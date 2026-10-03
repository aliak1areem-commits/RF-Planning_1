/* =========================================================
   ⚙️ CONFIG — Constants + Supabase + Global State
   ========================================================= */
(function() {
  'use strict';

  // ═══════════════════════════════════════════════════
  // 🔐 Supabase
  // ═══════════════════════════════════════════════════
  const SUPABASE_URL = 'https://lwmymnxwrvroxnkixjts.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_HAf79ZGumF-BKQhnJoW9ZQ_5V2ubxqT';

  const { createClient } = supabase;
  const db = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ═══════════════════════════════════════════════════
  // 🎨 Constants
  // ═══════════════════════════════════════════════════
  const CONSTANTS = {
    CELL_COLOR: '#D64545',
    SECTOR_COLORS: {
      'A': '#D64545', 'B': '#1F9D55', 'C': '#124191',
      'D': '#F2A900', 'E': '#8B5CF6', 'F': '#EC4899', 'G': '#06B6D4'
    },
    NB_FIELD_COUNT: 35,
    NB_FRONT_THRESHOLD: 45,
    NB_DEFAULT_RADIUS: 1200,
    EARTH_RADIUS_M: 6371000.0,

    GSM_BAND_ARFCN: {
      '900': { from: 34, to: 46 },
      '1800': { from: 663, to: 680 }
    },
    GSM_BAND_SUFFIX: {
      'A': '900', 'B': '900', 'C': '900',
      'G': '900', 'H': '900', 'I': '900',
      'D': '1800', 'E': '1800', 'F': '1800',
      'J': '1800', 'K': '1800', 'L': '1800'
    },
    GSM_RADIUS_M: 1200,
    GSM_FRONT_THRESHOLD: 45,

    THREE_G_DEFAULT_RADIUS: 1200,
    THREE_G_FRONT_THRESHOLD: 45,

    CACHE_KEY: 'rf_cells_cache_v2',
    CACHE_TTL_MS: 5 * 60 * 1000,
    LANG_KEY: 'rf_lang_preference',
    BOOKMARKS_KEY: 'rf_map_bookmarks_v1'
  };

  // ═══════════════════════════════════════════════════
  // 📊 Global State (Singleton)
  // ═══════════════════════════════════════════════════
  const State = {
    // Map
    map: null,
    canvasRenderer: null,
    basemaps: {},
    sectorLayer: null,
    labelLayer: null,
    coverageLayer: null,
    neighborLineLayer: null,
    neighborLinesActive: false,
    selectedCellForLines: null,
    drawnItems: null,

    // Data
    allCells: [],
    visibleCells: [],
    allProjects: [],
    currentProjectId: null,
    importPreviewData: [],
    cellByName: new Map(),
    cellById: new Map(),
    cellNeighborsCache: new Map(),

    // UI
    currentView: 'map',
    multiSelectMode: false,
    selectedCellIds: new Set(),
    selectedPolygons: new Map(),

    // Tools
    lastPCIResults: null,
    gsmLastResults: null,
    pscLastResults: null,
    bsicLastResults: null,
    hsnLastResults: null,
    azoptLastResults: null,
    symLastResults: null,
    threeGImportedData: { inter: [], intra: [], irat: [] },
    threeGAllNeighbors: [],
    threeGNbCurrent: null,
    threeGMapLayers: [],
    nbCurrentNeighbors: [],
    nbCurrentSource: null,
    nbBeforeSnapshot: {},
    nbCurrentRadius: 1200,
    nbBatchResults: {},
    nbMapLayers: [],
    symMapLayers: [],
    azoptMapLayers: [],
    nsLastPlan: null,
    bsicMode: 'clash',

    // Auth
    currentUser: null,
    currentProfile: null,

    // i18n
    currentLang: 'en',

    // Cells Page
    cellsPageState: {
      page: 1,
      sortBy: 'cell_name',
      sortAsc: true,
      selectedIds: new Set(),
      visibleColumns: ['cell_name', 'site', 'tech', 'pci', 'psc', 'bcch', 'bsic', 'bore', 'lat', 'long', 'comment', 'actions']
    }
  };

  // ═══════════════════════════════════════════════════
  // 🌐 Export to window
  // ═══════════════════════════════════════════════════
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;
  window.db = db;

  window.CONSTANTS = CONSTANTS;
  Object.keys(CONSTANTS).forEach(k => { window[k] = CONSTANTS[k]; });

  window.State = State;

  console.log('✅ Config loaded');
})();
