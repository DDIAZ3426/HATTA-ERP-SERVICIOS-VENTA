/* ============================================================
   APP — Navegación, sidebar, subtabs, arranque
   ============================================================ */

const App = {

  vistas: {},                 // id → { render: async fn }
  actual: 'inicio',

  registrar(id, vista){ App.vistas[id] = vista; },

  _consultorLibre: false,
  _protegidos: ['maestros','config'],
  _destinoPin: null,

  async _hayPin(){ return !!Repo.configGet('consultorPin', null); },

  async _pinCorrecto(pin){
    const hash = await U.hash(String(pin || ''));
    return hash === Repo.configGet('consultorPin', null);
  },

  pedirPin(){
    UI.modal2({
      titulo:'Modo consultor', icono:'lock',
      cuerpo:`
        <p class="muted" style="margin-bottom:10px">Maestros y Configuración están protegidos.
          Ingresa el PIN del consultor para editar.</p>
        <div class="form-group"><label>PIN</label>
          <input id="pin-input" type="password" class="form-input" inputmode="numeric" autocomplete="off"></div>`,
      pie:`<button class="btn" onclick="UI.cerrarModal2()">Cancelar</button>
           <button class="btn btn-primary" onclick="App.confirmarPin()"><i data-lucide="unlock"></i> Entrar</button>`,
    });
    setTimeout(() => { const i = U.$('pin-input'); if(i) i.focus(); }, 60);
  },

  async confirmarPin(){
    if(await App._pinCorrecto(U.$('pin-input').value)){
      App._consultorLibre = true;
      UI.cerrarModal2();
      const destino = App._destinoPin; App._destinoPin = null;
      if(destino) App.navegar(destino[0], destino[1]);
      UI.toast('Modo consultor activo.', 'info');
    }else{
      UI.toast('PIN incorrecto.', 'warning');
    }
  },

  bloquearConsultor(){
    App._consultorLibre = false;
    if(App._protegidos.includes(App.actual)) App.navegar('inicio');
    UI.toast('Maestros y Configuración quedaron bloqueados.', 'info');
  },

  async navegar(id, subtab){
    if(App._protegidos.includes(id) && !App._consultorLibre && await App._hayPin()){
      App._destinoPin = [id, subtab];
      App.pedirPin();
      return;
    }
    App.actual = id;

    document.querySelectorAll('.vista').forEach(s =>
      s.classList.toggle('active', s.id === 'vista-' + id));

    App.cerrarSidebarMovil();
    if(subtab) App.activarSubtab(id, subtab);
    App.marcarMenu();

    const v = App.vistas[id];
    if(v && v.render){
      try{ await v.render(); }
      catch(e){ console.error('[Vista]', id, e); UI.toast('Ocurrió un error al cargar la vista.', 'danger'); }
    }
    if(typeof TablaX !== 'undefined') TablaX.montar(document.getElementById('vista-' + id));
    if(typeof ExportX !== 'undefined') ExportX.montar(document.getElementById('vista-' + id));
    UI.icons();
    window.scrollTo({ top:0 });
  },

  activarSubtab(vistaId, subtab){
    const seccion = U.$('vista-' + vistaId);
    if(!seccion) return;
    seccion.querySelectorAll('.subtab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.panel === subtab));
    seccion.querySelectorAll('.subtab-panel').forEach(p =>
      p.classList.toggle('active', p.dataset.panel === subtab));
    App.marcarMenu();
  },

  /* ---- Sidebar dinámica desde ERP.modulos ---- */
  /* Menú de procesos: TODO el sistema, organizado por módulo.
     [etiqueta, código, onclick, subtab?, alertaId?] — las filas con "+" abren modales. */
  _menuProcesos(){
    return {
      inicio: [
        ['Pantalla principal',        'INI_HOME', "App.navegar('inicio')", ''],
      ],
      dashboard: [
        ['Indicadores del negocio',   'DSH_INDI', "App.navegar('dashboard')", ''],
      ],
      ventas: [
        ['+ Nueva factura',           'VEN_NFAC', "VentasUI.nueva()"],
        ['Facturas',                  'VEN_FACT', "App.navegar('ventas','facturas')", 'facturas'],
        ['+ Nueva cotización',        'VEN_NCOT', "VentasUI.nuevaCot()"],
        ['Cotizaciones',              'VEN_COTI', "App.navegar('ventas','cotizaciones')", 'cotizaciones', 'sb-num-cot'],
        ['+ Registrar cobro',         'VEN_NCOB', "VentasUI.cobrar()"],
        ['Por cobrar',                'VEN_CXC',  "App.navegar('ventas','porcobrar')", 'porcobrar', 'sb-num-cxc'],
      ],
      ordenes: [
        ['+ Nueva orden',             'ORD_NORD', "OrdenesUI.nueva()"],
        ['Órdenes de servicio',       'ORD_LIST', "App.navegar('ordenes')", ''],
      ],
      compras: [
        ['+ Nueva compra',            'COM_NCOM', "ComprasUI.nueva()"],
        ['Compras',                   'COM_COMP', "App.navegar('compras','compras')", 'compras'],
        ['+ Registrar pago',          'COM_NPAG', "ComprasUI.pagar()"],
        ['Por pagar',                 'COM_CXP',  "App.navegar('compras','porpagar')", 'porpagar', 'sb-num-cxp'],
      ],
      inventario: [
        ['Existencias',               'INV_EXIS', "App.navegar('inventario','existencias')", 'existencias', 'sb-num-stock'],
        ['Movimientos (kardex)',      'INV_KARD', "App.navegar('inventario','movimientos')", 'movimientos'],
        ['Ajustes',                   'INV_AJUS', "App.navegar('inventario','ajustes')", 'ajustes'],
        ['+ Nuevo ajuste',            'INV_NAJU', "InventarioUI.nuevoAjuste()"],
      ],
      caja: [
        ['Cuentas y saldos',          'CAJ_CTAS', "App.navegar('caja','cuentas')", 'cuentas'],
        ['Movimientos',               'CAJ_MOVS', "App.navegar('caja','movimientos')", 'movimientos'],
        ['+ Nueva entrada',           'CAJ_NENT', "CajaUI.nuevoMov('entrada')"],
        ['+ Nueva salida',            'CAJ_NSAL', "CajaUI.nuevoMov('salida')"],
        ['+ Nueva transferencia',     'CAJ_NTRA', "CajaUI.nuevaTransferencia()"],
      ],
      maestros: [
        ['Clientes',                  'MAE_CLIE', "App.navegar('maestros','clientes')", 'clientes'],
        ['Proveedores',               'MAE_PROV', "App.navegar('maestros','proveedores')", 'proveedores'],
        ['Artículos y servicios',     'MAE_ARTS', "App.navegar('maestros','items')", 'items'],
        ['Impuestos',                 'MAE_IMPU', "App.navegar('maestros','impuestos')", 'impuestos'],
        ['Categorías',                'MAE_CATE', "App.navegar('maestros','categorias')", 'categorias'],
        ['Unidades',                  'MAE_UNID', "App.navegar('maestros','unidades')", 'unidades'],
        ['Cuentas de caja y banco',   'MAE_CTAS', "App.navegar('maestros','cuentas')", 'cuentas'],
      ],
      config: [
        ['Empresa',                   'CFG_EMPR', "App.navegar('config','empresa')", 'empresa'],
        ['Numeraciones y NCF',        'CFG_NUME', "App.navegar('config','numeraciones')", 'numeraciones'],
        ['Respaldos y datos',         'CFG_DATO', "App.navegar('config','datos')", 'datos'],
        ['Bitácora',                  'CFG_BITA', "App.navegar('config','bitacora')", 'bitacora'],
      ],
    };
  },

  modulosVisibles(){
    const emp = Repo.configGet('empresa', ERP.empresaDefault);
    const tipo = emp.tipoNegocio || 'servicios';
    return ERP.modulos.filter(m => !m.soloServicios || tipo !== 'ventas');
  },

  pintarSidebar(){
    const menu = App._menuProcesos();
    U.$('sidebar-nav').innerHTML = App.modulosVisibles().map(m => {
      const cab = `
        <div class="menu-cab ${m.proxEtapa ? 'apagada' : ''}" data-mod="${m.id}"
          style="--mc:${m.color};--mt:${m.tinta}" ${m.proxEtapa ? '' : `onclick="App.navegar('${m.id}')"`}>
          <i data-lucide="${m.icono}"></i>${U.esc(m.label)}
          ${m.proxEtapa ? `<span class="menu-etapa">${U.esc(m.proxEtapa)}</span>` : ''}
        </div>`;
      if(m.proxEtapa)
        return cab + `<div class="menu-fila deshabilitada"><span>Disponible en la ${U.esc(m.proxEtapa)}</span></div>`;
      const filas = (menu[m.id] || []).map(([label, codigo, accion, sub, alertaId]) => {
        const esAccion = label.startsWith('+ ');
        return `
          <button class="menu-fila" data-mod="${m.id}" ${sub !== undefined ? `data-sub="${sub}"` : ''} onclick="${accion}">
            ${esAccion ? '<i data-lucide="plus" class="fplus"></i>' : ''}
            <span>${U.esc(esAccion ? label.slice(2) : label)}</span>
            ${alertaId ? `<span class="menu-num ${alertaId === 'sb-num-cot' ? 'azul' : ''}" id="${alertaId}"></span>` : ''}
            <span class="menu-cod">${codigo}</span>
            <span class="menu-cinta" style="--mc:${m.color}"></span>
          </button>`;
      }).join('');
      return cab + filas;
    }).join('');

    U.$('sb-paleta').innerHTML = App.modulosVisibles()
      .map(m => `<span style="background:${m.color}" title="${U.esc(m.label)}"></span>`).join('');
  },

  /* Marca en el menú el módulo y el proceso activos */
  marcarMenu(){
    const btnSub = document.querySelector(`#vista-${App.actual} .subtab-btn.active`);
    const sub = btnSub ? btnSub.dataset.panel : '';
    document.querySelectorAll('#sidebar-nav .menu-cab').forEach(c =>
      c.classList.toggle('active', c.dataset.mod === App.actual));
    document.querySelectorAll('#sidebar-nav .menu-fila[data-sub]').forEach(f =>
      f.classList.toggle('active', f.dataset.mod === App.actual && f.dataset.sub === sub));
  },

  pintarMarca(){
    const marca = (ERP.marca.nombre + ' ' + ERP.marca.acento).trim();
    document.title = `${marca} — ${ERP.marca.eslogan}`;
    U.$('logo-texto').innerHTML =
      `${U.esc(ERP.marca.nombre)} <span class="acento">${U.esc(ERP.marca.acento)}</span>` +
      `<span class="ver">v${ERP.version}</span>`;
    U.$('sidebar-pie').textContent = `${marca} · ${ERP.etapa} · v${ERP.version}`;
  },

  /* ---- Campana: cuentas vencidas ---- */
  /* Avisos de comprobantes fiscales; si no hay, va directo a Por cobrar */
  verAvisos(){
    const avisos = Ops.ncfAvisos();
    if(!avisos.length) return App.navegar('ventas', 'porcobrar');
    UI.modal({
      titulo:'Avisos de comprobantes', icono:'file-badge',
      cuerpo: avisos.map(a => `
        <div class="aviso-linea ${a.nivel}">
          <i data-lucide="${a.nivel === 'mal' ? 'octagon-alert' : 'triangle-alert'}"></i>
          <span>${U.esc(a.texto)}</span></div>`).join('') +
        `<p class="form-ayuda" style="margin-top:10px">Los rangos y vencimientos se ajustan en
          Configuración → Numeraciones, con la autorización que te dio la DGII.</p>`,
      pie:`<button class="btn" onclick="UI.cerrarModal(); App.navegar('ventas','porcobrar')">Ver cuentas por cobrar</button>
           <button class="btn btn-primary" onclick="UI.cerrarModal(); App.navegar('config','numeraciones')">
             <i data-lucide="settings"></i> Ir a Numeraciones</button>`,
    });
    UI.icons();
  },

  async refrescarAlertas(){
    const st = await Ops.stats();
    const avisosNcf = Ops.ncfAvisos();
    const punto = U.$('campana-punto');
    const total = (st.vencidoCant || 0) + avisosNcf.length;
    punto.textContent = total || '';
    punto.style.display = total ? 'flex' : 'none';
    U.$('btn-campana').title = avisosNcf.length
      ? 'Cuentas vencidas y avisos de comprobantes'
      : 'Cuentas vencidas';
    const pon = (id, n) => { const el = U.$(id); if(el) el.textContent = n || ''; };
    pon('sb-num-cxc', st.vencidoCant);
    pon('sb-num-cxp', st.cxpVencidoCant);
    pon('sb-num-cot', st.cotAbiertas);
    pon('sb-num-stock', st.invBajo + st.invSin);
  },

  /* ---- Móvil ---- */
  toggleSidebar(){
    U.$('sidebar').classList.toggle('abierta');
    U.$('sidebar-overlay').classList.toggle('visible');
  },
  cerrarSidebarMovil(){
    U.$('sidebar').classList.remove('abierta');
    U.$('sidebar-overlay').classList.remove('visible');
  },
};

/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  if(App._booted) return;          /* blindaje: un solo arranque aunque el evento llegue dos veces */
  App._booted = true;
  try{
    const creoDemo = await Seed.siVacio();

    App.pintarSidebar();
    App.pintarMarca();

    /* Subtabs: delegación global — cambiar de pestaña no re-renderiza (ya está pintado) */
    document.querySelectorAll('.subtabs').forEach(barra => {
      barra.addEventListener('click', e => {
        const btn = e.target.closest('.subtab-btn');
        if(!btn) return;
        const vistaId = btn.closest('.vista').id.replace('vista-','');
        App.activarSubtab(vistaId, btn.dataset.panel);
      });
    });

    /* Campana → Ventas · Pendientes */
    U.$('btn-campana').addEventListener('click', () => App.verAvisos());

    /* Móvil */
    U.$('btn-hamburguesa').addEventListener('click', App.toggleSidebar);
    U.$('sidebar-overlay').addEventListener('click', App.cerrarSidebarMovil);

    /* Cualquier evento de negocio refresca la vista activa y las alertas */
    Bus.on('*', async () => {
      const v = App.vistas[App.actual];
      if(v && v.render){ try{ await v.render(); UI.icons(); }catch(e){} }
      App.refrescarAlertas();
    });

    await App.navegar('inicio');
    await App.refrescarAlertas();

    if(creoDemo) UI.toast('Bienvenido. Se cargaron datos de ejemplo para que explores.', 'info');
  }catch(e){
    console.error('[Boot]', e);
    UI.toast('Error al iniciar la aplicación.', 'danger');
  }
});
