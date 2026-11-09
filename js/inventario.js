// inventario.js
const InventarioUI = {
  render() {
    this.renderExistencias();
    this.renderMovimientos();
    this.renderAjustes();
    this.renderImei();
  },
  renderExistencias() {
    const q = (document.getElementById('inv-exi-buscar')?.value || '').toLowerCase();
    let list = Repo.get('items').filter(i => i.controlInv);
    if (q) list = list.filter(i => i.nombre.toLowerCase().includes(q));
    document.getElementById('inv-count').textContent = list.length + ' artículos';
    document.getElementById('inv-exi-tbody').innerHTML = list.map(i => {
      const valor = (i.stock || 0) * (i.costo || 0);
      const estado = (i.stock || 0) <= 0 ? 'Sin existencia' : (i.stock || 0) <= (i.minimo || 0) ? 'Bajo mínimo' : 'Disponible';
      return `<tr>
        <td>${i.codigo||''}</td><td>${i.nombre}</td><td>${(Repo.find('categorias', i.categoriaId)||{}).nombre||''}</td>
        <td style="text-align:right">${i.stock||0}</td><td style="text-align:right">${i.minimo||0}</td>
        <td style="text-align:right">${Utils.formatMoney(i.costo)}</td><td style="text-align:right">${Utils.formatMoney(valor)}</td>
        <td>${estado}</td><td></td>
      </tr>`;
    }).join('') || '<tr><td colspan="9">Sin artículos con control de inventario</td></tr>';
    // KPIs
    const items = Repo.get('items').filter(i => i.controlInv);
    document.getElementById('inv-kpi-items').textContent = items.length;
    const valorTotal = items.reduce((s, i) => s + (i.stock||0)*(i.costo||0), 0);
    document.getElementById('inv-kpi-valor').textContent = Utils.formatMoney(valorTotal);
    document.getElementById('inv-kpi-bajo').textContent = items.filter(i => (i.stock||0) <= (i.minimo||0) && (i.stock||0) > 0).length;
    document.getElementById('inv-kpi-sin').textContent = items.filter(i => (i.stock||0) <= 0).length;
  },
  renderMovimientos() {
    const sel = document.getElementById('inv-mov-item');
    const items = Repo.get('items').filter(i => i.controlInv);
    const elegido = sel.value;
    sel.innerHTML = '<option value="">Todos los artículos</option>' + items.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
    sel.value = elegido;
    const itemId = sel.value;
    let movs = Repo.get('movimientosInv');
    if (itemId) movs = movs.filter(m => m.itemId === itemId);
    document.getElementById('inv-mov-tbody').innerHTML = movs.map(m => {
      const item = Repo.find('items', m.itemId);
      return `<tr><td>${Utils.formatDate(m.fecha)}</td><td>${item?.nombre||''}</td><td>${Utils.etiqueta(m.tipo)}</td>
        <td style="text-align:right">${m.cantidad}</td><td>${m.referencia||''}</td></tr>`;
    }).join('') || '<tr><td colspan="5">Sin movimientos</td></tr>';
  },
  renderAjustes() {
    const list = Repo.get('ajustesInv');
    document.getElementById('inv-aju-tbody').innerHTML = list.map(a => {
      const item = Repo.find('items', a.itemId);
      return `<tr><td>${Utils.formatDate(a.fecha)}</td><td>${item?.nombre||''}</td>
        <td style="text-align:right">${a.cantidad}</td><td>${a.motivo||''}</td><td></td></tr>`;
    }).join('') || '<tr><td colspan="5">Sin ajustes</td></tr>';
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
  nuevoAjuste() {
    const items = Repo.get('items').filter(i => i.controlInv);
    if (!items.length) return Utils.toast('Falta crear artículos con control de inventario');
    const opts = items.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
    document.getElementById('modal').innerHTML = `
      <div class="modal">
        <h3>Nuevo ajuste de inventario</h3>
        <div class="form-group"><label>Artículo</label><select id="aj-item" class="form-input">${opts}</select></div>
        <div class="form-group"><label>Cantidad (+ o -)</label><input id="aj-cant" type="number" class="form-input" value="1"></div>
        <div class="form-group"><label>Motivo</label><input id="aj-motivo" class="form-input" placeholder="Entrada inicial, conteo, etc."></div>
        <button class="btn btn-primary" onclick="InventarioUI.guardarAjuste()">Registrar</button>
        <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
      </div>`;
    document.getElementById('modal').classList.add('active');
  },
  guardarAjuste() {
    const itemId = document.getElementById('aj-item').value;
    const cant = +document.getElementById('aj-cant').value || 0;
    const motivo = document.getElementById('aj-motivo').value;
    const item = Repo.find('items', itemId);
    if (!item) return;
    item.stock = (item.stock || 0) + cant;
    Repo.update('items', itemId, { stock: item.stock });
    Repo.add('ajustesInv', { itemId, cantidad: cant, motivo, fecha: Utils.today() });
    Repo.add('movimientosInv', { itemId, tipo: cant >= 0 ? 'ajuste+' : 'ajuste-', cantidad: Math.abs(cant), referencia: motivo, fecha: Utils.today() });
    document.getElementById('modal').classList.remove('active');
    this.render();
    Utils.toast('Ajuste registrado');
  }
};
window.InventarioUI = InventarioUI;
