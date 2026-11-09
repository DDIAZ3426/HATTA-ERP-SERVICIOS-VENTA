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
    const total = facturas.reduce((s, f) => s + (f.total || 0), 0);
    const pend = facturas.filter(f => f.estado !== 'pagada' && f.estado !== 'anulada').reduce((s, f) => s + (f.pendiente || 0), 0);
    const el = document.getElementById('vt-tira');
    if (el) el.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Ventas totales</div><div class="kpi-value">${Utils.formatMoney(total)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Por cobrar</div><div class="kpi-value kpi-warn">${Utils.formatMoney(pend)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Facturas</div><div class="kpi-value">${facturas.length}</div></div>
    `;
  },

  renderFacturas() {
    const q = (document.getElementById('vt-filtro-buscar')?.value || '').toLowerCase();
    const est = document.getElementById('vt-filtro-estado')?.value || '';
    let list = Repo.get('facturas');
    if (est) list = list.filter(f => f.estado === est);
    if (q) list = list.filter(f => (f.numero||'').toLowerCase().includes(q) || (f.clienteNombre||'').toLowerCase().includes(q));
    const count = document.getElementById('vt-count');
    if (count) count.textContent = list.length + ' facturas';
    const tbody = document.getElementById('vt-tbody');
    if (!tbody) return;
    tbody.innerHTML = list.slice().reverse().map(f => `
      <tr>
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
    const list = Repo.get('cotizaciones');
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
    const list = Repo.get('facturas').filter(f => (f.pendiente||0) > 0 && f.estado !== 'anulada');
    tbody.innerHTML = list.map(f => `
      <tr>
        <td>${f.clienteNombre}</td><td>${f.numero}</td><td>${Utils.formatDate(f.vencimiento || f.fecha)}</td>
        <td style="text-align:right">${Utils.formatMoney(f.total)}</td>
        <td style="text-align:right">${Utils.formatMoney(f.pendiente)}</td>
        <td><button class="btn btn-sm btn-success" onclick="VentasUI.cobrarFactura('${f.id}')">Cobrar</button></td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted">Nada por cobrar</td></tr>';
  },

  nueva() {
    this.lineas = [];
    const clientes = Repo.get('clientes');
    const items = Repo.get('items');
    const cliOpts = '<option value="">Consumidor final</option>' + clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    const itemOpts = items.map(i => `<option value="${i.id}">${i.nombre} — ${Utils.formatMoney(i.precio)}</option>`).join('');
    const pagoOpts = Repo.get('cuentas').map(c => `<option value="${c.id}">Contado — ${c.nombre}</option>`).join('')
      + '<option value="fiado">Fiado (queda en Por cobrar)</option>';

    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:720px">
        <h3>Nueva venta</h3>
        <div class="form-row">
          <div class="form-group"><label>Cliente</label>
            <div style="display:flex;gap:6px"><select id="nv-cliente" data-clientes class="form-input" style="padding:8px 12px;flex:1">${cliOpts}</select>
            <button class="btn btn-sm" onclick="MaestrosUI.nuevoCliente('modal2')">Nuevo</button></div></div>
          <div class="form-group"><label>Fecha</label><input id="nv-fecha" type="date" class="form-input" style="padding:8px 12px" value="${Utils.today()}"></div>
        </div>
        <div class="seccion-titulo" style="margin-top:10px">Artículos</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <select id="nv-item" class="form-input" style="padding:8px 12px;flex:1">${itemOpts || '<option value="">Sin artículos</option>'}</select>
          <input id="nv-cant" type="number" min="1" value="1" class="form-input" style="padding:8px 12px;max-width:80px">
          <button class="btn btn-primary" onclick="VentasUI.agregarLinea()">Agregar</button>
        </div>
        <div class="panel" style="margin-bottom:10px"><div class="panel-body sin-pad">
          <table class="tabla" style="font-size:0.85rem">
            <thead><tr><th>Artículo</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th><th></th></tr></thead>
            <tbody id="nv-lineas"></tbody>
          </table>
        </div></div>
        <div style="text-align:right;font-weight:700;font-size:1.1rem;margin-bottom:12px">Total: <span id="nv-total">RD$ 0.00</span></div>
        <div class="form-group"><label>Forma de pago</label>
          <select id="nv-pago" class="form-input" style="padding:8px 12px">${pagoOpts}</select>
          <div class="form-ayuda">Fiado: la venta queda pendiente a nombre del cliente.</div></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
          <button class="btn btn-primary" onclick="VentasUI.guardarFactura()">Guardar venta</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
    this.renderLineas();
  },

  agregarLinea() {
    const itemId = document.getElementById('nv-item')?.value;
    const cant = +document.getElementById('nv-cant')?.value || 1;
    if (!itemId) return Utils.toast('Falta seleccionar un artículo');
    const item = Repo.find('items', itemId);
    if (!item) return;
    const existente = this.lineas.find(l => l.itemId === itemId);
    if (existente) existente.cantidad += cant;
    else this.lineas.push({ itemId, nombre: item.nombre, precio: item.precio, itbis: item.itbis, cantidad: cant, controlInv: item.controlInv });
    this.renderLineas();
  },

  quitarLinea(idx) {
    this.lineas.splice(idx, 1);
    this.renderLineas();
  },

  renderLineas() {
    const tbody = document.getElementById('nv-lineas');
    if (!tbody) return;
    tbody.innerHTML = this.lineas.map((l, i) => `
      <tr>
        <td>${l.nombre}</td>
        <td style="text-align:right">${l.cantidad}</td>
        <td style="text-align:right">${Utils.formatMoney(l.precio)}</td>
        <td style="text-align:right">${Utils.formatMoney(l.precio * l.cantidad)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="VentasUI.quitarLinea(${i})">×</button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">Sin artículos</td></tr>';
    const total = this.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
    const totalEl = document.getElementById('nv-total');
    if (totalEl) totalEl.textContent = Utils.formatMoney(total);
  },

  guardarFactura() {
    if (!this.lineas.length) return Utils.toast('Falta agregar al menos un artículo');
    const clienteId = document.getElementById('nv-cliente')?.value || '';
    const cliente = clienteId ? Repo.find('clientes', clienteId) : null;
    const fecha = document.getElementById('nv-fecha')?.value || Utils.today();
    const pago = document.getElementById('nv-pago')?.value || 'fiado';
    const contado = pago !== 'fiado';
    if (!contado && !cliente) return Utils.toast('Para fiar hay que elegir el cliente');

    const total = this.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);

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
      items: this.lineas.map(l => ({...l}))
    };
    Repo.add('facturas', factura);
    if (contado) {
      Repo.add('movimientosCaja', { fecha, tipo: 'entrada', monto: total, cuentaId: pago, concepto: 'Venta ' + numero, origen: 'cobro' });
    }

    // Descontar stock
    this.lineas.forEach(l => {
      if (l.controlInv) {
        const item = Repo.find('items', l.itemId);
        if (item) {
          item.stock = Math.max(0, (item.stock||0) - l.cantidad);
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
