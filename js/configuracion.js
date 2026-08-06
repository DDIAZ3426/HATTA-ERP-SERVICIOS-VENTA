/* ============================================================
   CONFIGURACIÓN — Empresa · Numeraciones · Datos · Bitácora
   ============================================================ */

const ConfigUI = {

  async render(){
    const emp = Repo.configGet('empresa', ERP.empresaDefault);
    const num = Repo.configGet('numeraciones', JSON.parse(JSON.stringify(ERP.numeracionesDefault)));

    /* --- Empresa --- */
    U.$('cf-emp-nombre').value = emp.nombre || '';
    U.$('cf-emp-rnc').value = emp.rnc || '';
    U.$('cf-emp-tel').value = emp.telefono || '';
    U.$('cf-emp-email').value = emp.email || '';
    U.$('cf-emp-dir').value = emp.direccion || '';
    U.$('cf-emp-ciudad').value = emp.ciudad || '';
    U.$('cf-emp-tipo').value = emp.tipoNegocio || 'servicios';
    U.$('cf-emp-ret-itbis').value = emp.retItbisPct ?? ERP.retencionesDefault.itbisPct;
    U.$('cf-emp-ret-isr').value   = emp.retIsrPct   ?? ERP.retencionesDefault.isrPct;
    const hayPin = !!Repo.configGet('consultorPin', null);
    U.$('cf-pin-estado').innerHTML = hayPin
      ? '<span class="badge b-pagada">PIN activo</span> Maestros y Configuración piden PIN.'
      : '<span class="badge b-pendiente">Sin PIN</span> Todo el sistema está abierto.';

    /* --- Numeraciones --- */
    U.$('cf-num-fac-pre').value = num.factura.prefijo;
    U.$('cf-num-fac-prox').value = num.factura.proximo;
    const numOs = num.orden || JSON.parse(JSON.stringify(ERP.numeracionesDefault.orden));
    U.$('cf-num-os-pre').value = numOs.prefijo;
    U.$('cf-num-os-prox').value = numOs.proximo;
    const numCom = num.compra || JSON.parse(JSON.stringify(ERP.numeracionesDefault.compra));
    U.$('cf-num-com-pre').value = numCom.prefijo;
    U.$('cf-num-com-prox').value = numCom.proximo;
    U.$('cf-num-cot-pre').value = num.cotizacion.prefijo;
    U.$('cf-num-cot-prox').value = num.cotizacion.proximo;
    /* --- NCF: un bloque por tipo, con rango y vencimiento --- */
    U.$('cf-ncf-bloques').innerHTML = ERP.tiposNcf.filter(t => t.id !== 'SIN').map(t => {
      const e = Ops.ncfEstado(t.id);
      let estado = '<span class="badge b-pendiente">Sin rango definido</span>';
      if(e.vencido)          estado = `<span class="badge b-vencida">Autorización vencida</span>`;
      else if(e.agotado)     estado = `<span class="badge b-vencida">Secuencia agotada</span>`;
      else if(e.porAgotarse) estado = `<span class="badge b-parcial">Quedan ${e.restantes}</span>`;
      else if(e.porVencer)   estado = `<span class="badge b-parcial">Vence en ${e.diasVence} día(s)</span>`;
      else if(e.hasta)       estado = `<span class="badge b-pagada">Quedan ${e.restantes}</span>`;
      return `
      <div class="ncf-bloque">
        <div class="ncf-cab"><b>${U.esc(t.label)}</b>${estado}</div>
        <div class="form-row">
          <div class="form-group"><label>Desde</label>
            <input id="cf-ncf-${t.id}-desde" type="number" min="1" class="form-input" value="${e.desde}"></div>
          <div class="form-group"><label>Hasta</label>
            <input id="cf-ncf-${t.id}-hasta" type="number" min="0" class="form-input" value="${e.hasta || ''}"
              placeholder="0 = sin límite"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Próximo a emitir</label>
            <input id="cf-ncf-${t.id}-prox" type="number" min="1" class="form-input" value="${e.proximo}"></div>
          <div class="form-group"><label>Vence el</label>
            <input id="cf-ncf-${t.id}-vence" type="date" class="form-input" value="${e.vence || ''}"></div>
        </div>
      </div>`;
    }).join('');

    /* --- Bitácora --- */
    const bit = await Repo.list('bitacora');
    U.$('cf-bit-tbody').innerHTML = bit.slice(0,100).map(b => `
      <tr>
        <td style="white-space:nowrap">${U.fmtFechaHora(b.fecha)}</td>
        <td>${U.esc(b.usuario)}</td>
        <td>${U.esc(b.modulo)}</td>
        <td>${U.esc(b.accion)}</td>
        <td style="color:var(--text-dim)">${U.esc(b.detalle)}</td>
      </tr>`).join('')
      || `<tr><td colspan="5" class="empty">La bitácora está vacía.</td></tr>`;

    UI.icons();
  },

  async guardarEmpresa(){
    const emp = {
      nombre: U.$('cf-emp-nombre').value.trim() || 'Mi Empresa',
      rnc: U.$('cf-emp-rnc').value.trim(),
      telefono: U.$('cf-emp-tel').value.trim(),
      email: U.$('cf-emp-email').value.trim(),
      direccion: U.$('cf-emp-dir').value.trim(),
      ciudad: U.$('cf-emp-ciudad').value.trim(),
      tipoNegocio: U.$('cf-emp-tipo').value,
      retItbisPct: U.num(U.$('cf-emp-ret-itbis').value),
      retIsrPct:   U.num(U.$('cf-emp-ret-isr').value),
    };
    Repo.configSet('empresa', emp);
    Repo.log('Configuración','Actualizó datos de empresa', emp.nombre);
    App.pintarMarca();
    App.pintarSidebar(); App.marcarMenu(); App.refrescarAlertas(); UI.icons();
    UI.toast('Datos de la empresa guardados.');
  },

  guardarNumeraciones(){
    const num = {
      factura:    { prefijo: U.$('cf-num-fac-pre').value || 'FAC-', proximo: Math.max(1, parseInt(U.$('cf-num-fac-prox').value) || 1) },
      cotizacion: { prefijo: U.$('cf-num-cot-pre').value || 'COT-', proximo: Math.max(1, parseInt(U.$('cf-num-cot-prox').value) || 1) },
      compra:     { prefijo: U.$('cf-num-com-pre').value || 'COM-', proximo: Math.max(1, parseInt(U.$('cf-num-com-prox').value) || 1) },
      orden:      { prefijo: U.$('cf-num-os-pre').value || 'OS-',  proximo: Math.max(1, parseInt(U.$('cf-num-os-prox').value) || 1) },
      ncf: ERP.tiposNcf.filter(t => t.id !== 'SIN').reduce((acc, t) => {
        acc[t.id] = {
          desde:   Math.max(1, parseInt(U.$(`cf-ncf-${t.id}-desde`).value) || 1),
          hasta:   Math.max(0, parseInt(U.$(`cf-ncf-${t.id}-hasta`).value) || 0),
          proximo: Math.max(1, parseInt(U.$(`cf-ncf-${t.id}-prox`).value)  || 1),
          vence:   U.$(`cf-ncf-${t.id}-vence`).value || '',
        };
        return acc;
      }, {}),
    };
    Repo.configSet('numeraciones', num);
    Repo.log('Configuración','Actualizó numeraciones','');
    UI.toast('Numeraciones guardadas.');
  },

  /* ---- Respaldo ---- */
  exportar(){
    const blob = new Blob([Repo.exportar()], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `respaldo-erp-${U.hoy()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    Repo.log('Configuración','Exportó respaldo','');
    UI.toast('Respaldo descargado.');
  },

  importar(input){
    const archivo = input.files && input.files[0];
    if(!archivo) return;
    const lector = new FileReader();
    lector.onload = async () => {
      const ok = await UI.confirmar('Importar respaldo',
        'Los datos actuales serán REEMPLAZADOS por los del archivo. ¿Continuar?', 'Sí, importar');
      input.value = '';
      if(!ok) return;
      try{
        Repo.importar(lector.result);
        Repo.log('Configuración','Importó respaldo', archivo.name);
        UI.toast('Respaldo importado. Recargando…');
        setTimeout(() => location.reload(), 900);
      }catch(e){ UI.toast(e.message, 'danger'); }
    };
    lector.readAsText(archivo);
  },

  async restablecerDemo(){
    const ok = await UI.confirmar('Restablecer datos demo',
      'Se BORRARÁN todos los datos actuales y se cargará de nuevo la empresa de ejemplo. Exporta un respaldo antes si lo necesitas.',
      'Borrar y cargar demo');
    if(!ok) return;
    Repo.borrarTodo();
    await Seed.crearDemo();
    UI.toast('Datos demo restablecidos. Recargando…', 'info');
    setTimeout(() => location.reload(), 900);
  },

  async vaciar(){
    const ok = await UI.confirmar('Empezar de cero',
      'Se BORRARÁN todos los datos (clientes, ventas, cuentas, todo) para que comiences con tu empresa real. Exporta un respaldo antes si lo necesitas.',
      'Sí, borrar todo');
    if(!ok) return;
    Repo.borrarTodo();
    /* Deja catálogos mínimos para poder trabajar de inmediato */
    await Repo.create('impuestos', { nombre:'ITBIS 18%', tasa:18 });
    await Repo.create('impuestos', { nombre:'Exento', tasa:0 });
    for(const n of ['Unidad','Hora','Mes']) await Repo.create('unidades', { nombre:n });
    await Repo.create('cuentas', { nombre:'Caja principal', tipo:'caja', banco:'', numero:'', saldoInicial:0 });
    Repo.configSet('empresa', { ...ERP.empresaDefault });
    Repo.log('Configuración','Sistema vaciado para empezar de cero','');
    UI.toast('Listo. Configura tu empresa y crea tus maestros.', 'info');
    setTimeout(() => location.reload(), 900);
  },
};

App.registrar('config', ConfigUI);


/* ---- Modo consultor: PIN ---- */
ConfigUI.guardarPin = async function(){
  const pin = U.$('cf-pin-nuevo').value.trim();
  if(!/^\d{4,8}$/.test(pin)) return UI.toast('El PIN debe tener de 4 a 8 dígitos.', 'warning');
  Repo.configSet('consultorPin', await U.hash(pin));
  U.$('cf-pin-nuevo').value = '';
  App._consultorLibre = true;                 /* el consultor que lo crea sigue dentro */
  Repo.log('Configuración','Activó / cambió el PIN de consultor');
  UI.toast('PIN guardado. Maestros y Configuración quedan protegidos.');
  ConfigUI.render();
};

ConfigUI.quitarPin = async function(){
  if(!Repo.configGet('consultorPin', null)) return UI.toast('No hay PIN activo.', 'info');
  const ok = await UI.confirmar('Quitar PIN', 'El sistema quedará abierto para todos.', 'Sí, quitar');
  if(!ok) return;
  Repo.configSet('consultorPin', null);
  Repo.log('Configuración','Quitó el PIN de consultor');
  UI.toast('PIN eliminado.', 'info');
  ConfigUI.render();
};
