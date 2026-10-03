/* =========================================================
   💾 IMPORT — Excel / CSV Import with Smart Detection
   ========================================================= */
(function() {
  'use strict';

  function initImportUI() {
    const dropZone = document.getElementById('importDropZone');
    const fileInput = document.getElementById('importFileInput');
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.style.borderColor = '#00A1E0';
      dropZone.style.background = '#EAF2FB';
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '#C9D4E4';
      dropZone.style.background = '#FBFCFE';
    });

    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.style.borderColor = '#C9D4E4';
      dropZone.style.background = '#FBFCFE';
      if (e.dataTransfer.files[0]) importHandleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) importHandleFile(e.target.files[0]);
    });
  }

  function importHandleFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        importParseRows(rows);
      } catch (err) {
        toast('Error reading file: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function importPasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.trim().split('\n');
      const headers = lines[0].split('\t').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const cells = line.split('\t');
        const obj = {};
        headers.forEach((h, i) => obj[h] = cells[i] ? cells[i].trim() : '');
        return obj;
      });
      importParseRows(rows);
    } catch (e) {
      toast('Cannot read clipboard. Paste into Excel first.', 'error');
    }
  }

  function normalizeHeader(h) {
    return String(h || '').toLowerCase().replace(/[\s_\-\(\)\[\]\.\/\\]/g, '').trim();
  }

  function importParseRows(rows) {
    if (!rows.length) { toast('No data found', 'error'); return; }
    console.log('📋 File headers:', Object.keys(rows[0]));

    const ALIASES_COMMON = {
      cell_name: ['cell', 'cellname', 'name', 'cell_name'],
      site: ['site', 'sitename', 'site_name', 'node', 'nodename', 'enodeb', 'gnodeb'],
      lat: ['lat', 'latitude', 'lattitude', 'y', 'ycoord'],
      long: ['long', 'lng', 'lon', 'longitude', 'x', 'xcoord'],
      bore: ['bore', 'azimuth', 'azm', 'az', 'bearing', 'heading', 'celldir', 'cell_dir', 'direction'],
      cell_radius: ['cellradiusm', 'cellradius', 'radius', 'radiusm', 'cell_radius'],
      height: ['height', 'antennaheight', 'antheight', 'hgt'],
      bw: ['bw', 'bandwidth', 'band_width']
    };

    const ALIASES_GSM = {
      bcch: ['bcch', 'bccharfcn', 'bcchno', 'bcchnumber'],
      bsic: ['bsic', 'bsiccode', 'nccbcc', 'colorcode'],
      tch: ['tch', 'tchfreq', 'tch_arfcn'],
      lac: ['lac', 'locationarea', 'locationareacode', 'lac_code'],
      hsn: ['hsn', 'hoppingsequencenumber', 'hopsequence', 'hopseq'],
      bsc: ['bsc', 'bscname', 'controller'],
      cell_id: ['ci', 'cellid', 'cell_id', 'cid', 'localcellid']
    };

    const ALIASES_LTE = {
      pci: ['pci', 'physicalcellid', 'physicalcellidentity', 'phycellid'],
      rsi: ['rsi', 'rootsequenceindex', 'rootseqindex'],
      cell_id: ['ci', 'cellid', 'cell_id', 'cid', 'localcellid']
    };

    const ALIASES_3G = {
      psc: ['psc', 'pscrambcode', 'scramblingcode', 'sccode'],
      downlink_uarfcn: ['downlinkuarfcn', 'dluarfcn', 'uarfcndl'],
      uplink_uarfcn: ['uplinkuarfcn', 'uluarfcn', 'uarfcnul'],
      rnc_id: ['rncid', 'rnc_id', 'rnc'],
      cpid: ['cpid', 'cellparameterid'],
      cell_id: ['cellid', 'cell_id', 'ci']
    };

    const ALIASES_NB = {};
    for (let i = 1; i <= 35; i++) {
      ALIASES_NB['nb' + i] = ['nb' + i, 'neighbor' + i, 'nbr' + i, 'nb_' + i];
    }

    function findVal(row, aliases) {
      if (!aliases) return '';
      const keys = Object.keys(row);
      for (const k of keys) {
        const nk = normalizeHeader(k);
        if (aliases.includes(nk)) return row[k];
      }
      for (const k of keys) {
        const nk = normalizeHeader(k);
        for (const a of aliases) {
          if (nk === a) return row[k];
          if (a.length >= 5 && nk.includes(a)) return row[k];
        }
      }
      return '';
    }

    const has = v => v !== '' && v !== null && v !== undefined;

    State.importPreviewData = rows.map(row => {
      const cellName = String(findVal(row, ALIASES_COMMON.cell_name) || '').trim();
      if (!cellName) return null;

      const nameUpper = cellName.toUpperCase();
      const is3G = nameUpper.startsWith('U');
      const isLTE = nameUpper.startsWith('L');
      const isGSM = !is3G && !isLTE;

      const lat = parseFloat(findVal(row, ALIASES_COMMON.lat)) || 0;
      const lng = parseFloat(findVal(row, ALIASES_COMMON.long)) || 0;
      if (!lat || !lng) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

      const siteVal = findVal(row, ALIASES_COMMON.site);
      const boreVal = findVal(row, ALIASES_COMMON.bore);
      const radiusVal = findVal(row, ALIASES_COMMON.cell_radius);
      const heightVal = findVal(row, ALIASES_COMMON.height);
      const bwVal = findVal(row, ALIASES_COMMON.bw);

      const result = {
        cell_name: cellName,
        site: String(siteVal || cellName.replace(/[A-Z]$/, '')).trim(),
        lat: lat,
        long: lng,
        bore: parseInt(boreVal) || 0,
        cell_radius: parseInt(radiusVal) || 5000,
        height: heightVal ? parseFloat(heightVal) : null,
        bw: bwVal ? parseFloat(bwVal) : null
      };

      if (is3G) {
        const psc = findVal(row, ALIASES_3G.psc);
        const dl = findVal(row, ALIASES_3G.downlink_uarfcn);
        const ul = findVal(row, ALIASES_3G.uplink_uarfcn);
        const rnc = findVal(row, ALIASES_3G.rnc_id);
        const cpid = findVal(row, ALIASES_3G.cpid);
        const ci = findVal(row, ALIASES_3G.cell_id);

        if (has(psc)) result.psc = parseInt(psc);
        if (has(dl)) result.downlink_uarfcn = parseInt(dl);
        if (has(ul)) result.uplink_uarfcn = parseInt(ul);
        if (has(rnc)) result.rnc_id = parseInt(rnc);
        if (has(cpid)) result.cpid = parseInt(cpid);
        if (has(ci)) result.cell_id = parseInt(ci);
      } else if (isLTE) {
        const pci = findVal(row, ALIASES_LTE.pci);
        const rsi = findVal(row, ALIASES_LTE.rsi);
        const ci = findVal(row, ALIASES_LTE.cell_id);

        if (has(pci)) result.pci = parseInt(pci);
        if (has(rsi)) result.rsi = parseInt(rsi);
        if (has(ci)) result.cell_id = parseInt(ci);
      } else {
        const bcch = findVal(row, ALIASES_GSM.bcch);
        const bsic = findVal(row, ALIASES_GSM.bsic);
        const tch = findVal(row, ALIASES_GSM.tch);
        const lac = findVal(row, ALIASES_GSM.lac);
        const hsn = findVal(row, ALIASES_GSM.hsn);
        const bsc = findVal(row, ALIASES_GSM.bsc);
        const ci = findVal(row, ALIASES_GSM.cell_id);

        if (has(bcch)) result.bcch = parseInt(bcch);
        if (has(bsic)) result.bsic = String(bsic).trim();
        if (has(tch)) result.tch = parseInt(tch);
        if (has(lac)) result.lac = parseInt(lac);
        if (has(hsn)) result.hsn = parseInt(hsn);
        if (has(bsc)) result.bsc = String(bsc).trim();
        if (has(ci)) result.cell_id = parseInt(ci);
      }

      for (let i = 1; i <= 35; i++) {
        const nbVal = findVal(row, ALIASES_NB['nb' + i]);
        if (nbVal) {
          const s = String(nbVal).trim();
          if (s && !s.startsWith('#')) result['nb' + i] = s;
        }
      }

      return result;
    }).filter(Boolean);

    if (!State.importPreviewData.length) {
      toast('No valid cells. Check Console (F12)', 'error', 6000);
      return;
    }

    console.log('✅ Parsed ' + State.importPreviewData.length + ' cells');
    importRenderPreview();
  }

  function importRenderPreview() {
    const previewCard = document.getElementById('importPreviewCard');
    if (previewCard) previewCard.style.display = 'block';

    const data = State.importPreviewData;
    const sample = data[0];
    const hasNb = sample.nb1 !== undefined || sample.nb2 !== undefined ||
                  Object.keys(sample).some(k => k.startsWith('nb'));

    const is3G = sample.psc !== null && sample.psc !== undefined;
    const isLTE = sample.pci !== null && sample.pci !== undefined && sample.pci > 0 && !is3G;
    const isGSM = !is3G && !isLTE && !hasNb;
    const isNBFile = hasNb && !is3G && !isLTE;

    const sites = new Set(data.map(r => r.site));
    const regions = new Set(data.map(r => {
      const m = (r.cell_name || '').match(/^[A-Z]+/);
      return m ? m[0] : null;
    }).filter(Boolean));

    let techLabel, techColor;
    if (isNBFile) { techLabel = 'Neighbor (NB)'; techColor = '#7C3AED'; }
    else if (is3G) { techLabel = '3G (UMTS)'; techColor = '#0EA5E9'; }
    else if (isGSM) { techLabel = 'GSM (2G)'; techColor = '#D97706'; }
    else if (isLTE) { techLabel = 'LTE (4G)'; techColor = '#124191'; }
    else { techLabel = 'Unknown'; techColor = '#5A6B87'; }

    const statsEl = document.getElementById('importPreviewStats');
    if (statsEl) {
      statsEl.innerHTML =
        '<div style="background:#EAF2FB;border-radius:10px;padding:14px;">' +
          '<div style="font-family:monospace;font-size:20px;font-weight:700;color:#0C1B3D;">' + data.length + '</div>' +
          '<div style="font-size:11.5px;color:#5A6B87;margin-top:2px;">Cells</div>' +
        '</div>' +
        '<div style="background:#EAF2FB;border-radius:10px;padding:14px;">' +
          '<div style="font-family:monospace;font-size:20px;font-weight:700;color:#0C1B3D;">' + sites.size + '</div>' +
          '<div style="font-size:11.5px;color:#5A6B87;margin-top:2px;">Sites</div>' +
        '</div>' +
        '<div style="background:#EAF2FB;border-radius:10px;padding:14px;">' +
          '<div style="font-family:monospace;font-size:20px;font-weight:700;color:#0C1B3D;">' + regions.size + '</div>' +
          '<div style="font-size:11.5px;color:#5A6B87;margin-top:2px;">Regions</div>' +
        '</div>' +
        '<div style="background:' + techColor + ';border-radius:10px;padding:14px;color:#fff;">' +
          '<div style="font-family:monospace;font-size:20px;font-weight:700;">' + techLabel + '</div>' +
          '<div style="font-size:11.5px;opacity:.85;margin-top:2px;">Detected Type</div>' +
        '</div>';
    }

    let columns;
    if (isNBFile) {
      columns = [
        { key: 'cell_name', label: 'Cell' }, { key: 'site', label: 'Site' },
        { key: 'lat', label: 'Lat' }, { key: 'long', label: 'Long' },
        { key: 'bore', label: 'Bore' },
        { key: 'nb1', label: 'NB1' }, { key: 'nb2', label: 'NB2' },
        { key: 'nb3', label: 'NB3' }, { key: 'nb4', label: 'NB4' }, { key: 'nb5', label: 'NB5' }
      ];
    } else if (is3G) {
      columns = [
        { key: 'cell_name', label: 'Cell' }, { key: 'site', label: 'Site' },
        { key: 'psc', label: 'PSC' },
        { key: 'downlink_uarfcn', label: 'DL UARFCN' },
        { key: 'uplink_uarfcn', label: 'UL UARFCN' },
        { key: 'rnc_id', label: 'RNC' },
        { key: 'bore', label: 'Bore' },
        { key: 'lat', label: 'Lat' }, { key: 'long', label: 'Long' }
      ];
    } else if (isLTE) {
      columns = [
        { key: 'cell_name', label: 'Cell' }, { key: 'site', label: 'Site' },
        { key: 'pci', label: 'PCI' }, { key: 'rsi', label: 'RSI' },
        { key: 'bore', label: 'Bore' }, { key: 'lat', label: 'Lat' }, { key: 'long', label: 'Long' }
      ];
    } else {
      columns = [
        { key: 'cell_name', label: 'Cell' }, { key: 'site', label: 'Site' },
        { key: 'bcch', label: 'BCCH' }, { key: 'bsic', label: 'BSIC' },
        { key: 'tch', label: 'TCH' }, { key: 'lac', label: 'LAC' },
        { key: 'bore', label: 'Bore' }, { key: 'lat', label: 'Lat' }, { key: 'long', label: 'Long' }
      ];
    }

    const preview = data.slice(0, 30);
    let html = '<table style="width:100%;border-collapse:collapse;font-size:12px;font-family:monospace;">';
    html += '<thead style="background:#EAF2FB;position:sticky;top:0;"><tr>';
    columns.forEach(col => {
      html += '<th style="padding:8px 10px;text-align:left;color:#124191;font-size:10.5px;">' + col.label + '</th>';
    });
    html += '</tr></thead><tbody>';
    preview.forEach(r => {
      html += '<tr style="border-bottom:1px solid #F0F3F9;">';
      columns.forEach(col => {
        let val = r[col.key];
        if (val === null || val === undefined) val = '—';
        html += '<td style="padding:7px 10px;">' + escapeHtml(String(val)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    if (data.length > 30) {
      html += '<div style="padding:10px;text-align:center;color:#5A6B87;font-size:11.5px;">... and ' + (data.length - 30) + ' more</div>';
    }

    const tableEl = document.getElementById('importPreviewTable');
    if (tableEl) tableEl.innerHTML = html;
  }

  function importClearPreview() {
    State.importPreviewData = [];
    const card = document.getElementById('importPreviewCard');
    if (card) card.style.display = 'none';
    const inp = document.getElementById('importFileInput');
    if (inp) inp.value = '';
  }

  async function importSaveToSupabase() {
    const projectId = document.getElementById('importProjectSelect').value;
    if (!projectId) { toast('Select a project first', 'error'); return; }
    if (!State.importPreviewData.length) { toast('No data to save', 'error'); return; }

    const btn = document.getElementById('importSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const cellsWithProject = State.importPreviewData.map(c => {
        const obj = { project_id: parseInt(projectId) };
        Object.keys(c).forEach(k => {
          if (c[k] !== null && c[k] !== undefined && c[k] !== '') obj[k] = c[k];
        });
        return obj;
      });

      const uniq = new Map();
      cellsWithProject.forEach(c => uniq.set(c.cell_name.toUpperCase() + '|' + c.project_id, c));
      const rowsToSave = [...uniq.values()];
      const duplicates = cellsWithProject.length - rowsToSave.length;
      if (duplicates > 0) toast('Skipped ' + duplicates + ' duplicates', 'info', 4000);

      const BATCH = 500;
      let saved = 0;
      for (let i = 0; i < rowsToSave.length; i += BATCH) {
        const batch = rowsToSave.slice(i, i + BATCH);
        const { error } = await db.from('rf_cells').upsert(batch, {
          onConflict: 'cell_name',
          ignoreDuplicates: false
        });
        if (error) throw error;
        saved += batch.length;
        btn.textContent = 'Saving ' + saved + '/' + rowsToSave.length + '...';
        await new Promise(r => setTimeout(r, 1000));
      }

      toast('Saved ' + saved + ' cells', 'success');
      importClearPreview();
      await loadProjects();
      await loadCells(false);
    } catch (e) {
      console.error('Save error:', e);
      toast('Error: ' + e.message, 'error', 6000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save to Supabase';
    }
  }

  window.initImportUI = initImportUI;
  window.importHandleFile = importHandleFile;
  window.importPasteFromClipboard = importPasteFromClipboard;
  window.importParseRows = importParseRows;
  window.importRenderPreview = importRenderPreview;
  window.importClearPreview = importClearPreview;
  window.importSaveToSupabase = importSaveToSupabase;

  window.addEventListener('pagesLoaded', initImportUI);

  console.log('✅ Import loaded');
})();
