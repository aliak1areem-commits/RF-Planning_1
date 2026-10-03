/* =========================================================
   🏗️ NEW SITE PLANNER PRO
   ========================================================= */
(function() {
  'use strict';

  let nsLastPlan = null;

  function nsSwitchTab(name) {
    document.querySelectorAll('#page-tool-new-site .nb-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#page-tool-new-site .nb-tab-content').forEach(c => c.classList.remove('active'));

    const btn = document.querySelector('#page-tool-new-site .nb-tab[data-nstab="' + name + '"]');
    if (btn) btn.classList.add('active');
    const content = document.getElementById('ns_tab_' + name);
    if (content) content.classList.add('active');
  }

  function nsUpdateSectors() {
    const n = parseInt(document.getElementById('ns_num_sectors').value);
    const container = document.getElementById('ns_sectors_container');
    if (!container) return;

    const defaultAz = {
      1: [0], 2: [0, 180], 3: [0, 120, 240],
      4: [0, 90, 180, 270], 6: [0, 60, 120, 180, 240, 300]
    };
    const sectors = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);
    const azimuths = defaultAz[n] || [0, 120, 240];

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">';
    sectors.forEach((s, i) => {
      html += '<div style="background:#F9FBFE;padding:14px;border-radius:10px;border:1px solid #E9EEF6;">' +
        '<div style="font-size:13px;font-weight:800;color:#124191;margin-bottom:8px;">Sector ' + s + '</div>' +
        '<label style="font-size:11px;color:#5A6B87;font-weight:700;display:block;margin-bottom:4px;">Azimuth (deg)</label>' +
        '<input type="number" id="ns_az_' + s + '" value="' + azimuths[i] + '" min="0" max="360" style="width:100%;padding:8px;border:1.5px solid #D7DEEA;border-radius:8px;font-family:monospace;font-size:14px;font-weight:700;">' +
      '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function nsSuggestAzimuths() {
    const lat = parseFloat(document.getElementById('ns_lat').value);
    const lng = parseFloat(document.getElementById('ns_long').value);
    const radius = parseInt(document.getElementById('ns_radius').value) || 5000;
    const n = parseInt(document.getElementById('ns_num_sectors').value);

    if (isNaN(lat) || isNaN(lng)) { toast('Enter coordinates first', 'error'); return; }

    const nearby = State.allCells.filter(c => {
      if (!c.lat || !c.long) return false;
      return haversineDistance(lat, lng, c.lat, c.long) <= radius;
    });

    if (nearby.length < 5) { toast('Not enough neighbors to suggest', 'error'); return; }

    const buckets = new Array(36).fill(0);
    nearby.forEach(c => {
      const bearing = calculateBearing(lat, lng, c.lat, c.long);
      const d = haversineDistance(lat, lng, c.lat, c.long);
      const weight = 1 / (1 + d / 1000);
      buckets[Math.floor(bearing / 10) % 36] += weight;
    });

    const ranked = buckets
      .map((score, idx) => ({ idx, score }))
      .sort((a, b) => b.score - a.score);

    const minSepDeg = 360 / n;
    const minSepBuckets = Math.floor(minSepDeg / 10);

    const picked = [];
    for (const cand of ranked) {
      let tooClose = false;
      for (const p of picked) {
        let diff = Math.abs(cand.idx - p.idx);
        if (diff > 18) diff = 36 - diff;
        if (diff < minSepBuckets) { tooClose = true; break; }
      }
      if (tooClose) continue;
      picked.push(cand);
      if (picked.length >= n) break;
    }

    if (picked.length < n) {
      for (const cand of ranked) {
        if (picked.find(p => p.idx === cand.idx)) continue;
        picked.push(cand);
        if (picked.length >= n) break;
      }
    }

    const suggested = picked.map(p => p.idx * 10 + 5).sort((a, b) => a - b);
    const sectors = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);

    sectors.forEach((s, i) => {
      const el = document.getElementById('ns_az_' + s);
      if (el) el.value = suggested[i];
    });

    toast('Suggested azimuths based on ' + nearby.length + ' neighbors', 'success', 4000);
  }

  function nsGet2GLetter(sector, band) {
    const idx = ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(sector);
    if (idx < 0) return sector;
    return band === '900'
      ? ['A', 'B', 'C', 'G', 'H', 'I'][idx]
      : ['D', 'E', 'F', 'J', 'K', 'L'][idx];
  }

  function nsGet3GLetter(sector, band) {
    if (band === '2100') return sector;
    const map = { A: 'G', B: 'H', C: 'I', D: 'J', E: 'K', F: 'L' };
    return map[sector] || sector;
  }

  function nsPlan2GCell(cellName, lat, lng, az, height, band, nearby2G, usedBcch, usedBsic, usedBcchBsic) {
    const range = GSM_BAND_ARFCN[band] || { from: 34, to: 46 };

    const allCandidates = [];
    for (let f = range.from; f <= range.to; f++) allCandidates.push(f);

    let candidates = allCandidates.filter(f => !usedBcch.has(f));
    if (candidates.length === 0) candidates = allCandidates;

    const bcchScores = candidates.map(freq => {
      let score = 10000;

      nearby2G.forEach(c => {
        if (c.gsmBand !== band || c.bcch == null) return;
        const d = haversineDistance(lat, lng, c.lat, c.long);
        if (d > 15000) return;

        const bearing = calculateBearing(lat, lng, c.lat, c.long);
        const angleDiff = boreDifference(az, bearing);
        const distW = Math.exp(-d / 800) * 50000;
        let angleW = 1.0;
        if (angleDiff <= 30) angleW = 2.0;
        else if (angleDiff <= 60) angleW = 1.5;
        else if (angleDiff <= 90) angleW = 1.0;
        else if (angleDiff <= 150) angleW = 0.4;
        else angleW = 0.15;
        const w = distW * angleW;

        if (c.bcch === freq) {
          let p = w;
          if (d < 300) p *= 5;
          else if (d < 1000) p *= 2;
          score -= p;
        } else if (Math.abs(c.bcch - freq) === 1) {
          score -= w * 0.3;
        }
      });

      score += Math.random() * 200;
      return { freq, score };
    });

    bcchScores.sort((a, b) => b.score - a.score);
    const bcch = bcchScores[0].freq;

    const allBsics = [];
    for (let ncc = 0; ncc < 8; ncc++) {
      for (let bcc = 0; bcc < 8; bcc++) allBsics.push(String(ncc) + String(bcc));
    }

    const clashBsics = new Set(
      nearby2G
        .filter(c => c.gsmBand === band && c.bcch === bcch && c.bsic &&
                     haversineDistance(lat, lng, c.lat, c.long) <= 3000)
        .map(c => c.bsic)
    );

    let bsicCandidates = allBsics.filter(b =>
      !usedBcchBsic.has(bcch + '_' + b) && !clashBsics.has(b));
    if (bsicCandidates.length === 0)
      bsicCandidates = allBsics.filter(b => !usedBcchBsic.has(bcch + '_' + b));
    if (bsicCandidates.length === 0) bsicCandidates = allBsics;

    const bsicScores = bsicCandidates.map(b => {
      let score = 10000;

      nearby2G.forEach(c => {
        if (c.gsmBand !== band || c.bcch !== bcch || c.bsic !== b) return;
        const d = haversineDistance(lat, lng, c.lat, c.long);
        const bearing = calculateBearing(lat, lng, c.lat, c.long);
        const angleDiff = boreDifference(az, bearing);
        const distW = Math.exp(-d / 800) * 60000;
        const angleW = angleDiff <= 30 ? 2.5 : (angleDiff <= 60 ? 1.8 : (angleDiff <= 90 ? 1.0 : 0.2));
        score -= distW * angleW;
      });

      score += Math.random() * 10000;
      return { b, score };
    });

    bsicScores.sort((a, b) => b.score - a.score);
    const bsic = bsicScores[0].b;

    return {
      cell_name: cellName, tech: 'GSM', band: band,
      lat, long: lng, bore: az, height, cell_radius: 5000,
      bcch, tch: null, bsic, status: 'planned'
    };
  }

  function nsPlan3GCell(cellName, lat, lng, az, height, band, nearby3G, usedPsc) {
    const uarfcn = band === '900' ? { dl: 3012, ul: 2787 } : { dl: 10700, ul: 9750 };

    const allCands = [];
    for (let p = 0; p <= 511; p++) allCands.push(p);

    let candidates = allCands.filter(p => !usedPsc.has(p));
    if (candidates.length === 0) candidates = allCands;

    const scores = candidates.map(p => {
      let score = 10000;
      nearby3G.forEach(c => {
        if (c.gsmBand !== band || c.psc == null || c.psc !== p) return;
        const d = haversineDistance(lat, lng, c.lat, c.long);
        if (d > 15000) return;
        const bearing = calculateBearing(lat, lng, c.lat, c.long);
        const angleDiff = boreDifference(az, bearing);
        const distW = Math.exp(-d / 800) * 50000;
        const angleW = angleDiff <= 30 ? 2.0 : (angleDiff <= 60 ? 1.5 : (angleDiff <= 90 ? 1.0 : 0.15));
        let penalty = distW * angleW;
        if (d < 300) penalty *= 5;
        else if (d < 1000) penalty *= 2;
        score -= penalty;
      });
      score += Math.random() * 1000;
      return { p, score };
    });

    scores.sort((a, b) => b.score - a.score);
    const psc = scores[0].p;

    const nearest3G = nearby3G.length ? nearby3G.reduce((a, b) =>
      haversineDistance(lat, lng, a.lat, a.long) < haversineDistance(lat, lng, b.lat, b.long) ? a : b) : null;

    return {
      cell_name: cellName, tech: '3G', band: band,
      lat, long: lng, bore: az, height, cell_radius: 5000,
      psc, uarfcn_dl: uarfcn.dl, uarfcn_ul: uarfcn.ul,
      rnc_id: nearest3G ? nearest3G.rnc_id : 7,
      status: 'planned'
    };
  }

  function nsPlan4GCell(cellName, lat, lng, az, height, nearby4G, usedPci, usedRsi) {
    const allCands = [];
    for (let p = 0; p <= 503; p++) allCands.push(p);

    const usedMod3 = new Set([...usedPci].map(u => u % 3));
    let candidates = allCands.filter(p => !usedPci.has(p) && !usedMod3.has(p % 3));
    if (candidates.length === 0) candidates = allCands.filter(p => !usedPci.has(p));
    if (candidates.length === 0) candidates = allCands;

    const scores = candidates.map(p => {
      let score = 10000;
      nearby4G.forEach(c => {
        if (c.pci == null) return;
        const d = haversineDistance(lat, lng, c.lat, c.long);
        if (d > 15000) return;
        const bearing = calculateBearing(lat, lng, c.lat, c.long);
        const angleDiff = boreDifference(az, bearing);
        const distW = Math.exp(-d / 800) * 50000;
        const angleW = angleDiff <= 30 ? 2.0 : (angleDiff <= 60 ? 1.5 : (angleDiff <= 90 ? 1.0 : 0.3));

        if (c.pci === p) {
          let pen = distW * angleW;
          if (d < 300) pen *= 5;
          else if (d < 1000) pen *= 2;
          score -= pen;
        }
        if (c.pci % 3 === p % 3 && d < 3000) {
          score -= Math.exp(-d / 1500) * 10000 * (angleDiff <= 60 ? 1.5 : 1.0);
        }
        if (c.pci % 6 === p % 6 && d < 1000) {
          score -= Math.exp(-d / 800) * 3000;
        }
      });
      score += Math.random() * 1000;
      return { p, score };
    });

    scores.sort((a, b) => b.score - a.score);
    const pci = scores[0].p;

    const usedRsisSet = new Set();
    nearby4G.forEach(c => {
      if (c.rsi != null && c.rsi > 0) {
        const d = haversineDistance(lat, lng, c.lat, c.long);
        if (d < 3000) usedRsisSet.add(c.rsi);
      }
    });
    usedRsi.forEach(r => { if (r > 0) usedRsisSet.add(r); });

    const RSI_STEP = 10;
    const validRsi = [];
    for (let r = 1; r <= 837; r++) {
      let ok = true;
      for (const u of usedRsisSet) {
        if (Math.abs(u - r) < RSI_STEP) { ok = false; break; }
      }
      if (ok) validRsi.push(r);
    }

    const rsi = validRsi.length
      ? validRsi[Math.floor(Math.random() * validRsi.length)]
      : 1;

    return {
      cell_name: cellName, tech: 'LTE', band: '4G',
      lat, long: lng, bore: az, height, cell_radius: 5000,
      pci, rsi, status: 'planned'
    };
  }

  function nsPlanNeighbors(newCells, nearby, radius, opts) {
    const neighbors = [];
    const seen = new Set();

    const newAsPool = newCells.map(c => ({
      cell_name: c.cell_name, tech: c.tech, gsmBand: c.band,
      lat: c.lat, long: c.long, bore: c.bore
    }));
    const pool = nearby.concat(newAsPool);

    const add = (src, dst, type, dist) => {
      const key = src + '->' + type + '->' + dst;
      if (src === dst || seen.has(key)) return;
      seen.add(key);
      neighbors.push({ source_cell: src, neighbor_cell: dst, relation_type: type, distance: dist });
    };

    const score = (nc, c, thr, weights) => {
      const d = haversineDistance(nc.lat, nc.long, c.lat, c.long);
      const bearing = calculateBearing(nc.lat, nc.long, c.lat, c.long);
      const angleDiff = boreDifference(nc.bore, bearing);
      const distScore = Math.max(0, 1 - d / radius);
      const angleScore = angleDiff <= thr ? 1 : (angleDiff <= 120 ? 0.5 : 0.1);
      return { cell: c, dist: d, angleDiff, score: distScore * weights[0] + angleScore * weights[1] };
    };

    newCells.filter(c => c.tech === 'GSM' || c.tech === '3G').forEach(nc => {
      pool.filter(c => c.tech === nc.tech && c.cell_name !== nc.cell_name)
        .map(c => score(nc, c, opts.frontThr, [0.6, 0.4]))
        .sort((a, b) => b.score - a.score)
        .slice(0, opts.maxNb)
        .forEach(x => {
          const type = nc.tech === 'GSM' ? 'gsm'
                     : (nc.band === x.cell.gsmBand ? 'intra' : 'inter');
          add(nc.cell_name, x.cell.cell_name, type, x.dist);
          if (opts.bidir) add(x.cell.cell_name, nc.cell_name, type, x.dist);
        });
    });

    newCells.filter(c => c.tech === '3G').forEach(nc => {
      pool.filter(c => c.tech === 'GSM')
        .map(c => score(nc, c, opts.iratThr, [0.7, 0.3]))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .forEach(x => add(nc.cell_name, x.cell.cell_name, 'irat', x.dist));
    });

    return neighbors;
  }

  function nsCheckConflicts(cells, nearby) {
    const conflicts = [];
    cells.forEach(cell => {
      if (cell.tech === 'GSM') {
        const sameBcchCells = nearby.filter(c =>
          c.gsmBand === cell.band && c.bcch === cell.bcch);
        if (sameBcchCells.length) {
          const nearest = sameBcchCells.reduce((a, b) =>
            haversineDistance(cell.lat, cell.long, a.lat, a.long) <
            haversineDistance(cell.lat, cell.long, b.lat, b.long) ? a : b);
          const dist = haversineDistance(cell.lat, cell.long, nearest.lat, nearest.long);
          if (dist < 500) {
            conflicts.push({ level: 'HIGH', cell: cell.cell_name, type: 'BCCH', value: cell.bcch,
              message: 'Same BCCH ' + cell.bcch + ' at ' + dist.toFixed(0) + 'm from ' + nearest.cell_name });
          } else if (dist < 2000) {
            conflicts.push({ level: 'MEDIUM', cell: cell.cell_name, type: 'BCCH', value: cell.bcch,
              message: 'Same BCCH at ' + dist.toFixed(0) + 'm' });
          }
        }
      }
      if (cell.tech === '3G') {
        const samePsc = nearby.filter(c => c.gsmBand === cell.band && c.psc === cell.psc);
        if (samePsc.length) {
          const nearest = samePsc.reduce((a, b) =>
            haversineDistance(cell.lat, cell.long, a.lat, a.long) <
            haversineDistance(cell.lat, cell.long, b.lat, b.long) ? a : b);
          const dist = haversineDistance(cell.lat, cell.long, nearest.lat, nearest.long);
          const lvl = dist < 500 ? 'HIGH' : (dist < 2000 ? 'MEDIUM' : null);
          if (lvl) {
            conflicts.push({ level: lvl, cell: cell.cell_name, type: 'PSC', value: cell.psc,
              message: 'Same PSC at ' + dist.toFixed(0) + 'm' });
          }
        }
      }
      if (cell.tech === 'LTE') {
        const samePci = nearby.filter(c => c.pci === cell.pci);
        if (samePci.length) {
          const nearest = samePci.reduce((a, b) =>
            haversineDistance(cell.lat, cell.long, a.lat, a.long) <
            haversineDistance(cell.lat, cell.long, b.lat, b.long) ? a : b);
          const dist = haversineDistance(cell.lat, cell.long, nearest.lat, nearest.long);
          const lvl = dist < 1000 ? 'HIGH' : (dist < 5000 ? 'MEDIUM' : null);
          if (lvl) {
            conflicts.push({ level: lvl, cell: cell.cell_name, type: 'PCI', value: cell.pci,
              message: 'Same PCI at ' + dist.toFixed(0) + 'm' });
          }
        }
      }
    });
    return conflicts;
  }

  function nsPlanAll(siteName, lat, lng, height, sectors, sectorAz, siteType, band2G, band3G, nearby, radius, opts) {
    const plan = { siteName, lat, lng, height, radius, opts, cells: [], neighbors: [], conflicts: [] };

    const has2G = siteType.includes('2G');
    const has3G = siteType.includes('3G');
    const has4G = siteType.includes('4G');

    const nearby2G = nearby.filter(c => c.tech === 'GSM');
    const nearby3G = nearby.filter(c => c.tech === '3G');
    const nearby4G = nearby.filter(c => c.tech === 'LTE');

    const bands2G = band2G === 'both' ? ['900', '1800'] : [band2G];
    const bands3G = band3G === 'both' ? ['2100', '900'] : [band3G];

    const siteBcch = { '900': new Set(), '1800': new Set() };
    const siteBsic = { '900': new Set(), '1800': new Set() };
    const siteBcchBsic = { '900': new Set(), '1800': new Set() };
    const sitePsc = new Set();
    const sitePci = new Set();
    const siteRsi = new Set();

    sectors.forEach(sec => {
      const az = sectorAz[sec];

      if (has2G) {
        bands2G.forEach(b => {
          const letter = nsGet2GLetter(sec, b);
          const cellName = siteName + letter;
          const cell = nsPlan2GCell(cellName, lat, lng, az, height, b,
            nearby2G, siteBcch[b], siteBsic[b], siteBcchBsic[b]);
          plan.cells.push(cell);

          if (opts.coSiteRule) {
            siteBcch[b].add(cell.bcch);
            siteBsic[b].add(cell.bsic);
            siteBcchBsic[b].add(cell.bcch + '_' + cell.bsic);
          }
        });
      }

      if (has3G) {
        bands3G.forEach(b => {
          const cellName = 'U' + siteName + nsGet3GLetter(sec, b);
          const cell = nsPlan3GCell(cellName, lat, lng, az, height, b, nearby3G, sitePsc);
          plan.cells.push(cell);
          if (opts.coSiteRule) sitePsc.add(cell.psc);
        });
      }

      if (has4G) {
        const cellName = 'L' + siteName + sec;
        const cell = nsPlan4GCell(cellName, lat, lng, az, height, nearby4G, sitePci, siteRsi);
        plan.cells.push(cell);
        if (opts.coSiteRule) {
          sitePci.add(cell.pci);
          siteRsi.add(cell.rsi);
        }
      }
    });

    if (opts.autoNb) plan.neighbors = nsPlanNeighbors(plan.cells, nearby, radius, opts);
    plan.conflicts = nsCheckConflicts(plan.cells, nearby);

    return plan;
  }

  function nsRunPlanner() {
    const siteName = (document.getElementById('ns_site_name').value || '').trim().toUpperCase();
    const lat = parseFloat(document.getElementById('ns_lat').value);
    const lng = parseFloat(document.getElementById('ns_long').value);
    const height = parseFloat(document.getElementById('ns_height').value) || 30;
    const radius = parseInt(document.getElementById('ns_radius').value) || 5000;
    const siteType = document.getElementById('ns_type').value;
    const band2G = document.getElementById('ns_2g_band').value;
    const band3G = document.getElementById('ns_3g_band').value;
    const numSectors = parseInt(document.getElementById('ns_num_sectors').value);

    const opts = {
      coSiteRule: document.getElementById('ns_opt_cosite').checked,
      autoNb: document.getElementById('ns_opt_autoNb').checked,
      bidir: document.getElementById('ns_opt_bidir').checked,
      frontThr: parseInt(document.getElementById('ns_front_threshold').value) || 45,
      iratThr: parseInt(document.getElementById('ns_irat_threshold').value) || 70,
      maxNb: parseInt(document.getElementById('ns_max_nb').value) || 20
    };

    if (!siteName) { toast('Enter site name', 'error'); return; }
    if (isNaN(lat) || isNaN(lng)) { toast('Invalid coordinates', 'error'); return; }

    const existing = State.allCells.find(c => c.cell_name.toUpperCase().startsWith(siteName));
    if (existing && !confirm('Site name already exists. Continue?')) return;

    const sectors = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, numSectors);
    const sectorAz = {};
    sectors.forEach(s => {
      sectorAz[s] = parseFloat(document.getElementById('ns_az_' + s)?.value) || 0;
    });

    toast('Analyzing cells...', 'info', 2000);

    setTimeout(() => {
      try {
        const nearby = State.allCells.filter(c => {
          if (!c.lat || !c.long) return false;
          return haversineDistance(lat, lng, c.lat, c.long) <= radius;
        });

        const plan = nsPlanAll(siteName, lat, lng, height, sectors, sectorAz,
          siteType, band2G, band3G, nearby, radius, opts);

        nsLastPlan = plan;
        nsRenderPlan(plan);

        document.getElementById('nsResults').style.display = 'block';
        nsSwitchTab('cells');

        const saveSel = document.getElementById('ns_save_project');
        if (saveSel) {
          saveSel.innerHTML = '<option value="">-- Select Project --</option>' +
            State.allProjects.map(p =>
              '<option value="' + p.id + '"' + (p.id === State.currentProjectId ? ' selected' : '') + '>' +
              escapeHtml(p.name) + '</option>').join('');
        }

        toast('Plan ready — ' + plan.cells.length + ' cells, ' + plan.neighbors.length + ' neighbors', 'success', 5000);
        setTimeout(() => document.getElementById('nsResults').scrollIntoView({ behavior: 'smooth' }), 200);
      } catch (e) {
        console.error(e);
        toast('Error: ' + e.message, 'error', 6000);
      }
    }, 100);
  }

  function nsRenderPlan(plan) {
    const nCells = plan.cells.length;
    const n2G = plan.cells.filter(c => c.tech === 'GSM').length;
    const n3G = plan.cells.filter(c => c.tech === '3G').length;
    const n4G = plan.cells.filter(c => c.tech === 'LTE').length;
    const nNb = plan.neighbors.length;
    const nConfH = plan.conflicts.filter(c => c.level === 'HIGH').length;
    const nConfM = plan.conflicts.filter(c => c.level === 'MEDIUM').length;

    document.getElementById('nsSummary').innerHTML =
      nsKpiCard('New Cells', nCells, '#124191') +
      nsKpiCard('2G', n2G, '#D97706') +
      nsKpiCard('3G', n3G, '#14B8A6') +
      nsKpiCard('4G', n4G, '#124191') +
      nsKpiCard('Neighbors', nNb, '#7C3AED') +
      nsKpiCard('HIGH Conflicts', nConfH, nConfH > 0 ? '#B91C1C' : '#1F9D55') +
      nsKpiCard('MED Conflicts', nConfM, nConfM > 0 ? '#F2A900' : '#1F9D55');

    document.getElementById('nsWarnings').innerHTML = (nConfH === 0 && nConfM === 0)
      ? '<div style="background:#E7F7EE;color:#1F9D55;padding:14px 18px;border-radius:10px;font-size:13px;"><b>Plan is clean!</b> No conflicts detected. Ready to save.</div>'
      : '<div style="background:#FDF1DC;color:#8A5A00;padding:14px 18px;border-radius:10px;font-size:13px;"><b>' + nConfH + ' HIGH and ' + nConfM + ' MEDIUM conflicts.</b> Review the Conflicts tab before saving.</div>';

    const tbody = document.querySelector('#nsCellsTable tbody');
    tbody.innerHTML = plan.cells.map(c => {
      const techBadge = c.tech === 'GSM' ? '#D97706' : c.tech === '3G' ? '#14B8A6' : '#124191';

      return '<tr>' +
        '<td><b>' + escapeHtml(c.cell_name) + '</b></td>' +
        '<td><span style="padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;background:' + techBadge + ';color:#fff;">' + c.tech + '</span></td>' +
        '<td>' + (c.band || '-') + '</td>' +
        '<td>' + c.bore + '°</td>' +
        '<td style="font-family:monospace;font-weight:700;color:#D97706;">' + (c.bcch || '-') + '</td>' +
        '<td style="font-family:monospace;">' + (c.tch || '-') + '</td>' +
        '<td style="font-family:monospace;font-weight:700;color:#8B5CF6;">' + (c.bsic || '-') + '</td>' +
        '<td style="font-family:monospace;font-weight:700;color:#14B8A6;">' + (c.psc != null ? c.psc : '-') + '</td>' +
        '<td style="font-family:monospace;font-size:11px;">' + (c.uarfcn_dl ? c.uarfcn_dl + ' / ' + c.uarfcn_ul : '-') + '</td>' +
        '<td style="font-family:monospace;font-weight:700;color:#124191;">' + (c.pci != null ? c.pci : '-') + '</td>' +
        '<td style="font-family:monospace;">' + (c.rsi != null ? c.rsi : '-') + '</td>' +
        '<td style="font-size:11px;">-</td>' +
      '</tr>';
    }).join('');

    nsRenderNeighbors(plan.neighbors);
    nsRenderConflicts(plan.conflicts);

    document.getElementById('nsSaveSummary').innerHTML =
      '<div style="font-size:13px;line-height:1.8;">' +
        '<b style="color:#124191;">Will add:</b><br>' +
        '<b>' + plan.cells.length + '</b> new cells<br>' +
        '<b>' + plan.neighbors.length + '</b> neighbor relations<br>' +
        (nConfH > 0
          ? '<span style="color:#B91C1C;">' + nConfH + ' HIGH conflicts — review first</span>'
          : '<span style="color:#1F9D55;">No HIGH conflicts</span>') +
      '</div>';
  }

  function nsKpiCard(label, value, color) {
    return '<div class="kpi-card"><div class="kpi-label">' + label + '</div><div class="kpi-value" style="color:' + color + ';">' + value + '</div></div>';
  }

  function nsRenderNeighbors(neighbors) {
    if (!neighbors.length) {
      document.getElementById('nsNeighborsPreview').innerHTML =
        '<div style="text-align:center;color:#5A6B87;padding:20px;">No neighbors suggested</div>';
      return;
    }

    const groups = { 'gsm': [], 'intra': [], 'inter': [], 'irat': [] };
    neighbors.forEach(n => { if (groups[n.relation_type]) groups[n.relation_type].push(n); });

    const labels = { 'gsm': '2G -> 2G', 'intra': '3G Intra-Freq', 'inter': '3G Inter-Freq', 'irat': '3G -> 2G (IRAT)' };
    const colors = { 'gsm': '#D97706', 'intra': '#0EA5E9', 'inter': '#F59E0B', 'irat': '#8B5CF6' };

    let html = '';
    Object.entries(groups).forEach(([key, items]) => {
      if (!items.length) return;
      html += '<div style="margin-bottom:16px;">' +
        '<div style="font-size:13px;font-weight:800;color:' + colors[key] + ';margin-bottom:10px;">' +
          labels[key] + ' — <span style="color:#124191;">' + items.length + '</span> relations' +
        '</div>' +
        '<div style="background:#F9FBFE;border-radius:10px;padding:12px;font-family:monospace;font-size:11.5px;max-height:300px;overflow-y:auto;">' +
          items.slice(0, 100).map(n =>
            '<div style="padding:4px 0;border-bottom:1px solid #F0F3F9;">' +
              '<b>' + escapeHtml(n.source_cell) + '</b> -> ' + escapeHtml(n.neighbor_cell) +
              ' <span style="color:#94A3B8;">(' + n.distance.toFixed(0) + 'm)</span>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>';
    });

    document.getElementById('nsNeighborsPreview').innerHTML = html;
  }

  function nsRenderConflicts(conflicts) {
    if (!conflicts.length) {
      document.getElementById('nsConflictsReport').innerHTML =
        '<div style="background:#E7F7EE;color:#1F9D55;padding:20px;border-radius:10px;text-align:center;font-size:14px;font-weight:700;">No conflicts!</div>';
      return;
    }

    let html = '';
    ['HIGH', 'MEDIUM'].forEach(lvl => {
      const items = conflicts.filter(c => c.level === lvl);
      if (!items.length) return;
      const color = lvl === 'HIGH' ? '#B91C1C' : '#F2A900';
      const bg = lvl === 'HIGH' ? '#FCEAEA' : '#FDF1DC';

      html += '<div style="margin-bottom:16px;">' +
        '<div style="font-size:13px;font-weight:800;color:' + color + ';margin-bottom:10px;">' + lvl + ' — ' + items.length + ' conflicts</div>' +
        items.map(c =>
          '<div style="background:' + bg + ';border-left:4px solid ' + color + ';padding:12px 14px;border-radius:8px;margin-bottom:8px;font-size:12.5px;">' +
            '<b>' + escapeHtml(c.cell) + '</b> · ' + c.type + '=' + c.value + '<br>' +
            '<span style="color:#5A6B87;">' + escapeHtml(c.message) + '</span>' +
          '</div>'
        ).join('') +
      '</div>';
    });

    document.getElementById('nsConflictsReport').innerHTML = html;
  }

  async function nsSaveToDatabase(btn) {
    if (!nsLastPlan) { toast('Run the planner first', 'error'); return; }
    const projId = document.getElementById('ns_save_project').value;
    if (!projId) { toast('Select a project', 'error'); return; }

    const pid = parseInt(projId);
    if (!confirm('Add ' + nsLastPlan.cells.length + ' cells and ' + nsLastPlan.neighbors.length + ' neighbors?')) return;

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const newNames = new Set(nsLastPlan.cells.map(c => c.cell_name));
      const gsmNb = {};
      nsLastPlan.neighbors.filter(n => n.relation_type === 'gsm').forEach(n => {
        (gsmNb[n.source_cell] = gsmNb[n.source_cell] || []).push(n.neighbor_cell);
      });

      const cellsPayload = nsLastPlan.cells.map(c => {
        const obj = { project_id: pid };
        ['cell_name', 'lat', 'long', 'bore', 'height', 'cell_radius', 'bcch', 'tch', 'bsic',
         'psc', 'uarfcn_dl', 'uarfcn_ul', 'rnc_id', 'pci', 'rsi'].forEach(k => {
          if (c[k] != null && c[k] !== '') obj[k] = c[k];
        });
        (gsmNb[c.cell_name] || []).slice(0, 35).forEach((nm, i) => {
          obj['nb' + (i + 1)] = nm;
        });
        return obj;
      });

      const { error: cellErr } = await db.from('rf_cells').insert(cellsPayload);
      if (cellErr) throw new Error('Cells: ' + cellErr.message);

      const validTypes = ['inter', 'intra', 'irat'];
      const nbPayload = nsLastPlan.neighbors
        .filter(n => validTypes.includes(n.relation_type))
        .map(n => ({
          project_id: pid,
          source_cell: n.source_cell,
          neighbor_cell: n.neighbor_cell,
          relation_type: n.relation_type
        }));

      let nbSaved = 0;
      if (nbPayload.length > 0) {
        const BATCH = 150;
        for (let i = 0; i < nbPayload.length; i += BATCH) {
          const { error: nbErr } = await db.from('rf_neighbors').insert(nbPayload.slice(i, i + BATCH));
          if (nbErr) throw new Error('Neighbors: ' + nbErr.message);
          nbSaved += Math.min(BATCH, nbPayload.length - i);
        }
      }

      toast('Added ' + cellsPayload.length + ' cells and ' + nbSaved + ' neighbors', 'success', 5000);
      await loadCells(false);
      if (typeof persistCellsCache === 'function') persistCellsCache();
    } catch (e) {
      console.error(e);
      toast('Error: ' + e.message, 'error', 8000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save All to Supabase';
    }
  }

  function nsShowOnMap() {
    if (!nsLastPlan) { toast('Run the planner first', 'error'); return; }

    window.__nbMode = true;
    window.__gsmMode = false;
    switchView('map');

    setTimeout(() => {
      if (State.sectorLayer) State.sectorLayer.clearLayers();
      if (State.labelLayer) State.labelLayer.clearLayers();

      window.nbMapLayers = window.nbMapLayers || [];
      nbMapLayers.forEach(l => { try { State.map.removeLayer(l); } catch (e) {} });
      window.nbMapLayers = [];

      const layersByCategory = {};
      const addToCategory = (cat, layer) => {
        if (!layersByCategory[cat]) layersByCategory[cat] = [];
        layersByCategory[cat].push(layer);
        nbMapLayers.push(layer);
        if (State.map && !State.map.hasLayer(layer)) State.map.addLayer(layer);
        return layer;
      };

      const { lat, lng } = nsLastPlan;

      const siteMarker = L.circleMarker([lat, lng], {
        radius: 16, color: '#124191', weight: 4,
        fillColor: '#124191', fillOpacity: 1
      }).addTo(State.map);
      siteMarker.bindTooltip('NEW: ' + nsLastPlan.siteName, {
        permanent: true, direction: 'top', offset: [0, -18], className: 'nb-label-source'
      });
      addToCategory('site', siteMarker);

      let n2g900 = 0, n2g1800 = 0, n3g900 = 0, n3g2100 = 0, n4g = 0;

      nsLastPlan.cells.forEach(c => {
        const coords = makeSectorCoords(c.lat, c.long, c.bore);
        let cat, color;
        if (c.tech === 'GSM') {
          if (c.band === '900') { cat = '2g900'; color = '#D97706'; n2g900++; }
          else { cat = '2g1800'; color = '#7C3AED'; n2g1800++; }
        } else if (c.tech === '3G') {
          if (c.band === '900') { cat = '3g900'; color = '#14B8A6'; n3g900++; }
          else { cat = '3g2100'; color = '#0D9488'; n3g2100++; }
        } else {
          cat = '4g'; color = '#124191'; n4g++;
        }

        const poly = L.polygon(coords, {
          color: '#fff', weight: 2.5, fillColor: color, fillOpacity: 0.85, interactive: true
        }).addTo(State.map);
        poly.bindTooltip(c.cell_name, { permanent: true, direction: 'center', className: 'nb-label' });
        addToCategory(cat, poly);
      });

      State.map.setView([lat, lng], 14);

      const onToggle = () => {
        Object.entries(layersByCategory).forEach(([cat, layers]) => {
          const visible = ToolLegend.isActive(cat);
          layers.forEach(l => {
            if (visible) { if (!State.map.hasLayer(l)) State.map.addLayer(l); }
            else { if (State.map.hasLayer(l)) State.map.removeLayer(l); }
          });
        });
      };

      const items = [{ id: 'site', color: '#124191', label: 'New Site', count: 1 }];
      if (n2g900 > 0) items.push({ id: '2g900', color: '#D97706', label: '2G-900', count: n2g900 });
      if (n2g1800 > 0) items.push({ id: '2g1800', color: '#7C3AED', label: '2G-1800', count: n2g1800 });
      if (n3g900 > 0) items.push({ id: '3g900', color: '#14B8A6', label: '3G-900', count: n3g900 });
      if (n3g2100 > 0) items.push({ id: '3g2100', color: '#0D9488', label: '3G-2100', count: n3g2100 });
      if (n4g > 0) items.push({ id: '4g', color: '#124191', label: 'LTE', count: n4g });

      ToolLegend.show({
        icon: '🏗️',
        title: 'New Site · ' + nsLastPlan.cells.length + ' cells',
        items: items,
        onToggle: onToggle
      });

      toast('New site displayed on map', 'success');
    }, 400);
  }

  function nsExportCSV() {
    if (!nsLastPlan) { toast('Run the planner first', 'error'); return; }

    const rows = [['Cell Name', 'Tech', 'Band', 'Azimuth', 'Height', 'BCCH', 'TCH', 'BSIC',
                   'PSC', 'UARFCN_DL', 'UARFCN_UL', 'PCI', 'RSI', 'Lat', 'Long']];

    nsLastPlan.cells.forEach(c => {
      rows.push([
        c.cell_name, c.tech, c.band, c.bore, c.height,
        c.bcch || '', c.tch || '', c.bsic || '',
        c.psc != null ? c.psc : '', c.uarfcn_dl || '', c.uarfcn_ul || '',
        c.pci != null ? c.pci : '', c.rsi != null ? c.rsi : '', c.lat, c.long
      ]);
    });

    downloadCSV('NewSite_' + nsLastPlan.siteName + '_' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV exported', 'success');
  }

  function nsExportKML() {
    if (!nsLastPlan) return;

    let kml = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n';
    kml += '  <name>' + escapeHtml(nsLastPlan.siteName) + '</name>\n';

    nsLastPlan.cells.forEach(c => {
      const coords = kmlSectorCoords(c.lat, c.long, c.bore);
      kml += '  <Placemark>\n    <name>' + escapeHtml(c.cell_name) + '</name>\n';
      kml += '    <Polygon><outerBoundaryIs><LinearRing><coordinates>\n';
      coords.forEach(p => {
        kml += '      ' + p[1].toFixed(6) + ',' + p[0].toFixed(6) + ',0\n';
      });
      kml += '    </coordinates></LinearRing></outerBoundaryIs></Polygon>\n  </Placemark>\n';
    });

    kml += '</Document>\n</kml>';

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'NewSite_' + nsLastPlan.siteName + '.kml';
    a.click();
    URL.revokeObjectURL(url);
    toast('KML exported', 'success');
  }

  function nsClearAll() {
    if (nsLastPlan && !confirm('Clear current plan?')) return;
    nsLastPlan = null;
    const r = document.getElementById('nsResults');
    if (r) r.style.display = 'none';
    const name = document.getElementById('ns_site_name');
    if (name) name.value = '';
    toast('Cleared', 'info');
  }

  setTimeout(() => {
    if (document.getElementById('ns_num_sectors')) nsUpdateSectors();
  }, 1500);

  window.nsSwitchTab = nsSwitchTab;
  window.nsUpdateSectors = nsUpdateSectors;
  window.nsSuggestAzimuths = nsSuggestAzimuths;
  window.nsRunPlanner = nsRunPlanner;
  window.nsRenderPlan = nsRenderPlan;
  window.nsSaveToDatabase = nsSaveToDatabase;
  window.nsShowOnMap = nsShowOnMap;
  window.nsExportCSV = nsExportCSV;
  window.nsExportKML = nsExportKML;
  window.nsClearAll = nsClearAll;

  console.log('✅ New Site Planner loaded');
})();
