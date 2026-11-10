// compras.js - simplified
const ComprasUI = {
  lineas: [],

  render() {
    this.renderTira();
    this.renderCompras();
    this.renderPorPagar();
  },
  renderTira() {
    const el = document.getElementById('cp-tira');
    if (!el) return;
    const mes = Utils.today().slice(0, 7);
    const delMes = Repo.get('compras').filter(c => (c.fecha || '').startsWith(mes) && c.estado !== 'anulada');
    const unidades = delMes.reduce((s, c) => s + (c.items || []).reduce((t, l) => t + (+l.cantidad || 0), 0), 0);
    el.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Compras del mes</div><div class="kpi-value">${Utils.formatMoney(delMes.reduce((s, c) => s + (c.total || 0), 0))}</div></div>
      <div class="kpi-card"><div class="kpi-label">Unidades compradas en el mes</div><div class="kpi-value">${unidades}</div></div>
      <div class="kpi-card"><div class="kpi-label">Compras</div><div class="kpi-value">${Repo.get('compras').length}</div></div>`;
  },
  renderCompras() {
    const q = (document.getElementById('cp-filtro-buscar')?.value || '').toLowerCase();
    const est = document.getElementById('cp-filtro-estado')?.value || '';
    let list = Repo.get('compras');
    if (est) list = list.filter(c => c.estado === est);
    if (q) list = list.filter(c => (c.numero||'').toLowerCase().includes(q) || (c.proveedorNombre||'').toLowerCase().includes(q));
    document.getElementById('cp-count').textContent = list.length + ' compras';
    document.getElementById('cp-tbody').innerHTML = Utils.ordenarPorFecha(list).map(c => `
      <tr class="fila-clic" onclick="ComprasUI.ver('${c.id}')"><td>${Utils.formatDate(c.fecha)}</td>
        <td>${c.numero}${c.refProv ? `<div class="muted sub-dato">Suplidor: ${c.refProv}</div>` : ''}</td><td>${c.ncfProv||''}</td><td>${c.proveedorNombre||''}</td>
        <td style="text-align:right">${Utils.formatMoney(c.total)}</td>
        <td style="text-align:right">${Utils.formatMoney(c.pagado||0)}</td>
        <td style="text-align:right">${Utils.formatMoney(c.pendiente||0)}</td>
        <td>${Utils.etiqueta(c.estado)}</td></tr>`).join('') || '<tr><td colspan="8">Sin compras</td></tr>';
  },
  renderPorPagar() {
    const list = Utils.ordenarPorFecha(Repo.get('compras').filter(c => (c.pendiente||0) > 0), 'asc');
    document.getElementById('cp-pen-tbody').innerHTML = list.map(c => `
      <tr><td>${c.proveedorNombre}</td><td>${c.numero}</td><td>${Utils.formatDate(c.vencimiento)}</td>
        <td style="text-align:right">${Utils.formatMoney(c.total)}</td>
        <td style="text-align:right">${Utils.formatMoney(c.pendiente)}</td>
        <td><button class="btn btn-sm" onclick="ComprasUI.pagarCompra('${c.id}')">Pagar</button></td></tr>`).join('') || '<tr><td colspan="6">Nada por pagar</td></tr>';
  },
  // Compra de contado: entra la mercancía al inventario y sale el dinero de la cuenta elegida.
  nueva() {
    const provs = Repo.get('proveedores');
    const items = InventarioUI.inventariables();
    this.lineas = [];
    const provOpts = '<option value="">Elegir proveedor</option>' + provs.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    const ctaOpts = Repo.get('cuentas').map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:760px">
        <h3>Nueva compra</h3>
        <div class="form-row">
          <div class="form-group"><label>Proveedor</label>
            <div style="display:flex;gap:6px"><select id="nc-prov" data-proveedores class="form-input" style="flex:1">${provOpts}</select>
            <button class="btn btn-sm" onclick="MaestrosUI.nuevoProveedor('modal2')">Nuevo</button></div></div>
          <div class="form-group" style="max-width:170px"><label>Fecha</label><input id="nc-fecha" type="date" class="form-input" value="${Utils.today()}"></div>
        </div>
        <div class="form-group"><label>Factura del suplidor</label>
          <input id="nc-ref" class="form-input"></div>

        <div class="seccion-titulo" style="margin-top:6px">Artículos</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input id="nc-buscar" class="form-input" style="flex:1" placeholder="Buscar artículo">
          <button class="btn" onclick="MaestrosUI.nuevoItem('modal2')">Artículo nuevo</button>
        </div>
        <div class="panel" style="margin-bottom:10px"><div class="panel-body sin-pad tabla-scroll">
          <table class="tabla">
            <thead><tr><th>Artículo</th><th style="text-align:right">Cant.</th><th style="text-align:right">Costo c/u</th><th style="text-align:right">Total</th><th></th></tr></thead>
            <tbody id="nc-lineas"></tbody>
          </table>
        </div></div>
        <div style="text-align:right;font-weight:700;font-size:1.1rem;margin-bottom:12px">Total: <span id="nc-total">RD$0.00</span></div>
        <div class="form-group"><label>Pagado desde</label>
          <select id="nc-cta" class="form-input">${ctaOpts}</select></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
          <button class="btn btn-primary" onclick="ComprasUI.guardar()">Guardar compra</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
    Selector.conectar(document.getElementById('nc-buscar'), () => ({
      columnas: [{ t: 'Código' }, { t: 'Artículo' }, { t: 'Costo', der: true }, { t: 'Hay', der: true }],
      grupos: Selector.gruposArticulos('costo'),
      onElegir: id => this.agregarItem(id)
    }));
    this.renderLineas();
  },

  // Desde el buscador: entra con cantidad 1 y su último costo (se cambian en la línea)
  agregarItem(id) {
    const item = Repo.find('items', id);
    if (!item) return;
    const existente = this.lineas.find(l => l.itemId === item.id);
    if (existente) existente.cantidad++;
    else this.lineas.push({ itemId: item.id, nombre: item.nombre, cantidad: 1, costo: item.costo || 0 });
    this.renderLineas();
  },
  cambiarLinea(idx, campo, valor) {
    const l = this.lineas[idx];
    if (!l) return;
    if (campo === 'cantidad') l.cantidad = Math.max(1, Math.floor(+valor || 1));
    else l.costo = Math.max(0, Math.round((+valor || 0) * 100) / 100);
    this.renderLineas();
  },
  quitarLinea(idx) { this.lineas.splice(idx, 1); this.renderLineas(); },
  renderLineas() {
    const tbody = document.getElementById('nc-lineas');
    if (!tbody) return;
    const inp = 'style="width:90px;text-align:right;padding:4px;border:1px solid #e2e8f0;border-radius:4px"';
    tbody.innerHTML = this.lineas.map((l, i) => `
      <tr><td>${l.nombre}</td>
        <td style="text-align:right"><input type="number" min="1" step="1" value="${l.cantidad}" ${inp} onchange="ComprasUI.cambiarLinea(${i},'cantidad',this.value)"></td>
        <td style="text-align:right"><input type="number" min="0" step="0.01" value="${l.costo}" ${inp} onchange="ComprasUI.cambiarLinea(${i},'costo',this.value)"></td>
        <td style="text-align:right">${Utils.formatMoney(l.cantidad * l.costo)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="ComprasUI.quitarLinea(${i})">×</button></td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">Sin artículos</td></tr>';
    document.getElementById('nc-total').textContent = Utils.formatMoney(this.total());
  },
  total() { return Math.round(this.lineas.reduce((s, l) => s + l.cantidad * l.costo, 0) * 100) / 100; },

  guardar() {
    const prov = Repo.find('proveedores', document.getElementById('nc-prov').value);
    const cuentaId = document.getElementById('nc-cta').value;
    const cuenta = Repo.find('cuentas', cuentaId);
    const fecha = document.getElementById('nc-fecha').value || Utils.today();
    const refProv = document.getElementById('nc-ref').value.trim();
    if (!prov) return Utils.toast('Falta el proveedor');
    if (!this.lineas.length) return Utils.toast('Faltan los artículos');
    if (!cuenta) return Utils.toast('Falta la cuenta');
    const total = this.total();
    const saldo = MaestrosUI.calcularSaldo(cuentaId);
    if (total > saldo && !confirm(`${cuenta.nombre} tiene ${Utils.formatMoney(saldo)}. ¿Guardar igual?`)) return;

    const num = Repo.data.numeraciones.com;
    const numero = num.pre + String(num.prox).padStart(4, '0');
    num.prox++;
    Repo.add('compras', {
      numero, fecha, proveedorId: prov.id, proveedorNombre: prov.nombre, refProv, ncfProv: '',
      total, pagado: total, pendiente: 0, estado: 'pagada', formaPago: 'contado', cuentaId,
      items: this.lineas.map(l => ({ ...l }))
    });
    // Entra al inventario. El costo queda como promedio entre lo que había y lo que llegó.
    this.lineas.forEach(l => {
      const item = Repo.find('items', l.itemId);
      if (!item) return;
      const antes = Math.max(0, item.stock || 0);
      const costo = antes > 0 ? Math.round(((antes * (item.costo || 0)) + (l.cantidad * l.costo)) / (antes + l.cantidad) * 100) / 100 : l.costo;
      item.stock = (item.stock || 0) + l.cantidad;
      item.costo = costo;
      Repo.update('items', item.id, { stock: item.stock, costo });
      Repo.add('movimientosInv', { itemId: item.id, tipo: 'compra', cantidad: l.cantidad, referencia: numero, fecha });
    });
    Repo.add('movimientosCaja', { fecha, tipo: 'salida', monto: total, cuentaId,
      concepto: 'Compra ' + numero + ' — ' + prov.nombre, origen: 'pago' });
    Repo.save();
    document.getElementById('modal').classList.remove('active');
    this.render();
    InventarioUI.render && InventarioUI.render();
    Utils.toast(`Compra ${numero} guardada`);
    this.lineas = [];
  },

  // Detalle de una compra
  ver(id) {
    const c = Repo.find('compras', id);
    if (!c) return;
    const cta = Repo.find('cuentas', c.cuentaId);
    const filas = (c.items || []).map(l => {
      const item = Repo.find('items', l.itemId) || {};
      return `<tr><td>${item.codigo || ''}</td><td>${l.nombre || item.nombre || ''}</td><td style="text-align:right">${l.cantidad}</td>
        <td style="text-align:right">${Utils.formatMoney(l.costo)}</td><td style="text-align:right">${Utils.formatMoney(l.cantidad * l.costo)}</td></tr>`;
    }).join('');
    const dato = (et, v) => v ? `<div class="os-dato"><span>${et}</span>${v}</div>` : '';
    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:640px">
        <h3>Compra ${c.numero}</h3>
        <div class="os-ficha">
          ${dato('Fecha', Utils.formatDate(c.fecha))}
          ${dato('Proveedor', c.proveedorNombre)}
          ${dato('Factura del suplidor', c.refProv)}
          ${dato('Pagado desde', cta ? cta.nombre : '')}
          ${dato('Estado', Utils.etiqueta(c.estado))}
        </div>
        <div class="panel"><div class="panel-body sin-pad tabla-scroll">
          <table class="tabla">
            <thead><tr><th>Código</th><th>Artículo</th><th style="text-align:right">Cant.</th><th style="text-align:right">Costo c/u</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>${filas || '<tr><td colspan="5" class="muted">Sin detalle</td></tr>'}</tbody>
          </table>
        </div></div>
        <div style="text-align:right;font-weight:700;font-size:1.1rem;margin-bottom:12px">Total: ${Utils.formatMoney(c.total)}</div>
        <div style="display:flex;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cerrar</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
  },
  pagar() { Utils.toast('Las compras pendientes están en la pestaña Por pagar'); },
  pagarCompra(id) {
    const c = Repo.find('compras', id);
    if (!c) return;
    const monto = +prompt('Monto a pagar:', c.pendiente) || 0;
    if (monto <= 0) return;
    c.pagado = (c.pagado || 0) + monto;
    c.pendiente = Math.max(0, c.total - c.pagado);
    c.estado = c.pendiente <= 0 ? 'pagada' : 'parcial';
    Repo.update('compras', id, c);
    const cta = Repo.get('cuentas')[0];
    if (cta) {
      Repo.add('movimientosCaja', {
        fecha: Utils.today(), tipo: 'salida', monto, cuentaId: cta.id,
        concepto: 'Pago compra ' + c.numero, origen: 'pago'
      });
    }
    this.render();
    CajaUI.render && CajaUI.render();
    Utils.toast('Pago registrado');
  }
};
window.ComprasUI = ComprasUI;
