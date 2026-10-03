/* =========================================================
   📊 DASHBOARD — KPIs + Charts + Insights
   ========================================================= */
(function() {
  'use strict';

  let dashCharts = {};

  function dashRefreshAll() {
    renderDashboard();
    toast('Dashboard refreshed', 'success', 2000);
  }

  function resetDashboardFilters() {
    const t = document.getElementById('dashFilterTech');
    const b = document.getElementById('dashFilterBand');
    const r = document.getElementById('dashFilterRegion');
    if (t) t.value = 'all';
    if (b) b.value = 'all';
    if (r) r.value = 'all';
    renderDashboard();
  }

  function dashGetFilteredCells() {
    const tech = document.getElementById('dashFilterTech')?.value || 'all';
    const band = document.getElementById('dashFilterBand')?.value || 'all';
    const region = document.getElementById('dashFilterRegion')?.value || 'all';

    let cells = State.allCells.filter(c => /[A-Z]$/.test(c.cell_name));
    if (tech !== 'all') cells = cells.filter(c => c.tech === tech);
    if (band !== 'all') cells = cells.filter(c => String(c.gsmBand) === band);
    if (region !== 'all') cells = cells.filter(c => c.region === region);
    return cells;
  }

  function renderDashboard() {
    const mainKPI = document.getElementById('dashMainKPI');
    if (!mainKPI) return;

    if (!State.allCells.length) {
      mainKPI.innerHTML =
        '<div style="grid-column:1/-1;background:#fff;border-radius:12px;padding:40px;text-align:center;color:#5A6B87;">' +
          '<div style="font-size:48px;margin-bottom:12px;">📊</div><p>Loading cells...</p>' +
        '</div>';
      return;
    }

    populateDashFilters();
    const cells = dashGetFilteredCells();

    const totalCells = cells.length;
    const sites = new Set(cells.map(c => c.site)).size;
    const regions = new Set(cells.map(c => c.region)).size;
    const avgSectorsPerSite = sites > 0 ? (totalCells / sites).toFixed(1) : 0;

    mainKPI.innerHTML =
      dashKpi('Total Cells', totalCells, '#124191') +
      dashKpi('Sites', sites, '#00A1E0') +
      dashKpi('Regions', regions, '#1F9D55') +
      dashKpi('Avg Cells/Site', avgSectorsPerSite, '#7C3AED');

    // Tech breakdown
    const techCounts = {
      'GSM-900': 0, 'GSM-1800': 0,
      '3G-900': 0, '3G-2100': 0,
      'LTE': 0, 'Unknown': 0
    };
    cells.forEach(c => {
      if (c.tech === 'GSM') {
        if (c.gsmBand === '900') techCounts['GSM-900']++;
        else if (c.gsmBand === '1800') techCounts['GSM-1800']++;
        else techCounts['Unknown']++;
      } else if (c.tech === '3G') {
        if (c.gsmBand === '900') techCounts['3G-900']++;
        else if (c.gsmBand === '2100') techCounts['3G-2100']++;
        else techCounts['Unknown']++;
      } else if (c.tech === 'LTE') techCounts['LTE']++;
    });

    const techColors = {
      'GSM-900': '#D97706', 'GSM-1800': '#7C3AED',
      '3G-900': '#14B8A6', '3G-2100': '#0D9488',
      'LTE': '#124191', 'Unknown': '#94A3B8'
    };

    const techBreakdown = document.getElementById('dashTechBreakdown');
    if (techBreakdown) {
      techBreakdown.innerHTML =
        '<div style="font-size:13px;font-weight:800;color:#0C1B3D;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;">Technology Breakdown</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">' +
          Object.entries(techCounts).map(([k, v]) => {
            const pct = totalCells ? ((v / totalCells) * 100).toFixed(1) : 0;
            return '<div style="background:#F9FBFE;border-radius:10px;padding:14px;border-left:4px solid ' + techColors[k] + ';">' +
              '<div style="font-size:11px;font-weight:700;color:#5A6B87;text-transform:uppercase;">' + k + '</div>' +
              '<div style="font-family:monospace;font-size:22px;font-weight:800;color:' + techColors[k] + ';margin-top:4px;">' + v + '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:2px;">' + pct + '% of total</div>' +
            '</div>';
          }).join('') +
        '</div>';
    }

    // Conflicts
    const lteCells = cells.filter(c => c.tech === 'LTE' && c.pci != null);
    const gsmCells = cells.filter(c => c.tech === 'GSM');
    const g3Cells = cells.filter(c => c.tech === '3G');

    const pciConflicts = dashCountClashes(lteCells, c => c.pci, 5000);
    const pscConflicts = dashCountClashes(g3Cells.filter(c => c.psc != null), c => c.gsmBand + '|' + c.psc, 2000);
    const bsicConflicts = dashCountClashes(gsmCells.filter(c => c.bsic), c => c.bcch + '-' + c.bsic, 10000);
    const gsmNoBcch = gsmCells.filter(c => !c.bcch).length;
    const g3NoPsc = g3Cells.filter(c => c.psc == null).length;
    const lteNoPci = cells.filter(c => c.tech === 'LTE' && c.pci == null).length;

    const conflictsEl = document.getElementById('dashConflicts');
    if (conflictsEl) {
      conflictsEl.innerHTML =
        '<div style="font-size:13px;font-weight:800;color:#0C1B3D;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;">Conflict Summary</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">' +
          dashConflictCard('PCI Conflicts', pciConflicts, 'LTE cells', pciConflicts > 0) +
          dashConflictCard('PSC Conflicts', pscConflicts, '3G cells', pscConflicts > 0) +
          dashConflictCard('BSIC Conflicts', bsicConflicts, 'GSM cells', bsicConflicts > 0) +
          dashConflictCard('GSM w/o BCCH', gsmNoBcch, 'GSM cells', gsmNoBcch > 0) +
          dashConflictCard('3G w/o PSC', g3NoPsc, '3G cells', g3NoPsc > 0) +
          dashConflictCard('LTE w/o PCI', lteNoPci, 'LTE cells', lteNoPci > 0) +
        '</div>';
    }

    // Neighbors
    const nbBox = document.getElementById('dashNeighbors');
    if (nbBox) {
      nbBox.innerHTML = '<div style="text-align:center;color:#5A6B87;padding:20px;font-size:13px;">Loading neighbor counts...</div>';
      dashLoadNbCounts().then(n => {
        const total = n.inter + n.intra + n.irat;
        const avg = g3Cells.length ? (total / g3Cells.length).toFixed(1) : 0;
        nbBox.innerHTML =
          '<div style="font-size:13px;font-weight:800;color:#0C1B3D;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;">3G Neighbor Relations</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">' +
            dashNbCard('Inter-Freq', n.inter, '#2563EB') +
            dashNbCard('Intra-Freq', n.intra, '#16A34A') +
            dashNbCard('IRAT (3G→2G)', n.irat, '#8B5CF6') +
            dashNbCard('Total', total, '#124191') +
            dashNbCard('Avg / 3G Cell', avg, '#F2A900') +
          '</div>';
      }).catch(() => { nbBox.innerHTML = ''; });
    }

    // Data Quality
    const dqItems = [
      { label: 'Cells with Name', value: cells.filter(c => c.cell_name).length, total: totalCells },
      { label: 'Cells with Coords', value: cells.filter(c => c.lat && c.long).length, total: totalCells },
      { label: 'Cells with Azimuth', value: cells.filter(c => c.bore != null).length, total: totalCells },
      { label: 'Cells with Height', value: cells.filter(c => c.height).length, total: totalCells },
      { label: 'Cells with Site', value: cells.filter(c => c.site).length, total: totalCells }
    ];

    const dqEl = document.getElementById('dashDataQuality');
    if (dqEl) {
      dqEl.innerHTML =
        '<div style="font-size:13px;font-weight:800;color:#0C1B3D;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;">Data Quality</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">' +
          dqItems.map(item => {
            const pct = item.total ? ((item.value / item.total) * 100).toFixed(1) : 0;
            const color = pct >= 95 ? '#1F9D55' : (pct >= 80 ? '#F2A900' : '#D64545');
            return '<div style="background:#F9FBFE;border-radius:10px;padding:14px;">' +
              '<div style="display:flex;justify-content:space-between;margin-bottom:8px;">' +
                '<span style="font-size:11.5px;font-weight:700;color:#5A6B87;">' + item.label + '</span>' +
                '<span style="font-family:monospace;font-size:12px;font-weight:800;color:' + color + ';">' + pct + '%</span>' +
              '</div>' +
              '<div style="height:6px;background:#E9EEF6;border-radius:3px;overflow:hidden;">' +
                '<div style="height:100%;width:' + pct + '%;background:' + color + ';"></div>' +
              '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:4px;">' + item.value + ' / ' + item.total + '</div>' +
            '</div>';
          }).join('') +
        '</div>';
    }

    // Charts
    dashChartTech(techCounts, totalCells);
    dashChartRegion(cells);
    dashChartSites(cells);
    dashChartSector(cells);

    // Insights
    dashRenderInsights(cells, pciConflicts, pscConflicts, bsicConflicts, gsmNoBcch, g3NoPsc, lteNoPci);
  }

  function dashCountClashes(cells, keyFn, radiusM) {
    const groups = new Map();
    cells.forEach(c => {
      const k = keyFn(c);
      if (k == null) return;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    });
    let pairs = 0;
    groups.forEach(list => {
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++)
          if (haversineDistance(list[i].lat, list[i].long, list[j].lat, list[j].long) <= radiusM) pairs++;
    });
    return pairs;
  }

  async function dashLoadNbCounts() {
    const out = {};
    for (const t of ['inter', 'intra', 'irat']) {
      let q = db.from('rf_neighbors').select('id', { count: 'exact', head: true }).eq('relation_type', t);
      if (State.currentProjectId) q = q.eq('project_id', State.currentProjectId);
      const { count } = await q;
      out[t] = count || 0;
    }
    return out;
  }

  function dashKpi(label, value, color) {
    return '<div style="background:#fff;border-radius:12px;padding:18px 20px;border:1px solid #E9EEF6;box-shadow:0 2px 8px rgba(12,27,61,.04);">' +
      '<div style="font-size:11px;font-weight:700;color:#5A6B87;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">' + label + '</div>' +
      '<div style="font-family:monospace;font-size:32px;font-weight:800;color:' + color + ';line-height:1;">' + value + '</div>' +
    '</div>';
  }

  function dashConflictCard(label, value, subtext, warn) {
    const color = warn ? '#D64545' : '#1F9D55';
    return '<div style="background:' + (warn ? '#FCEAEA' : '#E7F7EE') + ';border-radius:10px;padding:14px;">' +
      '<div style="font-size:11.5px;font-weight:700;color:#5A6B87;">' + label + '</div>' +
      '<div style="font-family:monospace;font-size:26px;font-weight:800;color:' + color + ';margin-top:6px;">' + value + '</div>' +
      '<div style="font-size:10.5px;color:#94A3B8;margin-top:2px;">' + subtext + '</div>' +
    '</div>';
  }

  function dashNbCard(label, value, color) {
    return '<div style="background:#F9FBFE;border-radius:10px;padding:14px;border-left:4px solid ' + color + ';">' +
      '<div style="font-size:11.5px;font-weight:700;color:#5A6B87;">' + label + '</div>' +
      '<div style="font-family:monospace;font-size:24px;font-weight:800;color:' + color + ';margin-top:6px;">' + value + '</div>' +
    '</div>';
  }

  function populateDashFilters() {
    const regionSel = document.getElementById('dashFilterRegion');
    if (regionSel && regionSel.options.length <= 1) {
      const regions = [...new Set(State.allCells.map(c => c.region))].sort();
      regionSel.innerHTML = '<option value="all">All Regions</option>' +
        regions.map(r => '<option value="' + r + '">' + r + '</option>').join('');
    }
  }

  function destroyChart(id) {
    if (dashCharts[id]) {
      dashCharts[id].destroy();
      delete dashCharts[id];
    }
  }

  function dashChartTech(techCounts, total) {
    destroyChart('tech');
    const ctx = document.getElementById('chartTech');
    if (!ctx || typeof Chart === 'undefined') return;

    const entries = Object.entries(techCounts).filter(([k, v]) => v > 0);
    const colors = {
      'GSM-900': '#D97706', 'GSM-1800': '#7C3AED',
      '3G-900': '#14B8A6', '3G-2100': '#0D9488',
      'LTE': '#124191', 'Unknown': '#94A3B8'
    };

    dashCharts.tech = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          data: entries.map(e => e[1]),
          backgroundColor: entries.map(e => colors[e[0]] || '#94A3B8'),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, padding: 12 } }
        }
      }
    });
  }

  function dashChartRegion(cells) {
    const counts = {};
    cells.forEach(c => { counts[c.region] = (counts[c.region] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);

    destroyChart('region');
    const ctx = document.getElementById('chartRegion');
    if (!ctx || typeof Chart === 'undefined') return;

    dashCharts.region = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(e => e[0]),
        datasets: [{
          label: 'Cells',
          data: sorted.map(e => e[1]),
          backgroundColor: '#00A1E0',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { font: { family: 'Inter', size: 10 } } },
          x: { ticks: { font: { family: 'Inter', size: 9 } } }
        }
      }
    });
  }

  function dashChartSites(cells) {
    const counts = {};
    cells.forEach(c => { counts[c.site] = (counts[c.site] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    destroyChart('sites');
    const ctx = document.getElementById('chartSites');
    if (!ctx || typeof Chart === 'undefined') return;

    dashCharts.sites = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(e => e[0]),
        datasets: [{
          label: 'Cells',
          data: sorted.map(e => e[1]),
          backgroundColor: '#7C3AED',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { font: { family: 'Inter', size: 10 } } },
          y: { ticks: { font: { family: 'monospace', size: 10 } } }
        }
      }
    });
  }

  function dashChartSector(cells) {
    const counts = {};
    cells.forEach(c => { counts[c.sector] = (counts[c.sector] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    destroyChart('sector');
    const ctx = document.getElementById('chartSector');
    if (!ctx || typeof Chart === 'undefined') return;

    dashCharts.sector = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: sorted.map(e => 'Sector ' + e[0]),
        datasets: [{
          data: sorted.map(e => e[1]),
          backgroundColor: ['#124191', '#1F9D55', '#D64545', '#F2A900', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 } } } }
      }
    });
  }

  function dashRenderInsights(cells, pciConf, pscConf, bsicConf, gsmNoBcch, g3NoPsc, lteNoPci) {
    const el = document.getElementById('dashInsights');
    if (!el) return;

    const insights = [];
    const totalConflicts = pciConf + pscConf + bsicConf;

    if (totalConflicts === 0) {
      insights.push({
        color: '#1F9D55', title: 'Network is Clean',
        text: 'No conflicts detected across all technologies.'
      });
    } else {
      insights.push({
        color: totalConflicts > 20 ? '#D64545' : '#F2A900',
        title: 'Conflicts Detected',
        text: 'Found <b>' + totalConflicts + '</b> total conflicts: ' +
              pciConf + ' PCI · ' + pscConf + ' PSC · ' + bsicConf + ' BSIC.'
      });
    }

    const missing = gsmNoBcch + g3NoPsc + lteNoPci;
    if (missing > 0) {
      insights.push({
        color: '#F2A900', title: 'Missing Values',
        text: '<b>' + gsmNoBcch + '</b> GSM without BCCH · ' +
              '<b>' + g3NoPsc + '</b> 3G without PSC · ' +
              '<b>' + lteNoPci + '</b> LTE without PCI.'
      });
    }

    insights.push({
      color: '#00A1E0', title: 'Recommended Actions',
      text: (pciConf > 0 ? '1. Fix PCI conflicts. ' : '') +
            (pscConf > 0 ? '2. Fix PSC conflicts. ' : '') +
            (bsicConf > 0 ? '3. Fix BSIC conflicts. ' : '') +
            (missing > 0 ? '4. Assign missing values. ' : '') +
            '5. Run Neighbor Analysis.'
    });

    el.innerHTML =
      '<div style="font-size:13px;font-weight:800;color:#0C1B3D;text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px;">Smart Insights</div>' +
      insights.map(i =>
        '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #F0F3F9;">' +
          '<div style="flex:1;font-size:13px;line-height:1.55;color:#1B1F2A;">' +
            '<b style="color:' + i.color + ';">' + i.title + ':</b> ' + i.text +
          '</div>' +
        '</div>'
      ).join('');
  }

  function dashExport() {
    const cells = dashGetFilteredCells();
    const rows = [['Cell Name', 'Tech', 'Band', 'Site', 'Region', 'PCI', 'PSC', 'BCCH', 'BSIC', 'HSN']];
    cells.forEach(c => {
      rows.push([c.cell_name, c.tech, c.gsmBand || '', c.site, c.region,
                 c.pci || '', c.psc || '', c.bcch || '', c.bsic || '',
                 c.hsn != null ? c.hsn : '']);
    });
    downloadCSV('Dashboard_Export_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('Report exported: ' + cells.length + ' cells', 'success');
  }

  window.renderDashboard = renderDashboard;
  window.dashRefreshAll = dashRefreshAll;
  window.resetDashboardFilters = resetDashboardFilters;
  window.dashExport = dashExport;

  console.log('✅ Dashboard loaded');
})();
