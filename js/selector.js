// selector.js — Buscador con tabla para elegir artículos (venta, compra, entrada/salida).
// Se escribe para buscar; la lista sale en tabla con columnas y separada por grupos.
const Selector = {
  panel: null, input: null, cfg: null, idx: -1,

  // cfgFn() devuelve: { columnas: [{t, der}], grupos: [{titulo, filas: [{id, celdas, buscar, apagado}]}], extra: {t, accion}, onElegir(id) }
  conectar(input, cfgFn) {
    if (!input) return;
    input.setAttribute('autocomplete', 'off');
    input.classList.add('selx-input');
    const abrir = () => { if (this.input !== input) this.abrir(input, cfgFn); };
    input.addEventListener('focus', abrir);
    input.addEventListener('click', abrir);
    input.addEventListener('input', () => { if (this.input !== input) this.abrir(input, cfgFn); else { this.idx = -1; this.pintar(); } });
    input.addEventListener('keydown', e => this.tecla(e));
  },

  abrir(input, cfgFn) {
    this.cerrar();
    this.input = input;
    this.cfg = cfgFn();
    this.idx = -1;
    this.panel = document.createElement('div');
    this.panel.className = 'selx-panel';
    this.panel.addEventListener('mousedown', e => e.preventDefault());   // que el buscador no pierda el foco
    document.body.appendChild(this.panel);
    this.pintar();
  },

  pintar() {
    if (!this.panel) return;
    const q = this.input.value.toLowerCase().trim();
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const cols = this.cfg.columnas;
    let cuerpo = '';
    this.cfg.grupos.forEach(g => {
      const filas = g.filas.filter(f => !q || f.buscar.toLowerCase().includes(q));
      if (!filas.length) return;
      if (g.titulo) cuerpo += `<tr class="selx-grupo"><td colspan="${cols.length}">${esc(g.titulo)}</td></tr>`;
      cuerpo += filas.map(f => `<tr class="selx-fila${f.apagado ? ' apagado' : ''}" data-id="${f.id}">${f.celdas.map((c, i) =>
        `<td${cols[i].der ? ' class="der"' : ''}>${c}</td>`).join('')}</tr>`).join('');
    });
    if (this.cfg.extra) cuerpo += `<tr class="selx-fila selx-extra" data-id="__extra"><td colspan="${cols.length}">${esc(this.cfg.extra.t)}</td></tr>`;
    this.panel.innerHTML = `<table class="selx-tabla"><thead><tr>${cols.map(c => `<th${c.der ? ' class="der"' : ''}>${c.t}</th>`).join('')}</tr></thead>
      <tbody>${cuerpo || `<tr><td colspan="${cols.length}" class="muted" style="padding:14px">Sin resultados</td></tr>`}</tbody></table>`;
    this.panel.querySelectorAll('.selx-fila').forEach(tr => tr.addEventListener('click', () => this.elegir(tr.dataset.id)));
    this.marcar();
    this.posicion();
  },

  posicion() {
    if (!this.panel || !this.input) return;
    const r = this.input.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const ancho = Math.min(Math.max(r.width, this.cfg.ancho || 520), vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - ancho - 8));
    const abajo = vh - r.bottom - 12, arriba = r.top - 12;
    const alto = Math.min(380, Math.max(abajo, arriba));
    Object.assign(this.panel.style, { left: left + 'px', width: ancho + 'px', maxHeight: alto + 'px' });
    if (abajo >= 220 || abajo >= arriba) { this.panel.style.top = (r.bottom + 4) + 'px'; this.panel.style.bottom = ''; }
    else { this.panel.style.top = ''; this.panel.style.bottom = (vh - r.top + 4) + 'px'; }
  },

  filasVisibles() { return this.panel ? [...this.panel.querySelectorAll('.selx-fila')] : []; },
  marcar() {
    this.filasVisibles().forEach((tr, i) => tr.classList.toggle('on', i === this.idx));
    const on = this.panel && this.panel.querySelector('.selx-fila.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  },
  tecla(e) {
    if (!this.panel) return;
    const n = this.filasVisibles().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.idx = Math.min(n - 1, this.idx + 1); this.marcar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.idx = Math.max(0, this.idx - 1); this.marcar(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const filas = this.filasVisibles();
      const tr = filas[this.idx] || (filas.length === 1 ? filas[0] : null);
      if (tr) this.elegir(tr.dataset.id);
    }
    else if (e.key === 'Escape') { e.stopPropagation(); this.cerrar(); }
  },

  elegir(id) {
    const cfg = this.cfg, input = this.input;
    this.cerrar();
    if (id === '__extra') return cfg.extra.accion();
    if (cfg.mantenerTexto) input.value = cfg.texto ? cfg.texto(id) : input.value;
    else input.value = '';
    cfg.onElegir(id);
    if (!cfg.mantenerTexto) input.blur();
  },

  cerrar() {
    if (this.panel) this.panel.remove();
    this.panel = null; this.input = null; this.cfg = null; this.idx = -1;
  },

  // Filas de artículos con existencia, para usar en venta, compra y entrada/salida
  gruposArticulos(precio) {
    const tipos = [['celular', 'Celulares'], ['pieza', 'Piezas'], ['accesorio', 'Accesorios']];
    const items = Repo.get('items').slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    return tipos.map(([t, titulo]) => ({
      titulo,
      filas: items.filter(i => i.tipo === t).map(i => {
        const hay = i.stock || 0;
        return { id: i.id, buscar: (i.codigo || '') + ' ' + i.nombre, apagado: i.controlInv && hay <= 0,
          celdas: [i.codigo || '', i.nombre, Utils.formatMoney(precio === 'costo' ? i.costo : i.precio),
            i.controlInv ? `<span class="${hay <= 0 ? 'selx-cero' : ''}">${hay}</span>` : '—'] };
      })
    }));
  }
};
window.Selector = Selector;
document.addEventListener('mousedown', e => {
  if (Selector.panel && !Selector.panel.contains(e.target) && e.target !== Selector.input) Selector.cerrar();
});
window.addEventListener('resize', () => Selector.posicion());
document.addEventListener('scroll', e => { if (Selector.panel && !Selector.panel.contains(e.target)) Selector.posicion(); }, true);
