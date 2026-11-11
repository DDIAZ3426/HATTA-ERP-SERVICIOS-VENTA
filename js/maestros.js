// maestros.js
const MaestrosUI = {
  siguienteCodigo(col, pre) {
    const usados = new Set(Repo.get(col).map(x => (x.codigo || '').toUpperCase()));
    let n = Repo.get(col).length + 1;
    while (usados.has((pre + String(n).padStart(3, '0')).toUpperCase())) n++;
    return pre + String(n).padStart(3, '0');
  },
  render() {
    this.renderClientes();
    this.renderProveedores();
    this.renderItems();
    this.renderSimple('impuestos', 'ms-imp-tbody');
    this.renderSimple('categorias', 'ms-cat-tbody');
    this.renderSimple('unidades', 'ms-uni-tbody');
    this.renderRecepcion();
    this.renderCuentas();
  },
  renderClientes() {
    const q = (document.getElementById('ms-cli-buscar')?.value || '').toLowerCase();
    const list = Repo.get('clientes').filter(c => !q || c.nombre.toLowerCase().includes(q) || (c.rnc||'').includes(q))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
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
    else nuevo = Repo.add('clientes', { ...obj, codigo: this.siguienteCodigo('clientes', 'CLI-') });
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
    const list = Repo.get('proveedores').filter(p => !q || (p.nombre||'').toLowerCase().includes(q) || (p.rnc||'').includes(q))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    document.getElementById('ms-prov-tbody').innerHTML = list.map(p => `
      <tr><td>${p.codigo||''}</td><td>${p.nombre}</td><td>${p.rnc||''}</td><td>${p.tel||''}</td>
      <td><button class="btn btn-sm" onclick="MaestrosUI.editarProveedor('${p.id}')">Editar</button></td></tr>`).join('') || '<tr><td colspan="5">Sin proveedores</td></tr>';
  },
  nuevoProveedor(destino) { this.modalProveedor({}, destino); },
  editarProveedor(id) { this.modalProveedor(Repo.find('proveedores', id)); },
  modalProveedor(p = {}, destino = 'modal') {
    document.getElementById(destino).innerHTML = `
      <div class="modal"><h3>${p.id?'Editar':'Nuevo'} proveedor</h3>
        <div class="form-group"><label>Nombre</label><input id="m-prov-nombre" class="form-input" value="${p.nombre||''}"></div>
        <div class="form-group"><label>RNC</label><input id="m-prov-rnc" class="form-input" value="${p.rnc||''}"></div>
        <div class="form-group"><label>Teléfono</label><input id="m-prov-tel" class="form-input" value="${p.tel||''}"></div>
        <button class="btn btn-primary" onclick="MaestrosUI.guardarProveedor('${p.id||''}','${destino}')">Guardar</button>
        <button class="btn" onclick="document.getElementById('${destino}').classList.remove('active')">Cancelar</button>
      </div>`;
    document.getElementById(destino).classList.add('active');
  },
  guardarProveedor(id, destino = 'modal') {
    if (!document.getElementById('m-prov-nombre').value.trim()) return Utils.toast('Falta el nombre del proveedor');
    const obj = { nombre: document.getElementById('m-prov-nombre').value, rnc: document.getElementById('m-prov-rnc').value, tel: document.getElementById('m-prov-tel').value };
    let nuevo = null;
    if (id) Repo.update('proveedores', id, obj);
    else nuevo = Repo.add('proveedores', { ...obj, codigo: this.siguienteCodigo('proveedores', 'PRV-') });
    document.getElementById(destino).classList.remove('active');
    this.renderProveedores();
    if (nuevo && destino === 'modal2') document.querySelectorAll('select[data-proveedores]').forEach(sel => {
      sel.insertAdjacentHTML('beforeend', `<option value="${nuevo.id}">${nuevo.nombre}</option>`);
      sel.value = nuevo.id;
    });
    Utils.toast('Proveedor guardado');
  },
  renderItems() {
    const tipo = document.getElementById('ms-item-tipo')?.value || '';
    const q = (document.getElementById('ms-item-buscar')?.value || '').toLowerCase();
    const orden = { celular: 1, pieza: 2, accesorio: 3, servicio: 4 };
    let list = Repo.get('items').slice().sort((a, b) =>
      (orden[a.tipo] || 9) - (orden[b.tipo] || 9) || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
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
  nuevoItem(destino) { this.modalItem({}, destino); },
  editarItem(id) { this.modalItem(Repo.find('items', id)); },
  modalItem(item = {}, destino = 'modal') {
    const cats = Repo.get('categorias').map(c => `<option value="${c.id}" ${item.categoriaId===c.id?'selected':''}>${c.nombre}</option>`).join('');
    document.getElementById(destino).innerHTML = `
      <div class="modal" style="max-width:560px">
        <h3>${item.id?'Editar':'Nuevo'} artículo</h3>
        <div class="form-row">
          <div class="form-group" style="max-width:170px"><label>Código</label>
            <input id="m-item-codigo" class="form-input" value="${item.codigo||''}"></div>
          <div class="form-group"><label>Nombre</label><input id="m-item-nombre" class="form-input" value="${item.nombre||''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Tipo</label>
            <select id="m-item-tipo" class="form-input" onchange="MaestrosUI.tipoItemCambio()">
              <option value="celular" ${item.tipo==='celular'?'selected':''}>Celular</option>
              <option value="pieza" ${item.tipo==='pieza'?'selected':''}>Pieza / repuesto</option>
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
        <div class="form-group"><label><input type="checkbox" id="m-item-inv" ${item.controlInv || !item.id ? 'checked' : ''}> Controlar inventario</label></div>
        <div class="form-group"><label><input type="checkbox" id="m-item-imei" ${item.controlImei?'checked':''}> Controlar IMEI / serie</label></div>
        </div>
        <button class="btn btn-primary" onclick="MaestrosUI.guardarItem('${item.id||''}','${destino}')">Guardar</button>
        <button class="btn" onclick="document.getElementById('${destino}').classList.remove('active')">Cancelar</button>
      </div>`;
    document.getElementById(destino).classList.add('active');
    this.tipoItemCambio();
  },
  // Un servicio no lleva inventario, IMEI ni existencia mínima
  tipoItemCambio() {
    const servicio = document.getElementById('m-item-tipo')?.value === 'servicio';
    const bloque = document.getElementById('m-item-inv-bloque');
    if (bloque) bloque.style.display = servicio ? 'none' : '';
  },
  guardarItem(id, destino = 'modal') {
    if (!document.getElementById('m-item-nombre').value.trim()) return Utils.toast('Falta el nombre del artículo');
    const codigo = document.getElementById('m-item-codigo').value.trim().toUpperCase();
    if (codigo && Repo.get('items').some(x => x.id !== id && (x.codigo || '').toUpperCase() === codigo))
      return Utils.toast('Ese código ya lo tiene otro artículo');
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
      minimo: id ? (Repo.find('items', id)?.minimo || 0) : 0,
      stock: id ? (Repo.find('items', id)?.stock || 0) : 0
    };
    obj.codigo = codigo || (id ? Repo.find('items', id)?.codigo : '') || this.siguienteCodigo('items', 'PROD-');
    let nuevo = null;
    if (id) Repo.update('items', id, obj);
    else nuevo = Repo.add('items', obj);
    document.getElementById(destino).classList.remove('active');
    this.renderItems();
    // Creado desde una compra abierta: queda elegido ahí mismo
    if (nuevo && destino === 'modal2' && document.getElementById('nc-buscar')) {
      if (!nuevo.controlInv) Utils.toast('Ese artículo no lleva inventario');
      else ComprasUI.agregarItem(nuevo.id);
    }
    Utils.toast('Artículo guardado');
  },
  // Listas del formulario de recepción del taller: se agregan y se quitan aquí
  recepcionTitulos: { tipos: 'Tipo de equipo', marcas: 'Marcas', motivos: 'Motivo de ingreso', estados: 'Estado al recibir', accesorios: 'Viene con' },
  renderRecepcion() {
    const el = document.getElementById('ms-recepcion');
    if (!el) return;
    const L = OrdenesUI.listas();
    el.innerHTML = Object.entries(this.recepcionTitulos).map(([k, t]) => `
      <div class="panel"><div class="panel-body">
        <div class="seccion-titulo" style="margin-top:0">${t}</div>
        <div class="chips">${(L[k] || []).map((v, i) =>
          `<span class="chip on chip-quitar">${v}<button type="button" onclick="MaestrosUI.quitarDeLista('${k}',${i})" title="Quitar">×</button></span>`).join('')}
          <input class="chip-nuevo" placeholder="+ Agregar" onkeydown="if(event.key==='Enter'){event.preventDefault();MaestrosUI.agregarALista('${k}',this.value)}"></div>
      </div></div>`).join('');
  },
  agregarALista(k, v) {
    v = (v || '').trim();
    if (!v) return;
    const L = OrdenesUI.listas();
    if (!L[k].some(x => x.toLowerCase() === v.toLowerCase())) { L[k].push(v); Repo.save(); }
    this.renderRecepcion();
    document.querySelectorAll('#ms-recepcion .chip-nuevo')[Object.keys(this.recepcionTitulos).indexOf(k)]?.focus();
  },
  quitarDeLista(k, i) {
    OrdenesUI.listas()[k].splice(i, 1);
    Repo.save();
    this.renderRecepcion();
  },

  renderSimple(col, tbodyId) {
    const list = Repo.get(col).slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
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
