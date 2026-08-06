/* ============================================================
   TABLAX — Orden y filtros por columna en TODAS las tablas
   (patrón portado de HATTA → Historial de registros)
   ------------------------------------------------------------
   · Cada columna gana: botón de orden (▲/▼) + botón de filtro ▾
   · El filtro abre un popover con valores únicos, conteos,
     buscador, Todos/Ninguno y Aplicar/Quitar (igual que HATTA)
   · Funciona sobre el DOM: no toca los renders de los módulos.
     Un MutationObserver re-aplica orden y filtros tras cada
     re-render del tbody.
   · Columnas numéricas (montos) solo ordenan, como los ⏱ de HATTA.
   ============================================================ */

const TablaX = {

  _estado: {},                    // clave de tabla → { sort:{col,dir}, filtros:{col:Set} }
  _obs: new WeakMap(),            // tabla → MutationObserver
  _ctx: null,                     // { tabla, col } del popover abierto

  /* ---------- Montaje (lo llama App tras navegar) ---------- */
  montar(vistaEl){
    if(!vistaEl) return;
    vistaEl.querySelectorAll('table.tabla').forEach((t, i) =>
      TablaX._montarTabla(t, vistaEl.id + '#' + i));
  },

  _montarTabla(tabla, clave){
    tabla.dataset.txClave = clave;
    if(!tabla.dataset.tx){
      tabla.dataset.tx = '1';
      const ths = tabla.querySelectorAll('thead th');
      ths.forEach((th, idx) => {
        const texto = th.textContent.trim();
        if(!texto) return;                                   // columna de acciones
        th.dataset.txCol = idx;
        th.innerHTML = `
          <div class="th-in">
            <button type="button" class="hcol">${U.esc(texto)} <span class="sort-ind"></span></button>
            <button type="button" class="hfilter" title="Filtrar">▾</button>
          </div>`;
        th.querySelector('.hcol').onclick = () => TablaX.ordenar(tabla, idx);
        th.querySelector('.hfilter').onclick = (e) => TablaX.abrirFiltro(e, tabla, idx);
      });
      const tb = tabla.tBodies[0];
      if(tb){
        const obs = new MutationObserver(() => TablaX.aplicar(tabla));
        obs.observe(tb, { childList:true });
        TablaX._obs.set(tabla, obs);
      }
    }
    TablaX.aplicar(tabla);
  },

  /* ---------- Estado y lectura de celdas ---------- */
  _st(tabla){
    return TablaX._estado[tabla.dataset.txClave] ||
      (TablaX._estado[tabla.dataset.txClave] = { sort:null, filtros:{} });
  },
  _filas(tabla){
    const tb = tabla.tBodies[0];
    return tb ? [...tb.rows].filter(r => !r.querySelector('.empty')) : [];
  },
  _valor(fila, col){
    const c = fila.cells[col];
    return c ? c.textContent.replace(/\s+/g,' ').trim() : '';
  },

  /* Detección de tipo por muestreo: moneda/número, fecha dd/mm/aaaa, o texto */
  _tipoCol(tabla, col){
    const filas = TablaX._filas(tabla).slice(0, 20);
    if(!filas.length) return 'texto';
    let num = 0, fec = 0;
    for(const f of filas){
      const v = TablaX._valor(f, col);
      if(!v || v === '—') continue;
      if(/^\d{2}\/\d{2}\/\d{4}/.test(v)) fec++;
      else if(/^(RD\$|\$)?\s?-?[\d.,]+%?$/.test(v)) num++;
    }
    if(fec > filas.length * .5) return 'fecha';
    if(num > filas.length * .5) return 'num';
    return 'texto';
  },
  _aNumero(v){
    const limpio = String(v).replace(/[^\d,.-]/g,'').replace(/,/g,'');
    const n = parseFloat(limpio);
    return isNaN(n) ? -Infinity : n;
  },
  _aFecha(v){
    const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? m[3] + m[2] + m[1] : '';
  },

  /* ---------- Orden ---------- */
  ordenar(tabla, col, dir){
    const st = TablaX._st(tabla);
    if(dir) st.sort = { col, dir };
    else if(st.sort && st.sort.col === col)
      st.sort.dir = st.sort.dir === 'asc' ? 'desc' : 'asc';
    else st.sort = { col, dir:'asc' };
    TablaX.cerrarPop();
    TablaX.aplicar(tabla);
  },

  /* ---------- Aplicar filtros + orden + indicadores ---------- */
  aplicar(tabla){
    const obs = TablaX._obs.get(tabla);
    if(obs) obs.disconnect();

    const st = TablaX._st(tabla);
    const filas = TablaX._filas(tabla);

    filas.forEach(f => {
      let ver = true;
      for(const col in st.filtros){
        const set = st.filtros[col];
        if(set && set.size && !set.has(TablaX._valor(f, +col))){ ver = false; break; }
      }
      f.style.display = ver ? '' : 'none';
    });

    if(st.sort){
      const { col, dir } = st.sort;
      const tipo = TablaX._tipoCol(tabla, col);
      const clave = v =>
        tipo === 'num'   ? TablaX._aNumero(v) :
        tipo === 'fecha' ? TablaX._aFecha(v) : v.toLowerCase();
      const mult = dir === 'asc' ? 1 : -1;
      filas.slice().sort((a, b) => {
        const va = clave(TablaX._valor(a, col)), vb = clave(TablaX._valor(b, col));
        if(va < vb) return -1 * mult;
        if(va > vb) return  1 * mult;
        return 0;
      }).forEach(f => f.parentNode.appendChild(f));
    }

    tabla.querySelectorAll('th[data-tx-col]').forEach(th => {
      const i = +th.dataset.txCol;
      const ind = th.querySelector('.sort-ind');
      if(ind) ind.textContent = st.sort && st.sort.col === i ? (st.sort.dir === 'asc' ? '▲' : '▼') : '';
      const hf = th.querySelector('.hfilter');
      if(hf){
        hf.classList.toggle('active', !!(st.filtros[i] && st.filtros[i].size));
        if(TablaX._tipoCol(tabla, i) === 'num') hf.style.display = 'none';   // montos: solo orden
      }
    });

    if(obs && tabla.tBodies[0]) obs.observe(tabla.tBodies[0], { childList:true });
  },

  /* ---------- Popover de filtro (clon del de HATTA) ---------- */
  _pop(){
    let p = document.getElementById('tx-pop');
    if(!p){
      p = document.createElement('div');
      p.id = 'tx-pop';
      document.body.appendChild(p);
      document.addEventListener('mousedown', e => {
        if(p.style.display === 'block' && !p.contains(e.target)) TablaX.cerrarPop();
      });
    }
    return p;
  },

  abrirFiltro(e, tabla, col){
    e.stopPropagation();
    const pop = TablaX._pop();
    TablaX._ctx = { tabla, col };
    const st = TablaX._st(tabla);
    const cur = st.filtros[col];

    const conteos = new Map();
    TablaX._filas(tabla).forEach(f => {
      const v = TablaX._valor(f, col);
      if(v) conteos.set(v, (conteos.get(v) || 0) + 1);
    });
    const vals = [...conteos.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], 'es', { numeric:true }));

    const titulo = tabla.querySelector(`th[data-tx-col="${col}"] .hcol`).textContent.replace(/[▲▼]/g,'').trim();

    if(!vals.length){
      pop.innerHTML = `<div class="pop-empty">Sin valores para filtrar</div>`;
    }else{
      const items = vals.map(([v, count]) => `
        <label class="pop-item">
          <input type="checkbox" value="${U.esc(v)}" ${(!cur || cur.has(v)) ? 'checked' : ''}>
          <span class="pop-val">${U.esc(v)}</span><span class="pop-count">${count}</span>
        </label>`).join('');
      const buscador = vals.length > 8
        ? `<input type="text" class="pop-search" placeholder="Buscar…" oninput="TablaX.buscarEnPop(this.value)">` : '';
      pop.innerHTML = `
        <div class="pop-header"><strong>Filtrar ${U.esc(titulo)}</strong>
          <button type="button" class="pop-close" onclick="TablaX.cerrarPop()">×</button></div>
        <div class="pop-sort">
          <button type="button" onclick="TablaX.ordenarDesdePop('asc')">↑ A→Z</button>
          <button type="button" onclick="TablaX.ordenarDesdePop('desc')">↓ Z→A</button>
        </div>
        ${buscador}
        <div class="pop-tools">
          <button type="button" onclick="TablaX.marcarPop(true)">Todos</button>
          <button type="button" onclick="TablaX.marcarPop(false)">Ninguno</button>
        </div>
        <div class="pop-list">${items}</div>
        <div class="pop-actions">
          <button type="button" class="btn-mini" onclick="TablaX.quitarFiltro()">Quitar</button>
          <button type="button" class="btn-mini primary" onclick="TablaX.aplicarFiltro()">Aplicar</button>
        </div>`;
    }

    pop.style.display = 'block';
    const r = e.currentTarget.getBoundingClientRect();
    requestAnimationFrame(() => {
      const pw = pop.offsetWidth || 260;
      pop.style.top = Math.max(8, r.bottom + 6) + 'px';
      pop.style.left = Math.min(Math.max(r.left - pw + 30, 8), (window.innerWidth || 1200) - pw - 8) + 'px';
    });
  },

  buscarEnPop(q){
    q = (q || '').toLowerCase();
    document.querySelectorAll('#tx-pop .pop-item').forEach(it => {
      const v = it.querySelector('.pop-val').textContent.toLowerCase();
      it.style.display = v.includes(q) ? 'flex' : 'none';
    });
  },
  marcarPop(estado){
    document.querySelectorAll('#tx-pop .pop-item').forEach(it => {
      if(it.style.display !== 'none') it.querySelector('input').checked = estado;
    });
  },
  ordenarDesdePop(dir){
    const { tabla, col } = TablaX._ctx || {};
    if(tabla) TablaX.ordenar(tabla, col, dir);
  },
  aplicarFiltro(){
    const { tabla, col } = TablaX._ctx || {};
    if(!tabla) return;
    const boxes = [...document.querySelectorAll('#tx-pop .pop-list input')];
    const marcados = boxes.filter(b => b.checked).map(b => b.value);
    const st = TablaX._st(tabla);
    if(!marcados.length || marcados.length === boxes.length) delete st.filtros[col];
    else st.filtros[col] = new Set(marcados);
    TablaX.cerrarPop();
    TablaX.aplicar(tabla);
  },
  quitarFiltro(){
    const { tabla, col } = TablaX._ctx || {};
    if(!tabla) return;
    delete TablaX._st(tabla).filtros[col];
    TablaX.cerrarPop();
    TablaX.aplicar(tabla);
  },
  cerrarPop(){
    const p = document.getElementById('tx-pop');
    if(p) p.style.display = 'none';
  },
};
