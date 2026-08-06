/* ============================================================
   CAJA Y BANCOS — Cuentas · Movimientos
   Un solo listado de movimientos con filtro de tipo y de origen.
   Los cobros de Ventas y los pagos de Compras entran aquí solos,
   marcados en la columna Origen para que nadie los cuente dos veces.
   ============================================================ */

const CajaUI = {

  async render(){
    const st = await Ops.stats();
    const [movs, cuentas] = await Promise.all([Repo.list('movimientos'), Repo.list('cuentas')]);
    const M = U.fmtMoney;
    const nombreCta = id => (cuentas.find(c => c.id === id) || {}).nombre || '—';

    /* --- Tira de saldos --- */
    UI.tira('cj-tira', [
      ['Caja',             M(st.saldoCaja)],
      ['Bancos',           M(st.saldoBancos)],
      ['Total disponible', M(st.saldoTotal), st.saldoTotal < 0 ? 'mal' : ''],
      ['Entradas mes',     M(st.entradasMes)],
      ['Salidas mes',      M(st.salidasMes)],
      ['Flujo mes',        M(st.flujoMes), st.flujoMes < 0 ? 'mal' : ''],
    ]);

    /* --- Cuentas --- */
    const sal = await Ops.saldos();
    U.$('cj-cuentas-tbody').innerHTML = sal.map(s => `
      <tr>
        <td>${U.esc(s.cuenta.nombre)}</td>
        <td>${s.cuenta.tipo === 'caja' ? 'Caja' : 'Banco'}</td>
        <td>${U.esc(s.cuenta.banco || '—')} ${U.esc(s.cuenta.numero || '')}</td>
        <td class="num"><b style="color:${s.saldo >= 0 ? 'var(--text)' : 'var(--danger)'}">${M(s.saldo)}</b></td>
      </tr>`).join('')
      || `<tr><td colspan="4" class="empty">Sin cuentas. Créalas en Maestros → Cuentas.</td></tr>`;

    /* --- Movimientos: un solo listado con filtros --- */
    const ORIGEN = {
      manual: { txt:'A mano',            cls:'' },
      cobro:  { txt:'Cobro de venta',    cls:'org-auto' },
      pago:   { txt:'Pago a proveedor',  cls:'org-auto' },
    };

    const fila = m => {
      const o = ORIGEN[m.origen] || { txt:'Automático', cls:'org-auto' };
      return `
      <tr>
        <td>${U.fmtFecha(m.fecha)}</td>
        <td>${UI.badge({
          entrada:{label:'Entrada',clase:'b-entrada'},
          salida:{label:'Salida',clase:'b-salida'},
          transferencia:{label:'Transfer.',clase:'b-transferencia'},
        }, m.tipo)}</td>
        <td>${U.esc(m.concepto)}</td>
        <td>${U.esc(nombreCta(m.cuentaId))}${m.tipo === 'transferencia' ? ' → ' + U.esc(nombreCta(m.cuentaDestinoId)) : ''}</td>
        <td><span class="origen-tag ${o.cls}">${o.txt}</span></td>
        <td class="num" style="color:${m.tipo === 'entrada' ? 'var(--success)' : m.tipo === 'salida' ? 'var(--danger)' : 'var(--info)'}">
          ${m.tipo === 'salida' ? '−' : ''}${M(m.monto)}</td>
        <td class="acciones">
          ${m.origen === 'manual'
            ? `<button class="btn btn-sm" onclick="CajaUI.eliminarMov('${m.id}')"><i data-lucide="trash-2"></i></button>`
            : `<span class="muted" title="Nació de un cobro o de un pago. Se anula en su documento.">—</span>`}
        </td>
      </tr>`;
    };

    const ord = [...movs].sort((a,b)=> b.fecha.localeCompare(a.fecha) || (b.creado||'').localeCompare(a.creado||''));
    const q  = (U.$('cj-mov-buscar').value || '').toLowerCase();
    const ft = U.$('cj-mov-tipo').value;
    const fo = U.$('cj-mov-origen').value;
    const lista = ord.filter(m =>
      (ft ? m.tipo === ft : m.tipo !== 'transferencia') &&
      (!fo || m.origen === fo) &&
      (!q || (m.concepto||'').toLowerCase().includes(q)
          || (nombreCta(m.cuentaId)||'').toLowerCase().includes(q)
          || (nombreCta(m.cuentaDestinoId)||'').toLowerCase().includes(q)));
    U.$('cj-mov-count').textContent = lista.length + ' registros';
    U.$('cj-mov-tbody').innerHTML = lista.map(fila).join('')
      || `<tr><td colspan="7" class="empty">Sin movimientos con esos filtros.</td></tr>`;

    UI.icons();
  },

  /* ---- Entrada / Salida manual ---- */
  async nuevoMov(tipo){
    const cuentas = await Repo.list('cuentas');
    if(!cuentas.length) return UI.toast('Crea una cuenta en Maestros → Cuentas.', 'warning');
    const esEntrada = tipo === 'entrada';
    UI.modal({
      titulo: esEntrada ? 'Nueva entrada' : 'Nueva salida',
      icono: esEntrada ? 'arrow-down-circle' : 'arrow-up-circle',
      cuerpo:`
        <div class="form-group"><label>Concepto</label>
          <input id="mv-concepto" class="form-input" placeholder="${esEntrada ? 'Ej.: Aporte de capital' : 'Ej.: Pago de nómina, alquiler…'}"></div>
        <div class="form-row">
          <div class="form-group"><label>Cuenta</label>
            <select id="mv-cuenta" class="form-input">${UI.opciones(cuentas, '')}</select></div>
          <div class="form-group"><label>Monto</label>
            <input id="mv-monto" type="number" step="0.01" min="0" class="form-input"></div>
          <div class="form-group"><label>Fecha</label>
            <input id="mv-fecha" type="date" class="form-input" value="${U.hoy()}"></div>
        </div>
        ${esEntrada ? `<p class="form-ayuda">Los cobros de facturas NO se registran aquí: hazlos en Ventas → Cobros y la entrada se crea sola.</p>` : ''}`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn ${esEntrada ? 'btn-success' : 'btn-danger'}" onclick="CajaUI.guardarMov('${tipo}')">
             <i data-lucide="check"></i> Registrar</button>`,
    });
  },

  async guardarMov(tipo){
    try{
      await Ops.crearMovimiento({
        tipo, cuentaId: U.$('mv-cuenta').value,
        concepto: U.$('mv-concepto').value,
        monto: U.$('mv-monto').value, fecha: U.$('mv-fecha').value,
      });
      UI.cerrarModal();
      UI.toast(tipo === 'entrada' ? 'Entrada registrada.' : 'Salida registrada.');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  /* ---- Transferencia ---- */
  async nuevaTransferencia(){
    const cuentas = await Repo.list('cuentas');
    if(cuentas.length < 2) return UI.toast('Necesitas al menos dos cuentas para transferir.', 'warning');
    UI.modal({
      titulo:'Transferencia entre cuentas', icono:'arrow-left-right',
      cuerpo:`
        <div class="form-row">
          <div class="form-group"><label>Desde</label>
            <select id="tr-origen" class="form-input">${UI.opciones(cuentas, '')}</select></div>
          <div class="form-group"><label>Hacia</label>
            <select id="tr-destino" class="form-input">${UI.opciones(cuentas, cuentas[1] ? cuentas[1].id : '')}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Monto</label>
            <input id="tr-monto" type="number" step="0.01" min="0" class="form-input"></div>
          <div class="form-group"><label>Fecha</label>
            <input id="tr-fecha" type="date" class="form-input" value="${U.hoy()}"></div>
        </div>
        <div class="form-group"><label>Concepto</label>
          <input id="tr-concepto" class="form-input" placeholder="Ej.: Depósito de efectivo"></div>`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-primary" onclick="CajaUI.guardarTransferencia()"><i data-lucide="check"></i> Transferir</button>`,
    });
  },

  async guardarTransferencia(){
    try{
      await Ops.transferir({
        origenId: U.$('tr-origen').value, destinoId: U.$('tr-destino').value,
        monto: U.$('tr-monto').value, fecha: U.$('tr-fecha').value,
        concepto: U.$('tr-concepto').value,
      });
      UI.cerrarModal();
      UI.toast('Transferencia registrada.');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  async eliminarMov(id){
    const ok = await UI.confirmar('Eliminar movimiento',
      'Se eliminará este movimiento y los saldos se recalcularán.', 'Sí, eliminar');
    if(!ok) return;
    try{
      await Ops.eliminarMovimiento(id);
      UI.toast('Movimiento eliminado.', 'info');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },
};

App.registrar('caja', CajaUI);
