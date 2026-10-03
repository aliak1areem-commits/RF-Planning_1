/* =========================================================
   🗺️ MAP CONTEXT MENU — Right-click Actions on Cell
   ========================================================= */
(function() {
  'use strict';

  function showCellContextMenu(cell, event) {
    let menu = document.getElementById('cellContextMenu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'cellContextMenu';
      menu.className = 'cell-context-menu';
      document.body.appendChild(menu);
    }

    menu.innerHTML =
      '<div class="ctx-item" onclick="flyToCellById(' + cell.id + ')">Go to Cell</div>' +
      '<div class="ctx-item" onclick="copyCellInfo(' + cell.id + ')">Copy Info</div>' +
      '<div class="ctx-item" onclick="showNeighborLinesForCell(' + cell.id + ')">Show Neighbors</div>' +
      '<div class="ctx-item" onclick="copyCellCoordinates(' + cell.id + ')">Copy Coordinates</div>' +
      '<div class="ctx-sep"></div>' +
      '<div class="ctx-item" onclick="googleMapsCell(' + cell.id + ')">Google Maps</div>' +
      '<div class="ctx-item" onclick="streetViewCell(' + cell.id + ')">Street View</div>';

    menu.style.left = event.originalEvent.pageX + 'px';
    menu.style.top = event.originalEvent.pageY + 'px';
    menu.classList.add('show');

    setTimeout(() => {
      document.addEventListener('click', hideContextMenu, { once: true });
    }, 100);
  }

  function hideContextMenu() {
    const menu = document.getElementById('cellContextMenu');
    if (menu) menu.classList.remove('show');
  }

  function copyCellInfo(id) {
    const cell = State.cellById.get(id);
    if (!cell) return;

    const text =
      'Cell: ' + cell.cell_name + '\n' +
      'Site: ' + cell.site + '\n' +
      'Tech: ' + cell.tech + '\n' +
      'PCI: ' + (cell.pci || '—') + '\n' +
      'BCCH: ' + (cell.bcch || '—') + '\n' +
      'BSIC: ' + (cell.bsic || '—') + '\n' +
      'Bore: ' + cell.bore + '°\n' +
      'Lat/Long: ' + cell.lat + ', ' + cell.long;

    navigator.clipboard.writeText(text).then(() => toast('Copied', 'success'));
    hideContextMenu();
  }

  function copyCellCoordinates(id) {
    const cell = State.cellById.get(id);
    if (!cell) return;
    navigator.clipboard.writeText(cell.lat + ',' + cell.long)
      .then(() => toast('Coordinates copied', 'success'));
    hideContextMenu();
  }

  function googleMapsCell(id) {
    const cell = State.cellById.get(id);
    if (!cell) return;
    window.open('https://www.google.com/maps/search/?api=1&query=' + cell.lat + ',' + cell.long, '_blank');
    hideContextMenu();
  }

  function streetViewCell(id) {
    const cell = State.cellById.get(id);
    if (!cell) return;
    window.open('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + cell.lat + ',' + cell.long, '_blank');
    hideContextMenu();
  }

  function flyToCellById(id) {
    const cell = State.cellById.get(id);
    if (!cell) return;
    State.map.flyTo([cell.lat, cell.long], 16, { duration: 1 });
    setTimeout(() => {
      if (typeof showSiteInfo === 'function') showSiteInfo(cell);
    }, 1100);
    hideContextMenu();
  }

  function showNeighborLinesForCell(id) {
    const cell = State.cellById.get(id);
    if (!cell) return;

    const chk = document.getElementById('showNeighborLines');
    if (chk) {
      chk.checked = true;
      if (typeof toggleNeighborLines === 'function') toggleNeighborLines();
    }
    if (typeof drawNeighborLines === 'function') drawNeighborLines(cell);
    hideContextMenu();
  }

  window.showCellContextMenu = showCellContextMenu;
  window.hideContextMenu = hideContextMenu;
  window.copyCellInfo = copyCellInfo;
  window.copyCellCoordinates = copyCellCoordinates;
  window.googleMapsCell = googleMapsCell;
  window.streetViewCell = streetViewCell;
  window.flyToCellById = flyToCellById;
  window.showNeighborLinesForCell = showNeighborLinesForCell;

  console.log('✅ Map context menu loaded');
})();
