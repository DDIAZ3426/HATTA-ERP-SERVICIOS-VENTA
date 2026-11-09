// maestros.js
const MaestrosUI = {
  render() {
    this.renderClientes();
    this.renderProveedores();
    this.renderItems();
    this.renderSimple('impuestos', 'ms-imp-tbody');
    this.renderSimple('categorias', 'ms-cat-tbody');
    this.renderSimple('unidades', 'ms-uni-tbody');
    this.renderCuentas();
  },
  renderClientes() {
    const q = (document.getElementById('ms-cli-buscar')?.value || '').toLowerCase();
    const list = Repo.get('clientes').filter(c => !q || c.nombre.toLowerCase().includes(q) || (c.rnc||'').includes(q));
    document.getElementById('ms-cli-count').textContent = list.length + ' clientes';
    document.getElementById('ms-cli-tbody').innerHTML = list.map(c => `
      <tr>
        <td>${c.codigo || ''}</td><td>${c.nombre}</td><td>${c.rnc || ''}</td><td>${c.tel || ''}</td>
        <td>${Utils.etiqueta(c.tipo || 'persona')}</td><td>${Utils.etiqueta(c.estado || 'activo')}</td>
        <td><button class="btn btn-sm" onclick="MaestrosUI.editarCliente('${c.id}')">Editar</button></td>
      </tr>`).join('') || '<tr><td colspan="7" class="muted">Sin clientes</td></tr>';
  },
  nuevoCliente(destino) { this.modalCliente({}, destino); },
  editarCliente(id) { this.modalCliente(Repo.find('clientes', id)); },
  modalCliente(c = {}, destino = 'modal') {
    const html = `
      <div class="modal">
        <h3>${c.id ? 'Editar' : 'Nuevo'} cliente</h3>
        <div class="form-group"><label>Nombre</label><input id="m-cli-nombre" class="form-input" value="${c.nombre||''}"></div>
        <div class="form-group"><label>RNC / Cédula</label><input id="m-cli-rnc" class="form-input" value="${c.rnc||''}"></div>
        <div class="form-group"><label>Teléfono / WhatsApp</label><input id="m-cli-tel" class="form-input" value="${c.tel||''}"></div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-primary" onclick="MaestrosUI.guardarCliente('${c.id||''}','${destino}')">Guardar</button>
          <button class="btn" onclick="document.getElementById('${destino}').classList.remove('active')">Cancelar</button>
        </div>
      </div>`;
    document.getElementById(destino).innerHTML = html;
    document.getElementById(destino).classList.add('active');
  },
  guardarCliente(id, destino = 'modal') {
    if (!document.getElementById('m-cli-nombre').value.trim()) return Utils.toast('Falta el nombre del cliente');
    const obj = {
      nombre: document.getElementById('m-cli-nombre').value,
      rnc: document.getElementById('m-cli-rnc').value,
      tel: document.getElementById('m-cli-tel').value,
      tipo: 'persona',
      estado: 'activo'
    };
    let nuevo = null;
    if (id) Repo.update('clientes', id, obj);
    else nuevo = Repo.add('clientes', { ...obj, codigo: 'CLI-' + (Repo.get('clientes').length + 1) });
    document.getElementById(destino).classList.remove('active');
    this.renderClientes();
    // Creado desde un formulario abierto (venta u orden): queda elegido ahí mismo
    if (nuevo && destino === 'modal2') document.querySelectorAll('select[data-clientes]').forEach(sel => {
      sel.insertAdjacentHTML('beforeend', `<option value="${nuevo.id}">${nuevo.nombre}</option>`);
      sel.value = nuevo.id;
      sel.dispatchEvent(new Event('change'));
    });
    Utils.toast('Cliente guardado');
  },
  renderProveedores() {
    const q = (document.getElementById('ms-prov-buscar')?.value || '').toLowerCase();
    const list = Repo.get('proveedores').filter(p => !q || (p.nombre||'').toLowerCase().includes(q) || (p.rnc||'').includes(q));
    document.getElementById('ms-prov-tbody').innerHTML = list.map(p => `
      <tr><td>${p.codigo||''}</td><td>${p.nombre}</td><td>${p.rnc||''}</td><td>${p.tel||''}</td>
      <td><button class="btn btn-sm" onclick="MaestrosUI.editarProveedor('${p.id}')">Editar</button></td></tr>`).join('') || '<tr><td colspan="5">Sin proveedores</td></tr>';
  },
  nuevoProveedor() { this.modalProveedor(); },
  editarProveedor(id) { this.modalProveedor(Repo.find('proveedores', id)); },
  modalProveedor(p = {}) {
    document.getElementById('modal').innerHTML = `
      <div class="modal"><h3>${p.id?'Editar':'Nuevo'} proveedor</h3>
        <div class="form-group"><label>Nombre</label><input id="m-prov-nombre" class="form-input" value="${p.nombre||''}"></div>
        <div class="form-group"><label>RNC</label><input id="m-prov-rnc" class="form-input" value="${p.rnc||''}"></div>
        <div class="form-group"><label>Teléfono</label><input id="m-prov-tel" class="form-input" value="${p.tel||''}"></div>
        <button class="btn btn-primary" onclick="MaestrosUI.guardarProveedor('${p.id||''}')">Guardar</button>
        <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
      </div>`;
    document.getElementById('modal').classList.add('active');
  },
  guardarProveedor(id) {
    const obj = { nombre: document.getElementById('m-prov-nombre').value, rnc: document.getElementById('m-prov-rnc').value, tel: document.getElementById('m-prov-tel').value };
    if (id) Repo.update('proveedores', id, obj);
    else Repo.add('proveedores', { ...obj, codigo: 'PROV-' + (Repo.get('proveedores').length+1) });
    document.getElementById('modal').classList.remove('active');
    this.renderProveedores();
    Utils.toast('Proveedor guardado');
  },
  renderItems() {
    const tipo = document.getElementById('ms-item-tipo')?.value || '';
    const q = (document.getElementById('ms-item-buscar')?.value || '').toLowerCase();
    let list = Repo.get('items');
    if (tipo) list = list.filter(i => i.tipo === tipo);
    if (q) list = list.filter(i => i.nombre.toLowerCase().includes(q) || (i.codigo||'').toLowerCase().includes(q));
    document.getElementById('ms-item-tbody').innerHTML = list.map(i => `
      <tr>
        <td>${i.codigo||''}</td><td>${i.nombre}</td><td>${Utils.etiqueta(i.tipo||'accesorio')}</td>
        <td>${(Repo.find('categorias', i.categoriaId)||{}).nombre || ''}</td>
        <td>Unidad</td><td style="text-align:right">${Utils.formatMoney(i.precio)}</td>
        <td>${i.itbis ? 'Sí' : 'No'}</td><td>${i.controlImei ? 'Sí' : 'No'}</td>
        <td><button class="btn btn-sm" onclick="MaestrosUI.editarItem('${i.id}')">Editar</button></td>
      </tr>`).join('') || '<tr><td colspan="9">Sin artículos</td></tr>';
  },
  nuevoItem() { this.modalItem(); },
  editarItem(id) { this.modalItem(Repo.find('items', id)); },
  modalItem(item = {}) {
    const cats = Repo.get('categorias').map(c => `<option value="${c.id}" ${item.categoriaId===c.id?'selected':''}>${c.nombre}</option>`).join('');
    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:560px">
        <h3>${item.id?'Editar':'Nuevo'} artículo</h3>
        <div class="form-group"><label>Nombre</label><input id="m-item-nombre" class="form-input" value="${item.nombre||''}"></div>
        <div class="form-row">
          <div class="form-group"><label>Tipo</label>
            <select id="m-item-tipo" class="form-input" onchange="MaestrosUI.tipoItemCambio()">
              <option value="celular" ${item.tipo==='celular'?'selected':''}>Celular</option>
              <option value="accesorio" ${item.tipo==='accesorio'?'selected':''}>Accesorio</option>
              <option value="servicio" ${item.tipo==='servicio'?'selected':''}>Servicio (mano de obra)</option>
            </select></div>
          <div class="form-group"><label>Categoría</label><select id="m-item-cat" class="form-input">${cats}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Precio venta</label><input id="m-item-precio" type="number" class="form-input" value="${item.precio||0}"></div>
          <div class="form-group"><label>Costo</label><input id="m-item-costo" type="number" class="form-input" value="${item.costo||0}"></div>
        </div>
        <div id="m-item-inv-bloque">
        <div class="form-group"><label><input type="checkbox" id="m-item-inv" ${item.controlInv?'checked':''}> Controlar inventario</label></div>
        <div class="form-group"><label><input type="checkbox" id="m-item-imei" ${item.controlImei?'checked':''}> Controlar IMEI / serie</label></div>
        <div class="form-group"><label>Existencia mínima</label><input id="m-item-min" type="number" class="form-input" value="${item.minimo||0}"></div>
        </div>
        <button class="btn btn-primary" onclick="MaestrosUI.guardarItem('${item.id||''}')">Guardar</button>
        <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
      </div>`;
    document.getElementById('modal').classList.add('active');
    this.tipoItemCambio();
  },
  // Un servicio no lleva inventario, IMEI ni existencia mínima
  tipoItemCambio() {
    const servicio = document.getElementById('m-item-tipo')?.value === 'servicio';
    const bloque = document.getElementById('m-item-inv-bloque');
    if (bloque) bloque.style.display = servicio ? 'none' : '';
  },
  guardarItem(id) {
    if (!document.getElementById('m-item-nombre').value.trim()) return Utils.toast('Falta el nombre del artículo');
    const servicio = document.getElementById('m-item-tipo').value === 'servicio';
    const obj = {
      nombre: document.getElementById('m-item-nombre').value,
      tipo: document.getElementById('m-item-tipo').value,
      categoriaId: document.getElementById('m-item-cat').value,
      precio: +document.getElementById('m-item-precio').value || 0,
      costo: +document.getElementById('m-item-costo').value || 0,
      itbis: false,
      controlInv: servicio ? false : document.getElementById('m-item-inv').checked,
      controlImei: servicio ? false : document.getElementById('m-item-imei').checked,
      minimo: servicio ? 0 : (+document.getElementById('m-item-min').value || 0),
      stock: id ? (Repo.find('items', id)?.stock || 0) : 0
    };
    if (id) Repo.update('items', id, obj);
    else Repo.add('items', { ...obj, codigo: 'PROD-' + (Repo.get('items').length+1) });
    document.getElementById('modal').classList.remove('active');
    this.renderItems();
    Utils.toast('Artículo guardado');
  },
  renderSimple(col, tbodyId) {
    const list = Repo.get(col);
    document.getElementById(tbodyId).innerHTML = list.map(x => `
      <tr><td>${x.nombre}</td>${col==='impuestos'?`<td style="text-align:right">${x.tasa}%</td>`:''}<td></td></tr>`).join('');
  },
  nuevoSimple(col) {
    const nombre = prompt('Nombre:');
    if (!nombre) return;
    const obj = { nombre };
    if (col === 'impuestos') obj.tasa = +prompt('Tasa %:', '18') || 0;
    Repo.add(col, obj);
    this.render();
  },
  renderCuentas() {
    const list = Repo.get('cuentas');
    document.getElementById('ms-cta-tbody').innerHTML = list.map(c => {
      const saldo = this.calcularSaldo(c.id);
      return `<tr><td>${c.nombre}</td><td>${Utils.etiqueta(c.tipo)}</td><td>${c.banco||''}</td>
        <td style="text-align:right">${Utils.formatMoney(c.saldoInicial)}</td>
        <td style="text-align:right">${Utils.formatMoney(saldo)}</td><td></td></tr>`;
    }).join('');
  },
  calcularSaldo(ctaId) {
    const movs = Repo.get('movimientosCaja').filter(m => m.cuentaId === ctaId);
    const cta = Repo.find('cuentas', ctaId);
    let s = cta?.saldoInicial || 0;
    movs.forEach(m => {
      if (m.tipo === 'entrada') s += m.monto;
      else if (m.tipo === 'salida') s -= m.monto;
    });
    return s;
  },
  nuevaCuenta() {
    const nombre = prompt('Nombre de la cuenta:');
    if (!nombre) return;
    Repo.add('cuentas', { nombre, tipo: 'banco', banco: '', saldoInicial: 0 });
    this.renderCuentas();
  }
};
window.MaestrosUI = MaestrosUI;
