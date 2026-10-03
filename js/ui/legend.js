/* =========================================================
   🎨 TOOL LEGEND — Legend تفاعلي لكل الأدوات
   ========================================================= */
(function() {
  'use strict';

  const ToolLegend = {
    items: [],
    onToggleCallback: null,
    container: null,
    _initialized: false,

    init() {
      if (this._initialized) return;
      this.container = document.getElementById('toolLegend');
      this._initialized = true;
    },

    show(options) {
      this.init();
      const opts = options || {};
      this.items = (opts.items || []).map(i => ({
        id: i.id,
        color: i.color || '#999',
        label: i.label || i.id,
        count: i.count != null ? i.count : null,
        dashed: !!i.dashed,
        active: i.active !== false
      }));
      this.onToggleCallback = opts.onToggle || null;

      const iconEl = document.getElementById('toolLegendIcon');
      const titleEl = document.getElementById('toolLegendTitle');
      if (iconEl) iconEl.textContent = opts.icon || '🎯';
      if (titleEl) titleEl.textContent = opts.title || 'Legend';

      this.render();
      if (this.container) this.container.classList.add('show');
    },

    render() {
      const itemsEl = document.getElementById('toolLegendItems');
      if (!itemsEl) return;

      itemsEl.innerHTML = this.items.map(item => {
        const colorStyle = item.dashed
          ? 'background: transparent; border: 2px dashed ' + item.color + ';'
          : 'background: ' + item.color + '; border: 1px solid rgba(0,0,0,.15);';
        return (
          '<label class="tool-legend-item' + (item.active === false ? ' disabled' : '') + '" data-id="' + item.id + '">' +
            '<input type="checkbox"' + (item.active !== false ? ' checked' : '') + '>' +
            '<span class="tool-legend-color" style="' + colorStyle + '"></span>' +
            '<span class="tool-legend-label">' + item.label + '</span>' +
            (item.count != null ? '<span class="tool-legend-count">' + item.count + '</span>' : '') +
          '</label>'
        );
      }).join('');

      itemsEl.querySelectorAll('.tool-legend-item').forEach(el => {
        const id = el.getAttribute('data-id');
        const cb = el.querySelector('input[type="checkbox"]');
        if (cb) cb.addEventListener('change', () => this.toggle(id));
      });
    },

    toggle(id) {
      const item = this.items.find(i => i.id === id);
      if (!item) return;
      item.active = !item.active;
      this.render();
      if (typeof this.onToggleCallback === 'function') {
        this.onToggleCallback(item, this.items);
      }
    },

    toggleAll(active) {
      this.items.forEach(i => i.active = !!active);
      this.render();
      if (typeof this.onToggleCallback === 'function') {
        this.onToggleCallback(null, this.items);
      }
    },

    invert() {
      this.items.forEach(i => i.active = !i.active);
      this.render();
      if (typeof this.onToggleCallback === 'function') {
        this.onToggleCallback(null, this.items);
      }
    },

    isActive(id) {
      const item = this.items.find(i => i.id === id);
      return item ? item.active !== false : true;
    },

    hide() {
      if (this.container) this.container.classList.remove('show');
      this.items = [];
      this.onToggleCallback = null;
    },

    activeIds() {
      return this.items.filter(i => i.active !== false).map(i => i.id);
    }
  };

  window.ToolLegend = ToolLegend;
  console.log('✅ ToolLegend loaded');
})();
