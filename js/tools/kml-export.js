/* =========================================================
   🗺️ KML EXPORT — Google Earth
   ========================================================= */
(function() {
  'use strict';

  function kmlSectorCoords(lat, lng, azimuth) {
    const radius_m = 350, half_width_m = 100;
    const near_d = radius_m * 0.04, far_d = radius_m;
    const near_w = half_width_m * 0.30, far_w = half_width_m;

    function pt(fwd_m, right_m) {
      const distance = Math.sqrt(fwd_m * fwd_m + right_m * right_m);
      const offsetAngle = Math.atan2(right_m, fwd_m) * 180 / Math.PI;
      return destinationPoint(lat, lng, azimuth + offsetAngle, distance);
    }
    return [pt(0, 0), pt(near_d, -near_w), pt(far_d, -far_w), pt(far_d, far_w), pt(near_d, near_w)];
  }

  function exportKML() {
    if (!State.allCells.length) { toast('No cells loaded', 'error'); return; }

    const includeSectors = document.getElementById('kml_sectors')?.value === 'yes';
    const colorMode = document.getElementById('kml_color')?.value || 'sector';
    const filename = (document.getElementById('kml_filename')?.value.trim() || 'RF_Planning_Export') + '.kml';

    function hexToKML(hex) {
      const r = hex.substring(1, 3), g = hex.substring(3, 5), b = hex.substring(5, 7);
      return 'ff' + b + g + r;
    }

    function getColor(cell) {
      if (colorMode === 'sector') return SECTOR_COLORS[cell.sector] || CELL_COLOR;
      return CELL_COLOR;
    }

    let kml = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n';
    kml += '  <name>' + escapeHtml(filename) + '</name>\n';
    kml += '  <description>RF Planning Export — ' + State.allCells.length + ' cells</description>\n';

    const stylesUsed = new Set();
    State.allCells.forEach(c => stylesUsed.add(getColor(c)));

    stylesUsed.forEach(color => {
      const kmlColor = hexToKML(color);
      kml += '  <Style id="style_' + color.substring(1) + '">\n';
      kml += '    <LineStyle><color>' + kmlColor + '</color><width>1.5</width></LineStyle>\n';
      kml += '    <PolyStyle><color>' + kmlColor.replace('ff', 'aa') + '</color></PolyStyle>\n';
      kml += '  </Style>\n';
    });

    kml += '  <Folder><name>Cells</name>\n';

    State.allCells.forEach(cell => {
      if (!cell.lat || !cell.long) return;
      const color = getColor(cell);
      const styleId = 'style_' + color.substring(1);

      kml += '    <Placemark>\n';
      kml += '      <name>' + escapeHtml(cell.cell_name) + '</name>\n';
      kml += '      <description><![CDATA[\n';
      kml += '        <b>Cell:</b> ' + escapeHtml(cell.cell_name) + '<br/>';
      kml += '        <b>Site:</b> ' + escapeHtml(cell.site) + '<br/>';
      kml += '        <b>Region:</b> ' + escapeHtml(cell.region) + '<br/>';
      kml += '        <b>PCI:</b> ' + cell.pci + '<br/>';
      kml += '        <b>Azimuth:</b> ' + cell.bore + '&deg;<br/>';
      kml += '      ]]></description>\n';
      kml += '      <styleUrl>#' + styleId + '</styleUrl>\n';

      if (includeSectors) {
        const coords = kmlSectorCoords(cell.lat, cell.long, cell.bore);
        kml += '      <Polygon>\n<outerBoundaryIs><LinearRing><coordinates>\n          ';
        coords.forEach(c => { kml += c[1].toFixed(6) + ',' + c[0].toFixed(6) + ',0 '; });
        kml += '\n        </coordinates></LinearRing></outerBoundaryIs>\n      </Polygon>\n';
      } else {
        kml += '      <Point><coordinates>' + cell.long.toFixed(6) + ',' + cell.lat.toFixed(6) + ',0</coordinates></Point>\n';
      }
      kml += '    </Placemark>\n';
    });

    kml += '  </Folder>\n</Document>\n</kml>\n';

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast('KML exported: ' + filename, 'success');
  }

  window.exportKML = exportKML;
  window.kmlSectorCoords = kmlSectorCoords;
  console.log('✅ KML export loaded');
})();
