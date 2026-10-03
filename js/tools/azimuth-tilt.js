/* =========================================================
   🎯 AZIMUTH & TILT Calculator
   ========================================================= */
(function() {
  'use strict';

  function calcAzimuth() {
    const lat1 = parseFloat(document.getElementById('a_lat1')?.value);
    const lon1 = parseFloat(document.getElementById('a_lon1')?.value);
    const h1 = parseFloat(document.getElementById('a_h1')?.value);
    const lat2 = parseFloat(document.getElementById('a_lat2')?.value);
    const lon2 = parseFloat(document.getElementById('a_lon2')?.value);
    const h2 = parseFloat(document.getElementById('a_h2')?.value);

    if ([lat1, lon1, h1, lat2, lon2, h2].some(isNaN)) {
      toast('Please enter valid values', 'error');
      return;
    }

    const distM = haversineDistance(lat1, lon1, lat2, lon2);
    const azimuth = calculateBearing(lat1, lon1, lat2, lon2);
    const heightDiff = h2 - h1;
    const tilt = Math.atan2(heightDiff, distM) * 180 / Math.PI;

    document.getElementById('res_azimuth').textContent = azimuth.toFixed(2) + '°';
    document.getElementById('res_az_dist').textContent = distM.toFixed(2) + ' m';
    document.getElementById('res_az_hdiff').textContent = heightDiff.toFixed(2) + ' m';
    document.getElementById('res_az_tilt').textContent = tilt.toFixed(3) + '°';
    document.getElementById('azimuthResults').style.display = 'grid';

    toast('Azimuth: ' + azimuth.toFixed(1) + '° · Tilt: ' + tilt.toFixed(2) + '°', 'success');
  }

  window.calcAzimuth = calcAzimuth;
  console.log('✅ Azimuth tool loaded');
})();
