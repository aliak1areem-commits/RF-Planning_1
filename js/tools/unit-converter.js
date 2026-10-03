/* =========================================================
   🔢 UNIT CONVERTER — Power, Gain, Distance
   ========================================================= */
(function() {
  'use strict';

  function convertPower() {
    const val = parseFloat(document.getElementById('u_power_val')?.value);
    const from = document.getElementById('u_power_from')?.value;
    if (isNaN(val)) { toast('Enter a valid number', 'error'); return; }

    let dbm, mw, w;
    if (from === 'dbm') { dbm = val; mw = Math.pow(10, val / 10); w = mw / 1000; }
    else if (from === 'mw') { mw = val; dbm = 10 * Math.log10(val); w = val / 1000; }
    else { w = val; mw = val * 1000; dbm = 10 * Math.log10(mw); }

    document.getElementById('res_dbm').textContent = dbm.toFixed(4) + ' dBm';
    document.getElementById('res_mw').textContent = mw.toFixed(6) + ' mW';
    document.getElementById('res_w').textContent = w.toFixed(8) + ' W';
    document.getElementById('powerResults').style.display = 'grid';
    toast('Converted successfully', 'success');
  }

  function convertGain() {
    const val = parseFloat(document.getElementById('u_gain_val')?.value);
    const from = document.getElementById('u_gain_from')?.value;
    if (isNaN(val)) { toast('Enter a valid number', 'error'); return; }

    let dbi, dbd;
    if (from === 'dbi') { dbi = val; dbd = val - 2.15; }
    else { dbd = val; dbi = val + 2.15; }

    document.getElementById('res_dbi').textContent = dbi.toFixed(3) + ' dBi';
    document.getElementById('res_dbd').textContent = dbd.toFixed(3) + ' dBd';
    document.getElementById('gainResults').style.display = 'grid';
    toast('Converted successfully', 'success');
  }

  function convertDistance() {
    const val = parseFloat(document.getElementById('u_dist_val')?.value);
    const from = document.getElementById('u_dist_from')?.value;
    if (isNaN(val)) { toast('Enter a valid number', 'error'); return; }

    let m, km, mi, ft;
    if (from === 'm') { m = val; km = val / 1000; mi = val * 0.000621371; ft = val * 3.28084; }
    else if (from === 'km') { m = val * 1000; km = val; mi = val * 0.621371; ft = val * 3280.84; }
    else if (from === 'mi') { m = val * 1609.34; km = val * 1.60934; mi = val; ft = val * 5280; }
    else { m = val * 0.3048; km = val * 0.0003048; mi = val * 0.000189394; ft = val; }

    document.getElementById('res_m').textContent = m.toFixed(3) + ' m';
    document.getElementById('res_km').textContent = km.toFixed(6) + ' km';
    document.getElementById('res_mi').textContent = mi.toFixed(6) + ' mi';
    document.getElementById('res_ft').textContent = ft.toFixed(3) + ' ft';
    document.getElementById('distResults').style.display = 'grid';
    toast('Converted successfully', 'success');
  }

  window.convertPower = convertPower;
  window.convertGain = convertGain;
  window.convertDistance = convertDistance;
  console.log('✅ Unit converter loaded');
})();
