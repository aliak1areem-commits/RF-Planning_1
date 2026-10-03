/* =========================================================
   🔗 NEIGHBOR SYMMETRY CHECKER
   ========================================================= */
(function() {
  'use strict';

  let symLastResults = null;

  function symGetNbList(cell) {
    const list = [];
    for (let i = 1; i <= 35; i++) {
      const val = cell['nb' + i];
      if (val && String(val).trim()) {
        list.push(String(val).trim().toUpperCase());
      }
    }
    return list;
  }

  function runSymmetryChecker() {
    const maxDist = parseInt(document.getElementById('sym_max_dist').value) || 5000;
    const tech = document.getElementById('sym_tech').value;

    let cells = State.allCells.filter(c => /[A-Z]$/.test(c.cell_name));
    if (tech !== 'all') cells = cells.filter(c => c.tech === tech);

    if (!cells.length) { toast('No cells to analyze', 'error'); return; }

    const cellMap = new Map();
    cells.forEach(c => cellMap.set(c.cell_name.toUpperCase(), c));

    const relations = [];
    const asymmetric = [];

    cells.forEach(cell => {
      const nbList = symGetNbList(cell);

      nbList.forEach(nbName => {
        const nbCell = cellMap.get(nbName);
        if (!nbCell) return;

        const dist = haversineDistance(cell.lat, cell.long, nbCell.lat, nbCell.long);
        if (dist > maxDist) return;

        const bearing = calculateBearing(cell.lat, cell.long, nbCell.lat, nbCell.long);
        const angleDiff = boreDifference(cell.bore, bearing);
        const direction = angleDiff <= 45 ? 'Front' : (angleDiff <= 120 ? 'Side' : 'Back');

        const reverseList = symGetNbList(nbCell);
        const reverseExists = reverseList.includes(cell.cell_name.toUpperCase());

        relations.push({
          source: cell.cell_name,
          neighbor: nbCell.cell_name,
          distance: dist,
          direction: direction,
          reverseExists: reverseExists,
          sourceCell: cell,
          neighborCell: nbCell
        });

        if (!reverseExists) {
          asymmetric.push({
            source: cell.cell_name,
            neighbor: nbCell.cell_name,
            distance: dist,
            direction: direction,
            sourceCell: cell,
            neighborCell: nbCell
          });
        }
      });
    });

    const symCount = relations.filter(r => r.reverseExists).length;

    symLastResults = {
      cells: cells,
      relations: relations,
      asymmetric: asymmetric,
      symmetricCount: symCount,
      maxDist: maxDist,
      tech: tech
    };

    renderSymmetryResults(symLastResults);
    document.getElementById('symResults').style.display = 'block';
    toast(relations.length + ' relations · ' + asymmetric.length + ' asymmetric', 'success', 5000);
  }

  function renderSymmetryResults(r) {
    document.getElementById('sym_kpi_total').textContent = r.cells.length;
    document.getElementById('sym_kpi_relations').textContent = r.relations.length;
    document.getElementById('sym_kpi_symmetric').textContent = r.symmetricCount;
    document.getElementById('sym_kpi_asymmetric').textContent = r.asymmetric.length;
    document.getElementById('sym_kpi_missing').textContent = r.asymmetric.length;

    const tbody = document.querySelector('#symTable tbody');
    if (!r.asymmetric.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#1F9D55;font-weight:600;">All relations are symmetric!</td></tr>';
      return;
    }

    tbody.innerHTML = r.asymmetric.slice(0, 500).map((a, idx) => {
      const dirBadge = a.direction === 'Front'
        ? '<span style="padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;background:#E7F7EE;color:#1F9D55;">Front</span>'
        : a.direction === 'Side'
        ? '<span style="padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;background:#FDF1DC;color:#8A5A00;">Side</span>'
        : '<span style="padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;background:#F4F7FB;color:#5A6B87;">Back</span>';

      return '<tr>' +
        '<td><b>' + escapeHtml(a.source) + '</b></td>' +
        '<td><b>' + escapeHtml(a.neighbor) + '</b></td>' +
        '<td>' + a.distance.toFixed(0) + '</td>' +
        '<td>' + dirBadge + '</td>' +
        '<td style="color:#B91C1C;font-weight:700;">Missing</td>' +
        '<td><button onclick="symFixOne(' + idx + ')" style="padding:4px 8px;background:#EAF2FB;color:#124191;border:1px solid #D7DEEA;border-radius:6px;font-size:10.5px;font-weight:600;cursor:pointer;font-family:inherit;">Fix</button></td>' +
      '</tr>';
    }).join('');

    if (r.asymmetric.length > 500) {
      tbody.innerHTML += '<tr><td colspan="6" style="text-align:center;padding:10px;color:#5A6B87;">... and ' + (r.asymmetric.length - 500) + ' more</td></tr>';
    }
  }

  async function symFixOne(idx) {
    if (!symLastResults) return;
    const item = symLastResults.asymmetric[idx];
    if (!item) return;

    const neighborCell = item.neighborCell;
    const sourceName = item.source;

    const emptySlots = [];
    for (let i = 1; i <= 35; i++) {
      const val = neighborCell['nb' + i];
      if (!val || !String(val).trim()) emptySlots.push('nb' + i);
    }

    if (!emptySlots.length) {
      toast('Neighbor "' + item.neighbor + '" has no empty NB slots', 'error', 5000);
      return;
    }

    const slot = emptySlots[0];
    if (!confirm('Add "' + sourceName + '" to ' + item.neighbor + ' as ' + slot.toUpperCase() + '?')) return;

    try {
      const update = {};
      update[slot] = sourceName;
      const { error } = await db.from('rf_cells').update(update).eq('id', neighborCell.id);
      if (error) throw error;

      neighborCell[slot] = sourceName;
      toast('Added ' + sourceName + ' -> ' + item.neighbor, 'success');
      if (typeof persistCellsCache === 'function') persistCellsCache();
      runSymmetryChecker();
    } catch (e) {
      console.error(e);
      toast('Error: ' + e.message, 'error');
    }
  }

  function clearSymmetryResults() {
    symLastResults = null;
    document.getElementById('symResults').style.display = 'none';
    toast('Cleared', 'info');
  }

  function symExportCSV() {
    if (!symLastResults) { toast('Run analysis first', 'error'); return; }

    const rows = [['Source', 'Neighbor', 'Distance (m)', 'Direction', 'Reverse Exists']];
    symLastResults.relations.forEach(r => {
      rows.push([r.source, r.neighbor, r.distance.toFixed(0), r.direction, r.reverseExists ? 'Yes' : 'No']);
    });

    downloadCSV('Symmetry_Report_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  function symShowOnMap() {
    if (!symLastResults) { toast('Run analysis first', 'error'); return; }

    window.__gsmMode = true;
    switchView('map');

    setTimeout(() => {
      window.symMapLayers = window.symMapLayers || [];
      symMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.symMapLayers = [];

      if (State.sectorLayer) State.sectorLayer.clearLayers();
      if (State.labelLayer) State.labelLayer.clearLayers();

      window.nbMapLayers = window.nbMapLayers || [];
      nbMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.nbMapLayers = [];

      const asym = symLastResults.asymmetric;
      const layersByCategory = {};
      const addToCategory = (cat, layer) => {
        if (!layersByCategory[cat]) layersByCategory[cat] = [];
        layersByCategory[cat].push(layer);
        nbMapLayers.push(layer);
        if (State.map && !State.map.hasLayer(layer)) State.map.addLayer(layer);
        return layer;
      };

      const shown = new Set();
      asym.forEach(item => {
        [item.sourceCell, item.neighborCell].forEach(cell => {
          if (shown.has(cell.id)) return;
          shown.add(cell.id);

          const coords = makeSectorCoordsScaled(cell.lat, cell.long, cell.bore, 1.0);
          const poly = L.polygon(coords, {
            color: '#DC2626', weight: 2, fillColor: '#DC2626', fillOpacity: 0.5
          });
          poly.bindPopup(
            '<div style="font-family:Inter,sans-serif;font-size:12.5px;min-width:220px;">' +
              '<div style="font-weight:800;font-family:monospace;margin-bottom:6px;">' + escapeHtml(cell.cell_name) + '</div>' +
              '<div style="color:#B91C1C;font-weight:700;">Has asymmetric relation</div>' +
            '</div>'
          );
          addToCategory('source', poly);
        });
      });

      asym.slice(0, 200).forEach(item => {
        const line = L.polyline([
          [item.sourceCell.lat, item.sourceCell.long],
          [item.neighborCell.lat, item.neighborCell.long]
        ], {
          color: '#DC2626', weight: 2, opacity: 0.7, dashArray: '8,6'
        });
        addToCategory('asym-line', line);
      });

      if (shown.size) {
        const points = [...shown].map(id => {
          const c = State.allCells.find(x => x.id === id);
          return c ? [c.lat, c.long] : null;
        }).filter(Boolean);

        if (points.length > 1) {
          State.map.fitBounds(L.latLngBounds(points), { padding: [60, 60] });
        }
      }

      const onToggle = () => {
        Object.entries(layersByCategory).forEach(([cat, layers]) => {
          const visible = ToolLegend.isActive(cat);
          layers.forEach(l => {
            if (visible) { if (!State.map.hasLayer(l)) State.map.addLayer(l); }
            else { if (State.map.hasLayer(l)) State.map.removeLayer(l); }
          });
        });
      };

      ToolLegend.show({
        icon: '🔗',
        title: 'Neighbor Symmetry · ' + asym.length,
        items: [
          { id: 'source', color: '#DC2626', label: 'Affected Cells', count: shown.size },
          { id: 'asym-line', color: '#DC2626', label: 'Asymmetric Relation', count: Math.min(asym.length, 200), dashed: true }
        ],
        onToggle: onToggle
      });

      toast(asym.length + ' asymmetric relations on map', 'success', 4000);
    }, 400);
  }

  window.runSymmetryChecker = runSymmetryChecker;
  window.symFixOne = symFixOne;
  window.clearSymmetryResults = clearSymmetryResults;
  window.symExportCSV = symExportCSV;
  window.symShowOnMap = symShowOnMap;

  console.log('✅ Neighbor symmetry loaded');
})();
