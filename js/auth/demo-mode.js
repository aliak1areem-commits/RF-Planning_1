/* =========================================================
   👤 DEMO MODE — Riyadh Sample Network
   ========================================================= */
(function() {
  'use strict';

  function startDemoMode() {
    localStorage.setItem('rf_demo_mode', '1');
    window.__demoMode = true;

    if (!window.__demoGuardActive) {
      location.reload();
      return;
    }

    console.log('%c👤 Starting Demo Mode...', 'background:#006C35;color:#fff;padding:8px 16px;border-radius:6px;font-weight:700');

    const loginScreen = document.getElementById('loginScreen');
    const app = document.querySelector('.app');
    if (loginScreen) loginScreen.style.display = 'none';
    if (app) app.style.display = '';

    window.checkAuthOnLoad = function() {};
    window.doLogin = function() {};

    // Generate sample data
    const rand = (min, max) => Math.random() * (max - min) + min;
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    const NUM_SITES = 300;
    const SECTORS = ['A', 'B', 'C'];
    const SECTOR_ANGLES = [0, 120, 240];
    const MIN_LAT = 24.60, MAX_LAT = 24.85;
    const MIN_LNG = 46.50, MAX_LNG = 46.85;
    const MIN_DIST = 0.008;
    const CELL_RADIUS = 700;

    function isInWater(lat, lng) {
      const t = (lng - 46.50) / 0.35;
      const wadiLat = 24.75 - t * 0.15;
      return Math.abs(lat - wadiLat) < 0.008;
    }

    function poissonDiskSampling(n, minDist) {
      const positions = [];
      const minDistSq = minDist * minDist;
      let attempts = 0;
      while (positions.length < n && attempts < n * 40) {
        attempts++;
        const lat = rand(MIN_LAT, MAX_LAT);
        const lng = rand(MIN_LNG, MAX_LNG);
        if (isInWater(lat, lng)) continue;
        let ok = true;
        for (let i = 0; i < positions.length; i++) {
          const dLat = positions[i].lat - lat;
          const dLng = positions[i].lng - lng;
          if (dLat * dLat + dLng * dLng < minDistSq) { ok = false; break; }
        }
        if (ok) positions.push({ lat, lng });
      }
      return positions;
    }

    console.log('🔄 Generating Riyadh demo data...');
    const sitePositions = poissonDiskSampling(NUM_SITES, MIN_DIST);
    const demoCells = [];
    let siteCounter = 1;

    sitePositions.forEach(function(pos) {
      const siteNum = siteCounter;
      const siteName = 'Site' + siteNum;
      const region = 'RYD' + (Math.floor(siteNum / 20) + 1);
      const lac = randInt(100, 999);
      const rncId = randInt(1, 20);
      const bsc = 'BSC' + randInt(1, 15);
      const u2100 = pick([10700, 10712, 10812]);
      const u900 = pick([3012, 3020, 3030]);

      SECTORS.forEach(function(sector, k) {
        const bore = SECTOR_ANGLES[k] + randInt(-10, 10);

        const addCell = function(cellData) {
          const obj = {
            id: 900000 + demoCells.length,
            site: siteName,
            region: region,
            sector: sector,
            lat: pos.lat,
            long: pos.lng,
            bore: bore,
            radius: CELL_RADIUS,
            height: randInt(20, 45),
            comment: null,
            project_id: null,
            color: '#D64545'
          };
          for (const key in cellData) obj[key] = cellData[key];
          demoCells.push(obj);
        };

        // 2G-900
        addCell({
          cell_name: 'Cell' + siteNum + sector, cell_id: randInt(1000, 99999),
          tech: 'GSM', gsmBand: '900', pci: null, rsi: 0,
          bcch: randInt(1, 124),
          bsic: String(randInt(0, 7)) + String(randInt(0, 7)),
          tch: randInt(1, 124), lac: lac, hsn: randInt(0, 63),
          psc: null, uarfcn_dl: null, uarfcn_ul: null, rnc_id: null,
          bsc: bsc, bw: 0
        });

        // 2G-1800
        addCell({
          cell_name: 'Cell' + siteNum + sector + '_18', cell_id: randInt(1000, 99999),
          tech: 'GSM', gsmBand: '1800', pci: null, rsi: 0,
          bcch: randInt(600, 700),
          bsic: String(randInt(0, 7)) + String(randInt(0, 7)),
          tch: randInt(600, 700), lac: lac, hsn: randInt(0, 63),
          psc: null, uarfcn_dl: null, uarfcn_ul: null, rnc_id: null,
          bsc: bsc, bw: 0
        });

        // 3G-900
        addCell({
          cell_name: 'UCell' + siteNum + sector + '_9', cell_id: randInt(1000, 99999),
          tech: '3G', gsmBand: '900', pci: null, rsi: 0,
          bcch: 0, bsic: '', tch: 0, lac: lac, hsn: null,
          psc: randInt(0, 511),
          uarfcn_dl: u900, uarfcn_ul: u900 - 9500,
          rnc_id: rncId, bsc: '', bw: 0
        });

        // 3G-2100
        addCell({
          cell_name: 'UCell' + siteNum + sector, cell_id: randInt(1000, 99999),
          tech: '3G', gsmBand: '2100', pci: null, rsi: 0,
          bcch: 0, bsic: '', tch: 0, lac: lac, hsn: null,
          psc: randInt(0, 511),
          uarfcn_dl: u2100, uarfcn_ul: u2100 - 9500,
          rnc_id: rncId, bsc: '', bw: 0
        });

        // LTE
        addCell({
          cell_name: 'LCell' + siteNum + sector, cell_id: randInt(1000, 99999),
          tech: 'LTE', gsmBand: null, pci: randInt(0, 503), rsi: randInt(1, 837),
          bcch: 0, bsic: '', tch: 0, lac: 0, hsn: null,
          psc: null, uarfcn_dl: null, uarfcn_ul: null, rnc_id: null,
          bsc: '', bw: pick([10, 15, 20])
        });
      });
      siteCounter++;
    });

    console.log('📊 Generated ' + demoCells.length + ' cells / ' + sitePositions.length + ' sites');

    // Inject
    State.allCells = demoCells;
    State.visibleCells = demoCells.slice();
    State.allProjects = [{
      id: 9001,
      name: 'Riyadh Demo',
      description: 'Sample demo network',
      created_at: new Date().toISOString()
    }];

    // Override loaders
    window.loadCells = async function() {
      State.allCells = demoCells;
      State.visibleCells = demoCells.slice();
      if (typeof rebuildLookups === 'function') rebuildLookups();
      if (typeof updateStats === 'function') updateStats();
      if (typeof applyFilters === 'function') applyFilters();
      if (typeof renderMap === 'function') renderMap();
      const nav = document.getElementById('navCellsCount');
      if (nav) nav.textContent = demoCells.length.toLocaleString();
    };

    window.loadProjects = async function() {
      if (typeof renderProjectsList === 'function') renderProjectsList();
      if (typeof renderProjectSelect === 'function') renderProjectSelect();
    };

    // Render
    if (typeof rebuildLookups === 'function') rebuildLookups();
    if (typeof updateStats === 'function') updateStats();
    if (typeof applyFilters === 'function') applyFilters();
    if (typeof renderMap === 'function') renderMap();
    if (typeof renderProjectsList === 'function') renderProjectsList();

    const nav = document.getElementById('navCellsCount');
    if (nav) nav.textContent = demoCells.length.toLocaleString();

    // Fly to Riyadh
    if (State.map) {
      setTimeout(function() {
        try { State.map.invalidateSize(); } catch (e) {}
        try { State.map.flyTo([24.72, 46.67], 11, { duration: 1.5 }); } catch (e) {}
        setTimeout(function() {
          if (typeof fitAllCells === 'function') fitAllCells();
        }, 1800);
      }, 400);
    }

    // Read-only enforcement
    ['pciApplyAll','pscApplyAll','bsicApplyAll','hsnApplyAll','gsmSaveToDatabase',
     'importSaveToSupabase','nsSaveToDatabase','deleteProject','createProject',
     'updateUserRole','toggleUserActive'].forEach(function(fn) {
      if (typeof window[fn] === 'function') {
        window[fn] = function() { alert('Demo mode — read-only'); };
      }
    });

    // Banner
    let banner = document.getElementById('__demoBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = '__demoBanner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(90deg,#006C35,#00A550);color:#fff;padding:9px 20px;font-size:12.5px;font-weight:700;text-align:center;letter-spacing:.05em;text-transform:uppercase;box-shadow:0 4px 20px rgba(0,108,53,.5);font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;gap:16px;';
      banner.innerHTML =
        '<span>DEMO MODE · Riyadh · ' + sitePositions.length + ' sites · ' + demoCells.length + ' cells · NOT real</span>' +
        '<a href="javascript:exitDemoMode()" style="color:#FFD700;text-decoration:underline;font-size:11px;cursor:pointer;">Exit Demo</a>';
      document.body.appendChild(banner);
    }

    document.body.style.paddingTop = '40px';

    console.log('%c✅ DEMO MODE READY', 'background:#006C35;color:#fff;padding:10px 20px;border-radius:8px;font-weight:700');
  }

  function exitDemoMode() {
    localStorage.removeItem('rf_demo_mode');
    window.__demoMode = false;
    window.__demoGuardActive = false;
    location.href = location.pathname;
  }

  window.startDemoMode = startDemoMode;
  window.exitDemoMode = exitDemoMode;

  console.log('✅ Demo mode loaded');
})();
