/* ============================================================
   VENTAS — Facturas · Cotizaciones · Por cobrar
   Cobrar es una acción, no una pestaña: se cobra desde Por cobrar
   o desde la factura. El historial de cobros vive en la factura.
   ============================================================ */

const VentasUI = {

  _doc: null,          // documento en edición (modal nueva venta / cotización)
  _cli: [], _its: [], _ctas: [],

  async _cargarCatalogos(){
    const [cli, its, ctas] = await Promise.all([
      Repo.list('clientes'), Repo.list('items'), Repo.list('cuentas'),
    ]);
    VentasUI._cli  = cli.filter(c => c.activo !== false).sort((a,b)=>a.nombre.localeCompare(b.nombre));
    VentasUI._its  = its.filter(i => i.activo !== false).sort((a,b)=>a.nombre.localeCompare(b.nombre));
    VentasUI._ctas = ctas;
  },

  /* ================= RENDER GENERAL ================= */

  async render(){
    const [ventas, cots] = await Promise.all([
      Repo.list('ventas'), Repo.list('cotizaciones'),
    ]);
    const hoy = U.hoy();
    const st = await Ops.stats();
    const M = U.fmtMoney;

    /* --- Tira de indicadores --- */
    UI.tira('vt-tira', [
      ['Facturado mes', M(st.facturadoMes)],
      ['Cobrado mes',   M(st.cobradoMes)],
      ['Por cobrar',    M(st.porCobrar),    st.porCobrar    > 0 ? 'alerta' : ''],
      ['Vencido',       M(st.vencidoMonto), st.vencidoMonto > 0 ? 'mal'    : ''],
    ]);

    /* --- Facturas (con filtros) --- */
    const ord = [...ventas].sort((a,b)=> b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado));
    const q = (U.$('vt-filtro-buscar').value || '').toLowerCase();
    const fe = U.$('vt-filtro-estado').value;
    const filtradas = ord.filter(v =>
      (!q || v.numero.toLowerCase().includes(q) || v.clienteNombre.toLowerCase().includes(q) || (v.ncf||'').toLowerCase().includes(q)) &&
      (!fe || v.estado === fe));
    U.$('vt-count').textContent = filtradas.length + ' registros';
    U.$('vt-tbody').innerHTML = filtradas.map(v => VentasUI._filaVenta(v)).join('')
      || `<tr><td colspan="8" class="empty">Sin resultados con esos filtros.</td></tr>`;

    /* --- Cotizaciones --- */
    const qc = (U.$('vt-cot-buscar').value || '').toLowerCase();
    const cotsOrd = [...cots].sort((a,b)=> b.fecha.localeCompare(a.fecha));
    U.$('vt-cot-tbody').innerHTML = cotsOrd
      .filter(c => !qc || c.numero.toLowerCase().includes(qc) || c.clienteNombre.toLowerCase().includes(qc))
      .map(c => {
        const visual = (c.estado === 'abierta' && c.vence < hoy) ? 'vencida' : c.estado;
        return `
        <tr class="fila-click" onclick="VentasUI.detalleCot('${c.id}')">
          <td class="doc">${U.esc(c.numero)}</td>
          <td>${U.esc(c.clienteNombre)}</td>
          <td>${U.fmtFecha(c.fecha)}</td>
          <td>${U.fmtFecha(c.vence)}</td>
          <td class="num">${M(c.total)}</td>
          <td>${UI.badge(ERP.estadosCotizacion, visual)}</td>
          <td class="acciones" onclick="event.stopPropagation()">
            ${(c.estado === 'abierta' || c.estado === 'aceptada')
              ? `<button class="btn btn-sm btn-primary" onclick="VentasUI.convertir('${c.id}')"><i data-lucide="arrow-right-circle"></i> Facturar</button>` : ''}
          </td>
        </tr>`;
      }).join('')
      || `<tr><td colspan="7" class="empty">No hay cotizaciones${qc ? ' con esa búsqueda' : ''}.</td></tr>`;

    /* --- Por cobrar (CxC) --- */
    const pend = ventas.filter(v => v.estado !== 'anulada' && Ops.pendiente(v) > 0.009)
      .sort((a,b)=> a.vence.localeCompare(b.vence));
    U.$('vt-badge-pendientes').textContent = st.vencidoCant || '';
    U.$('vt-pen-tbody').innerHTML = pend.map(v => {
      const dias = U.diasEntre(v.vence, hoy);   // >0 vencida
      const aging = dias > 0
        ? `<span class="aging rojo">+${dias} d</span>`
        : dias === 0 ? `<span class="aging ambar">hoy</span>`
        : `<span class="aging ${dias >= -7 ? 'ambar' : 'ok'}">en ${-dias} d</span>`;
      return `
        <tr class="fila-click" onclick="VentasUI.detalle('${v.id}')">
          <td>${U.esc(v.clienteNombre)}</td>
          <td class="doc">${U.esc(v.numero)}</td>
          <td>${U.fmtFecha(v.vence)} &nbsp;${aging}</td>
          <td class="num">${M(v.total)}</td>
          <td class="num" style="color:var(--warning)">${M(Ops.pendiente(v))}</td>
          <td class="acciones" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-success" onclick="VentasUI.cobrar('${v.id}')"><i data-lucide="hand-coins"></i> Cobrar</button>
          </td>
        </tr>`;
    }).join('')
      || `<tr><td colspan="6" class="empty">Excelente: no hay cuentas por cobrar.</td></tr>`;

    UI.icons();
  },

  _filaVenta(v){
    const p = Ops.pendiente(v);
    return `
      <tr class="fila-click ${v.estado === 'anulada' ? 'inactivo' : ''}" onclick="VentasUI.detalle('${v.id}')">
        <td>${U.fmtFecha(v.fecha)}</td>
        <td class="doc">${U.esc(v.numero)}</td>
        <td class="doc" style="font-size:11.5px;color:var(--text-muted)">${U.esc(v.ncf || '—')}</td>
        <td>${U.esc(v.clienteNombre)}</td>
        <td class="num">${U.fmtMoney(v.total)}</td>
        <td class="num">${U.fmtMoney(v.cobrado)}</td>
        <td class="num">${U.fmtMoney(p)}</td>
        <td>${UI.badge(ERP.estadosVenta, v.estado)}
          <span class="acciones" onclick="event.stopPropagation()">
          ${p > 0.009 && v.estado !== 'anulada'
            ? `<button class="btn btn-sm btn-success" onclick="VentasUI.cobrar('${v.id}')"><i data-lucide="hand-coins"></i></button>` : ''}
          </span></td>
      </tr>`;
  },

  /* ================= NUEVA VENTA / COTIZACIÓN ================= */

  async nueva(prefill = {}){ await VentasUI._abrirDoc('venta', prefill); },
  async nuevaCot(prefill = {}){ await VentasUI._abrirDoc('cot', prefill); },

  async _abrirDoc(tipo, prefill){
    await VentasUI._cargarCatalogos();
    if(!VentasUI._cli.length) return UI.toast('Primero crea un cliente en Maestros.', 'warning');

    VentasUI._doc = {
      tipo,
      clienteId: prefill.clienteId || '',
      origenCotId: prefill.origenCotId || null,
      ordenId: prefill.ordenId || null,
      lineas: (prefill.lineas || []).map(l => ({ ...l })),
      notas: prefill.notas || '',
    };
    if(!VentasUI._doc.lineas.length) VentasUI._doc.lineas.push({ itemId:'', libre:false, nombre:'', cant:1, precio:0, tasa:ERP.itbisDefault });

    const esVenta = tipo === 'venta';
    const cliSel = `
      <div class="form-group">
        <label>Cliente</label>
        <div style="display:flex;gap:8px">
          <select id="doc-cliente" class="form-input" onchange="VentasUI.clienteCambio()">
            <option value="">— Selecciona —</option>
            ${UI.opciones(VentasUI._cli, VentasUI._doc.clienteId)}
          </select>
          <button class="btn" style="flex-shrink:0" title="Cliente nuevo" onclick="VentasUI.clienteRapido()"><i data-lucide="user-plus"></i></button>
        </div>
      </div>`;

    const condicion = esVenta ? `
      <div class="form-row">
        <div class="form-group">
          <label>Condición</label>
          <select id="doc-cond" class="form-input" onchange="VentasUI.condCambio()">
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
        <div class="form-group" id="doc-dias-wrap" style="display:none">
          <label>Días de crédito</label>
          <input id="doc-dias" type="number" class="form-input" value="${ERP.diasCreditoDefault}" min="1">
        </div>
        <div class="form-group">
          <label>Comprobante</label>
          <select id="doc-ncf" class="form-input">
            ${ERP.tiposNcf.map(t => `<option value="${t.id}">${U.esc(t.label)}</option>`).join('')}
          </select>
        </div>
      </div>` : `
      <div class="form-row">
        <div class="form-group">
          <label>Validez (días)</label>
          <input id="doc-validez" type="number" class="form-input" value="${ERP.diasValidezCotizacion}" min="1">
        </div>
      </div>`;

    const cobroAhora = esVenta ? `
      <div id="doc-cobro-wrap" style="border-top:1px dashed var(--border);padding-top:12px;margin-top:4px">
        <label class="check-linea"><input type="checkbox" id="doc-cobrar" checked onchange="VentasUI.condCambio()">
          Registrar el cobro completo al guardar</label>
        <div class="form-row" id="doc-cobro-campos" style="margin-top:8px">
          <div class="form-group"><label>Método</label>
            <select id="doc-metodo" class="form-input">${ERP.metodosPago.map(m=>`<option>${m}</option>`).join('')}</select></div>
          <div class="form-group"><label>Cuenta que recibe</label>
            <select id="doc-cuenta" class="form-input">${UI.opciones(VentasUI._ctas, '')}</select></div>
        </div>
      </div>` : '';

    UI.modal({
      titulo: esVenta ? 'Nueva venta' : 'Nueva cotización',
      icono: esVenta ? 'receipt-text' : 'file-text',
      ancho: 'ancha',
      cuerpo: `
        <div class="form-row">
          ${cliSel}
          <div class="form-group"><label>Fecha</label>
            <input id="doc-fecha" type="date" class="form-input" value="${U.hoy()}"></div>
        </div>
        ${condicion}
        <div class="form-group">
          <label>Líneas</label>
          <div class="tabla-scroll">
            <table class="tabla lineas-tabla">
              <thead><tr><th style="min-width:210px">Artículo / Servicio</th><th style="width:72px">Cant.</th>
                <th style="width:110px">Precio</th><th style="width:64px">ITBIS</th><th style="width:110px;text-align:right">Importe</th><th></th></tr></thead>
              <tbody id="doc-lineas"></tbody>
            </table>
          </div>
          <button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="VentasUI.agregarLinea()">
            <i data-lucide="plus"></i> Agregar línea</button>
        </div>
        <div class="form-group"><label>Notas</label>
          <textarea id="doc-notas" class="form-input" placeholder="Opcional">${U.esc(VentasUI._doc.notas)}</textarea></div>
        <div class="totales-caja">
          <div class="t-linea"><span>Subtotal</span><b id="doc-sub">—</b></div>
          <div class="t-linea"><span>ITBIS</span><b id="doc-itbis">—</b></div>
          <div class="t-linea t-total"><span>TOTAL</span><b id="doc-total">—</b></div>
        </div>
        ${cobroAhora}
      `,
      pie: `
        <button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="VentasUI.guardarDoc()">
          <i data-lucide="save"></i> Guardar ${esVenta ? 'venta' : 'cotización'}</button>`,
    });

    VentasUI._refrescarLineas();
    if(VentasUI._doc.clienteId) VentasUI.clienteCambio();
  },

  _refrescarLineas(){
    const grupos = (tipo, titulo) => {
      const arr = VentasUI._its.filter(i => i.tipo === tipo);
      if(!arr.length) return '';
      return `<optgroup label="${titulo}">${arr.map(i =>
        `<option value="${i.id}">${U.esc(i.nombre)}</option>`).join('')}</optgroup>`;
    };
    U.$('doc-lineas').innerHTML = VentasUI._doc.lineas.map((l, i) => `
      <tr>
        <td>
          <select class="form-input" onchange="VentasUI.lineaItem(${i}, this.value)">
            <option value="">— Selecciona —</option>
            <option value="__libre">✎ Línea libre (concepto sin catálogo)</option>
            ${grupos('servicio','Servicios')}${grupos('articulo','Artículos')}
          </select>
          ${l.libre ? `<input class="form-input" style="margin-top:6px" placeholder="Descripción del concepto"
            value="${U.esc(l.nombre || '')}" oninput="VentasUI.lineaCampo(${i},'nombre',this.value)">` : ''}
        </td>
        <td><input type="number" class="form-input" min="0" step="0.5" value="${l.cant}"
          oninput="VentasUI.lineaCampo(${i},'cant',this.value)"></td>
        <td><input type="number" class="form-input" min="0" step="0.01" value="${l.precio}"
          oninput="VentasUI.lineaCampo(${i},'precio',this.value)"></td>
        <td style="text-align:center;font-size:12.5px;color:var(--text-dim)" id="linea-tasa-${i}">${l.tasa}%</td>
        <td class="num" id="linea-imp-${i}">—</td>
        <td><button class="linea-quitar" title="Quitar" onclick="VentasUI.quitarLinea(${i})"><i data-lucide="x"></i></button></td>
      </tr>`).join('');

    /* re-seleccionar items en los selects */
    [...U.$('doc-lineas').querySelectorAll('select')].forEach((sel, i) => {
      const l = VentasUI._doc.lineas[i];
      sel.value = l.libre ? '__libre' : (l.itemId || '');
    });
    VentasUI._totales();
    UI.icons();
  },

  _totales(){
    const c = Ops.calcularLineas(VentasUI._doc.lineas);
    VentasUI._doc.lineas.forEach((l, i) => {
      const celda = U.$('linea-imp-' + i);
      if(celda) celda.textContent = U.fmtMoney(U.round2(U.num(l.cant) * U.num(l.precio)));
      const tc = U.$('linea-tasa-' + i);
      if(tc) tc.textContent = U.num(l.tasa) + '%';
    });
    U.$('doc-sub').textContent = U.fmtMoney(c.subtotal);
    U.$('doc-itbis').textContent = U.fmtMoney(c.itbis);
    U.$('doc-total').textContent = U.fmtMoney(c.total);
  },

  agregarLinea(){
    VentasUI._doc.lineas.push({ itemId:'', cant:1, precio:0, tasa:ERP.itbisDefault });
    VentasUI._refrescarLineas();
  },
  quitarLinea(i){
    VentasUI._doc.lineas.splice(i, 1);
    if(!VentasUI._doc.lineas.length) VentasUI._doc.lineas.push({ itemId:'', cant:1, precio:0, tasa:ERP.itbisDefault });
    VentasUI._refrescarLineas();
  },
  lineaCampo(i, campo, valor){
    VentasUI._doc.lineas[i][campo] = valor;
    if(campo !== 'nombre') VentasUI._totales();
  },
  lineaItem(i, valor){
    const l = VentasUI._doc.lineas[i];
    if(valor === '__libre'){
      l.libre = true; l.itemId = null; l.nombre = l.nombre || '';
    }else{
      const item = VentasUI._its.find(x => x.id === valor);
      l.libre = false; l.itemId = valor || '';
      if(item){ l.nombre = item.nombre; l.unidad = item.unidad; l.precio = item.precio; l.tasa = item.tasa; }
    }
    VentasUI._refrescarLineas();
  },

  clienteCambio(){
    const sel = U.$('doc-cliente');
    VentasUI._doc.clienteId = sel.value;
    const ncfSel = U.$('doc-ncf');
    if(!ncfSel) return;
    const c = VentasUI._cli.find(x => x.id === sel.value);
    if(c) ncfSel.value = (c.rnc && c.rnc.replace(/\D/g,'').length === 9) ? 'B01' : 'B02';
  },

  condCambio(){
    const cond = U.$('doc-cond') ? U.$('doc-cond').value : 'contado';
    const diasWrap = U.$('doc-dias-wrap');
    const cobroWrap = U.$('doc-cobro-wrap');
    if(diasWrap) diasWrap.style.display = cond === 'credito' ? '' : 'none';
    if(cobroWrap){
      cobroWrap.style.display = cond === 'contado' ? '' : 'none';
      const campos = U.$('doc-cobro-campos');
      if(campos) campos.style.display = U.$('doc-cobrar').checked ? '' : 'none';
    }
  },

  async guardarDoc(){
    const d = VentasUI._doc;
    d.notas = U.$('doc-notas').value;
    const fecha = U.$('doc-fecha').value || U.hoy();
    try{
      if(d.tipo === 'venta'){
        const cond = U.$('doc-cond').value;
        const venta = await Ops.crearVenta({
          clienteId: d.clienteId, fecha, condicion: cond,
          diasCredito: U.$('doc-dias').value,
          tipoNcf: U.$('doc-ncf').value,
          lineas: d.lineas, notas: d.notas, origenCotId: d.origenCotId,
        });
        if(cond === 'contado' && U.$('doc-cobrar').checked){
          await Ops.registrarCobro({
            ventaId: venta.id, fecha, monto: venta.total,
            metodo: U.$('doc-metodo').value, cuentaId: U.$('doc-cuenta').value,
          });
        }
        if(d.ordenId) await Ops.enlazarFacturaOrden(d.ordenId, venta);
        UI.cerrarModal();
        UI.toast(`Venta ${venta.numero} guardada.`);
      }else{
        const cot = await Ops.crearCotizacion({
          clienteId: d.clienteId, fecha,
          diasValidez: U.$('doc-validez').value,
          lineas: d.lineas, notas: d.notas,
        });
        UI.cerrarModal();
        UI.toast(`Cotización ${cot.numero} guardada.`);
      }
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  /* ---- Cliente rápido (modal secundario) ---- */
  clienteRapido(){
    UI.modal2({
      titulo:'Cliente nuevo', icono:'user-plus',
      cuerpo:`
        <div class="form-group"><label>Nombre</label><input id="cr-nombre" class="form-input" autofocus></div>
        <div class="form-row">
          <div class="form-group"><label>RNC / Cédula</label><input id="cr-rnc" class="form-input" placeholder="Opcional"></div>
          <div class="form-group"><label>Teléfono</label><input id="cr-tel" class="form-input" placeholder="Opcional"></div>
        </div>`,
      pie:`<button class="btn" onclick="UI.cerrarModal2()">Cancelar</button>
           <button class="btn btn-primary" onclick="VentasUI.guardarClienteRapido()"><i data-lucide="save"></i> Crear</button>`,
    });
  },

  async guardarClienteRapido(){
    const nombre = U.$('cr-nombre').value.trim();
    if(!nombre) return UI.toast('Escribe el nombre del cliente.', 'warning');
    const c = await Repo.create('clientes', {
      codigo:'CL-' + String((await Repo.list('clientes')).length + 1).padStart(3,'0'),
      nombre, rnc: U.$('cr-rnc').value.trim(), telefono: U.$('cr-tel').value.trim(),
      email:'', tipo:'empresa', activo:true,
    });
    Repo.log('Maestros','Creó cliente', c.nombre);
    UI.cerrarModal2();
    VentasUI._cli.push(c);
    VentasUI._cli.sort((a,b)=>a.nombre.localeCompare(b.nombre));
    const sel = U.$('doc-cliente');
    sel.innerHTML = `<option value="">— Selecciona —</option>` + UI.opciones(VentasUI._cli, c.id);
    VentasUI.clienteCambio();
    UI.toast(`Cliente ${c.nombre} creado.`);
  },

  /* ================= DETALLE DE VENTA ================= */

  async detalle(id){
    const v = await Repo.get('ventas', id);
    if(!v) return;
    const cobros = (await Repo.list('cobros')).filter(c => c.ventaId === id)
      .sort((a,b)=> a.fecha.localeCompare(b.fecha));
    const p = Ops.pendiente(v);

    const filasCobros = cobros.map(c => {
      const ret = U.num(c.retItbis) + U.num(c.retIsr);
      return `
      <tr><td>${U.fmtFecha(c.fecha)}</td><td>${U.esc(c.metodo)}</td>
        <td>${U.esc(c.cuentaNombre || '—')}</td>
        <td class="num">${U.fmtMoney(c.monto)}</td>
        <td class="num">${ret > 0 ? U.fmtMoney(ret) : '—'}</td>
        <td class="num"><b>${U.fmtMoney(U.num(c.aplicado) || U.num(c.monto))}</b></td>
        <td class="acciones"><button class="btn btn-sm" title="Anular cobro"
          onclick="VentasUI.anularCobro('${c.id}','${v.id}')"><i data-lucide="undo-2"></i></button></td></tr>`;
    }).join('') || `<tr><td colspan="7" class="empty">Sin cobros todavía.</td></tr>`;

    UI.modal({
      titulo:'Detalle de venta', icono:'receipt-text', ancho:'ancha',
      cuerpo:`
        <div class="detalle-cab">
          <div>
            <div class="doc-num">${U.esc(v.numero)}</div>
            <div class="muted">NCF: <span class="mono">${U.esc(v.ncf || 'Sin comprobante')}</span></div>
          </div>
          ${UI.badge(ERP.estadosVenta, v.estado)}
        </div>
        <div class="detalle-datos">
          <div class="dato-item"><div class="d-label">Cliente</div><div class="d-valor">${U.esc(v.clienteNombre)}</div></div>
          <div class="dato-item"><div class="d-label">RNC / Cédula</div><div class="d-valor mono">${U.esc(v.clienteRnc || '—')}</div></div>
          <div class="dato-item"><div class="d-label">Fecha</div><div class="d-valor">${U.fmtFecha(v.fecha)}</div></div>
          <div class="dato-item"><div class="d-label">Condición</div><div class="d-valor">${v.condicion === 'credito' ? 'Crédito' : 'Contado'}</div></div>
          <div class="dato-item"><div class="d-label">Vence</div><div class="d-valor">${U.fmtFecha(v.vence)}</div></div>
        </div>
        <div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Descripción</th><th style="text-align:right">Cant.</th>
            <th style="text-align:right">Precio</th><th style="text-align:right">ITBIS</th><th style="text-align:right">Importe</th></tr></thead>
          <tbody>${v.lineas.map(l => `
            <tr><td>${U.esc(l.nombre)}</td><td class="num">${l.cant}</td>
              <td class="num">${U.fmtMoney(l.precio)}</td><td class="num">${U.fmtMoney(l.itbis)}</td>
              <td class="num">${U.fmtMoney(l.importe)}</td></tr>`).join('')}
          </tbody></table></div>
        <div class="totales-caja" style="margin-top:10px">
          <div class="t-linea"><span>Subtotal</span><b>${U.fmtMoney(v.subtotal)}</b></div>
          <div class="t-linea"><span>ITBIS</span><b>${U.fmtMoney(v.itbis)}</b></div>
          <div class="t-linea"><span>Cobrado</span><b>${U.fmtMoney(v.cobrado)}</b></div>
          <div class="t-linea t-total"><span>Pendiente</span><b>${U.fmtMoney(p)}</b></div>
        </div>
        ${v.notas ? `<p class="muted" style="margin-top:10px"><b>Notas:</b> ${U.esc(v.notas)}</p>` : ''}
        <div style="margin-top:14px">
          <div class="seccion-titulo"><i data-lucide="hand-coins"></i> Cobros de esta venta</div>
          <div class="tabla-scroll"><table class="tabla">
            <thead><tr><th>Fecha</th><th>Método</th><th>Cuenta</th>
              <th style="text-align:right">Recibido</th><th style="text-align:right">Retenido</th>
              <th style="text-align:right">Aplicado</th><th></th></tr></thead>
            <tbody>${filasCobros}</tbody></table></div>
        </div>`,
      pie:`
        ${p > 0.009 && v.estado !== 'anulada'
          ? `<button class="btn btn-success" onclick="VentasUI.cobrar('${v.id}')"><i data-lucide="hand-coins"></i> Registrar cobro</button>` : ''}
        <button class="btn" onclick="VentasUI.imprimir('${v.id}')"><i data-lucide="printer"></i> Imprimir</button>
        <button class="btn" onclick="VentasUI.pdf('${v.id}')"><i data-lucide="file-down"></i> PDF</button>
        ${U.num(v.cobrado) <= 0.009 && v.estado !== 'anulada'
          ? `<button class="btn btn-danger" onclick="VentasUI.anular('${v.id}')"><i data-lucide="ban"></i> Anular</button>` : ''}
        <button class="btn btn-primary" onclick="UI.cerrarModal()">Cerrar</button>`,
    });
  },

  async anular(id){
    const ok = await UI.confirmar('Anular factura',
      'La factura quedará anulada y no contará en los indicadores. Esta acción no se puede deshacer.', 'Sí, anular');
    if(!ok) return;
    try{
      await Ops.anularVenta(id);
      UI.cerrarModal();
      UI.toast('Factura anulada.', 'info');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  /* ================= COBROS ================= */

  async cobrar(ventaId = null){
    await VentasUI._cargarCatalogos();
    if(!VentasUI._ctas.length) return UI.toast('Crea una cuenta de caja o banco en Maestros.', 'warning');
    const ventas = (await Repo.list('ventas')).filter(v => v.estado !== 'anulada' && Ops.pendiente(v) > 0.009);
    if(!ventas.length) return UI.toast('No hay documentos pendientes de cobro.', 'info');

    VentasUI._ventasPend = ventas;
    const fija = ventaId ? ventas.find(v => v.id === ventaId) : null;

    UI.modal({
      titulo:'Registrar cobro', icono:'hand-coins',
      cuerpo:`
        <div class="form-group"><label>Documento</label>
          <select id="cb-venta" class="form-input" onchange="VentasUI.cobroDocCambio()" ${fija ? 'disabled' : ''}>
            ${!fija ? '<option value="">— Selecciona —</option>' : ''}
            ${ventas.map(v => `<option value="${v.id}" ${fija && fija.id === v.id ? 'selected' : ''}>
              ${U.esc(v.numero)} · ${U.esc(v.clienteNombre)} · pend. ${U.fmtMoney(Ops.pendiente(v))}</option>`).join('')}
          </select></div>
        <div class="form-row">
          <div class="form-group"><label>Monto</label>
            <input id="cb-monto" type="number" step="0.01" min="0" class="form-input"></div>
          <div class="form-group"><label>Fecha</label>
            <input id="cb-fecha" type="date" class="form-input" value="${U.hoy()}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Método</label>
            <select id="cb-metodo" class="form-input">${ERP.metodosPago.map(m=>`<option>${m}</option>`).join('')}</select></div>
          <div class="form-group"><label>Cuenta que recibe</label>
            <select id="cb-cuenta" class="form-input">${UI.opciones(VentasUI._ctas, '')}</select></div>
        </div>
        <div class="form-group"><label>Nota</label><input id="cb-nota" class="form-input" placeholder="Opcional"></div>

        <div class="bloque-ret">
          <label class="check-linea">
            <input type="checkbox" id="cb-ret-on" onchange="VentasUI.cobroRetToggle()">
            <span>El cliente retuvo impuestos (ITBIS / ISR)</span>
          </label>
          <div id="cb-ret-campos" style="display:none">
            <div class="form-row" style="margin-top:10px">
              <div class="form-group"><label>ITBIS retenido</label>
                <input id="cb-ret-itbis" type="number" step="0.01" min="0" class="form-input" value="0"
                  oninput="VentasUI.cobroRecalcular()"></div>
              <div class="form-group"><label>ISR retenido</label>
                <input id="cb-ret-isr" type="number" step="0.01" min="0" class="form-input" value="0"
                  oninput="VentasUI.cobroRecalcular()"></div>
            </div>
            <button type="button" class="btn btn-sm" onclick="VentasUI.cobroSugerirRet()">
              <i data-lucide="wand-2"></i> Calcular con las tasas configuradas</button>
            <p class="form-ayuda" style="margin-top:8px">Lo retenido no entra a tu cuenta: el cliente
              se lo paga a la DGII a tu nombre. Aun así salda la factura, por eso se registra aquí.</p>
          </div>
        </div>

        <div class="resumen-cobro" id="cb-resumen"></div>
        <p class="form-ayuda">Solo el dinero recibido genera entrada en Caja y Bancos.</p>`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-success" onclick="VentasUI.guardarCobro()"><i data-lucide="check"></i> Registrar</button>`,
    });
    VentasUI.cobroDocCambio();
  },

  cobroDocCambio(){
    const v = VentasUI._cobroVenta();
    if(v) U.$('cb-monto').value = Ops.pendiente(v);
    VentasUI.cobroRecalcular();
  },

  _cobroVenta(){
    const id = U.$('cb-venta').value;
    return (VentasUI._ventasPend || []).find(x => x.id === id) || null;
  },

  cobroRetToggle(){
    const on = U.$('cb-ret-on').checked;
    U.$('cb-ret-campos').style.display = on ? '' : 'none';
    if(!on){ U.$('cb-ret-itbis').value = 0; U.$('cb-ret-isr').value = 0; }
    UI.icons();
    VentasUI.cobroRecalcular();
  },

  /* Calcula la retención con las tasas de Configuración → Empresa.
     ITBIS retenido = % sobre el ITBIS facturado. ISR = % sobre el subtotal. */
  cobroSugerirRet(){
    const v = VentasUI._cobroVenta();
    if(!v) return;
    const emp = Repo.configGet('empresa', ERP.empresaDefault);
    const pItbis = U.num(emp.retItbisPct ?? ERP.retencionesDefault.itbisPct);
    const pIsr   = U.num(emp.retIsrPct   ?? ERP.retencionesDefault.isrPct);
    U.$('cb-ret-itbis').value = U.round2(U.num(v.itbis)    * pItbis / 100);
    U.$('cb-ret-isr').value   = U.round2(U.num(v.subtotal) * pIsr   / 100);
    VentasUI.cobroRecalcular(true);
  },

  /* El monto en efectivo se ajusta para que recibido + retenido = pendiente */
  cobroRecalcular(ajustarMonto = false){
    const v = VentasUI._cobroVenta();
    const caja = U.$('cb-resumen'); if(!caja) return;
    if(!v){ caja.innerHTML = ''; return; }
    const pend = Ops.pendiente(v);
    const rI = U.num(U.$('cb-ret-itbis') ? U.$('cb-ret-itbis').value : 0);
    const rS = U.num(U.$('cb-ret-isr')   ? U.$('cb-ret-isr').value   : 0);
    if(ajustarMonto) U.$('cb-monto').value = U.round2(Math.max(0, pend - rI - rS));
    const monto = U.num(U.$('cb-monto').value);
    const aplicado = U.round2(monto + rI + rS);
    const queda = U.round2(pend - aplicado);
    const M = U.fmtMoney;
    const cls = Math.abs(queda) < 0.01 ? 'ok' : queda < 0 ? 'mal' : '';
    caja.innerHTML = `
      <div class="rc-linea"><span>Pendiente de la factura</span><b>${M(pend)}</b></div>
      <div class="rc-linea"><span>Recibido en cuenta</span><b>${M(monto)}</b></div>
      ${(rI + rS) > 0 ? `<div class="rc-linea"><span>Retenido por el cliente</span><b>${M(rI + rS)}</b></div>` : ''}
      <div class="rc-linea rc-total ${cls}"><span>${queda < 0 ? 'Excede por' : 'Queda pendiente'}</span>
        <b>${M(Math.abs(queda))}</b></div>`;
  },

  async guardarCobro(){
    try{
      const cobro = await Ops.registrarCobro({
        ventaId: U.$('cb-venta').value,
        monto: U.$('cb-monto').value,
        fecha: U.$('cb-fecha').value,
        metodo: U.$('cb-metodo').value,
        cuentaId: U.$('cb-cuenta').value,
        retItbis: U.$('cb-ret-on').checked ? U.$('cb-ret-itbis').value : 0,
        retIsr:   U.$('cb-ret-on').checked ? U.$('cb-ret-isr').value   : 0,
        nota: U.$('cb-nota').value,
      });
      UI.cerrarModal();
      const ret = U.num(cobro.retItbis) + U.num(cobro.retIsr);
      UI.toast(ret > 0
        ? `Cobro registrado: ${U.fmtMoney(cobro.monto)} recibido + ${U.fmtMoney(ret)} retenido.`
        : `Cobro de ${U.fmtMoney(cobro.monto)} registrado.`);
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  async anularCobro(id, ventaId = null){
    const ok = await UI.confirmar('Anular cobro',
      'Se eliminará el cobro y su entrada en Caja y Bancos, y la factura volverá a quedar pendiente por ese monto.', 'Sí, anular');
    if(!ok) return;
    try{
      await Ops.anularCobro(id);
      UI.toast('Cobro anulado.', 'info');
      if(ventaId) VentasUI.detalle(ventaId); else UI.cerrarModal();
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  /* ================= COTIZACIONES ================= */

  async detalleCot(id){
    const c = await Repo.get('cotizaciones', id);
    if(!c) return;
    const visual = (c.estado === 'abierta' && c.vence < U.hoy()) ? 'vencida' : c.estado;
    UI.modal({
      titulo:'Detalle de cotización', icono:'file-text', ancho:'ancha',
      cuerpo:`
        <div class="detalle-cab">
          <div><div class="doc-num">${U.esc(c.numero)}</div>
            <div class="muted">Válida hasta ${U.fmtFecha(c.vence)}</div></div>
          ${UI.badge(ERP.estadosCotizacion, visual)}
        </div>
        <div class="detalle-datos">
          <div class="dato-item"><div class="d-label">Cliente</div><div class="d-valor">${U.esc(c.clienteNombre)}</div></div>
          <div class="dato-item"><div class="d-label">Fecha</div><div class="d-valor">${U.fmtFecha(c.fecha)}</div></div>
        </div>
        <div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Descripción</th><th style="text-align:right">Cant.</th>
            <th style="text-align:right">Precio</th><th style="text-align:right">Importe</th></tr></thead>
          <tbody>${c.lineas.map(l => `
            <tr><td>${U.esc(l.nombre)}</td><td class="num">${l.cant}</td>
              <td class="num">${U.fmtMoney(l.precio)}</td><td class="num">${U.fmtMoney(l.importe)}</td></tr>`).join('')}
          </tbody></table></div>
        <div class="totales-caja" style="margin-top:10px">
          <div class="t-linea"><span>Subtotal</span><b>${U.fmtMoney(c.subtotal)}</b></div>
          <div class="t-linea"><span>ITBIS</span><b>${U.fmtMoney(c.itbis)}</b></div>
          <div class="t-linea t-total"><span>TOTAL</span><b>${U.fmtMoney(c.total)}</b></div>
        </div>
        ${c.notas ? `<p class="muted" style="margin-top:10px"><b>Notas:</b> ${U.esc(c.notas)}</p>` : ''}`,
      pie:`
        ${c.estado === 'abierta' ? `
          <button class="btn" onclick="VentasUI.marcarCot('${c.id}','aceptada')"><i data-lucide="thumbs-up"></i> Aceptada</button>
          <button class="btn" onclick="VentasUI.marcarCot('${c.id}','rechazada')"><i data-lucide="thumbs-down"></i> Rechazada</button>` : ''}
        ${(c.estado === 'abierta' || c.estado === 'aceptada') ? `
          <button class="btn btn-primary" onclick="VentasUI.convertir('${c.id}')"><i data-lucide="arrow-right-circle"></i> Convertir en factura</button>` : ''}
        <button class="btn" onclick="VentasUI.imprimirCot('${c.id}')"><i data-lucide="printer"></i> Imprimir</button>
        <button class="btn btn-primary" onclick="UI.cerrarModal()">Cerrar</button>`,
    });
  },

  async marcarCot(id, estado){
    await Ops.estadoCotizacion(id, estado);
    UI.toast('Cotización marcada como ' + estado + '.', 'info');
    VentasUI.detalleCot(id);
  },

  async convertir(id){
    const c = await Repo.get('cotizaciones', id);
    if(!c) return;
    UI.cerrarModal();
    await VentasUI.nueva({
      clienteId: c.clienteId,
      lineas: c.lineas.map(l => ({ ...l })),
      notas: c.notas ? `De cotización ${c.numero}. ${c.notas}` : `De cotización ${c.numero}.`,
      origenCotId: c.id,
    });
  },

  /* ================= IMPRESIÓN ================= */

  async pdf(id){
    UI.toast('En el diálogo elige "Guardar como PDF" como destino.', 'info');
    await VentasUI.imprimir(id);
  },

  async imprimir(id){
    const v = await Repo.get('ventas', id);
    if(!v) return;
    /* Facturas creadas antes de guardar el RNC: se busca en el maestro */
    let rnc = v.clienteRnc || '';
    if(!rnc){ const c = await Repo.get('clientes', v.clienteId); rnc = (c && c.rnc) || ''; }
    VentasUI._imprimirDoc({ ...v, clienteRnc: rnc },
      v.condicion === 'credito' ? 'Factura de crédito' : 'Factura', true);
  },
  async imprimirCot(id){
    const c = await Repo.get('cotizaciones', id);
    if(c) VentasUI._imprimirDoc(c, 'Cotización', false);
  },

  _imprimirDoc(d, tipoLabel, esVenta){
    const emp = Repo.configGet('empresa', ERP.empresaDefault);
    U.$('print-area').innerHTML = `
      <div class="pr-cab">
        <div>
          <h1>${U.esc(emp.nombre)}</h1>
          <div class="pr-emp">
            ${emp.rnc ? 'RNC: ' + U.esc(emp.rnc) + '<br>' : ''}
            ${U.esc(emp.direccion || '')}${emp.direccion ? '<br>' : ''}
            ${U.esc(emp.ciudad || '')}${emp.ciudad ? '<br>' : ''}
            ${U.esc(emp.telefono || '')} ${emp.email ? '· ' + U.esc(emp.email) : ''}
          </div>
        </div>
        <div class="pr-doc">
          <div class="pr-tipo">${U.esc(tipoLabel)}</div>
          <div class="pr-num">${U.esc(d.numero)}</div>
          ${esVenta && d.ncf ? `<div class="pr-ncf">NCF: ${U.esc(d.ncf)}</div>` : ''}
          ${esVenta && d.ncf && Ops.ncfEstado(d.ncfTipo).vence
            ? `<div style="font-size:10.5px">Válido hasta: ${U.fmtFecha(Ops.ncfEstado(d.ncfTipo).vence)}</div>` : ''}
          <div style="font-size:11.5px;margin-top:3px">Fecha: ${U.fmtFecha(d.fecha)}</div>
          <div style="font-size:11.5px">${esVenta ? 'Vence' : 'Válida hasta'}: ${U.fmtFecha(d.vence)}</div>
        </div>
      </div>
      <div class="pr-datos">
        <div><b>Cliente</b>${U.esc(d.clienteNombre)}
          ${esVenta ? `<div class="pr-rnc">RNC / Cédula: ${U.esc(d.clienteRnc || '—')}</div>` : ''}</div>
        ${esVenta ? `<div style="text-align:right"><b>Condición</b>${d.condicion === 'credito' ? 'Crédito' : 'Contado'}</div>` : ''}
      </div>
      <table>
        <thead><tr><th>Descripción</th><th style="width:56px">Cant.</th>
          <th style="width:92px">Precio</th><th style="width:82px">ITBIS</th><th style="width:96px">Importe</th></tr></thead>
        <tbody>${d.lineas.map(l => `
          <tr><td>${U.esc(l.nombre)}</td><td class="pr-num-col">${l.cant}</td>
            <td class="pr-num-col">${U.fmtMoney(l.precio)}</td>
            <td class="pr-num-col">${U.fmtMoney(l.itbis)}</td>
            <td class="pr-num-col">${U.fmtMoney(l.importe)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="pr-totales">
        <div><span>Subtotal</span><span>${U.fmtMoney(d.subtotal)}</span></div>
        <div><span>ITBIS</span><span>${U.fmtMoney(d.itbis)}</span></div>
        <div class="pr-total"><span>TOTAL</span><span>${U.fmtMoney(d.total)}</span></div>
      </div>
      ${d.notas ? `<p style="font-size:11.5px;margin-top:10px"><b>Notas:</b> ${U.esc(d.notas)}</p>` : ''}
      <div class="pr-pie">${U.esc(emp.nombre)} · Documento generado por ${U.esc(ERP.marca.nombre + ERP.marca.acento)}</div>`;
    window.print();
  },
};

App.registrar('ventas', VentasUI);
