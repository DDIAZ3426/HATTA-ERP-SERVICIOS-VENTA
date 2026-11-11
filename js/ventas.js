// ventas.js - Estilo ERP clásico de tienda
const VentasUI = {
  lineas: [],

  render() {
    this.renderFacturas();
    this.renderCotizaciones();
    this.renderPorCobrar();
    this.renderTira();
  },

  renderTira() {
    const facturas = Repo.get('facturas');
    const total = facturas.filter(f => f.estado !== 'anulada').reduce((s, f) => s + this.neto(f), 0);
    const pend = facturas.filter(f => f.estado !== 'pagada' && f.estado !== 'anulada').reduce((s, f) => s + (f.pendiente || 0), 0);
    const el = document.getElementById('vt-tira');
    if (el) el.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Ventas totales</div><div class="kpi-value">${Utils.formatMoney(total)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Por cobrar</div><div class="kpi-value kpi-warn">${Utils.formatMoney(pend)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Facturas</div><div class="kpi-value">${facturas.length}</div></div>
    `;
  },

  // Lo que quedó vendido: total menos lo devuelto
  neto(f) { return Math.round(((f.total || 0) - (f.devuelto || 0)) * 100) / 100; },

  renderFacturas() {
    const q = (document.getElementById('vt-filtro-buscar')?.value || '').toLowerCase();
    const est = document.getElementById('vt-filtro-estado')?.value || '';
    let list = Repo.get('facturas');
    if (est) list = list.filter(f => f.estado === est);
    if (q) list = list.filter(f => (f.numero||'').toLowerCase().includes(q) || (f.clienteNombre||'').toLowerCase().includes(q)
      || (f.items || []).some(l => (l.imei || '').toLowerCase().includes(q)));
    const count = document.getElementById('vt-count');
    if (count) count.textContent = list.length + ' facturas';
    const tbody = document.getElementById('vt-tbody');
    if (!tbody) return;
    tbody.innerHTML = Utils.ordenarPorFecha(list).map(f => `
      <tr class="fila-clic" onclick="VentasUI.ver('${f.id}')">
        <td>${Utils.formatDate(f.fecha)}</td>
        <td>${f.numero}</td>
        <td>${f.ncf || '—'}</td>
        <td>${f.clienteNombre || ''}</td>
        <td style="text-align:right">${Utils.formatMoney(f.total)}</td>
        <td style="text-align:right">${Utils.formatMoney(f.pagado || 0)}</td>
        <td style="text-align:right">${Utils.formatMoney(f.pendiente || 0)}</td>
        <td>${Utils.etiqueta(f.estado)}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="muted">Sin facturas</td></tr>';
    const badge = document.getElementById('vt-badge-pendientes');
    if (badge) {
      const n = Repo.get('facturas').filter(f => (f.pendiente||0) > 0 && f.estado !== 'anulada').length;
      badge.textContent = n || '';
      badge.style.display = n ? '' : 'none';
    }
  },

  renderCotizaciones() {
    const tbody = document.getElementById('vt-cot-tbody');
    if (!tbody) return;
    const list = Utils.ordenarPorFecha(Repo.get('cotizaciones'));
    tbody.innerHTML = list.map(c => `
      <tr>
        <td>${c.numero}</td><td>${c.clienteNombre||''}</td>
        <td>${Utils.formatDate(c.fecha)}</td><td>${Utils.formatDate(c.validaHasta)}</td>
        <td style="text-align:right">${Utils.formatMoney(c.total)}</td>
        <td>${Utils.etiqueta(c.estado||'borrador')}</td><td></td>
      </tr>`).join('') || '<tr><td colspan="7" class="muted">Sin cotizaciones</td></tr>';
  },

  renderPorCobrar() {
    const tbody = document.getElementById('vt-pen-tbody');
    if (!tbody) return;
    const list = Utils.ordenarPorFecha(Repo.get('facturas').filter(f => (f.pendiente||0) > 0 && f.estado !== 'anulada'), 'asc');
    tbody.innerHTML = list.map(f => `
      <tr>
        <td>${f.clienteNombre}</td><td>${f.numero}</td><td>${Utils.formatDate(f.vencimiento || f.fecha)}</td>
        <td style="text-align:right">${Utils.formatMoney(f.total)}</td>
        <td style="text-align:right">${Utils.formatMoney(f.pendiente)}</td>
        <td><button class="btn btn-sm btn-success" onclick="VentasUI.cobrarFactura('${f.id}')">Cobrar</button></td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted">Nada por cobrar</td></tr>';
  },

  // La venta tiene dos partes: Productos (salen del inventario) y Servicios (van al taller).
  // grupo: 'producto' | 'servicio'. Una línea de servicio con ordenId cobra una orden que ya está en el taller;
  // una línea de servicio sin ordenId crea la orden en el taller al guardar la venta.
  nueva() {
    this.lineas = [];
    this.ordenOrigen = null;
    this.recepcion = null;
    this.abrirModalVenta();
  },

  // Desde el taller: abre la venta con la orden ya cargada
  nuevaDesdeOrden(ordenId) {
    const o = Repo.find('ordenes', ordenId);
    if (!o) return Utils.toast('Orden no encontrada');
    this.lineas = [];
    this.ordenOrigen = null;
    this.recepcion = null;
    this.abrirModalVenta(o.clienteId);
    this.agregarOrden(o.id);
  },
  lineaDeOrden(o) {
    const p = o.pagoAdelantado;
    return {
      itemId: null, grupo: 'servicio', ordenId: o.id, itbis: false, cantidad: 1, controlInv: false,
      nombre: `Reparación ${o.equipo} — ${o.falla || 'Servicio'} (${o.numero})`,
      precio: o.presupuesto || 0,
      nota: p && p.tipo === 'chequeo' ? `Chequeo pagado: ${Utils.formatMoney(p.monto)} (${p.factura})` : ''
    };
  },
  // Agrega la orden a la venta abierta sin borrar lo que ya se había puesto
  agregarOrden(id) {
    const o = Repo.find('ordenes', id);
    if (!o) return;
    if (o.facturaNumero) return Utils.toast('Ya cobrada (' + o.facturaNumero + ')');
    if (this.ordenOrigen && this.ordenOrigen !== o.id) return Utils.toast('Ya hay una orden en esta venta');
    if (this.lineas.some(l => l.ordenId === o.id)) return Utils.toast('Esa orden ya está en la venta');
    this.lineas.push(this.lineaDeOrden(o));
    this.ordenOrigen = o.id;
    const sel = document.getElementById('nv-cliente');
    if (sel && o.clienteId) { sel.value = o.clienteId; this.clienteCambio(); }
    this.renderLineas();
  },

  cargarOrden() {
    const ordenes = Utils.ordenarPorFecha(Repo.get('ordenes')
      .filter(o => !o.facturaNumero && o.estado !== 'devuelto')); // sin cobrar, lo más reciente arriba
    if (!ordenes.length) return Utils.toast('No hay órdenes por cobrar');
    const filas = ordenes.map(o => `
      <tr class="fila-clic" onclick="VentasUI.seleccionarOrden('${o.id}')">
        <td>${Utils.formatDate(o.fecha)}</td>
        <td><b>${o.numero}</b></td>
        <td>${o.clienteNombre}<div class="muted sub-dato">${o.clienteTel || ''}</div></td>
        <td>${o.equipo}</td>
        <td>${OrdenesUI.pill(o.estado)}</td>
        <td style="text-align:right">${o.presupuesto ? Utils.formatMoney(o.presupuesto) : '—'}</td>
      </tr>`).join('');
    document.getElementById('modal2').innerHTML = `
      <div class="modal" style="max-width:860px">
        <h3>Órdenes por cobrar</h3>
        <div class="toolbar">
          <div class="buscar"><i data-lucide="search"></i>
            <input id="buscar-orden" class="form-input" placeholder="Buscar" oninput="VentasUI.filtrarOrdenes()"></div>
          <span class="toolbar-count">${ordenes.length} órdenes</span>
        </div>
        <div class="panel"><div class="panel-body sin-pad tabla-scroll" style="max-height:52vh">
          <table class="tabla" id="tabla-ordenes">
            <thead><tr><th>Fecha</th><th>Orden</th><th>Cliente</th><th>Equipo</th><th>Estado</th><th style="text-align:right">Presupuesto</th></tr></thead>
            <tbody id="ordenes-cobrar-tbody">${filas}</tbody>
          </table>
        </div></div>
        <div style="margin-top:12px;text-align:right">
          <button class="btn" onclick="document.getElementById('modal2').classList.remove('active')">Cancelar</button>
        </div>
      </div>`;
    document.getElementById('modal2').classList.add('active');
    TablaX.activar(document.getElementById('tabla-ordenes'), true);
    lucide.createIcons();
  },

  filtrarOrdenes() {
    const q = (document.getElementById('buscar-orden')?.value || '').toLowerCase().trim();
    document.querySelectorAll('#ordenes-cobrar-tbody tr').forEach(tr => {
      if (!q || tr.textContent.toLowerCase().includes(q)) delete tr.dataset.txOculta; else tr.dataset.txOculta = '1';
    });
    TablaX.aplicar('ordenes-cobrar-tbody');
  },

  seleccionarOrden(id) {
    document.getElementById('modal2').classList.remove('active');
    this.agregarOrden(id);
  },

  abrirModalVenta(clienteIdPre = '') {
    const clientes = Repo.get('clientes').slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    const cliOpts = '<option value="">Consumidor final</option>' + clientes.map(c =>
      `<option value="${c.id}" ${c.id === clienteIdPre ? 'selected' : ''}>${c.nombre}</option>`).join('');
    // Servicios del catálogo: salen como sugerencia al escribir; también se puede escribir cualquier otro
    this.servicios = Repo.get('items').filter(i => i.tipo === 'servicio').sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    const pagoOpts = Repo.get('cuentas').map(c => `<option value="${c.id}">Contado — ${c.nombre}</option>`).join('')
      + '<option value="fiado">Fiado</option>';

    document.getElementById('modal').innerHTML = `
      <div class="modal modal-venta">
        <div class="nv-top">
          <h3>Nueva venta</h3>
          <div class="nv-cliente">
            <div class="form-group"><label>Cliente <span class="kbd">F2</span><span class="nv-debe" id="nv-debe"></span></label>
              <div style="display:flex;gap:6px"><select id="nv-cliente" data-clientes class="form-input" style="flex:1" onchange="VentasUI.clienteCambio()">${cliOpts}</select>
              <button class="btn" onclick="MaestrosUI.nuevoCliente('modal2')">Nuevo</button></div></div>
            <div class="form-group" style="max-width:180px"><label>Fecha</label><input id="nv-fecha" type="date" class="form-input" value="${Utils.today()}"></div>
          </div>
        </div>

        <div class="nv-cols">
          <!-- Productos: salen del inventario -->
          <section class="nv-seccion" style="--c:#f59e0b;--t:#92400e">
            <div class="nv-cab"><span>Productos</span><span class="kbd">F4</span></div>
            <input id="nv-buscar-prod" class="form-input" placeholder="Buscar producto">
          </section>

          <!-- Servicios: se escriben directo; si el equipo se queda, se llena la orden de taller -->
          <section class="nv-seccion" style="--c:#ec4899;--t:#be185d">
            <div class="nv-cab"><span>Servicios</span><span class="kbd">Ins</span></div>
            <div class="nv-serv-entrada">
              <input id="nv-serv-det" class="form-input" list="nv-serv-lista" placeholder="Servicio" oninput="VentasUI.servicioEscrito()"
                onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('nv-serv-imp').focus()}">
              <input id="nv-serv-imp" type="number" min="0" step="0.01" class="form-input" placeholder="Importe"
                onkeydown="if(event.key==='Enter'){event.preventDefault();VentasUI.agregarServicioLibre()}">
              <button class="btn btn-primary" onclick="VentasUI.agregarServicioLibre()">Agregar</button>
            </div>
            <datalist id="nv-serv-lista">${this.servicios.map(i => `<option value="${i.nombre}">`).join('')}</datalist>
            <div id="nv-orden"></div>
            <div class="nv-equipo" id="nv-equipo" style="display:none">
              <div class="form-group" style="margin:0"><label>Se cobró</label>
                <div class="aj-tipo">
                  <label id="nv-lbl-chequeo"><input type="radio" name="nv-cobro" value="chequeo" onchange="VentasUI.marcarCobro()"> Chequeo</label>
                  <label id="nv-lbl-completo"><input type="radio" name="nv-cobro" value="completo" onchange="VentasUI.marcarCobro()"> Completo</label>
                </div></div>
            </div>
          </section>
        </div>

        <!-- Detalle: una sola tabla, separada en productos y servicios -->
        <div class="panel nv-detalle"><div class="panel-body sin-pad tabla-scroll">
          <table class="nv-tabla">
            <thead><tr><th>Descripción</th><th>IMEI</th><th class="der">Cant.</th><th class="der">Precio</th>
              <th class="der">Desc. %</th><th class="der">Total</th><th></th></tr></thead>
            <tbody id="nv-lineas"></tbody>
          </table>
        </div></div>

        <div class="nv-pie">
          <div class="nv-totales">
            <span>Productos <b id="nv-tot-prod">RD$0.00</b></span>
            <span>Servicios <b id="nv-tot-serv">RD$0.00</b></span>
            <span id="nv-tot-desc-w" style="display:none">Descuento <b id="nv-tot-desc" class="kpi-mal">RD$0.00</b></span>
            <span class="nv-total">Total <b id="nv-total">RD$0.00</b></span>
          </div>
          <div class="nv-cobro">
            <div class="form-group" style="flex:1;min-width:240px;margin:0"><label>Forma de pago</label>
              <select id="nv-pago" class="form-input">${pagoOpts}</select></div>
            <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
            <button class="btn btn-primary" onclick="VentasUI.guardarFactura()">Guardar venta <span class="kbd kbd-osc">F9</span></button>
          </div>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
    Selector.conectar(document.getElementById('nv-buscar-prod'), () => ({
      columnas: [{ t: 'Código' }, { t: 'Artículo' }, { t: 'Precio', der: true }, { t: 'Quedan', der: true }],
      grupos: Selector.gruposArticulos('precio'),
      onElegir: id => this.agregarProducto(id)
    }));
    this.activarTeclas();
    this.clienteCambio();
    this.renderLineas();
    lucide.createIcons();
    document.getElementById('nv-buscar-prod').focus();
  },

  // Teclas como en el punto de venta de antes: F2 cliente, F4 producto, Ins servicio, F9 guardar
  activarTeclas() {
    if (this._teclas) return;
    this._teclas = true;
    document.addEventListener('keydown', e => {
      const m = document.getElementById('modal');
      if (!m.classList.contains('active') || !m.querySelector('.modal-venta') || document.getElementById('modal2').classList.contains('active')) return;
      const ir = id => { e.preventDefault(); const el = document.getElementById(id); el && el.focus(); };
      if (e.key === 'F2') ir('nv-cliente');
      else if (e.key === 'F4') ir('nv-buscar-prod');
      else if (e.key === 'Insert') ir('nv-serv-det');
      else if (e.key === 'F9') { e.preventDefault(); this.guardarFactura(); }
    });
  },

  // Al elegir el cliente se trae su teléfono (para la orden de taller)
  clienteCambio() {
    const c = Repo.find('clientes', document.getElementById('nv-cliente')?.value);
    const debe = c ? Repo.get('facturas').filter(f => f.clienteId === c.id && f.estado !== 'anulada')
      .reduce((t, f) => t + (f.pendiente || 0), 0) : 0;
    const el = document.getElementById('nv-debe');
    if (el) { el.textContent = debe > 0 ? 'Debe ' + Utils.formatMoney(debe) : ''; el.style.display = debe > 0 ? 'inline-block' : 'none'; }
    if (this.recepcion && c && c.tel && !this.recepcion.clienteTel) this.recepcion.clienteTel = c.tel;
  },

  // ---------- Orden de taller desde la venta ----------
  abrirRecepcion() {
    const c = Repo.find('clientes', document.getElementById('nv-cliente')?.value);
    OrdenesUI.modalRecepcionVenta(this.recepcion || { clienteTel: c ? c.tel : '' });
  },
  recepcionLista() {
    const r = OrdenesUI.leerEquipo();
    if (r.error) return Utils.toast(r.error);
    const tel = (document.getElementById('os-tel')?.value || '').trim();
    if (!tel) return Utils.toast('Falta el teléfono');
    this.recepcion = { ...r.datos, clienteTel: tel };
    document.getElementById('modal2').classList.remove('active');
    this.renderLineas();
  },
  quitarRecepcion() { this.recepcion = null; this.renderLineas(); },
  renderOrden() {
    const el = document.getElementById('nv-orden');
    if (!el) return;
    if (this.ordenOrigen) { el.innerHTML = ''; return; }      // se está cobrando una orden que ya está en el taller
    const d = this.recepcion;
    if (!d) {
      el.innerHTML = `<button class="btn nv-btn-orden" onclick="VentasUI.abrirRecepcion()"><i data-lucide="wrench"></i> Orden de taller</button>`;
    } else {
      const linea = (et, v) => v ? `<div class="nv-oc-linea"><span>${et}</span>${v}</div>` : '';
      el.innerHTML = `
        <div class="nv-orden-card">
          <div class="nv-oc-tit">${d.tipoEquipo ? d.tipoEquipo + ': ' : ''}${d.equipo}</div>
          ${linea('Falla', d.falla)}
          ${linea('Estado', (d.condicion || []).join(', '))}
          ${linea('Viene con', (d.accesorios || []).join(', '))}
          ${linea('IMEI', d.imei)}
          <div class="nv-oc-btns">
            <button class="btn btn-sm" onclick="VentasUI.abrirRecepcion()">Editar</button>
            <button class="btn btn-sm nv-quitar" onclick="VentasUI.quitarRecepcion()">Quitar</button>
          </div>
        </div>`;
    }
    if (window.lucide) lucide.createIcons();
  },

  // Si lo escrito es un servicio del catálogo, se pone su precio
  servicioEscrito() {
    const det = document.getElementById('nv-serv-det').value.trim().toLowerCase();
    const it = (this.servicios || []).find(i => (i.nombre || '').toLowerCase() === det);
    if (it) document.getElementById('nv-serv-imp').value = it.precio || 0;
  },
  agregarServicioLibre() {
    const desc = document.getElementById('nv-serv-det');
    const imp = document.getElementById('nv-serv-imp');
    const nombre = (desc?.value || '').trim();
    const precio = Math.round((+imp?.value || 0) * 100) / 100;
    if (!nombre) { desc.focus(); return Utils.toast('Falta el servicio'); }
    if (!(precio > 0)) { imp.focus(); return Utils.toast('Falta el importe'); }
    const it = (this.servicios || []).find(i => (i.nombre || '').toLowerCase() === nombre.toLowerCase());
    this.lineas.push({ itemId: it ? it.id : null, grupo: 'servicio', nombre: it ? it.nombre : nombre, precio, itbis: false,
      cantidad: 1, controlInv: false, chequeo: /^chequeo/i.test(nombre) });
    desc.value = ''; imp.value = '';
    this.renderLineas();
    desc.focus();
  },
  agregarServicio(itemId) {
    const item = Repo.find('items', itemId);
    if (!item) return;
    this.lineas.push({ itemId: item.id, grupo: 'servicio', nombre: item.nombre, precio: item.precio || 0, itbis: false,
      cantidad: 1, controlInv: false, chequeo: /^chequeo/i.test(item.nombre || '') });
    this.renderLineas();
  },
  // Compatibilidad
  agregarChequeo(nombre, precio) {
    this.lineas.push({ itemId: null, grupo: 'servicio', nombre, precio, itbis: false, cantidad: 1, controlInv: false, chequeo: true });
    this.renderLineas();
  },

  // Precio con descuento y total de la línea
  precioNeto(l) { return Math.round(l.precio * (1 - (l.desc || 0) / 100) * 100) / 100; },
  totalLinea(l) { return Math.round(this.precioNeto(l) * l.cantidad * 100) / 100; },
  cambiarDesc(idx, v) {
    const l = this.lineas[idx];
    if (!l) return;
    l.desc = Math.min(100, Math.max(0, Math.round((+v || 0) * 100) / 100));
    this.renderLineas();
  },
  cambiarImei(idx, v) { if (this.lineas[idx]) this.lineas[idx].imei = v.trim(); },
  llevaImei(l) {
    const it = l.itemId ? Repo.find('items', l.itemId) : null;
    return !!it && !this.esServicio(l) && (it.tipo === 'celular' || it.controlImei);
  },

  cambiarPrecio(idx, nuevo) {
    const p = Math.round((+nuevo || 0) * 100) / 100;
    if (p < 0) return Utils.toast('Precio no puede ser negativo');
    const original = this.lineas[idx].precioOriginal ?? this.lineas[idx].precio;
    this.lineas[idx].precioOriginal = original;
    if (p < original * 0.7 && !confirm(`¿Bajar el precio de ${Utils.formatMoney(original)} a ${Utils.formatMoney(p)}?`)) {
      this.renderLineas();
      return;
    }
    this.lineas[idx].precio = p;
    this.renderLineas();
  },

  agregarProducto(itemId) {
    const item = Repo.find('items', itemId);
    if (!item) return;
    const existente = this.lineas.find(l => l.itemId === itemId && !this.esServicio(l));
    const pedidas = (existente ? existente.cantidad : 0) + 1;
    if (item.controlInv && pedidas > (item.stock || 0) && !confirm(`Solo quedan ${item.stock || 0}. ¿Agregar igual?`)) return;
    if (existente) existente.cantidad++;
    else this.lineas.push({ itemId, grupo: 'producto', nombre: item.nombre, precio: item.precio, itbis: item.itbis, cantidad: 1, controlInv: item.controlInv });
    this.renderLineas();
    const i = this.lineas.findIndex(l => l.itemId === itemId && !this.esServicio(l));
    const imei = document.querySelector(`.nv-imei[data-i="${i}"]`);
    if (imei && !imei.value) imei.focus();
  },
  cambiarCantidad(idx, valor) {
    const l = this.lineas[idx];
    if (!l) return;
    const q = Math.max(1, Math.floor(+valor || 1));
    const item = l.itemId ? Repo.find('items', l.itemId) : null;
    if (item && l.controlInv && q > (item.stock || 0) && !confirm(`Solo quedan ${item.stock || 0}. ¿Dejar ${q}?`)) return this.renderLineas();
    l.cantidad = q;
    this.renderLineas();
  },

  quitarLinea(idx) {
    const l = this.lineas[idx];
    if (l && l.ordenId === this.ordenOrigen) this.ordenOrigen = null;
    this.lineas.splice(idx, 1);
    this.renderLineas();
  },

  esServicio(l) { return l.grupo === 'servicio' || (!l.grupo && !l.controlInv && !l.itemId); },
  serviciosNuevos() { return this.ordenOrigen ? [] : this.lineas.filter(l => this.esServicio(l) && !l.ordenId); },

  renderLineas() {
    const tbody = document.getElementById('nv-lineas');
    if (!tbody) return;
    const M = Utils.formatMoney;
    const fila = (l, i) => `
      <tr>
        <td class="nv-d">${l.nombre}${l.ordenId ? ' <span class="nv-tag">Orden</span>' : ''}${l.nota ? `<div class="muted sub-dato">${l.nota}</div>` : ''}</td>
        <td>${this.llevaImei(l) ? `<input class="form-input nv-in nv-imei" data-i="${i}" value="${l.imei || ''}" placeholder="IMEI"
          onchange="VentasUI.cambiarImei(${i}, this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();document.getElementById('nv-buscar-prod').focus()}">` : ''}</td>
        <td class="der">${l.ordenId ? '1' : `<input type="number" min="1" step="1" value="${l.cantidad}" class="form-input nv-in nv-n" onchange="VentasUI.cambiarCantidad(${i}, this.value)">`}</td>
        <td class="der"><input type="number" min="0" step="0.01" value="${l.precio}" class="form-input nv-in nv-p" onchange="VentasUI.cambiarPrecio(${i}, this.value)"></td>
        <td class="der"><input type="number" min="0" max="100" step="1" value="${l.desc || ''}" placeholder="0" class="form-input nv-in nv-n" onchange="VentasUI.cambiarDesc(${i}, this.value)"></td>
        <td class="der"><b>${M(this.totalLinea(l))}</b></td>
        <td><button class="btn btn-sm nv-quitar" onclick="VentasUI.quitarLinea(${i})" title="Quitar">×</button></td>
      </tr>`;
    const grupo = (titulo, cls, filas) => filas.length ? `<tr class="nv-grupo ${cls}"><td colspan="7">${titulo}</td></tr>` + filas.join('') : '';
    const prod = [], serv = [];
    this.lineas.forEach((l, i) => (this.esServicio(l) ? serv : prod).push(fila(l, i)));
    tbody.innerHTML = (grupo('Productos', 'g-prod', prod) + grupo('Servicios', 'g-serv', serv))
      || '<tr><td colspan="7" class="nv-vacio">Sin artículos</td></tr>';

    const suma = (arr, f) => arr.reduce((t, l) => t + f(l), 0);
    const P = this.lineas.filter(l => !this.esServicio(l)), S = this.lineas.filter(l => this.esServicio(l));
    const tProd = suma(P, l => this.totalLinea(l)), tServ = suma(S, l => this.totalLinea(l));
    const bruto = suma(this.lineas, l => l.precio * l.cantidad);
    const desc = Math.round((bruto - tProd - tServ) * 100) / 100;
    document.getElementById('nv-tot-prod').textContent = M(tProd);
    document.getElementById('nv-tot-serv').textContent = M(tServ);
    document.getElementById('nv-tot-desc').textContent = M(desc);
    document.getElementById('nv-tot-desc-w').style.display = desc > 0 ? '' : 'none';
    document.getElementById('nv-total').textContent = M(tProd + tServ);

    this.renderOrden();
    // "Se cobró": solo si el equipo entra al taller con esta venta
    const nuevos = this.recepcion ? this.serviciosNuevos() : [];
    const eq = document.getElementById('nv-equipo');
    eq.style.display = nuevos.length ? '' : 'none';
    if (nuevos.length && !document.querySelector('input[name="nv-cobro"]:checked')) {
      const sugerido = nuevos.every(l => l.chequeo) ? 'chequeo' : 'completo';
      document.querySelector(`input[name="nv-cobro"][value="${sugerido}"]`).checked = true;
    }
    if (!nuevos.length) document.querySelectorAll('input[name="nv-cobro"]').forEach(r => { r.checked = false; });
    this.marcarCobro();
  },
  marcarCobro() {
    const v = document.querySelector('input[name="nv-cobro"]:checked')?.value;
    const lc = document.getElementById('nv-lbl-chequeo'), lk = document.getElementById('nv-lbl-completo');
    if (!lc) return;
    lc.className = v === 'chequeo' ? 'sel-nv' : '';
    lk.className = v === 'completo' ? 'sel-nv' : '';
  },

  guardarFactura() {
    if (!this.lineas.length) return Utils.toast('Falta agregar al menos un artículo');
    const clienteId = document.getElementById('nv-cliente')?.value || '';
    const cliente = clienteId ? Repo.find('clientes', clienteId) : null;
    const fecha = document.getElementById('nv-fecha')?.value || Utils.today();
    const pago = document.getElementById('nv-pago')?.value || 'fiado';
    const contado = pago !== 'fiado';
    if (!contado && !cliente) return Utils.toast('Para fiar falta el cliente');
    // Servicio nuevo: el equipo entra al taller, hacen falta sus datos
    const nuevosServ = this.serviciosNuevos();
    const rec = this.recepcion;
    const tipoCobro = document.querySelector('input[name="nv-cobro"]:checked')?.value || 'completo';
    if (rec && !this.ordenOrigen && !nuevosServ.length) return Utils.toast('Falta el chequeo o el servicio');
    if (rec && !cliente) return Utils.toast('Falta el cliente');

    const total = Math.round(this.lineas.reduce((t, l) => t + this.totalLinea(l), 0) * 100) / 100;

    const num = Repo.data.numeraciones.fac;
    const numero = num.pre + String(num.prox).padStart(4, '0');
    num.prox++;

    const factura = {
      numero, fecha, clienteId,
      clienteNombre: cliente ? cliente.nombre : 'Consumidor final',
      total,
      pagado: contado ? total : 0,
      pendiente: contado ? 0 : total,
      estado: contado ? 'pagada' : 'pendiente',
      formaPago: contado ? 'contado' : 'fiado',
      cobros: contado ? [{ fecha, monto: total, cuentaId: pago }] : [],
      ncf: '',
      ordenId: this.ordenOrigen || null,
      items: this.lineas.map(l => ({...l}))
    };
    Repo.add('facturas', factura);

    // Orden que ya estaba en el taller: queda cobrada. Si estaba lista, se entrega.
    if (this.ordenOrigen) {
      const o = Repo.find('ordenes', this.ordenOrigen);
      if (o) {
        const entrega = o.estado === 'listo';
        Repo.update('ordenes', o.id, { facturaNumero: numero, estado: entrega ? 'entregado' : o.estado, ...(entrega ? { fechaSalida: fecha } : {}),
          historial: (o.historial || []).concat({ estado: entrega ? 'entregado' : o.estado, fechaHora: new Date().toISOString(),
            nota: 'Cobrada en ' + numero + (entrega ? ' y entregada' : '') }) });
      }
    }
    // Servicio nuevo: se crea la orden en el taller con lo que se cobró
    let ordenNueva = null;
    if (rec && nuevosServ.length) {
      OrdenesUI.asegurarDatos();
      const montoServ = nuevosServ.reduce((t, l) => t + this.totalLinea(l), 0);
      const soloChequeo = tipoCobro === 'chequeo';
      const nos = Repo.data.numeraciones.os;
      const numOS = nos.pre + String(nos.prox).padStart(4, '0');
      nos.prox++;
      if (!cliente.tel) Repo.update('clientes', cliente.id, { tel: rec.clienteTel });
      ordenNueva = Repo.add('ordenes', {
        ...rec, numero: numOS, fecha, clienteId: cliente.id, clienteNombre: cliente.nombre,
        obs: [rec.obs, nuevosServ.map(l => l.nombre).join(', ')].filter(Boolean).join(' — '),
        presupuesto: soloChequeo ? rec.presupuesto : montoServ,
        estado: 'recibido', facturaNumero: soloChequeo ? '' : numero,
        pagoAdelantado: { factura: numero, monto: montoServ, tipo: soloChequeo ? 'chequeo' : 'completo' },
        historial: [{ estado: 'recibido', fechaHora: new Date().toISOString(),
          nota: `Entró desde la venta ${numero}: ${soloChequeo ? 'chequeo' : 'servicio'} cobrado ${Utils.formatMoney(montoServ)}` }]
      });
      const fac = Repo.get('facturas').find(f => f.numero === numero);
      if (fac) Repo.update('facturas', fac.id, { ordenTaller: numOS });
    }
    if (contado) {
      Repo.add('movimientosCaja', { fecha, tipo: 'entrada', monto: total, cuentaId: pago, concepto: 'Venta ' + numero, origen: 'cobro' });
    }

    // Descontar stock
    this.lineas.forEach(l => {
      if (l.controlInv) {
        const item = Repo.find('items', l.itemId);
        if (item) {
          item.stock = (item.stock || 0) - l.cantidad;
          Repo.update('items', l.itemId, { stock: item.stock });
          Repo.add('movimientosInv', { itemId: l.itemId, tipo: 'venta', cantidad: l.cantidad, referencia: numero, fecha });
        }
      }
    });
    Repo.save();
    document.getElementById('modal').classList.remove('active');
    this.render();
    if (typeof CajaUI !== 'undefined') CajaUI.render && CajaUI.render();
    Utils.toast(contado ? 'Venta ' + numero + ' cobrada' : 'Venta ' + numero + ' registrada como fiado');
    this.ordenOrigen = null;
    this.recepcion = null;
    if (ordenNueva && typeof OrdenesUI !== 'undefined') OrdenesUI.render();
    const fac = Repo.get('facturas').find(x => x.numero === numero);
    setTimeout(() => {
      if (confirm(ordenNueva ? `Orden ${ordenNueva.numero} creada en Taller. ¿Imprimir tickets?` : '¿Imprimir ticket?'))
        this.imprimir(fac.id, ordenNueva ? ordenNueva.id : null);
    }, 300);
  },

  ver(id) {
    const f = Repo.find('facturas', id);
    if (!f) return;
    const M = Utils.formatMoney;
    const dev = (f.devoluciones || []);
    const filas = (f.items || []).map(l => `<tr><td>${l.nombre}${l.imei ? `<div class="muted sub-dato">IMEI ${l.imei}</div>` : ''}</td>
      <td style="text-align:right">${l.cantidad}</td>
      <td style="text-align:right">${M(l.precio)}${l.desc ? `<div class="muted sub-dato">−${l.desc}%</div>` : ''}</td><td style="text-align:right">${M(this.totalLinea(l))}</td>
      <td style="text-align:right">${l.devuelta ? l.devuelta : ''}</td></tr>`).join('');
    const dato = (et, v) => v ? `<div class="os-dato"><span>${et}</span>${v}</div>` : '';
    const puedeDevolver = f.estado !== 'anulada' && (f.items || []).some(l => (l.devuelta || 0) < l.cantidad);
    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:720px">
        <div class="os-cabeza"><h3>Venta ${f.numero}</h3><b>${Utils.etiqueta(f.estado)}</b></div>
        <div class="os-ficha">
          ${dato('Fecha', Utils.formatDate(f.fecha))}
          ${dato('Cliente', f.clienteNombre)}
          ${dato('Forma de pago', Utils.etiqueta(f.formaPago) || f.formaPago)}
          ${dato('Orden de taller', f.ordenTaller || (f.ordenId ? (Repo.find('ordenes', f.ordenId) || {}).numero : ''))}
        </div>
        <div class="panel"><div class="panel-body sin-pad tabla-scroll">
          <table class="tabla">
            <thead><tr><th>Artículo</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th>
              <th style="text-align:right">Total</th><th style="text-align:right">Devuelto</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div></div>
        <div class="vf-totales">
          <span>Total <b>${M(f.total)}</b></span>
          ${f.devuelto ? `<span>Devuelto <b class="kpi-mal">${M(f.devuelto)}</b></span>` : ''}
          <span>Pagado <b>${M(f.pagado || 0)}</b></span>
          <span>Pendiente <b>${M(f.pendiente || 0)}</b></span>
        </div>
        ${dev.length ? `<div class="seccion-titulo">Devoluciones</div>${dev.map(d =>
          `<div class="vf-dev">${Utils.formatDate(d.fecha)}: ${d.items.map(x => x.cantidad + ' × ' + x.nombre).join(', ')}. ${M(d.monto)}${d.reembolso ? ' (reembolso ' + M(d.reembolso) + ')' : ''}</div>`).join('')}` : ''}
        <div class="os-pie">
          ${puedeDevolver ? `<button class="btn btn-danger" onclick="VentasUI.devolver('${f.id}')">Devolución</button>` : ''}
          <button class="btn" onclick="VentasUI.imprimir('${f.id}')">Imprimir ticket</button>
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cerrar</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
  },

  ticketHTML(id) {
    const f = Repo.find('facturas', id);
    if (!f) return '';
    const e = Repo.data.empresa || {};
    const M = Utils.formatMoney;
    const fila = (a, b, neg) => `<div style="display:flex;justify-content:space-between;gap:8px${neg ? ';font-weight:700' : ''}"><span>${a}</span><span>${b}</span></div>`;
    return `
      <div class="ticket">
        <div class="t-centro"><div class="t-empresa">${e.nombre || ''}</div>${e.dir ? e.dir + '<br>' : ''}${e.tel ? 'Tel. ' + e.tel : ''}</div>
        <div class="t-titulo">Venta ${f.numero}</div>
        <div>${Utils.formatDate(f.fecha)} — ${f.clienteNombre || ''}</div>
        <div class="t-linea"></div>
        ${(f.items || []).map(l => `<div>${l.nombre}</div>${l.imei ? `<div>IMEI: ${l.imei}</div>` : ''}${fila(l.cantidad + ' × ' + M(this.precioNeto(l)) + (l.desc ? ' (−' + l.desc + '%)' : ''), M(this.totalLinea(l)))}`).join('')}
        <div class="t-linea"></div>
        ${fila('TOTAL', M(f.total), 1)}
        ${f.devuelto ? fila('Devuelto', M(f.devuelto)) : ''}
        ${fila('Pagado', M(f.pagado || 0))}
        ${f.pendiente ? fila('Pendiente', M(f.pendiente), 1) : ''}
        <div class="t-linea"></div>
        <div class="t-centro">Gracias por su compra</div>
      </div>`;
  },
  // Imprime la venta; si se creó una orden de taller, también su ticket
  imprimir(id, ordenId) {
    const html = this.ticketHTML(id) + (ordenId ? '<div style="page-break-before:always"></div>' + OrdenesUI.ticketHTML(ordenId) : '');
    if (!html) return;
    document.getElementById('print-area').innerHTML = html;
    window.print();
  },

  // Devolución: lo devuelto vuelve al inventario si se marca; el dinero baja lo pendiente y, si ya se pagó, sale de caja
  devolver(id) {
    const f = Repo.find('facturas', id);
    if (!f) return;
    const ctaOpts = Repo.get('cuentas').map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    const filas = (f.items || []).map((l, i) => {
      const max = l.cantidad - (l.devuelta || 0);
      if (max <= 0) return '';
      return `<tr><td>${l.nombre}</td><td style="text-align:right">${max}</td>
        <td><input type="number" min="0" max="${max}" step="1" value="0" class="form-input dv-cant" data-i="${i}" style="width:80px;text-align:right" oninput="VentasUI.devolverTotal('${f.id}')"></td>
        <td style="text-align:center">${l.controlInv ? `<input type="checkbox" class="dv-repone" data-i="${i}" checked style="width:18px;height:18px">` : '—'}</td></tr>`;
    }).join('');
    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:640px">
        <h3>Devolución ${f.numero}</h3>
        <div class="panel"><div class="panel-body sin-pad tabla-scroll">
          <table class="tabla">
            <thead><tr><th>Artículo</th><th style="text-align:right">Vendido</th><th>Devuelve</th><th style="text-align:center">Vuelve al inventario</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div></div>
        <div class="vf-totales"><span>A devolver <b id="dv-total">RD$0.00</b></span><span>Reembolso <b id="dv-reembolso">RD$0.00</b></span></div>
        <div class="form-group" id="dv-cta-g"><label>Reembolso desde</label><select id="dv-cta" class="form-input">${ctaOpts}</select></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="VentasUI.ver('${f.id}')">Cancelar</button>
          <button class="btn btn-danger" onclick="VentasUI.guardarDevolucion('${f.id}')">Registrar devolución</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
    this.devolverTotal(f.id);
  },
  // Cuánto se devuelve y cuánto dinero sale (lo demás baja lo pendiente)
  calcDevolucion(f) {
    const items = [...document.querySelectorAll('.dv-cant')].map(inp => {
      const l = f.items[+inp.dataset.i];
      const max = l.cantidad - (l.devuelta || 0);
      const cantidad = Math.min(max, Math.max(0, Math.floor(+inp.value || 0)));
      const repone = !!document.querySelector(`.dv-repone[data-i="${inp.dataset.i}"]`)?.checked;
      return { i: +inp.dataset.i, nombre: l.nombre, itemId: l.itemId, cantidad, precio: this.precioNeto(l), repone: l.controlInv && repone };
    }).filter(x => x.cantidad > 0);
    const monto = Math.round(items.reduce((t, x) => t + x.cantidad * x.precio, 0) * 100) / 100;
    const netoDespues = this.neto(f) - monto;
    const reembolso = Math.max(0, Math.round(((f.pagado || 0) - netoDespues) * 100) / 100);
    return { items, monto, reembolso };
  },
  devolverTotal(id) {
    const f = Repo.find('facturas', id);
    const d = this.calcDevolucion(f);
    document.getElementById('dv-total').textContent = Utils.formatMoney(d.monto);
    document.getElementById('dv-reembolso').textContent = Utils.formatMoney(d.reembolso);
    document.getElementById('dv-cta-g').style.display = d.reembolso > 0 ? '' : 'none';
  },
  guardarDevolucion(id) {
    const f = Repo.find('facturas', id);
    if (!f) return;
    const d = this.calcDevolucion(f);
    if (!d.items.length) return Utils.toast('Falta la cantidad a devolver');
    const cuentaId = document.getElementById('dv-cta').value;
    if (d.reembolso > 0 && !cuentaId) return Utils.toast('Falta la cuenta');
    if (!confirm(`¿Devolver ${Utils.formatMoney(d.monto)}${d.reembolso ? ' y reembolsar ' + Utils.formatMoney(d.reembolso) : ''}?`)) return;
    const fecha = Utils.today();
    // Inventario
    d.items.forEach(x => {
      f.items[x.i].devuelta = (f.items[x.i].devuelta || 0) + x.cantidad;
      if (!x.repone) return;
      const item = Repo.find('items', x.itemId);
      if (!item) return;
      item.stock = (item.stock || 0) + x.cantidad;
      Repo.update('items', item.id, { stock: item.stock });
      Repo.add('movimientosInv', { itemId: item.id, tipo: 'ajuste+', cantidad: x.cantidad, motivo: 'Devolución de venta', referencia: f.numero, fecha });
    });
    // Dinero
    f.devuelto = Math.round(((f.devuelto || 0) + d.monto) * 100) / 100;
    f.pagado = Math.round(((f.pagado || 0) - d.reembolso) * 100) / 100;
    f.pendiente = Math.max(0, Math.round((this.neto(f) - f.pagado) * 100) / 100);
    f.estado = this.neto(f) <= 0 ? 'devuelta' : f.pendiente <= 0 ? 'pagada' : f.pagado > 0 ? 'parcial' : 'pendiente';
    f.devoluciones = (f.devoluciones || []).concat({ fecha, items: d.items, monto: d.monto, reembolso: d.reembolso, cuentaId: d.reembolso ? cuentaId : '' });
    Repo.update('facturas', f.id, f);
    if (d.reembolso > 0) Repo.add('movimientosCaja', { fecha, tipo: 'salida', monto: d.reembolso, cuentaId,
      concepto: 'Devolución ' + f.numero, origen: 'devolucion' });
    Repo.save();
    this.render();
    Utils.toast('Devolución registrada');
    this.ver(f.id);
  },

  cobrar() {
    App.navegar('ventas', 'porcobrar');
    Utils.toast('Elegir la factura a cobrar');
  },

  cobrarFactura(id) {
    const f = Repo.find('facturas', id);
    if (!f) return;
    const ctaOpts = Repo.get('cuentas').map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    document.getElementById('modal').innerHTML = `
      <div class="modal">
        <h3>Registrar cobro</h3>
        <p class="muted" style="margin-bottom:12px">${f.numero} — ${f.clienteNombre}. Pendiente: <b>${Utils.formatMoney(f.pendiente)}</b></p>
        <div class="form-group"><label>Monto</label><input id="cb-monto" type="number" min="0" step="0.01" class="form-input" value="${f.pendiente}"></div>
        <div class="form-group"><label>Cobrar en</label><select id="cb-cta" class="form-input">${ctaOpts}</select></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
          <button class="btn btn-success" onclick="VentasUI.guardarCobro('${f.id}')">Guardar cobro</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
  },

  guardarCobro(id) {
    const f = Repo.find('facturas', id);
    if (!f) return;
    const monto = Math.round((+document.getElementById('cb-monto').value || 0) * 100) / 100;
    const cuentaId = document.getElementById('cb-cta').value;
    if (monto <= 0) return Utils.toast('Falta el monto');
    if (monto > f.pendiente) return Utils.toast('El monto es mayor que lo pendiente');
    if (!cuentaId) return Utils.toast('Falta crear una cuenta en Maestros');
    const fecha = Utils.today();
    f.pagado = Math.round(((f.pagado || 0) + monto) * 100) / 100;
    f.pendiente = Math.max(0, Math.round((f.total - f.pagado) * 100) / 100);
    f.estado = f.pendiente <= 0 ? 'pagada' : 'parcial';
    f.cobros = (f.cobros || []).concat({ fecha, monto, cuentaId });
    Repo.update('facturas', id, f);
    Repo.add('movimientosCaja', {
      fecha, tipo: 'entrada', monto, cuentaId,
      concepto: 'Cobro factura ' + f.numero, origen: 'cobro'
    });
    document.getElementById('modal').classList.remove('active');
    Repo.save();
    this.render();
    if (typeof CajaUI !== 'undefined') CajaUI.render && CajaUI.render();
    Utils.toast('Cobro registrado');
  },

  nuevaCot() {
    Utils.toast('Cotizaciones no está disponible en esta versión');
  }
};
window.VentasUI = VentasUI;
