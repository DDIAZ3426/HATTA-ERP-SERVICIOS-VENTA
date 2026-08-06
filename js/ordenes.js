/* ============================================================
   ÓRDENES DE SERVICIO — el mundo del taller / técnico
   ------------------------------------------------------------
   El objeto del cliente entra, se diagnostica, se repara y se
   entrega: recibido → en proceso → listo → entregado.
   Facturar la orden crea la venta ya prellenada y las enlaza.
   Este módulo solo aparece si la empresa es de Servicios o Mixto.
   ============================================================ */

const OrdenesUI = {

  async render(){
    const [ordenes, st] = await Promise.all([Repo.list('ordenes'), Ops.stats()]);

    U.$('os-kpi-recibidas').textContent = st.ordRecibidas;
    U.$('os-kpi-proceso').textContent = st.ordProceso;
    U.$('os-kpi-listas').textContent = st.ordListas;
    U.$('os-kpi-entregadas').textContent = st.ordEntregadasMes;

    const q = (U.$('os-buscar').value || '').toLowerCase();
    const fe = U.$('os-filtro-estado').value;
    const hoy = U.hoy();

    const filtradas = [...ordenes]
      .sort((a,b)=> b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado))
      .filter(o =>
        (!q || o.numero.toLowerCase().includes(q) || o.clienteNombre.toLowerCase().includes(q)
            || (o.equipo||'').toLowerCase().includes(q) || (o.tecnico||'').toLowerCase().includes(q)) &&
        (!fe || o.estado === fe));
    U.$('os-count').textContent = filtradas.length + ' registros';

    U.$('os-tbody').innerHTML = filtradas.map(o => {
      const tarde = o.fechaPromesa && o.fechaPromesa < hoy && !['entregado','anulada'].includes(o.estado);
      const puedeAvanzar = ['recibido','proceso','listo'].includes(o.estado);
      const puedeFacturar = !o.facturaId && o.estado !== 'anulada';
      return `
        <tr class="fila-click ${o.estado === 'anulada' ? 'inactivo' : ''}" onclick="OrdenesUI.detalle('${o.id}')">
          <td>${U.fmtFecha(o.fecha)}</td>
          <td class="doc">${U.esc(o.numero)}</td>
          <td>${U.esc(o.clienteNombre)}</td>
          <td>${U.esc(o.equipo)}</td>
          <td>${U.esc(o.tecnico || '—')}</td>
          <td>${o.fechaPromesa ? U.fmtFecha(o.fechaPromesa) : '—'}
            ${tarde ? ' <span class="aging rojo">tarde</span>' : ''}</td>
          <td class="doc" style="font-size:11.5px">${U.esc(o.facturaNumero || '—')}</td>
          <td>${UI.badge(ERP.estadosOrden, o.estado)}
            <span class="acciones" onclick="event.stopPropagation()">
              ${puedeAvanzar ? `<button class="btn btn-sm" title="Pasar a ${ERP.estadosOrden[Ops._flujoOrden[Ops._flujoOrden.indexOf(o.estado)+1]].label}"
                onclick="OrdenesUI.avanzar('${o.id}')"><i data-lucide="chevron-right"></i></button>` : ''}
              ${puedeFacturar ? `<button class="btn btn-sm btn-success" title="Facturar orden"
                onclick="OrdenesUI.facturar('${o.id}')"><i data-lucide="receipt-text"></i></button>` : ''}
            </span></td>
        </tr>`;
    }).join('') || `<tr><td colspan="8" class="empty">No hay órdenes con esos filtros. Crea la primera con "Nueva orden".</td></tr>`;

    UI.icons();
  },

  /* ---------- Nueva orden ---------- */
  async nueva(){
    const clientes = (await Repo.list('clientes')).filter(c => c.activo !== false)
      .sort((a,b)=>a.nombre.localeCompare(b.nombre));
    if(!clientes.length) return UI.toast('Primero crea un cliente en Maestros.', 'warning');

    UI.modal({
      titulo:'Nueva orden de servicio', icono:'clipboard-list',
      cuerpo:`
        <div class="form-group"><label>Cliente</label>
          <select id="os-cli" class="form-input">
            <option value="">— Selecciona —</option>${UI.opciones(clientes, '')}
          </select></div>
        <div class="form-group"><label>Equipo u objeto recibido</label>
          <input id="os-equipo" class="form-input" placeholder="Ej.: iPhone 13 azul · Toyota Corolla 2015 placa A123456"></div>
        <div class="form-group"><label>Falla reportada / trabajo solicitado</label>
          <textarea id="os-falla" class="form-input" placeholder="Lo que el cliente dice que pasa o pide"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Técnico</label>
            <input id="os-tecnico" class="form-input" placeholder="Opcional"></div>
          <div class="form-group"><label>Fecha</label>
            <input id="os-fecha" type="date" class="form-input" value="${U.hoy()}"></div>
          <div class="form-group"><label>Fecha prometida</label>
            <input id="os-promesa" type="date" class="form-input"></div>
        </div>
        <div class="form-group"><label>Notas</label>
          <input id="os-notas" class="form-input" placeholder="Accesorios recibidos, contraseñas, etc. (opcional)"></div>`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-primary" onclick="OrdenesUI.guardar()"><i data-lucide="save"></i> Crear orden</button>`,
    });
  },

  async guardar(){
    try{
      const o = await Ops.crearOrden({
        clienteId: U.$('os-cli').value,
        equipo: U.$('os-equipo').value,
        falla: U.$('os-falla').value,
        tecnico: U.$('os-tecnico').value,
        fecha: U.$('os-fecha').value,
        fechaPromesa: U.$('os-promesa').value,
        notas: U.$('os-notas').value,
      });
      UI.cerrarModal();
      UI.toast(`Orden ${o.numero} creada.`);
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  /* ---------- Detalle ---------- */
  async detalle(id){
    const o = await Repo.get('ordenes', id);
    if(!o) return;
    const pasos = Ops._flujoOrden.map(e => `
      <button class="btn btn-sm ${o.estado === e ? 'btn-primary' : ''}"
        ${o.estado === 'anulada' ? 'disabled' : ''}
        onclick="OrdenesUI.cambiarEstado('${o.id}','${e}')">${ERP.estadosOrden[e].label}</button>`).join('');

    UI.modal({
      titulo:'Orden de servicio', icono:'clipboard-list', ancho:'ancha',
      cuerpo:`
        <div class="detalle-cab">
          <div><div class="doc-num">${U.esc(o.numero)}</div>
            <div class="muted">${U.esc(o.clienteNombre)}</div></div>
          ${UI.badge(ERP.estadosOrden, o.estado)}
        </div>
        <div class="detalle-datos">
          <div class="dato-item"><div class="d-label">Recibido</div><div class="d-valor">${U.fmtFecha(o.fecha)}</div></div>
          <div class="dato-item"><div class="d-label">Prometido</div><div class="d-valor">${o.fechaPromesa ? U.fmtFecha(o.fechaPromesa) : '—'}</div></div>
          <div class="dato-item"><div class="d-label">Factura</div><div class="d-valor mono">${U.esc(o.facturaNumero || '—')}</div></div>
        </div>
        <div class="form-group"><label>Equipo u objeto</label>
          <input id="osd-equipo" class="form-input" value="${U.esc(o.equipo)}"></div>
        <div class="form-group"><label>Falla reportada</label>
          <textarea id="osd-falla" class="form-input">${U.esc(o.falla || '')}</textarea></div>
        <div class="form-group"><label>Diagnóstico / trabajo realizado</label>
          <textarea id="osd-diag" class="form-input" placeholder="Lo que se encontró y lo que se hizo">${U.esc(o.diagnostico || '')}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Técnico</label>
            <input id="osd-tecnico" class="form-input" value="${U.esc(o.tecnico || '')}"></div>
          <div class="form-group"><label>Fecha prometida</label>
            <input id="osd-promesa" type="date" class="form-input" value="${o.fechaPromesa || ''}"></div>
        </div>
        <div class="form-group"><label>Notas</label>
          <input id="osd-notas" class="form-input" value="${U.esc(o.notas || '')}"></div>
        <div class="form-group"><label>Estado del trabajo</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${pasos}</div></div>`,
      pie:`
        ${!o.facturaId && o.estado !== 'anulada'
          ? `<button class="btn btn-success" onclick="OrdenesUI.facturar('${o.id}', true)"><i data-lucide="receipt-text"></i> Facturar</button>` : ''}
        ${o.facturaId
          ? `<button class="btn" onclick="UI.cerrarModal(); App.navegar('ventas','facturas').then(()=>VentasUI.detalle('${o.facturaId}'))"><i data-lucide="eye"></i> Ver factura</button>` : ''}
        ${!o.facturaId && o.estado !== 'anulada'
          ? `<button class="btn btn-danger" onclick="OrdenesUI.anular('${o.id}')"><i data-lucide="ban"></i> Anular</button>` : ''}
        <button class="btn btn-primary" onclick="OrdenesUI.guardarDetalle('${o.id}')"><i data-lucide="save"></i> Guardar cambios</button>`,
    });
  },

  async guardarDetalle(id){
    try{
      await Ops.actualizarOrden(id, {
        equipo: U.$('osd-equipo').value.trim(),
        falla: U.$('osd-falla').value.trim(),
        diagnostico: U.$('osd-diag').value.trim(),
        tecnico: U.$('osd-tecnico').value.trim(),
        fechaPromesa: U.$('osd-promesa').value,
        notas: U.$('osd-notas').value.trim(),
      });
      UI.cerrarModal();
      UI.toast('Orden actualizada.');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  async cambiarEstado(id, estado){
    try{
      await Ops.cambiarEstadoOrden(id, estado);
      OrdenesUI.detalle(id);
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  async avanzar(id){
    try{ await Ops.avanzarOrden(id); }
    catch(e){ UI.toast(e.message, 'warning'); }
  },

  async anular(id){
    const ok = await UI.confirmar('Anular orden',
      'La orden quedará anulada. Si el cliente vuelve, crea una nueva.', 'Sí, anular');
    if(!ok) return;
    try{
      await Ops.anularOrden(id);
      UI.cerrarModal();
      UI.toast('Orden anulada.', 'info');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  /* ---------- Facturar la orden ---------- */
  async facturar(id, desdeDetalle = false){
    const o = await Repo.get('ordenes', id);
    if(!o) return;
    if(desdeDetalle) UI.cerrarModal();
    const desc = `Servicio ${o.numero}: ${o.equipo}` + (o.diagnostico ? ` — ${o.diagnostico}` : (o.falla ? ` — ${o.falla}` : ''));
    await VentasUI.nueva({
      clienteId: o.clienteId,
      ordenId: o.id,
      lineas: [{ itemId:null, libre:true, nombre: desc.slice(0, 160), cant:1, precio:0, tasa:ERP.itbisDefault }],
      notas: `Orden de servicio ${o.numero}`,
    });
    UI.toast('Completa el precio del servicio y guarda la factura.', 'info');
  },
};

App.registrar('ordenes', OrdenesUI);
