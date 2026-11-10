// tablax.js — Filtro tipo Excel para todas las tablas del sistema.
// Cada encabezado trae su botón: ordenar, buscar y marcar/desmarcar valores.
// No toca los módulos: mira cada tabla y, cada vez que el módulo la vuelve a pintar,
// le aplica de nuevo el filtro y el orden que el usuario dejó puestos.
const TablaX = {
  estado: {},          // por tabla (id del tbody): { filtros: { col: Set de valores }, orden: { col, dir } }
  obs: {},             // un observador por tabla
  pop: null,           // menú abierto
  popInfo: null,

  icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  iconoFiltro: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>',
  iconoAsc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  iconoDesc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',

  init() {
    document.querySelectorAll('main .tabla').forEach(t => this.activar(t));
    document.addEventListener('click', e => {
      if (this.pop && !this.pop.contains(e.target) && !e.target.closest('.tx-btn, .tx-th')) this.cerrar();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.cerrar(); });
  },

  // Pone los botones en una tabla. reiniciar = olvidar filtros anteriores (tablas de ventanas que se rehacen)
  activar(tabla, reiniciar) {
    const tbody = tabla && tabla.tBodies[0];
    if (!tbody || !tabla.tHead) return;
    if (!tbody.id) tbody.id = 'tx-' + Math.random().toString(36).slice(2, 8);
    const key = tbody.id;
    if (reiniciar || !this.estado[key]) this.estado[key] = { filtros: {}, orden: null };
    [...tabla.tHead.rows[0].cells].forEach((th, i) => {
      if (th.querySelector('.tx-btn') || th.classList.contains('tx-no') || !th.textContent.trim()) return;
      th.classList.add('tx-th');
      th.insertAdjacentHTML('beforeend',
        `<button type="button" class="tx-btn" onclick="event.stopPropagation();TablaX.abrir(this,'${key}',${i})">${this.icono}</button>`);
      th.addEventListener('click', e => { if (!e.target.closest('.tx-btn')) th.querySelector('.tx-btn').click(); });
    });
    if (this.obs[key]) this.obs[key].disconnect();
    this.obs[key] = new MutationObserver(() => this.aplicar(key));
    this.obs[key].observe(tbody, { childList: true });
    this.aplicar(key);
  },

  // ---------- Lectura de celdas ----------
  valor(td) {
    if (!td) return '';
    if (td.dataset.f !== undefined) return td.dataset.f;
    const c = td.cloneNode(true);
    c.querySelectorAll('.sub-dato, button, input, select, .tx-ignorar').forEach(x => x.remove());
    const v = c.textContent.replace(/\s+/g, ' ').trim();
    return v === '—' ? '' : v;
  },
  valores(tr) { return tr._tx || (tr._tx = [...tr.cells].map(td => this.valor(td))); },
  filas(tbody) {
    return [...tbody.rows].filter(tr => !tr.classList.contains('tx-vacia') && !(tr.cells.length === 1 && tr.cells[0].colSpan > 1));
  },
  num(v) {
    const s = String(v).replace(/RD\$|\s|,|%/g, '');
    return /^[-+]?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
  },
  fecha(v) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
    return m ? m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0') : null;
  },
  tipoCol(filas, col) {
    const vs = filas.map(tr => this.valores(tr)[col]).filter(v => v !== '');
    if (!vs.length) return 'texto';
    if (vs.every(v => this.fecha(v))) return 'fecha';
    if (vs.every(v => !isNaN(this.num(v)))) return 'num';
    return 'texto';
  },
  comparar(a, b, tipo) {
    if (a === b) return 0;
    if (a === '') return 1;      // vacías siempre al final
    if (b === '') return -1;
    if (tipo === 'num') return this.num(a) - this.num(b);
    if (tipo === 'fecha') return this.fecha(a).localeCompare(this.fecha(b));
    return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
  },
  pasa(tr, filtros, menosCol) {
    const v = this.valores(tr);
    return !tr.dataset.txOculta && Object.keys(filtros).every(c => +c === menosCol || filtros[c].has(v[c]));
  },

  // ---------- Aplicar filtro y orden ----------
  aplicar(key) {
    const tbody = document.getElementById(key);
    const st = this.estado[key];
    if (!tbody || !st) return;
    const obs = this.obs[key];
    if (obs) obs.disconnect();            // lo que se mueve aquí no debe disparar otra vuelta
    tbody.querySelectorAll('.tx-vacia').forEach(tr => tr.remove());
    const filas = this.filas(tbody);
    filas.forEach((tr, i) => { if (tr._txi === undefined) tr._txi = i; });   // orden original del módulo

    if (!st.orden && filas.some((tr, i) => tr._txi !== i)) {
      filas.slice().sort((a, b) => a._txi - b._txi).forEach(tr => tbody.appendChild(tr));
    }
    if (st.orden && filas.length) {
      const { col, dir } = st.orden;
      const tipo = this.tipoCol(filas, col);
      filas.map(tr => ({ tr, i: tr._txi, v: this.valores(tr)[col] }))
        .sort((a, b) => {
          if (a.v === '' || b.v === '') return this.comparar(a.v, b.v, tipo) || a.i - b.i;
          return (dir === 'desc' ? -1 : 1) * this.comparar(a.v, b.v, tipo) || a.i - b.i;
        })
        .forEach(x => tbody.appendChild(x.tr));
    }

    let vis = 0;
    filas.forEach(tr => {
      const ok = this.pasa(tr, st.filtros);
      tr.style.display = ok ? '' : 'none';
      if (ok) vis++;
    });
    const hayFiltro = Object.keys(st.filtros).length > 0;
    if (filas.length && !vis) {
      const cols = tbody.closest('table')?.tHead?.rows[0]?.cells.length || 1;
      tbody.insertAdjacentHTML('beforeend', `<tr class="tx-vacia"><td colspan="${cols}" class="muted">Sin resultados</td></tr>`);
    }
    if (obs) obs.observe(tbody, { childList: true });
    this.pintarBotones(key);
    this.contador(tbody, hayFiltro, vis, filas.length);
  },

  pintarBotones(key) {
    const tbody = document.getElementById(key);
    const st = this.estado[key];
    const tabla = tbody && tbody.closest('table');
    if (!tabla || !tabla.tHead) return;
    [...tabla.tHead.rows[0].cells].forEach((th, i) => {
      const b = th.querySelector('.tx-btn');
      if (!b) return;
      const filtrada = !!st.filtros[i];
      const orden = st.orden && st.orden.col === i ? st.orden.dir : '';
      b.classList.toggle('tx-activo', filtrada || !!orden);
      b.innerHTML = filtrada ? this.iconoFiltro : !orden ? this.icono : (orden === 'asc' ? this.iconoAsc : this.iconoDesc);
    });
  },

  // "12 de 50 facturas" y botón para quitar todo, en la barra de la misma pestaña
  contador(tbody, hayFiltro, vis, total) {
    const zona = tbody.closest('.subtab-panel, .modal, .vista');
    if (!zona) return;
    const el = zona.querySelector('.toolbar-count');
    if (el) {
      if (el.dataset.tx !== el.textContent) el.dataset.base = el.textContent;   // el módulo lo reescribió
      el.textContent = hayFiltro ? `${vis} de ${el.dataset.base || total}` : (el.dataset.base || el.textContent);
      el.dataset.tx = el.textContent;
    }
    const barra = zona.querySelector('.toolbar');
    let btn = barra && barra.querySelector('.tx-limpiar');
    const st = this.estado[tbody.id];
    const algo = hayFiltro || !!st.orden;
    if (barra && algo && !btn) {
      barra.insertAdjacentHTML('beforeend', `<button type="button" class="btn btn-sm tx-limpiar" onclick="TablaX.limpiar('${tbody.id}')">Quitar filtros</button>`);
    } else if (btn && !algo) btn.remove();
  },

  // ---------- Menú del encabezado ----------
  abrir(btn, key, col) {
    if (this.popInfo && this.popInfo.key === key && this.popInfo.col === col) return this.cerrar();
    this.cerrar();
    const tbody = document.getElementById(key);
    const st = this.estado[key];
    if (!tbody || !st) return;
    const filas = this.filas(tbody);
    const tipo = this.tipoCol(filas, col);
    const vals = [...new Set(filas.filter(tr => this.pasa(tr, st.filtros, col)).map(tr => this.valores(tr)[col]))]
      .sort((a, b) => this.comparar(a, b, tipo));
    const actual = st.filtros[col];
    const etq = tipo === 'num' ? ['de menor a mayor', 'de mayor a menor']
      : tipo === 'fecha' ? ['del más antiguo al más reciente', 'del más reciente al más antiguo']
      : ['de A a Z', 'de Z a A'];
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const lista = vals.map((v, i) => `<label class="tx-item"><input type="checkbox" data-i="${i}" ${!actual || actual.has(v) ? 'checked' : ''}>
      <span>${v === '' ? '<i class="muted">(Vacías)</i>' : esc(v)}</span></label>`).join('');

    const pop = document.createElement('div');
    pop.className = 'tx-pop';
    pop.innerHTML = `
      <button type="button" class="tx-op" onclick="TablaX.ordenar('asc')">Ordenar ${etq[0]}</button>
      <button type="button" class="tx-op" onclick="TablaX.ordenar('desc')">Ordenar ${etq[1]}</button>
      <button type="button" class="tx-op" onclick="TablaX.borrar()" ${actual ? '' : 'disabled'}>Borrar filtro</button>
      <div class="tx-sep"></div>
      <div class="tx-cuerpo">
        <input type="text" class="form-input tx-buscar" placeholder="Buscar" oninput="TablaX.buscarLista(this.value)"
          onkeydown="if(event.key==='Enter')TablaX.aceptar()">
        <div class="tx-lista">
          <label class="tx-item tx-todo"><input type="checkbox" onchange="TablaX.marcarTodo(this.checked)"> <span>(Seleccionar todo)</span></label>
          ${lista || '<div class="muted tx-nada">Sin datos</div>'}
        </div>
      </div>
      <div class="tx-pie">
        <button type="button" class="btn btn-sm" onclick="TablaX.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-sm btn-primary" onclick="TablaX.aceptar()">Aceptar</button>
      </div>`;
    document.body.appendChild(pop);
    this.pop = pop;
    this.popInfo = { key, col, vals };
    pop.querySelectorAll('.tx-item:not(.tx-todo) input').forEach(i => i.addEventListener('change', () => this.revisarTodo()));
    this.revisarTodo();

    // Debajo del botón, sin salirse de la pantalla
    const r = btn.getBoundingClientRect();
    const ancho = pop.offsetWidth;
    let left = r.left + window.scrollX;
    left = Math.min(left, window.scrollX + document.documentElement.clientWidth - ancho - 8);
    pop.style.left = Math.max(window.scrollX + 8, left) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 4) + 'px';
    if (window.matchMedia('(hover: hover)').matches) pop.querySelector('.tx-buscar').focus();
  },

  itemsLista() { return this.pop ? [...this.pop.querySelectorAll('.tx-item:not(.tx-todo)')] : []; },
  buscarLista(q) {
    q = q.toLowerCase().trim();
    this.itemsLista().forEach(l => { l.style.display = !q || l.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    this.revisarTodo();
  },
  marcarTodo(si) {
    this.itemsLista().filter(l => l.style.display !== 'none').forEach(l => { l.querySelector('input').checked = si; });
    this.revisarTodo();
  },
  revisarTodo() {
    const vis = this.itemsLista().filter(l => l.style.display !== 'none');
    const todo = this.pop && this.pop.querySelector('.tx-todo input');
    if (!todo) return;
    const n = vis.filter(l => l.querySelector('input').checked).length;
    todo.checked = vis.length > 0 && n === vis.length;
    todo.indeterminate = n > 0 && n < vis.length;
  },

  aceptar() {
    if (!this.pop) return;
    const { key, col, vals } = this.popInfo;
    const st = this.estado[key];
    const marcados = new Set();
    let todos = true;
    this.itemsLista().forEach(l => {
      const inp = l.querySelector('input');
      if (l.style.display !== 'none' && inp.checked) marcados.add(vals[+inp.dataset.i]);
      else todos = false;
    });
    if (!marcados.size) return Utils.toast('Marca al menos un valor');
    if (todos) delete st.filtros[col]; else st.filtros[col] = marcados;
    this.cerrar();
    this.aplicar(key);
  },
  ordenar(dir) {
    const { key, col } = this.popInfo;
    this.estado[key].orden = { col, dir };
    this.cerrar();
    this.aplicar(key);
  },
  borrar() {
    const { key, col } = this.popInfo;
    delete this.estado[key].filtros[col];
    this.cerrar();
    this.aplicar(key);
  },
  cerrar() {
    if (this.pop) this.pop.remove();
    this.pop = null;
    this.popInfo = null;
  },

  // ---------- Para usar desde los módulos ----------
  limpiar(key) {
    if (!this.estado[key]) return;
    this.estado[key] = { filtros: {}, orden: null };
    this.aplicar(key);
  },
  // Varias columnas a la vez. Ej.: TablaX.filtrarVarios('os-tbody', { Prometido: [...], Estado: [...] })
  filtrarVarios(key, mapa) {
    const tbody = document.getElementById(key);
    const tabla = tbody && tbody.closest('table');
    if (!tabla || !this.estado[key]) return;
    const titulos = [...tabla.tHead.rows[0].cells].map(th =>
      [...th.childNodes].filter(n => !(n.classList && n.classList.contains('tx-btn'))).map(n => n.textContent).join('').trim());
    const filtros = {};
    Object.entries(mapa).forEach(([t, v]) => { const c = titulos.indexOf(t); if (c >= 0) filtros[c] = new Set(v); });
    this.estado[key].filtros = filtros;
    this.aplicar(key);
  },
  // Filtra una columna por el texto de su encabezado. Ej.: TablaX.filtrarPorTitulo('inv-exi-tbody', 'Estado', ['Agotado'])
  filtrarPorTitulo(key, titulo, valores) {
    const tbody = document.getElementById(key);
    const tabla = tbody && tbody.closest('table');
    if (!tabla || !this.estado[key]) return;
    const col = [...tabla.tHead.rows[0].cells].findIndex(th =>
      [...th.childNodes].filter(n => !(n.classList && n.classList.contains('tx-btn'))).map(n => n.textContent).join('').trim() === titulo);
    if (col < 0) return;
    this.estado[key].filtros = { [col]: new Set(valores) };
    this.aplicar(key);
  }
};
window.TablaX = TablaX;
document.addEventListener('DOMContentLoaded', () => TablaX.init());
