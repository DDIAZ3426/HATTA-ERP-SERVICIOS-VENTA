// inventario.js
const InventarioUI = {
  // Un solo criterio para todo el sistema (Inventario y Dashboard dicen lo mismo)
  estados: {
    ok:      { txt: 'Disponible', color: '#16a34a' },
    agotado: { txt: 'Agotado',    color: '#dc2626' }
  },
  ordenTipo: { celular: 1, pieza: 2, accesorio: 3 },
  motivos: {
    // Lo que tiene su propio lugar no va aquí: compras (Compras), repuestos (Taller), devoluciones (Ventas)
    entrada: ['Inventario inicial', 'Corrección de conteo', 'Otro'],
    salida:  ['Dañado o defectuoso', 'Pérdida o robo', 'Garantía con el proveedor', 'Uso de la tienda', 'Corrección de conteo', 'Otro']
  },

  estadoStock(i) {
    return (i.stock || 0) <= 0 ? 'agotado' : 'ok';
  },
  pill(clave) {
    const e = this.estados[clave];
    return `<span class="estado-pill" style="--c:${e.color}">${e.txt}</span>`;
  },
  // Artículos que llevan inventario, agrupados: celulares, piezas, accesorios; y por nombre
  inventariables() {
    return Repo.get('items').filter(i => i.controlInv).slice().sort((a, b) =>
      (this.ordenTipo[a.tipo] || 9) - (this.ordenTipo[b.tipo] || 9) || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  },

  render() {
    this.renderExistencias();
    this.renderMovimientos();
    this.renderImei();
  },
  renderExistencias() {
    const q = (document.getElementById('inv-exi-buscar')?.value || '').toLowerCase().trim();
    const cat = i => (Repo.find('categorias', i.categoriaId) || {}).nombre || '';
    const items = this.inventariables();
    let list = items;
    if (q) list = list.filter(i => [i.codigo, i.nombre, cat(i)].some(v => (v || '').toLowerCase().includes(q)));
    document.getElementById('inv-count').textContent = list.length + (list.length === 1 ? ' artículo' : ' artículos');
    document.getElementById('inv-exi-tbody').innerHTML = list.map(i => {
      const valor = (i.stock || 0) * (i.costo || 0);
      return `<tr class="fila-clic" onclick="InventarioUI.verMovimientos('${i.id}')" >
        <td>${i.codigo || ''}</td><td>${i.nombre}</td><td>${Utils.etiqueta(i.tipo)}</td><td>${cat(i)}</td>
        <td style="text-align:right"><b>${i.stock || 0}</b></td>
        <td style="text-align:right">${Utils.formatMoney(i.costo)}</td><td style="text-align:right">${Utils.formatMoney(valor)}</td>
        <td>${this.pill(this.estadoStock(i))}</td>
        <td><button class="btn btn-sm" style="white-space:nowrap" onclick="event.stopPropagation();InventarioUI.nuevoAjuste('${i.id}')">+ / −</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" class="muted">Sin artículos</td></tr>';
    // Indicadores
    document.getElementById('inv-kpi-items').textContent = items.length;
    document.getElementById('inv-kpi-unidades').textContent = items.reduce((s, i) => s + Math.max(0, i.stock || 0), 0);
    document.getElementById('inv-kpi-valor').textContent = Utils.formatMoney(items.reduce((s, i) => s + (i.stock || 0) * (i.costo || 0), 0));
    document.getElementById('inv-kpi-sin').textContent = items.filter(i => this.estadoStock(i) === 'agotado').length;
  },

  // Clic en un indicador (aquí o en el Dashboard): muestra solo esos artículos
  irA(estado) {
    App.navegar('inventario', 'existencias');
    if (estado) TablaX.filtrarPorTitulo('inv-exi-tbody', 'Estado', [this.estados[estado].txt]);
    else TablaX.limpiar('inv-exi-tbody');
  },
  // Clic en un artículo: su historial de entradas y salidas
  verMovimientos(id) {
    const item = Repo.find('items', id);
    if (!item) return;
    const b = document.getElementById('inv-mov-buscar');
    if (b) b.value = '';
    App.navegar('inventario', 'movimientos');
    TablaX.filtrarPorTitulo('inv-mov-tbody', 'Artículo', [item.nombre]);
  },

  // Texto del movimiento: Venta, Compra, Entrada: Mercancía recibida, Salida: Pieza usada en reparación...
  movTexto(m) {
    if (m.tipo === 'ajuste+' || m.tipo === 'ajuste-') {
      const lado = m.tipo === 'ajuste+' ? 'Entrada' : 'Salida';
      return m.motivo ? lado + ': ' + m.motivo : Utils.etiqueta(m.tipo);
    }
    return Utils.etiqueta(m.tipo);
  },
  renderMovimientos() {
    const q = (document.getElementById('inv-mov-buscar')?.value || '').toLowerCase().trim();
    let movs = Repo.get('movimientosInv').map((m, i) => ({ m, i, item: Repo.find('items', m.itemId) || {} }));
    if (q) movs = movs.filter(x => [x.item.nombre, x.item.codigo, x.m.referencia, x.m.motivo].some(v => (v || '').toLowerCase().includes(q)));
    // Lo más reciente arriba
    movs.sort((a, b) => (b.m.fecha || '').localeCompare(a.m.fecha || '') || b.i - a.i);
    const count = document.getElementById('inv-mov-count');
    if (count) count.textContent = movs.length + (movs.length === 1 ? ' movimiento' : ' movimientos');
    document.getElementById('inv-mov-tbody').innerHTML = movs.map(({ m, item }) => {
      const entra = m.tipo === 'compra' || m.tipo === 'ajuste+';
      return `<tr><td>${Utils.formatDate(m.fecha)}</td><td>${item.codigo || ''}</td><td>${item.nombre || '(artículo borrado)'}</td>
        <td>${this.movTexto(m)}</td>
        <td style="text-align:right">${entra ? `<span class="num-entrada">${m.cantidad}</span>` : ''}</td>
        <td style="text-align:right">${entra ? '' : `<span class="num-salida">${m.cantidad}</span>`}</td>
        <td>${m.referencia || ''}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="muted">Sin movimientos</td></tr>';
  },
  renderImei() {
    const q = (document.getElementById('inv-imei-buscar')?.value || '').toLowerCase();
    const est = document.getElementById('inv-imei-estado')?.value || '';
    const tbody = document.getElementById('inv-imei-tbody');
    if (!tbody) return; // todavía no hay pantalla de IMEI
    let list = Repo.get('imeis');
    if (est) list = list.filter(i => i.estado === est);
    if (q) list = list.filter(i => (i.imei||'').toLowerCase().includes(q) || (i.modelo||'').toLowerCase().includes(q));
    tbody.innerHTML = list.map(im => {
      const item = Repo.find('items', im.itemId);
      return `<tr>
        <td><code>${im.imei}</code></td><td>${item?.nombre||''}</td>
        <td>${im.marca||''} ${im.modelo||''}</td><td>${im.color||''} / ${im.capacidad||''}</td>
        <td>${im.estado}</td><td>${im.cliente||''} ${im.factura||''}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">Sin IMEI registrados. Agrégalos al recibir compras o ajustes.</td></tr>';
  },
  nuevoAjuste(itemIdPre) {
    const items = this.inventariables();
    if (!items.length) return Utils.toast('No hay artículos');
    const pre = itemIdPre ? Repo.find('items', itemIdPre) : null;
    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:520px">
        <h3>Entrada / salida</h3>
        <div class="form-group"><label>Artículo</label><input type="hidden" id="aj-item" value="${pre ? pre.id : ''}">
          <input id="aj-buscar" class="form-input" placeholder="Buscar artículo" value="${pre ? (pre.codigo ? pre.codigo + ' — ' : '') + pre.nombre : ''}"></div>
        <div class="form-group aj-tipo">
          <label id="aj-lbl-entrada"><input type="radio" name="aj-tipo" value="entrada" checked onchange="InventarioUI.ajusteTipo()"> Entrada</label>
          <label id="aj-lbl-salida"><input type="radio" name="aj-tipo" value="salida" onchange="InventarioUI.ajusteTipo()"> Salida</label>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Motivo</label><select id="aj-motivo" class="form-input" onchange="InventarioUI.ajusteVista()"></select></div>
          <div class="form-group" style="max-width:130px"><label>Cantidad</label>
            <input id="aj-cant" type="number" min="1" step="1" class="form-input" value="1" oninput="InventarioUI.ajusteVista()"></div>
        </div>
        <div class="form-group"><label>Nota</label><input id="aj-nota" class="form-input"></div>
        <div class="aj-resultado" id="aj-resultado"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
          <button class="btn btn-primary" onclick="InventarioUI.guardarAjuste()">Registrar</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
    const texto = id => { const i = Repo.find('items', id); return i ? (i.codigo ? i.codigo + ' — ' : '') + i.nombre : ''; };
    Selector.conectar(document.getElementById('aj-buscar'), () => ({
      columnas: [{ t: 'Código' }, { t: 'Artículo' }, { t: 'Costo', der: true }, { t: 'Hay', der: true }],
      grupos: Selector.gruposArticulos('costo').map(g => ({ ...g, filas: g.filas.filter(f => Repo.find('items', f.id)?.controlInv) })),
      mantenerTexto: true, texto,
      onElegir: id => { document.getElementById('aj-item').value = id; this.ajusteVista(); }
    }));
    this.ajusteTipo();
  },
  ajusteTipoActual() { return document.querySelector('input[name="aj-tipo"]:checked')?.value || 'entrada'; },
  ajusteTipo() {
    const tipo = this.ajusteTipoActual();
    document.getElementById('aj-motivo').innerHTML = this.motivos[tipo].map(m => `<option>${m}</option>`).join('');
    document.getElementById('aj-lbl-entrada').className = tipo === 'entrada' ? 'sel-entrada' : '';
    document.getElementById('aj-lbl-salida').className = tipo === 'salida' ? 'sel-salida' : '';
    this.ajusteVista();
  },
  // Muestra cómo queda la existencia antes de guardar
  ajusteVista() {
    const item = Repo.find('items', document.getElementById('aj-item')?.value);
    const el = document.getElementById('aj-resultado');
    if (!item || !el) return;
    const cant = Math.floor(+document.getElementById('aj-cant').value || 0);
    const signo = this.ajusteTipoActual() === 'entrada' ? 1 : -1;
    const antes = item.stock || 0;
    const despues = antes + signo * Math.max(0, cant);
    el.innerHTML = `Existencia: <b>${antes}</b> → <b class="${despues < 0 ? 'kpi-mal' : ''}">${despues}</b>`;
  },

  // Conteo físico: solo se ajusta lo que se cuenta. Se puede contar por partes (ej. solo las piezas)
  // usando el filtro de las columnas Tipo o Categoría.
  modoConteo() {
    const items = this.inventariables();
    if (!items.length) return Utils.toast('No hay artículos con inventario');
    const filas = items.map(i => `
      <tr>
        <td>${i.codigo || ''}</td>
        <td>${i.nombre}</td>
        <td>${Utils.etiqueta(i.tipo)}</td>
        <td>${(Repo.find('categorias', i.categoriaId) || {}).nombre || ''}</td>
        <td style="text-align:right">${i.stock || 0}</td>
        <td><input type="number" min="0" step="1" inputmode="numeric" class="form-input conteo-input" data-id="${i.id}" data-actual="${i.stock || 0}" style="width:90px;text-align:right"></td>
        <td class="diff" style="text-align:right"></td>
      </tr>`).join('');

    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:820px">
        <h3>Conteo</h3>
        <div class="toolbar" style="margin:10px 0">
          <div class="buscar"><i data-lucide="search"></i>
            <input id="buscar-conteo" class="form-input" placeholder="Buscar" oninput="InventarioUI.filtrarConteo()"></div>
          <span class="toolbar-count" id="conteo-count">${items.length} artículos</span>
        </div>
        <div class="panel"><div class="panel-body sin-pad tabla-scroll" style="max-height:52vh">
          <table class="tabla" id="tabla-conteo">
            <thead><tr><th>Código</th><th>Artículo</th><th>Tipo</th><th>Categoría</th><th style="text-align:right">Sistema</th>
              <th class="tx-no">Contado</th><th class="tx-no" style="text-align:right">Diferencia</th></tr></thead>
            <tbody id="conteo-tbody">${filas}</tbody>
          </table>
        </div></div>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap">
          <span class="muted" id="conteo-resumen" style="margin-right:auto"></span>
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
          <button class="btn btn-primary" onclick="InventarioUI.aplicarConteo()">Aplicar</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
    TablaX.activar(document.getElementById('tabla-conteo'), true);
    lucide.createIcons();

    document.querySelectorAll('.conteo-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const td = inp.closest('tr').querySelector('.diff');
        if (inp.value === '') { td.textContent = ''; }
        else {
          const diff = Math.max(0, Math.floor(+inp.value || 0)) - (+inp.dataset.actual || 0);
          td.textContent = diff > 0 ? '+' + diff : diff;
          td.style.color = diff === 0 ? '' : diff > 0 ? '#16a34a' : '#dc2626';
          td.style.fontWeight = diff === 0 ? '' : '600';
        }
        const llenos = [...document.querySelectorAll('.conteo-input')].filter(x => x.value !== '');
        const conDif = llenos.filter(x => Math.max(0, Math.floor(+x.value || 0)) !== (+x.dataset.actual || 0)).length;
        document.getElementById('conteo-resumen').textContent = llenos.length
          ? `${llenos.length} contados, ${conDif} con diferencia` : '';
      });
    });
  },

  filtrarConteo() {
    const q = (document.getElementById('buscar-conteo')?.value || '').toLowerCase().trim();
    document.querySelectorAll('#conteo-tbody tr').forEach(tr => {
      const ok = !q || [...tr.cells].slice(0, 2).some(td => td.textContent.toLowerCase().includes(q));
      if (ok) delete tr.dataset.txOculta; else tr.dataset.txOculta = '1';
    });
    TablaX.aplicar('conteo-tbody');
  },

  aplicarConteo() {
    const llenos = [...document.querySelectorAll('.conteo-input')].filter(inp => inp.value !== '');
    if (!llenos.length) return Utils.toast('No hay nada contado');
    const cambios = llenos.map(inp => {
      const item = Repo.find('items', inp.dataset.id);
      const contado = Math.max(0, Math.floor(+inp.value || 0));
      return item ? { item, contado, diff: contado - (item.stock || 0) } : null;
    }).filter(c => c && c.diff !== 0);
    if (!cambios.length) {
      document.getElementById('modal').classList.remove('active');
      return Utils.toast('Sin diferencias');
    }
    if (!confirm(`¿Corregir ${cambios.length} artículo(s)?`)) return;
    cambios.forEach(({ item, contado, diff }) => {
      item.stock = contado;
      Repo.update('items', item.id, { stock: contado });
      Repo.add('ajustesInv', { itemId: item.id, cantidad: diff, motivo: 'Conteo físico', fecha: Utils.today() });
      Repo.add('movimientosInv', { itemId: item.id, tipo: diff > 0 ? 'ajuste+' : 'ajuste-', cantidad: Math.abs(diff),
        motivo: 'Conteo físico', referencia: 'Conteo', fecha: Utils.today() });
    });
    document.getElementById('modal').classList.remove('active');
    this.render();
    Utils.toast(cambios.length + ' artículo(s) corregidos');
  },

  guardarAjuste() {
    const itemId = document.getElementById('aj-item').value;
    const item = Repo.find('items', itemId);
    if (!item) return Utils.toast('Falta el artículo');
    const tipo = this.ajusteTipoActual();
    const cant = Math.floor(+document.getElementById('aj-cant').value || 0);
    const motivo = document.getElementById('aj-motivo').value;
    const nota = document.getElementById('aj-nota').value.trim();
    if (cant <= 0) return Utils.toast('Cantidad inválida');
    if (tipo === 'salida' && cant > (item.stock || 0)) return Utils.toast(`Solo hay ${item.stock || 0}`);
    if (motivo === 'Otro' && !nota) return Utils.toast('Falta la nota');
    const signo = tipo === 'entrada' ? 1 : -1;
    item.stock = (item.stock || 0) + signo * cant;
    Repo.update('items', itemId, { stock: item.stock });
    Repo.add('ajustesInv', { itemId, cantidad: signo * cant, motivo, nota, fecha: Utils.today() });
    Repo.add('movimientosInv', { itemId, tipo: signo > 0 ? 'ajuste+' : 'ajuste-', cantidad: cant, motivo, referencia: nota, fecha: Utils.today() });
    document.getElementById('modal').classList.remove('active');
    this.render();
    Utils.toast(`${item.nombre}: quedan ${item.stock}`);
  }
};
window.InventarioUI = InventarioUI;
