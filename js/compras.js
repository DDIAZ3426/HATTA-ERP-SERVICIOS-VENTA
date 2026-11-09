// compras.js - simplified
const ComprasUI = {
  render() {
    this.renderCompras();
    this.renderPorPagar();
  },
  renderCompras() {
    const q = (document.getElementById('cp-filtro-buscar')?.value || '').toLowerCase();
    const est = document.getElementById('cp-filtro-estado')?.value || '';
    let list = Repo.get('compras');
    if (est) list = list.filter(c => c.estado === est);
    if (q) list = list.filter(c => (c.numero||'').toLowerCase().includes(q) || (c.proveedorNombre||'').toLowerCase().includes(q));
    document.getElementById('cp-count').textContent = list.length + ' compras';
    document.getElementById('cp-tbody').innerHTML = list.map(c => `
      <tr><td>${Utils.formatDate(c.fecha)}</td><td>${c.numero}</td><td>${c.ncfProv||''}</td><td>${c.proveedorNombre||''}</td>
        <td style="text-align:right">${Utils.formatMoney(c.total)}</td>
        <td style="text-align:right">${Utils.formatMoney(c.pagado||0)}</td>
        <td style="text-align:right">${Utils.formatMoney(c.pendiente||0)}</td>
        <td>${Utils.etiqueta(c.estado)}</td></tr>`).join('') || '<tr><td colspan="8">Sin compras</td></tr>';
  },
  renderPorPagar() {
    const list = Repo.get('compras').filter(c => (c.pendiente||0) > 0);
    document.getElementById('cp-pen-tbody').innerHTML = list.map(c => `
      <tr><td>${c.proveedorNombre}</td><td>${c.numero}</td><td>${Utils.formatDate(c.vencimiento)}</td>
        <td style="text-align:right">${Utils.formatMoney(c.total)}</td>
        <td style="text-align:right">${Utils.formatMoney(c.pendiente)}</td>
        <td><button class="btn btn-sm" onclick="ComprasUI.pagarCompra('${c.id}')">Pagar</button></td></tr>`).join('') || '<tr><td colspan="6">Nada por pagar</td></tr>';
  },
  nueva() {
    const prov = Repo.get('proveedores')[0];
    const item = Repo.get('items')[0];
    if (!prov || !item) return Utils.toast('Falta crear un proveedor y un artículo');
    const num = Repo.data.numeraciones.com;
    const numero = num.pre + String(num.prox).padStart(4, '0');
    num.prox++;
    const total = (item.costo || 0) * 1;
    Repo.add('compras', {
      numero, fecha: Utils.today(), proveedorId: prov.id, proveedorNombre: prov.nombre,
      total, pagado: 0, pendiente: total, estado: 'pendiente', ncfProv: '',
      items: [{ itemId: item.id, cantidad: 1, costo: item.costo }]
    });
    if (item.controlInv) {
      item.stock = (item.stock || 0) + 1;
      Repo.update('items', item.id, { stock: item.stock });
      Repo.add('movimientosInv', { itemId: item.id, tipo: 'compra', cantidad: 1, referencia: numero, fecha: Utils.today() });
    }
    Repo.save();
    this.render();
    InventarioUI.render && InventarioUI.render();
    Utils.toast('Compra demo creada: ' + numero);
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
