/* ============================================================
   COMPRAS — Compras · Por pagar (CxP)
   Espejo de Ventas: el pago genera una SALIDA automática en Caja.
   Las líneas pueden ser del catálogo o libres (gastos: internet,
   papelería…). Solo las de catálogo con inventario mueven stock.
   ============================================================ */

const ComprasUI = {

  _doc: null,
  _prov: [], _its: [], _ctas: [],

  async _cargarCatalogos(){
    const [prov, its, ctas] = await Promise.all([
      Repo.list('proveedores'), Repo.list('items'), Repo.list('cuentas'),
    ]);
    ComprasUI._prov = prov.filter(p => p.activo !== false).sort((a,b)=>a.nombre.localeCompare(b.nombre));
    ComprasUI._its  = its.filter(i => i.activo !== false).sort((a,b)=>a.nombre.localeCompare(b.nombre));
    ComprasUI._ctas = ctas;
  },

  /* ================= RENDER ================= */

  async render(){
    const compras = await Repo.list('compras');
    const hoy = U.hoy();
    const st = await Ops.stats();
    const M = U.fmtMoney;

    /* --- Tira de indicadores --- */
    UI.tira('cp-tira', [
      ['Compras mes', M(st.comprasMesMonto)],
      ['Pagado mes',  M(st.pagadoMes)],
      ['Por pagar',   M(st.porPagar),       st.porPagar       > 0 ? 'alerta' : ''],
      ['Vencido',     M(st.cxpVencidoMonto), st.cxpVencidoMonto > 0 ? 'mal'   : ''],
    ]);

    /* --- Compras (con filtros) --- */
    const ord = [...compras].sort((a,b)=> b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado));
    const q = (U.$('cp-filtro-buscar').value || '').toLowerCase();
    const fe = U.$('cp-filtro-estado').value;
    const filtradas = ord.filter(c =>
        (!q || c.numero.toLowerCase().includes(q) || c.proveedorNombre.toLowerCase().includes(q) || (c.ncfProveedor||'').toLowerCase().includes(q)) &&
        (!fe || c.estado === fe));
    U.$('cp-count').textContent = filtradas.length + ' registros';
    U.$('cp-tbody').innerHTML = filtradas.map(c => ComprasUI._fila(c)).join('')
      || `<tr><td colspan="8" class="empty">Sin resultados con esos filtros.</td></tr>`;

    /* --- Por pagar (CxP) --- */
    const pend = compras.filter(c => c.estado !== 'anulada' && Ops.pendienteCompra(c) > 0.009)
      .sort((a,b)=> a.vence.localeCompare(b.vence));
    U.$('cp-badge-pendientes').textContent = st.cxpVencidoCant || '';
    U.$('cp-pen-tbody').innerHTML = pend.map(c => {
      const dias = U.diasEntre(c.vence, hoy);
      const aging = dias > 0
        ? `<span class="aging rojo">+${dias} d</span>`
        : dias === 0 ? `<span class="aging ambar">hoy</span>`
        : `<span class="aging ${dias >= -7 ? 'ambar' : 'ok'}">en ${-dias} d</span>`;
      return `
        <tr class="fila-click" onclick="ComprasUI.detalle('${c.id}')">
          <td>${U.esc(c.proveedorNombre)}</td>
          <td class="doc">${U.esc(c.numero)}</td>
          <td>${U.fmtFecha(c.vence)} &nbsp;${aging}</td>
          <td class="num">${M(c.total)}</td>
          <td class="num" style="color:var(--warning)">${M(Ops.pendienteCompra(c))}</td>
          <td class="acciones" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-success" onclick="ComprasUI.pagar('${c.id}')"><i data-lucide="banknote"></i> Pagar</button>
          </td>
        </tr>`;
    }).join('')
      || `<tr><td colspan="6" class="empty">Excelente: no hay cuentas por pagar.</td></tr>`;

    UI.icons();
  },

  _fila(c){
    const p = Ops.pendienteCompra(c);
    return `
      <tr class="fila-click ${c.estado === 'anulada' ? 'inactivo' : ''}" onclick="ComprasUI.detalle('${c.id}')">
        <td>${U.fmtFecha(c.fecha)}</td>
        <td class="doc">${U.esc(c.numero)}</td>
        <td class="doc" style="font-size:11.5px;color:var(--text-muted)">${U.esc(c.ncfProveedor || '—')}</td>
        <td>${U.esc(c.proveedorNombre)}</td>
        <td class="num">${U.fmtMoney(c.total)}</td>
        <td class="num">${U.fmtMoney(c.pagado)}</td>
        <td class="num">${U.fmtMoney(p)}</td>
        <td>${UI.badge(ERP.estadosCompra, c.estado)}
          <span class="acciones" onclick="event.stopPropagation()">
          ${p > 0.009 && c.estado !== 'anulada'
            ? `<button class="btn btn-sm btn-success" onclick="ComprasUI.pagar('${c.id}')"><i data-lucide="banknote"></i></button>` : ''}
          </span></td>
      </tr>`;
  },

  /* ================= NUEVA COMPRA ================= */

  async nueva(prefill = {}){
    await ComprasUI._cargarCatalogos();
    if(!ComprasUI._prov.length) return UI.toast('Primero crea un proveedor en Maestros.', 'warning');

    ComprasUI._doc = {
      proveedorId: prefill.proveedorId || '',
      lineas: [{ itemId:'', libre:false, nombre:'', cant:1, costo:0, tasa:ERP.itbisDefault }],
      notas:'',
    };

    UI.modal({
      titulo:'Nueva compra', icono:'shopping-cart', ancho:'ancha',
      cuerpo:`
        <div class="form-row">
          <div class="form-group">
            <label>Proveedor</label>
            <div style="display:flex;gap:8px">
              <select id="com-prov" class="form-input" onchange="ComprasUI._doc.proveedorId=this.value">
                <option value="">— Selecciona —</option>
                ${UI.opciones(ComprasUI._prov, ComprasUI._doc.proveedorId)}
              </select>
              <button class="btn" style="flex-shrink:0" title="Proveedor nuevo" onclick="ComprasUI.proveedorRapido()"><i data-lucide="plus"></i></button>
            </div>
          </div>
          <div class="form-group"><label>Fecha</label>
            <input id="com-fecha" type="date" class="form-input" value="${U.hoy()}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>NCF del proveedor</label>
            <input id="com-ncf" class="form-input" placeholder="Como sale en su factura (ej. B0100001234)">
            <div class="form-ayuda">Lo emite el proveedor; se guarda para el reporte fiscal 606 (Etapa 3).</div></div>
          <div class="form-group"><label>Condición</label>
            <select id="com-cond" class="form-input" onchange="ComprasUI.condCambio()">
              <option value="contado">Contado</option>
              <option value="credito">Crédito</option>
            </select></div>
          <div class="form-group" id="com-dias-wrap" style="display:none">
            <label>Días de crédito</label>
            <input id="com-dias" type="number" class="form-input" value="${ERP.diasCreditoDefault}" min="1"></div>
        </div>
        <div class="form-group">
          <label>Líneas</label>
          <div class="tabla-scroll">
            <table class="tabla lineas-tabla">
              <thead><tr><th style="min-width:220px">Artículo / Servicio / Gasto</th><th style="width:72px">Cant.</th>
                <th style="width:110px">Costo</th><th style="width:64px">ITBIS</th><th style="width:110px;text-align:right">Importe</th><th></th></tr></thead>
              <tbody id="com-lineas"></tbody>
            </table>
          </div>
          <button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="ComprasUI.agregarLinea()">
            <i data-lucide="plus"></i> Agregar línea</button>
        </div>
        <div class="form-group"><label>Notas</label>
          <textarea id="com-notas" class="form-input" placeholder="Opcional"></textarea></div>
        <div class="totales-caja">
          <div class="t-linea"><span>Subtotal</span><b id="com-sub">—</b></div>
          <div class="t-linea"><span>ITBIS</span><b id="com-itbis">—</b></div>
          <div class="t-linea t-total"><span>TOTAL</span><b id="com-total">—</b></div>
        </div>
        <div id="com-pago-wrap" style="border-top:1px dashed var(--border);padding-top:12px;margin-top:4px">
          <label class="check-linea"><input type="checkbox" id="com-pagar" checked onchange="ComprasUI.condCambio()">
            Registrar el pago completo al guardar</label>
          <div class="form-row" id="com-pago-campos" style="margin-top:8px">
            <div class="form-group"><label>Método</label>
              <select id="com-metodo" class="form-input">${ERP.metodosPago.map(m=>`<option>${m}</option>`).join('')}</select></div>
            <div class="form-group"><label>Cuenta que paga</label>
              <select id="com-cuenta" class="form-input">${UI.opciones(ComprasUI._ctas, '')}</select></div>
          </div>
        </div>`,
      pie:`
        <button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="ComprasUI.guardar()"><i data-lucide="save"></i> Guardar compra</button>`,
    });

    ComprasUI._refrescarLineas();
  },

  _refrescarLineas(){
    const grupos = (tipo, titulo) => {
      const arr = ComprasUI._its.filter(i => i.tipo === tipo);
      if(!arr.length) return '';
      return `<optgroup label="${titulo}">${arr.map(i =>
        `<option value="${i.id}">${U.esc(i.nombre)}</option>`).join('')}</optgroup>`;
    };
    U.$('com-lineas').innerHTML = ComprasUI._doc.lineas.map((l, i) => `
      <tr>
        <td>
          <select class="form-input" onchange="ComprasUI.lineaItem(${i}, this.value)">
            <option value="">— Selecciona —</option>
            <option value="__libre">✎ Línea libre (gasto sin catálogo)</option>
            ${grupos('articulo','Artículos')}${grupos('servicio','Servicios')}
          </select>
          ${l.libre ? `<input class="form-input" style="margin-top:6px" placeholder="Descripción del gasto"
            value="${U.esc(l.nombre)}" oninput="ComprasUI.lineaCampo(${i},'nombre',this.value)">` : ''}
        </td>
        <td><input type="number" class="form-input" min="0" step="0.5" value="${l.cant}"
          oninput="ComprasUI.lineaCampo(${i},'cant',this.value)"></td>
        <td><input type="number" class="form-input" min="0" step="0.01" value="${l.costo}"
          oninput="ComprasUI.lineaCampo(${i},'costo',this.value)"></td>
        <td style="text-align:center;font-size:12.5px;color:var(--text-dim)" id="clinea-tasa-${i}">${l.tasa}%</td>
        <td class="num" id="clinea-imp-${i}">—</td>
        <td><button class="linea-quitar" title="Quitar" onclick="ComprasUI.quitarLinea(${i})"><i data-lucide="x"></i></button></td>
      </tr>`).join('');

    [...U.$('com-lineas').querySelectorAll('select')].forEach((sel, i) => {
      const l = ComprasUI._doc.lineas[i];
      sel.value = l.libre ? '__libre' : (l.itemId || '');
    });
    ComprasUI._totales();
    UI.icons();
  },

  _totales(){
    const c = Ops.calcularLineasCompra(ComprasUI._doc.lineas);
    ComprasUI._doc.lineas.forEach((l, i) => {
      const celda = U.$('clinea-imp-' + i);
      if(celda) celda.textContent = U.fmtMoney(U.round2(U.num(l.cant) * U.num(l.costo)));
      const tc = U.$('clinea-tasa-' + i);
      if(tc) tc.textContent = U.num(l.tasa) + '%';
    });
    U.$('com-sub').textContent = U.fmtMoney(c.subtotal);
    U.$('com-itbis').textContent = U.fmtMoney(c.itbis);
    U.$('com-total').textContent = U.fmtMoney(c.total);
  },

  agregarLinea(){
    ComprasUI._doc.lineas.push({ itemId:'', libre:false, nombre:'', cant:1, costo:0, tasa:ERP.itbisDefault });
    ComprasUI._refrescarLineas();
  },
  quitarLinea(i){
    ComprasUI._doc.lineas.splice(i, 1);
    if(!ComprasUI._doc.lineas.length)
      ComprasUI._doc.lineas.push({ itemId:'', libre:false, nombre:'', cant:1, costo:0, tasa:ERP.itbisDefault });
    ComprasUI._refrescarLineas();
  },
  lineaCampo(i, campo, valor){
    ComprasUI._doc.lineas[i][campo] = valor;
    if(campo !== 'nombre') ComprasUI._totales();
  },
  lineaItem(i, valor){
    const l = ComprasUI._doc.lineas[i];
    if(valor === '__libre'){
      l.libre = true; l.itemId = null; l.nombre = l.nombre || '';
    }else{
      const item = ComprasUI._its.find(x => x.id === valor);
      l.libre = false; l.itemId = valor || '';
      if(item){ l.nombre = item.nombre; l.unidad = item.unidad; l.costo = item.costo; l.tasa = item.tasa; }
    }
    ComprasUI._refrescarLineas();
  },

  condCambio(){
    const cond = U.$('com-cond').value;
    U.$('com-dias-wrap').style.display = cond === 'credito' ? '' : 'none';
    const wrap = U.$('com-pago-wrap');
    wrap.style.display = cond === 'contado' ? '' : 'none';
    U.$('com-pago-campos').style.display = U.$('com-pagar').checked ? '' : 'none';
  },

  async guardar(){
    try{
      const cond = U.$('com-cond').value;
      const fecha = U.$('com-fecha').value || U.hoy();
      const compra = await Ops.crearCompra({
        proveedorId: ComprasUI._doc.proveedorId,
        fecha, condicion: cond,
        diasCredito: U.$('com-dias').value,
        ncfProveedor: U.$('com-ncf').value,
        lineas: ComprasUI._doc.lineas,
        notas: U.$('com-notas').value,
      });
      if(cond === 'contado' && U.$('com-pagar').checked){
        await Ops.registrarPago({
          compraId: compra.id, fecha, monto: compra.total,
          metodo: U.$('com-metodo').value, cuentaId: U.$('com-cuenta').value,
        });
      }
      UI.cerrarModal();
      UI.toast(`Compra ${compra.numero} guardada.`);
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  /* ---- Proveedor rápido ---- */
  proveedorRapido(){
    UI.modal2({
      titulo:'Proveedor nuevo', icono:'truck',
      cuerpo:`
        <div class="form-group"><label>Nombre</label><input id="pr-nombre" class="form-input"></div>
        <div class="form-row">
          <div class="form-group"><label>RNC</label><input id="pr-rnc" class="form-input" placeholder="Opcional"></div>
          <div class="form-group"><label>Teléfono</label><input id="pr-tel" class="form-input" placeholder="Opcional"></div>
        </div>`,
      pie:`<button class="btn" onclick="UI.cerrarModal2()">Cancelar</button>
           <button class="btn btn-primary" onclick="ComprasUI.guardarProveedorRapido()"><i data-lucide="save"></i> Crear</button>`,
    });
  },

  async guardarProveedorRapido(){
    const nombre = U.$('pr-nombre').value.trim();
    if(!nombre) return UI.toast('Escribe el nombre del proveedor.', 'warning');
    const p = await Repo.create('proveedores', {
      codigo:'PR-' + String((await Repo.list('proveedores')).length + 1).padStart(3,'0'),
      nombre, rnc: U.$('pr-rnc').value.trim(), telefono: U.$('pr-tel').value.trim(), email:'', activo:true,
    });
    Repo.log('Maestros','Creó proveedor', p.nombre);
    UI.cerrarModal2();
    ComprasUI._prov.push(p);
    ComprasUI._prov.sort((a,b)=>a.nombre.localeCompare(b.nombre));
    ComprasUI._doc.proveedorId = p.id;
    U.$('com-prov').innerHTML = `<option value="">— Selecciona —</option>` + UI.opciones(ComprasUI._prov, p.id);
    UI.toast(`Proveedor ${p.nombre} creado.`);
  },

  /* ================= DETALLE ================= */

  async detalle(id){
    const c = await Repo.get('compras', id);
    if(!c) return;
    const pagos = (await Repo.list('pagos')).filter(p => p.compraId === id)
      .sort((a,b)=> a.fecha.localeCompare(b.fecha));
    const pend = Ops.pendienteCompra(c);

    const filasPagos = pagos.map(p => `
      <tr><td>${U.fmtFecha(p.fecha)}</td><td>${U.esc(p.metodo)}</td>
        <td>${U.esc(p.cuentaNombre || '')}</td><td class="num">${U.fmtMoney(p.monto)}</td>
        <td class="acciones"><button class="btn btn-sm" title="Anular pago"
          onclick="ComprasUI.anularPago('${p.id}','${c.id}')"><i data-lucide="undo-2"></i></button></td></tr>`
    ).join('') || `<tr><td colspan="5" class="empty">Sin pagos todavía.</td></tr>`;

    UI.modal({
      titulo:'Detalle de compra', icono:'shopping-cart', ancho:'ancha',
      cuerpo:`
        <div class="detalle-cab">
          <div>
            <div class="doc-num">${U.esc(c.numero)}</div>
            <div class="muted">NCF proveedor: <span class="mono">${U.esc(c.ncfProveedor || '—')}</span></div>
          </div>
          ${UI.badge(ERP.estadosCompra, c.estado)}
        </div>
        <div class="detalle-datos">
          <div class="dato-item"><div class="d-label">Proveedor</div><div class="d-valor">${U.esc(c.proveedorNombre)}</div></div>
          <div class="dato-item"><div class="d-label">Fecha</div><div class="d-valor">${U.fmtFecha(c.fecha)}</div></div>
          <div class="dato-item"><div class="d-label">Condición</div><div class="d-valor">${c.condicion === 'credito' ? 'Crédito' : 'Contado'}</div></div>
          <div class="dato-item"><div class="d-label">Vence</div><div class="d-valor">${U.fmtFecha(c.vence)}</div></div>
        </div>
        <div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Descripción</th><th style="text-align:right">Cant.</th>
            <th style="text-align:right">Costo</th><th style="text-align:right">ITBIS</th><th style="text-align:right">Importe</th></tr></thead>
          <tbody>${c.lineas.map(l => `
            <tr><td>${U.esc(l.nombre)}${l.itemId ? '' : ' <span class="muted">(libre)</span>'}</td><td class="num">${l.cant}</td>
              <td class="num">${U.fmtMoney(l.costo)}</td><td class="num">${U.fmtMoney(l.itbis)}</td>
              <td class="num">${U.fmtMoney(l.importe)}</td></tr>`).join('')}
          </tbody></table></div>
        <div class="totales-caja" style="margin-top:10px">
          <div class="t-linea"><span>Subtotal</span><b>${U.fmtMoney(c.subtotal)}</b></div>
          <div class="t-linea"><span>ITBIS</span><b>${U.fmtMoney(c.itbis)}</b></div>
          <div class="t-linea"><span>Pagado</span><b>${U.fmtMoney(c.pagado)}</b></div>
          <div class="t-linea t-total"><span>Pendiente</span><b>${U.fmtMoney(pend)}</b></div>
        </div>
        ${c.notas ? `<p class="muted" style="margin-top:10px"><b>Notas:</b> ${U.esc(c.notas)}</p>` : ''}
        <div style="margin-top:14px">
          <div class="seccion-titulo"><i data-lucide="banknote"></i> Pagos de esta compra</div>
          <div class="tabla-scroll"><table class="tabla">
            <thead><tr><th>Fecha</th><th>Método</th><th>Cuenta</th><th style="text-align:right">Monto</th><th></th></tr></thead>
            <tbody>${filasPagos}</tbody></table></div>
        </div>`,
      pie:`
        ${pend > 0.009 && c.estado !== 'anulada'
          ? `<button class="btn btn-success" onclick="ComprasUI.pagar('${c.id}')"><i data-lucide="banknote"></i> Registrar pago</button>` : ''}
        ${U.num(c.pagado) <= 0.009 && c.estado !== 'anulada'
          ? `<button class="btn btn-danger" onclick="ComprasUI.anular('${c.id}')"><i data-lucide="ban"></i> Anular</button>` : ''}
        <button class="btn btn-primary" onclick="UI.cerrarModal()">Cerrar</button>`,
    });
  },

  async anular(id){
    const ok = await UI.confirmar('Anular compra',
      'La compra quedará anulada, no contará en los indicadores y dejará de sumar al inventario.', 'Sí, anular');
    if(!ok) return;
    try{
      await Ops.anularCompra(id);
      UI.cerrarModal();
      UI.toast('Compra anulada.', 'info');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  /* ================= PAGOS ================= */

  async pagar(compraId = null){
    await ComprasUI._cargarCatalogos();
    if(!ComprasUI._ctas.length) return UI.toast('Crea una cuenta de caja o banco en Maestros.', 'warning');
    const compras = (await Repo.list('compras')).filter(c => c.estado !== 'anulada' && Ops.pendienteCompra(c) > 0.009);
    if(!compras.length) return UI.toast('No hay compras pendientes de pago.', 'info');

    ComprasUI._comprasPend = compras;
    const fija = compraId ? compras.find(c => c.id === compraId) : null;

    UI.modal({
      titulo:'Registrar pago', icono:'banknote',
      cuerpo:`
        <div class="form-group"><label>Compra</label>
          <select id="pg-compra" class="form-input" onchange="ComprasUI.pagoDocCambio()" ${fija ? 'disabled' : ''}>
            ${!fija ? '<option value="">— Selecciona —</option>' : ''}
            ${compras.map(c => `<option value="${c.id}" ${fija && fija.id === c.id ? 'selected' : ''}>
              ${U.esc(c.numero)} · ${U.esc(c.proveedorNombre)} · pend. ${U.fmtMoney(Ops.pendienteCompra(c))}</option>`).join('')}
          </select></div>
        <div class="form-row">
          <div class="form-group"><label>Monto</label>
            <input id="pg-monto" type="number" step="0.01" min="0" class="form-input"></div>
          <div class="form-group"><label>Fecha</label>
            <input id="pg-fecha" type="date" class="form-input" value="${U.hoy()}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Método</label>
            <select id="pg-metodo" class="form-input">${ERP.metodosPago.map(m=>`<option>${m}</option>`).join('')}</select></div>
          <div class="form-group"><label>Cuenta que paga</label>
            <select id="pg-cuenta" class="form-input">${UI.opciones(ComprasUI._ctas, '')}</select></div>
        </div>
        <div class="form-group"><label>Nota</label><input id="pg-nota" class="form-input" placeholder="Opcional"></div>
        <p class="form-ayuda">El pago genera automáticamente una salida en Caja y Bancos.</p>`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-success" onclick="ComprasUI.guardarPago()"><i data-lucide="check"></i> Registrar</button>`,
    });
    ComprasUI.pagoDocCambio();
  },

  pagoDocCambio(){
    const id = U.$('pg-compra').value;
    const c = (ComprasUI._comprasPend || []).find(x => x.id === id);
    if(c) U.$('pg-monto').value = Ops.pendienteCompra(c);
  },

  async guardarPago(){
    try{
      const pago = await Ops.registrarPago({
        compraId: U.$('pg-compra').value,
        monto: U.$('pg-monto').value,
        fecha: U.$('pg-fecha').value,
        metodo: U.$('pg-metodo').value,
        cuentaId: U.$('pg-cuenta').value,
        nota: U.$('pg-nota').value,
      });
      UI.cerrarModal();
      UI.toast(`Pago de ${U.fmtMoney(pago.monto)} registrado.`);
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  async anularPago(id, compraId = null){
    const ok = await UI.confirmar('Anular pago',
      'Se eliminará el pago y su salida en Caja y Bancos, y la compra volverá a quedar pendiente por ese monto.', 'Sí, anular');
    if(!ok) return;
    try{
      await Ops.anularPago(id);
      UI.toast('Pago anulado.', 'info');
      if(compraId) ComprasUI.detalle(compraId); else UI.cerrarModal();
    }catch(e){ UI.toast(e.message, 'warning'); }
  },
};

App.registrar('compras', ComprasUI);
