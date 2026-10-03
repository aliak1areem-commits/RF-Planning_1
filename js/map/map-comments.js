/* =========================================================
   🗺️ MAP COMMENTS — Add/Edit/Delete Comments
   ========================================================= */
(function() {
  'use strict';

  function showSiteInfo(cell) {
    const card = document.getElementById('siteInfoCard');
    const title = document.getElementById('siteInfoTitle');
    const body = document.getElementById('siteInfoBody');

    if (!card || !title || !body) return;

    title.textContent = cell.cell_name;
    card.classList.add('show');

    const gmapsLink = 'https://www.google.com/maps/search/?api=1&query=' + cell.lat + ',' + cell.long;
    const streetLink = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + cell.lat + ',' + cell.long;
    const isGSM = cell.tech === 'GSM';

    let rfSection = '';
    if (isGSM) {
      const bandBadge = cell.gsmBand === '1800'
        ? '<span style="background:#F3E8FF;color:#7C3AED;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;">1800 MHz</span>'
        : cell.gsmBand === '900'
        ? '<span style="background:#FDF1DC;color:#8A5A00;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;">900 MHz</span>'
        : '<span style="background:#F4F7FB;color:#5A6B87;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:700;">Unknown</span>';

      rfSection =
        '<div class="info-section-title">GSM Parameters</div>' +
        '<div class="info-row"><span class="k">Band</span><span class="v">' + bandBadge + '</span></div>' +
        '<div class="info-row"><span class="k">BCCH</span><span class="v" style="color:#D97706;font-weight:800;">' + (cell.bcch || '—') + '</span></div>' +
        '<div class="info-row"><span class="k">TCH</span><span class="v">' + (cell.tch || '—') + '</span></div>' +
        '<div class="info-row"><span class="k">LAC</span><span class="v">' + (cell.lac || '—') + '</span></div>' +
        '<div class="info-row"><span class="k">HSN</span><span class="v">' + (cell.hsn != null ? cell.hsn : '—') + '</span></div>';
    } else if (cell.tech === '3G') {
      rfSection =
        '<div class="info-section-title">3G Parameters</div>' +
        '<div class="info-row"><span class="k">Band</span><span class="v">' + (cell.gsmBand === '900' ? '900 MHz' : (cell.gsmBand === '2100' ? '2100 MHz' : '—')) + '</span></div>' +
        '<div class="info-row"><span class="k">PSC</span><span class="v" style="color:#14B8A6;font-weight:800;">' + (cell.psc || '—') + '</span></div>' +
        '<div class="info-row"><span class="k">DL UARFCN</span><span class="v">' + (cell.uarfcn_dl || '—') + '</span></div>' +
        '<div class="info-row"><span class="k">UL UARFCN</span><span class="v">' + (cell.uarfcn_ul || '—') + '</span></div>' +
        '<div class="info-row"><span class="k">RNC ID</span><span class="v">' + (cell.rnc_id || '—') + '</span></div>';
    } else {
      rfSection =
        '<div class="info-section-title">LTE Parameters</div>' +
        '<div class="info-row"><span class="k">PCI</span><span class="v" style="color:#124191;font-weight:800;">' + (cell.pci != null ? cell.pci : '—') + '</span></div>' +
        '<div class="info-row"><span class="k">RSI</span><span class="v">' + (cell.rsi || '—') + '</span></div>';
    }

    const antSection =
      '<div class="info-section-title">Antenna</div>' +
      '<div class="info-row"><span class="k">Azimuth</span><span class="v">' + cell.bore + '°</span></div>' +
      '<div class="info-row"><span class="k">Height</span><span class="v">' + (cell.height || '—') + '</span></div>';

    const locSection =
      '<div class="info-section-title">Location</div>' +
      '<div class="info-row"><span class="k">Latitude</span><span class="v">' + cell.lat.toFixed(6) + '</span></div>' +
      '<div class="info-row"><span class="k">Longitude</span><span class="v">' + cell.long.toFixed(6) + '</span></div>';

    const commentSection =
      '<div class="info-section-title">Comments</div>' +
      '<div id="cellCommentDisplay" style="background:#F9FBFE;border-radius:8px;padding:12px;font-size:12.5px;color:#0C1B3D;line-height:1.5;min-height:40px;margin-bottom:8px;white-space:pre-wrap;">' +
        (cell.comment ? escapeHtml(cell.comment) : '<em style="color:#94A3B8;">No comments yet</em>') +
      '</div>' +
      '<div style="display:flex;gap:6px;">' +
        '<button class="btn btn-secondary" style="flex:1;justify-content:center;font-size:12px;padding:8px;" onclick="openCommentEditor(' + cell.id + ')">' +
          (cell.comment ? 'Edit' : 'Add') + ' Comment' +
        '</button>' +
        (cell.comment ? '<button class="btn btn-danger" style="font-size:12px;padding:8px;" onclick="deleteComment(' + cell.id + ')">Delete</button>' : '') +
      '</div>';

    let techBadge;
    if (cell.tech === 'GSM') {
      const bandLabel = cell.gsmBand === '1800' ? 'GSM 2G · 1800 MHz' :
                        cell.gsmBand === '900' ? 'GSM 2G · 900 MHz' :
                        'GSM 2G';
      const badgeBg = cell.gsmBand === '1800' ? '#F3E8FF' : '#FDF1DC';
      const badgeColor = cell.gsmBand === '1800' ? '#7C3AED' : '#8A5A00';
      techBadge = '<span style="background:' + badgeBg + ';color:' + badgeColor + ';padding:3px 10px;border-radius:12px;font-size:10.5px;font-weight:800;">' + bandLabel + '</span>';
    } else if (cell.tech === 'LTE') {
      techBadge = '<span style="background:#EAF2FB;color:#124191;padding:3px 10px;border-radius:12px;font-size:10.5px;font-weight:800;">LTE 4G</span>';
    } else if (cell.tech === '3G') {
      const bandLabel = cell.gsmBand === '2100' ? '3G UMTS · 2100 MHz' :
                        cell.gsmBand === '900' ? '3G UMTS · 900 MHz' :
                        '3G UMTS';
      const badgeBg = cell.gsmBand === '2100' ? '#CCFBF1' : '#D1FAE5';
      const badgeColor = cell.gsmBand === '2100' ? '#0F766E' : '#047857';
      techBadge = '<span style="background:' + badgeBg + ';color:' + badgeColor + ';padding:3px 10px;border-radius:12px;font-size:10.5px;font-weight:800;">' + bandLabel + '</span>';
    } else {
      techBadge = '<span style="background:#F4F7FB;color:#5A6B87;padding:3px 10px;border-radius:12px;font-size:10.5px;font-weight:800;">Unknown</span>';
    }

    body.innerHTML =
      '<div style="margin-bottom:12px;">' + techBadge + '</div>' +
      '<div class="info-section-title">Cell Info</div>' +
      '<div class="info-row"><span class="k">Cell Name</span><span class="v">' + escapeHtml(cell.cell_name) + '</span></div>' +
      '<div class="info-row"><span class="k">Site</span><span class="v">' + escapeHtml(cell.site) + '</span></div>' +
      '<div class="info-row"><span class="k">Sector</span><span class="v">' + escapeHtml(cell.sector) + '</span></div>' +
      rfSection + antSection + locSection + commentSection +
      '<div style="display:flex;gap:8px;margin-top:18px;">' +
        '<a href="' + gmapsLink + '" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:9px;background:#124191;color:#fff;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;">Maps</a>' +
        '<a href="' + streetLink + '" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:9px;background:#1F9D55;color:#fff;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;">Street View</a>' +
      '</div>';
  }

  function closeSiteInfo() {
    const card = document.getElementById('siteInfoCard');
    if (card) card.classList.remove('show');
  }

  function openCommentEditor(cellId) {
    const cell = State.allCells.find(c => c.id === cellId);
    if (!cell) { toast('Cell not found', 'error'); return; }

    const existing = document.getElementById('commentEditorModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'commentEditorModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(12,27,61,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:5000;padding:20px;';

    const currentText = cell.comment || '';

    modal.innerHTML =
      '<div style="background:#fff;border-radius:14px;width:100%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.3);">' +
        '<div style="padding:16px 22px;border-bottom:1px solid #E9EEF6;display:flex;align-items:center;justify-content:space-between;">' +
          '<div>' +
            '<div style="font-size:15px;font-weight:800;color:#0C1B3D;">Comment on Cell</div>' +
            '<div style="font-size:12px;color:#5A6B87;margin-top:2px;font-family:monospace;">' + escapeHtml(cell.cell_name) + '</div>' +
          '</div>' +
          '<button onclick="document.getElementById(\'commentEditorModal\').remove()" style="width:32px;height:32px;border-radius:8px;background:#FCEAEA;color:#D64545;border:none;cursor:pointer;font-size:16px;font-family:inherit;">X</button>' +
        '</div>' +
        '<div style="padding:18px 22px;">' +
          '<label style="display:block;font-size:12px;font-weight:700;color:#5A6B87;text-transform:uppercase;margin-bottom:6px;">Comment</label>' +
          '<textarea id="commentTextarea" rows="5" placeholder="Write your comment..." style="width:100%;padding:10px 14px;border:1.5px solid #D7DEEA;border-radius:8px;font-size:13px;font-family:inherit;outline:none;resize:vertical;background:#FBFCFE;">' + escapeHtml(currentText) + '</textarea>' +
          '<div style="font-size:11px;color:#94A3B8;margin-top:6px;">Visible to team · supports text</div>' +
        '</div>' +
        '<div style="padding:14px 22px;background:#FBFCFE;border-top:1px solid #E9EEF6;display:flex;gap:8px;justify-content:flex-end;border-radius:0 0 14px 14px;">' +
          '<button onclick="document.getElementById(\'commentEditorModal\').remove()" style="padding:8px 16px;background:#fff;color:#5A6B87;border:1.5px solid #D7DEEA;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>' +
          '<button id="commentSaveBtn" onclick="saveComment(' + cellId + ')" style="padding:8px 20px;background:#124191;color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target.id === 'commentEditorModal') modal.remove();
    });

    setTimeout(() => {
      const ta = document.getElementById('commentTextarea');
      if (ta) {
        ta.focus();
        ta.addEventListener('keydown', e => {
          if (e.key === 'Escape') modal.remove();
          if (e.key === 'Enter' && e.ctrlKey) saveComment(cellId);
        });
      }
    }, 100);
  }

  async function saveComment(cellId) {
    const ta = document.getElementById('commentTextarea');
    if (!ta) return;

    const text = ta.value.trim();
    const btn = document.getElementById('commentSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const { error } = await db.from('rf_cells')
        .update({ comment: text || null }).eq('id', cellId);
      if (error) throw error;

      const cell = State.allCells.find(c => c.id === cellId);
      if (cell) cell.comment = text || null;

      if (typeof persistCellsCache === 'function') persistCellsCache();
      toast('Comment saved', 'success');

      document.getElementById('commentEditorModal').remove();

      if (cell) showSiteInfo(cell);
    } catch (e) {
      console.error(e);
      toast('Save failed: ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  }

  async function deleteComment(cellId) {
    if (!confirm('Delete this comment?')) return;

    try {
      const { error } = await db.from('rf_cells')
        .update({ comment: null }).eq('id', cellId);
      if (error) throw error;

      const cell = State.allCells.find(c => c.id === cellId);
      if (cell) cell.comment = null;

      if (typeof persistCellsCache === 'function') persistCellsCache();
      toast('Comment deleted', 'success');

      if (cell) showSiteInfo(cell);
    } catch (e) {
      console.error(e);
      toast('Delete failed: ' + e.message, 'error');
    }
  }

  window.showSiteInfo = showSiteInfo;
  window.closeSiteInfo = closeSiteInfo;
  window.openCommentEditor = openCommentEditor;
  window.saveComment = saveComment;
  window.deleteComment = deleteComment;

  console.log('✅ Map comments loaded');
})();
