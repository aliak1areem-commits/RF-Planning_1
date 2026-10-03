/* =========================================================
   📐 DISTANCE & BEARING Calculator
   ========================================================= */
(function() {
  'use strict';

  function calcDistance() {
    const lat1 = parseFloat(document.getElementById('d_lat1')?.value);
    const lon1 = parseFloat(document.getElementById('d_lon1')?.value);
    const lat2 = parseFloat(document.getElementById('d_lat2')?.value);
    const lon2 = parseFloat(document.getElementById('d_lon2')?.value);

    if ([lat1, lon1, lat2, lon2].some(isNaN)) {
      toast('Please enter valid coordinates', 'error');
      return;
    }

    const distM = haversineDistance(lat1, lon1, lat2, lon2);
    const distKm = distM / 1000;
    const bearing = calculateBearing(lat1, lon1, lat2, lon2);
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const direction = dirs[Math.round(bearing / 22.5) % 16];

    document.getElementById('res_dist_m').textContent = distM.toFixed(2) + ' m';
    document.getElementById('res_dist_km').textContent = distKm.toFixed(3) + ' km';
    document.getElementById('res_bearing').textContent = bearing.toFixed(2) + '°';
    document.getElementById('res_direction').textContent = direction;
    document.getElementById('distanceResults').style.display = 'grid';

    toast('Calculated: ' + distKm.toFixed(2) + ' km · ' + bearing.toFixed(1) + '°', 'success');
  }

  window.calcDistance = calcDistance;
  console.log('✅ Distance tool loaded');
})();
