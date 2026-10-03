/* =========================================================
   🗺️ MAP BOOKMARKS — Save/Load Map Views
   ========================================================= */
(function() {
  'use strict';

  const BOOKMARKS_KEY = 'rf_map_bookmarks_v1';

  function getBookmarks() {
    try {
      return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveBookmarks(list) {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  }

  function toggleBookmarksPanel() {
    const panel = document.getElementById('bookmarksPanel');
    if (!panel) return;
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) renderBookmarks();
  }

  function addCurrentBookmark() {
    const name = prompt('Bookmark name:');
    if (!name) return;

    const center = State.map.getCenter();
    const zoom = State.map.getZoom();
    const bookmarks = getBookmarks();

    bookmarks.push({
      name: name.trim(),
      lat: center.lat,
      lon: center.lng,
      zoom: zoom,
      created: Date.now()
    });

    saveBookmarks(bookmarks);
    renderBookmarks();
    toast('Saved "' + name + '"', 'success');
  }

  function renderBookmarks() {
    const panel = document.getElementById('bookmarksPanel');
    if (!panel) return;

    const bookmarks = getBookmarks();

    let html = '<div style="font-size:12px;font-weight:800;color:#0C1B3D;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">' +
      '<span>Bookmarks (' + bookmarks.length + ')</span>' +
      '<button onclick="addCurrentBookmark()" style="background:#124191;color:#fff;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">+ Add</button>' +
    '</div>';

    if (!bookmarks.length) {
      html += '<div style="text-align:center;color:#94A3B8;font-size:12px;padding:20px;">No bookmarks yet</div>';
    } else {
      bookmarks.forEach((bm, idx) => {
        html += '<div class="bookmark-item" onclick="goToBookmark(' + idx + ')" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;border-bottom:1px solid #F0F3F9;">' +
          '<b style="flex:1;color:#0C1B3D;">' + escapeHtml(bm.name) + '</b>' +
          '<button onclick="event.stopPropagation();deleteBookmark(' + idx + ')" style="background:none;border:none;color:#D64545;cursor:pointer;font-size:14px;">X</button>' +
        '</div>';
      });
    }

    panel.innerHTML = html;
  }

  function goToBookmark(idx) {
    const bookmarks = getBookmarks();
    const bm = bookmarks[idx];
    if (!bm) return;

    State.map.flyTo([bm.lat, bm.lon], bm.zoom || 14, { duration: 1.2 });
    const panel = document.getElementById('bookmarksPanel');
    if (panel) panel.classList.remove('show');
  }

  function deleteBookmark(idx) {
    const bookmarks = getBookmarks();
    bookmarks.splice(idx, 1);
    saveBookmarks(bookmarks);
    renderBookmarks();
    toast('Deleted', 'info');
  }

  window.toggleBookmarksPanel = toggleBookmarksPanel;
  window.addCurrentBookmark = addCurrentBookmark;
  window.renderBookmarks = renderBookmarks;
  window.goToBookmark = goToBookmark;
  window.deleteBookmark = deleteBookmark;

  console.log('✅ Map bookmarks loaded');
})();
