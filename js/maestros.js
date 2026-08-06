/* ============================================================
   MAESTROS — Información base del sistema, totalmente editable:
   Clientes · Proveedores · Artículos y servicios · Impuestos ·
   Categorías · Unidades · Cuentas (cajas y bancos)
   ============================================================ */

const MaestrosUI = {

  _edit: null,   // { col, id } cuando se edita

  async render(){
    const [cli, prov, items, imps, cats, unis, ctas] = await Promise.all([
      Repo.list('clientes'), Repo.list('proveedores'), Repo.list('items'),
      Repo.list('impuestos'), Repo.list('categorias'), Repo.list('unidades'), Repo.list('cuentas'),
    ]);
    const M = U.fmtMoney;

    /* --- Clientes --- */
    const qc = (U.$('ms-cli-buscar').value || '').toLowerCase();
    const cliFiltrados = cli
      .filter(c => !qc || c.nombre.toLowerCase().includes(qc) || (c.rnc||'').includes(qc) || (c.codigo||'').toLowerCase().includes(qc))
      .sort((a,b)=>a.nombre.localeCompare(b.nombre));
    U.$('ms-cli-count').textContent = cliFiltrados.length + ' registros';
    U.$('ms-cli-tbody').innerHTML = cliFiltrados
      .map(c => `
        <tr class="fila-click ${c.activo === false ? 'inactivo' : ''}" onclick="MaestrosUI.detalleCliente('${c.id}')">
          <td class="doc">${U.esc(c.codigo || '')}</td>
          <td>${U.esc(c.nombre)}</td>
          <td class="mono" style="font-size:12.5px">${U.esc(c.rnc || '—')}</td>
          <td>${U.esc(c.telefono || '—')}</td>
          <td>${c.tipo === 'persona' ? 'Persona' : 'Empresa'}</td>
          <td>${UI.badge({activo:{label:'Activo',clase:'b-activo'},inactivo:{label:'Inactivo',clase:'b-inactivo'}}, c.activo === false ? 'inactivo' : 'activo')}</td>
          <td class="acciones" onclick="event.stopPropagation()">
            <button class="btn btn-sm" onclick="MaestrosUI.editarCliente('${c.id}')"><i data-lucide="pencil"></i></button>
            <button class="btn btn-sm" onclick="MaestrosUI.eliminar('clientes','${c.id}')"><i data-lucide="trash-2"></i></button>
          </td>
        </tr>`).join('')
      || `<tr><td colspan="7" class="empty">No hay clientes${qc ? ' con esa búsqueda' : ''}.</td></tr>`;

    /* --- Proveedores --- */
    const qp = (U.$('ms-prov-buscar').value || '').toLowerCase();
    U.$('ms-prov-tbody').innerHTML = prov
      .filter(p => !qp || p.nombre.toLowerCase().includes(qp) || (p.rnc||'').includes(qp))
      .sort((a,b)=>a.nombre.localeCompare(b.nombre))
      .map(p => `
        <tr class="${p.activo === false ? 'inactivo' : ''}">
          <td class="doc">${U.esc(p.codigo || '')}</td>
          <td>${U.esc(p.nombre)}</td>
          <td class="mono" style="font-size:12.5px">${U.esc(p.rnc || '—')}</td>
          <td>${U.esc(p.telefono || '—')}</td>
          <td class="acciones">
            <button class="btn btn-sm" onclick="MaestrosUI.editarProveedor('${p.id}')"><i data-lucide="pencil"></i></button>
            <button class="btn btn-sm" onclick="MaestrosUI.eliminar('proveedores','${p.id}')"><i data-lucide="trash-2"></i></button>
          </td>
        </tr>`).join('')
      || `<tr><td colspan="5" class="empty">No hay proveedores. (Se usarán en Compras — Etapa 2.)</td></tr>`;

    /* --- Artículos y servicios --- */
    const qi = (U.$('ms-item-buscar').value || '').toLowerCase();
    const ft = U.$('ms-item-tipo').value;
    U.$('ms-item-tbody').innerHTML = items
      .filter(i => (!qi || i.nombre.toLowerCase().includes(qi) || (i.codigo||'').toLowerCase().includes(qi)) && (!ft || i.tipo === ft))
      .sort((a,b)=>a.nombre.localeCompare(b.nombre))
      .map(i => `
        <tr class="fila-click ${i.activo === false ? 'inactivo' : ''}" onclick="MaestrosUI.editarItem('${i.id}')">
          <td class="doc">${U.esc(i.codigo || '')}</td>
          <td>${U.esc(i.nombre)}</td>
          <td><span class="badge ${i.tipo === 'servicio' ? 'b-servicio' : 'b-articulo'}">${i.tipo === 'servicio' ? 'Servicio' : 'Artículo'}</span></td>
          <td>${U.esc(i.categoria || '—')}</td>
          <td>${U.esc(i.unidad || '—')}</td>
          <td class="num">${M(i.precio)}</td>
          <td style="font-size:12.5px;color:var(--text-dim)">${i.tasa}%</td>
          <td class="acciones" onclick="event.stopPropagation()">
            <button class="btn btn-sm" onclick="MaestrosUI.eliminar('items','${i.id}')"><i data-lucide="trash-2"></i></button>
          </td>
        </tr>`).join('')
      || `<tr><td colspan="8" class="empty">No hay artículos ni servicios${qi || ft ? ' con esos filtros' : ''}.</td></tr>`;

    /* --- Impuestos --- */
    U.$('ms-imp-tbody').innerHTML = imps.map(x => `
      <tr><td>${U.esc(x.nombre)}</td><td class="num">${x.tasa}%</td>
        <td class="acciones">
          <button class="btn btn-sm" onclick="MaestrosUI.editarSimple('impuestos','${x.id}')"><i data-lucide="pencil"></i></button>
          <button class="btn btn-sm" onclick="MaestrosUI.eliminar('impuestos','${x.id}')"><i data-lucide="trash-2"></i></button>
        </td></tr>`).join('')
      || `<tr><td colspan="3" class="empty">Sin impuestos definidos.</td></tr>`;

    /* --- Categorías / Unidades --- */
    const listaSimple = (arr, col) => arr.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(x => `
      <tr><td>${U.esc(x.nombre)}</td>
        <td class="acciones">
          <button class="btn btn-sm" onclick="MaestrosUI.editarSimple('${col}','${x.id}')"><i data-lucide="pencil"></i></button>
          <button class="btn btn-sm" onclick="MaestrosUI.eliminar('${col}','${x.id}')"><i data-lucide="trash-2"></i></button>
        </td></tr>`).join('') || `<tr><td colspan="2" class="empty">Sin registros.</td></tr>`;
    U.$('ms-cat-tbody').innerHTML = listaSimple(cats, 'categorias');
    U.$('ms-uni-tbody').innerHTML = listaSimple(unis, 'unidades');

    /* --- Cuentas --- */
    const movs = await Repo.list('movimientos');
    U.$('ms-cta-tbody').innerHTML = ctas.map(c => `
      <tr>
        <td>${U.esc(c.nombre)}</td>
        <td>${c.tipo === 'caja' ? 'Caja' : 'Banco'}</td>
        <td>${U.esc(c.banco || '—')} ${U.esc(c.numero || '')}</td>
        <td class="num">${M(c.saldoInicial)}</td>
        <td class="num"><b>${M(Ops.saldoCuenta(c, movs))}</b></td>
        <td class="acciones">
          <button class="btn btn-sm" onclick="MaestrosUI.editarCuenta('${c.id}')"><i data-lucide="pencil"></i></button>
          <button class="btn btn-sm" onclick="MaestrosUI.eliminar('cuentas','${c.id}')"><i data-lucide="trash-2"></i></button>
        </td></tr>`).join('')
      || `<tr><td colspan="6" class="empty">Crea tu primera cuenta (caja o banco).</td></tr>`;

    UI.icons();
  },

  /* ================= CLIENTES ================= */

  async nuevoCliente(){ MaestrosUI._formCliente(null); },
  async editarCliente(id){ MaestrosUI._formCliente(await Repo.get('clientes', id)); },

  async _formCliente(c){
    MaestrosUI._edit = c ? { col:'clientes', id:c.id } : null;
    const codigo = c ? c.codigo : 'CL-' + String((await Repo.list('clientes')).length + 1).padStart(3,'0');
    UI.modal({
      titulo: c ? 'Editar cliente' : 'Nuevo cliente', icono:'user',
      cuerpo:`
        <div class="form-row">
          <div class="form-group"><label>Código</label><input id="f-codigo" class="form-input" value="${U.esc(codigo)}"></div>
          <div class="form-group"><label>Tipo</label>
            <select id="f-tipo" class="form-input">
              <option value="empresa" ${!c || c.tipo !== 'persona' ? 'selected' : ''}>Empresa</option>
              <option value="persona" ${c && c.tipo === 'persona' ? 'selected' : ''}>Persona</option>
            </select></div>
        </div>
        <div class="form-group"><label>Nombre</label><input id="f-nombre" class="form-input" value="${U.esc(c ? c.nombre : '')}"></div>
        <div class="form-row">
          <div class="form-group"><label>RNC / Cédula</label><input id="f-rnc" class="form-input" value="${U.esc(c ? c.rnc : '')}">
            <div class="form-ayuda">Con RNC (9 dígitos) se sugiere NCF B01 al facturar.</div></div>
          <div class="form-group"><label>Teléfono</label><input id="f-tel" class="form-input" value="${U.esc(c ? c.telefono : '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Email</label><input id="f-email" class="form-input" value="${U.esc(c ? c.email : '')}"></div>
        </div>
        <div class="form-group"><label>Dirección</label><input id="f-dir" class="form-input" value="${U.esc(c ? (c.direccion || '') : '')}"></div>
        ${c ? `<label class="check-linea"><input type="checkbox" id="f-activo" ${c.activo !== false ? 'checked' : ''}> Cliente activo</label>` : ''}`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-primary" onclick="MaestrosUI.guardarCliente()"><i data-lucide="save"></i> Guardar</button>`,
    });
  },

  async guardarCliente(){
    const nombre = U.$('f-nombre').value.trim();
    if(!nombre) return UI.toast('Escribe el nombre.', 'warning');
    const datos = {
      codigo: U.$('f-codigo').value.trim(), nombre,
      rnc: U.$('f-rnc').value.trim(), telefono: U.$('f-tel').value.trim(),
      email: U.$('f-email').value.trim(), direccion: U.$('f-dir').value.trim(),
      tipo: U.$('f-tipo').value,
    };
    if(MaestrosUI._edit){
      datos.activo = U.$('f-activo') ? U.$('f-activo').checked : true;
      await Repo.update('clientes', MaestrosUI._edit.id, datos);
      Repo.log('Maestros','Editó cliente', nombre);
    }else{
      await Repo.create('clientes', { ...datos, activo:true });
      Repo.log('Maestros','Creó cliente', nombre);
    }
    UI.cerrarModal();
    UI.toast('Cliente guardado.');
    Bus.emit('MAESTRO_CAMBIO', 'clientes');
  },

  async detalleCliente(id){
    const c = await Repo.get('clientes', id);
    if(!c) return;
    const ventas = (await Repo.list('ventas')).filter(v => v.clienteId === id && v.estado !== 'anulada')
      .sort((a,b)=> b.fecha.localeCompare(a.fecha));
    const facturado = U.round2(ventas.reduce((s,v)=>s+v.total,0));
    const cobrado   = U.round2(ventas.reduce((s,v)=>s+v.cobrado,0));
    const pendiente = U.round2(facturado - cobrado);

    UI.modal({
      titulo:'Cliente', icono:'user', ancho:'ancha',
      cuerpo:`
        <div class="detalle-cab">
          <div><div class="doc-num" style="font-family:'Plus Jakarta Sans'">${U.esc(c.nombre)}</div>
            <div class="muted">${U.esc(c.codigo || '')} · ${c.tipo === 'persona' ? 'Persona' : 'Empresa'}</div></div>
          ${UI.badge({activo:{label:'Activo',clase:'b-activo'},inactivo:{label:'Inactivo',clase:'b-inactivo'}}, c.activo === false ? 'inactivo' : 'activo')}
        </div>
        <div class="detalle-datos">
          <div class="dato-item"><div class="d-label">RNC / Cédula</div><div class="d-valor mono">${U.esc(c.rnc || '—')}</div></div>
          <div class="dato-item"><div class="d-label">Teléfono</div><div class="d-valor">${U.esc(c.telefono || '—')}</div></div>
          <div class="dato-item"><div class="d-label">Email</div><div class="d-valor">${U.esc(c.email || '—')}</div></div>
          <div class="dato-item"><div class="d-label">Dirección</div><div class="d-valor">${U.esc(c.direccion || '—')}</div></div>
        </div>
        <div class="cliente-balance">
          <div class="mini-kpi"><div class="mk-label">Facturado</div><div class="mk-valor">${U.fmtMoney(facturado)}</div></div>
          <div class="mini-kpi"><div class="mk-label">Cobrado</div><div class="mk-valor">${U.fmtMoney(cobrado)}</div></div>
          <div class="mini-kpi"><div class="mk-label">Pendiente</div>
            <div class="mk-valor" style="color:${pendiente > 0.009 ? 'var(--warning)' : 'var(--success)'}">${U.fmtMoney(pendiente)}</div></div>
        </div>
        <div class="seccion-titulo"><i data-lucide="receipt-text"></i> Últimas ventas (${ventas.length})</div>
        <div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Fecha</th><th>Documento</th><th style="text-align:right">Total</th>
            <th style="text-align:right">Pendiente</th><th>Estado</th></tr></thead>
          <tbody>${ventas.slice(0,5).map(v => `
            <tr class="fila-click" onclick="VentasUI.detalle('${v.id}')">
              <td>${U.fmtFecha(v.fecha)}</td><td class="doc">${U.esc(v.numero)}</td>
              <td class="num">${U.fmtMoney(v.total)}</td><td class="num">${U.fmtMoney(Ops.pendiente(v))}</td>
              <td>${UI.badge(ERP.estadosVenta, v.estado)}</td></tr>`).join('')
            || `<tr><td colspan="5" class="empty">Este cliente aún no tiene ventas.</td></tr>`}
          </tbody></table></div>`,
      pie:`
        <button class="btn btn-success" onclick="UI.cerrarModal(); VentasUI.nueva({clienteId:'${c.id}'})">
          <i data-lucide="plus"></i> Nueva venta</button>
        <button class="btn" onclick="MaestrosUI.editarCliente('${c.id}')"><i data-lucide="pencil"></i> Editar</button>
        <button class="btn btn-primary" onclick="UI.cerrarModal()">Cerrar</button>`,
    });
  },

  /* ================= PROVEEDORES ================= */

  async nuevoProveedor(){ MaestrosUI._formProveedor(null); },
  async editarProveedor(id){ MaestrosUI._formProveedor(await Repo.get('proveedores', id)); },

  async _formProveedor(p){
    MaestrosUI._edit = p ? { col:'proveedores', id:p.id } : null;
    const codigo = p ? p.codigo : 'PR-' + String((await Repo.list('proveedores')).length + 1).padStart(3,'0');
    UI.modal({
      titulo: p ? 'Editar proveedor' : 'Nuevo proveedor', icono:'truck',
      cuerpo:`
        <div class="form-group"><label>Código</label><input id="f-codigo" class="form-input" value="${U.esc(codigo)}"></div>
        <div class="form-group"><label>Nombre</label><input id="f-nombre" class="form-input" value="${U.esc(p ? p.nombre : '')}"></div>
        <div class="form-row">
          <div class="form-group"><label>RNC</label><input id="f-rnc" class="form-input" value="${U.esc(p ? p.rnc : '')}"></div>
          <div class="form-group"><label>Teléfono</label><input id="f-tel" class="form-input" value="${U.esc(p ? p.telefono : '')}"></div>
        </div>
        <div class="form-group"><label>Email</label><input id="f-email" class="form-input" value="${U.esc(p ? p.email : '')}"></div>
        ${p ? `<label class="check-linea"><input type="checkbox" id="f-activo" ${p.activo !== false ? 'checked' : ''}> Proveedor activo</label>` : ''}`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-primary" onclick="MaestrosUI.guardarProveedor()"><i data-lucide="save"></i> Guardar</button>`,
    });
  },

  async guardarProveedor(){
    const nombre = U.$('f-nombre').value.trim();
    if(!nombre) return UI.toast('Escribe el nombre.', 'warning');
    const datos = {
      codigo: U.$('f-codigo').value.trim(), nombre,
      rnc: U.$('f-rnc').value.trim(), telefono: U.$('f-tel').value.trim(), email: U.$('f-email').value.trim(),
    };
    if(MaestrosUI._edit){
      datos.activo = U.$('f-activo') ? U.$('f-activo').checked : true;
      await Repo.update('proveedores', MaestrosUI._edit.id, datos);
      Repo.log('Maestros','Editó proveedor', nombre);
    }else{
      await Repo.create('proveedores', { ...datos, activo:true });
      Repo.log('Maestros','Creó proveedor', nombre);
    }
    UI.cerrarModal(); UI.toast('Proveedor guardado.');
    Bus.emit('MAESTRO_CAMBIO', 'proveedores');
  },

  /* ================= ARTÍCULOS Y SERVICIOS ================= */

  async nuevoItem(){ MaestrosUI._formItem(null); },
  async editarItem(id){ MaestrosUI._formItem(await Repo.get('items', id)); },

  async _formItem(it){
    MaestrosUI._edit = it ? { col:'items', id:it.id } : null;
    const [cats, unis, imps, items] = await Promise.all([
      Repo.list('categorias'), Repo.list('unidades'), Repo.list('impuestos'), Repo.list('items'),
    ]);
    const codigo = it ? it.codigo : 'SV-' + String(items.filter(x=>x.tipo==='servicio').length + 1).padStart(3,'0');
    UI.modal({
      titulo: it ? 'Editar artículo / servicio' : 'Nuevo artículo / servicio', icono:'wrench',
      cuerpo:`
        <div class="form-row">
          <div class="form-group"><label>Tipo</label>
            <select id="f-itipo" class="form-input">
              <option value="servicio" ${!it || it.tipo === 'servicio' ? 'selected' : ''}>Servicio</option>
              <option value="articulo" ${it && it.tipo === 'articulo' ? 'selected' : ''}>Artículo</option>
            </select></div>
          <div class="form-group"><label>Código</label><input id="f-codigo" class="form-input" value="${U.esc(codigo)}"></div>
        </div>
        <div class="form-group"><label>Nombre</label><input id="f-nombre" class="form-input" value="${U.esc(it ? it.nombre : '')}"></div>
        <div class="form-row">
          <div class="form-group"><label>Categoría</label>
            <select id="f-cat" class="form-input"><option value="">—</option>
              ${cats.map(cx => `<option ${it && it.categoria === cx.nombre ? 'selected' : ''}>${U.esc(cx.nombre)}</option>`).join('')}
            </select></div>
          <div class="form-group"><label>Unidad</label>
            <select id="f-uni" class="form-input"><option value="">—</option>
              ${unis.map(ux => `<option ${it && it.unidad === ux.nombre ? 'selected' : ''}>${U.esc(ux.nombre)}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Precio (sin ITBIS)</label>
            <input id="f-precio" type="number" step="0.01" min="0" class="form-input" value="${it ? it.precio : ''}"></div>
          <div class="form-group"><label>Costo</label>
            <input id="f-costo" type="number" step="0.01" min="0" class="form-input" value="${it ? it.costo : ''}"></div>
          <div class="form-group"><label>Impuesto</label>
            <select id="f-imp" class="form-input">
              ${imps.map(ix => `<option value="${ix.id}" ${it && it.impuestoId === ix.id ? 'selected' : ''}>${U.esc(ix.nombre)}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-row" style="align-items:end">
          <div class="form-group" style="max-width:180px"><label>Stock mínimo</label>
            <input id="f-min" type="number" min="0" step="1" class="form-input" value="${it ? (it.stockMinimo || '') : ''}" placeholder="0">
            <div class="form-ayuda">Solo aplica a artículos con inventario.</div></div>
        </div>
        <label class="check-linea"><input type="checkbox" id="f-inv" ${it && it.controlaInventario ? 'checked' : ''}>
          Controlar inventario (el stock se administra en el módulo Inventario)</label>
        ${it ? `<label class="check-linea"><input type="checkbox" id="f-activo" ${it.activo !== false ? 'checked' : ''}> Activo</label>` : ''}`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-primary" onclick="MaestrosUI.guardarItem()"><i data-lucide="save"></i> Guardar</button>`,
    });
  },

  async guardarItem(){
    const nombre = U.$('f-nombre').value.trim();
    if(!nombre) return UI.toast('Escribe el nombre.', 'warning');
    const imp = await Repo.get('impuestos', U.$('f-imp').value);
    const datos = {
      tipo: U.$('f-itipo').value, codigo: U.$('f-codigo').value.trim(), nombre,
      categoria: U.$('f-cat').value, unidad: U.$('f-uni').value,
      precio: U.round2(U.num(U.$('f-precio').value)), costo: U.round2(U.num(U.$('f-costo').value)),
      impuestoId: imp ? imp.id : null, tasa: imp ? U.num(imp.tasa) : 0,
      controlaInventario: U.$('f-inv').checked,
      stockMinimo: U.num(U.$('f-min').value),
    };
    if(MaestrosUI._edit){
      datos.activo = U.$('f-activo') ? U.$('f-activo').checked : true;
      await Repo.update('items', MaestrosUI._edit.id, datos);
      Repo.log('Maestros','Editó artículo/servicio', nombre);
    }else{
      await Repo.create('items', { ...datos, activo:true });
      Repo.log('Maestros','Creó artículo/servicio', nombre);
    }
    UI.cerrarModal(); UI.toast('Guardado.');
    Bus.emit('MAESTRO_CAMBIO', 'items');
  },

  /* ================= IMPUESTOS / CATEGORÍAS / UNIDADES ================= */

  nuevoSimple(col){ MaestrosUI._formSimple(col, null); },
  async editarSimple(col, id){ MaestrosUI._formSimple(col, await Repo.get(col, id)); },

  _formSimple(col, x){
    MaestrosUI._edit = x ? { col, id:x.id } : null;
    MaestrosUI._colSimple = col;
    const esImp = col === 'impuestos';
    const titulos = { impuestos:'Impuesto', categorias:'Categoría', unidades:'Unidad' };
    UI.modal({
      titulo: (x ? 'Editar ' : 'Nueva ') + titulos[col].toLowerCase(), icono:'tag',
      ancho:'angosta',
      cuerpo:`
        <div class="form-group"><label>Nombre</label><input id="f-nombre" class="form-input" value="${U.esc(x ? x.nombre : '')}"></div>
        ${esImp ? `<div class="form-group"><label>Tasa (%)</label>
          <input id="f-tasa" type="number" step="0.01" min="0" class="form-input" value="${x ? x.tasa : ERP.itbisDefault}"></div>` : ''}`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-primary" onclick="MaestrosUI.guardarSimple()"><i data-lucide="save"></i> Guardar</button>`,
    });
  },

  async guardarSimple(){
    const col = MaestrosUI._colSimple;
    const nombre = U.$('f-nombre').value.trim();
    if(!nombre) return UI.toast('Escribe el nombre.', 'warning');
    const datos = { nombre };
    if(col === 'impuestos') datos.tasa = U.num(U.$('f-tasa').value);

    if(MaestrosUI._edit){
      await Repo.update(col, MaestrosUI._edit.id, datos);
      /* si cambia la tasa, sincroniza los items que usan este impuesto */
      if(col === 'impuestos'){
        const items = await Repo.list('items');
        for(const it of items.filter(i => i.impuestoId === MaestrosUI._edit.id)){
          await Repo.update('items', it.id, { tasa: datos.tasa });
        }
      }
      Repo.log('Maestros','Editó ' + col, nombre);
    }else{
      await Repo.create(col, datos);
      Repo.log('Maestros','Creó en ' + col, nombre);
    }
    UI.cerrarModal(); UI.toast('Guardado.');
    Bus.emit('MAESTRO_CAMBIO', col);
  },

  /* ================= CUENTAS (cajas y bancos) ================= */

  nuevaCuenta(){ MaestrosUI._formCuenta(null); },
  async editarCuenta(id){ MaestrosUI._formCuenta(await Repo.get('cuentas', id)); },

  _formCuenta(c){
    MaestrosUI._edit = c ? { col:'cuentas', id:c.id } : null;
    UI.modal({
      titulo: c ? 'Editar cuenta' : 'Nueva cuenta', icono:'landmark',
      cuerpo:`
        <div class="form-group"><label>Nombre</label>
          <input id="f-nombre" class="form-input" value="${U.esc(c ? c.nombre : '')}" placeholder="Ej.: Caja principal, Banco Popular"></div>
        <div class="form-row">
          <div class="form-group"><label>Tipo</label>
            <select id="f-ctipo" class="form-input">
              <option value="caja" ${!c || c.tipo === 'caja' ? 'selected' : ''}>Caja (efectivo)</option>
              <option value="banco" ${c && c.tipo === 'banco' ? 'selected' : ''}>Banco</option>
            </select></div>
          <div class="form-group"><label>Saldo inicial</label>
            <input id="f-saldo" type="number" step="0.01" class="form-input" value="${c ? c.saldoInicial : 0}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Banco</label><input id="f-banco" class="form-input" value="${U.esc(c ? (c.banco || '') : '')}" placeholder="Si aplica"></div>
          <div class="form-group"><label>No. de cuenta</label><input id="f-numcta" class="form-input" value="${U.esc(c ? (c.numero || '') : '')}" placeholder="****1234"></div>
        </div>
        <p class="form-ayuda">El saldo actual se calcula: saldo inicial + entradas − salidas ± transferencias.</p>`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-primary" onclick="MaestrosUI.guardarCuenta()"><i data-lucide="save"></i> Guardar</button>`,
    });
  },

  async guardarCuenta(){
    const nombre = U.$('f-nombre').value.trim();
    if(!nombre) return UI.toast('Escribe el nombre de la cuenta.', 'warning');
    const datos = {
      nombre, tipo: U.$('f-ctipo').value,
      banco: U.$('f-banco').value.trim(), numero: U.$('f-numcta').value.trim(),
      saldoInicial: U.round2(U.num(U.$('f-saldo').value)),
    };
    if(MaestrosUI._edit){
      await Repo.update('cuentas', MaestrosUI._edit.id, datos);
      Repo.log('Maestros','Editó cuenta', nombre);
    }else{
      await Repo.create('cuentas', datos);
      Repo.log('Maestros','Creó cuenta', nombre);
    }
    UI.cerrarModal(); UI.toast('Cuenta guardada.');
    Bus.emit('MAESTRO_CAMBIO', 'cuentas');
  },

  /* ================= ELIMINAR (con protección de usos) ================= */

  async eliminar(col, id){
    const x = await Repo.get(col, id);
    if(!x) return;

    let usos = 0, dondeSeUsa = '';
    if(col === 'clientes'){ usos = await Ops.usosCliente(id); dondeSeUsa = 'ventas, cotizaciones o cobros'; }
    if(col === 'proveedores'){ usos = await Ops.usosProveedor(id); dondeSeUsa = 'compras o pagos'; }
    if(col === 'items'){ usos = await Ops.usosItem(id); dondeSeUsa = 'líneas de documentos'; }
    if(col === 'cuentas'){ usos = await Ops.usosCuenta(id); dondeSeUsa = 'movimientos, cobros o pagos'; }
    if(col === 'impuestos'){
      usos = (await Repo.list('items')).filter(i => i.impuestoId === id).length;
      dondeSeUsa = 'artículos o servicios';
    }

    if(usos > 0){
      if(col === 'clientes' || col === 'items' || col === 'proveedores'){
        const ok = await UI.confirmar('No se puede eliminar',
          `"${x.nombre}" tiene ${usos} uso(s) en ${dondeSeUsa}. Para conservar el historial, puedes desactivarlo y dejará de aparecer en los formularios.`,
          'Desactivar', 'btn-primary');
        if(ok){
          await Repo.update(col, id, { activo:false });
          Repo.log('Maestros','Desactivó', x.nombre);
          UI.toast('Desactivado.', 'info');
          Bus.emit('MAESTRO_CAMBIO', col);
        }
      }else{
        UI.toast(`No se puede eliminar: tiene ${usos} uso(s) en ${dondeSeUsa}.`, 'warning');
      }
      return;
    }

    const ok = await UI.confirmar('Eliminar', `Se eliminará "${x.nombre}" de forma permanente.`, 'Sí, eliminar');
    if(!ok) return;
    await Repo.remove(col, id);
    Repo.log('Maestros','Eliminó', x.nombre);
    UI.toast('Eliminado.', 'info');
    Bus.emit('MAESTRO_CAMBIO', col);
  },
};

App.registrar('maestros', MaestrosUI);
