/* ============================================================
   UI TEST — Arranca la app real en jsdom y verifica que:
   · el boot no lanza errores
   · todos los módulos y subtabs renderizan
   · todos los modales abren y cierran
   Uso: node ui_test.js   (herramienta de desarrollo)
   ============================================================ */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const nodeCrypto = require('crypto');

(async () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;

  /* --- Stubs de entorno --- */
  w.lucide = { createIcons(){} };                       // CDN no disponible en test
  if(!w.crypto) w.crypto = {};
  if(!w.crypto.randomUUID) w.crypto.randomUUID = () => nodeCrypto.randomUUID();
  if(!w.crypto.subtle) w.crypto.subtle = nodeCrypto.webcrypto.subtle;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.print = () => {};

  /* --- Captura de errores --- */
  const errores = [];
  w.addEventListener('error', e => errores.push('window.onerror: ' + e.message));
  const conError = w.console.error.bind(w.console);
  w.console.error = (...a) => { errores.push('console.error: ' + a.map(String).join(' ')); conError(...a); };
  process.on('unhandledRejection', e => errores.push('unhandledRejection: ' + (e && e.message || e)));

  /* --- Ejecutar los scripts de la app como UN solo bundle (los const
         top-level comparten scope, igual que <script> reales) --- */
  const srcs = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]);
  const bundle = srcs.map(src => fs.readFileSync(src, 'utf8')).join('\n;\n') + `
;window.App=App;window.Ops=Ops;window.Repo=Repo;window.U=U;window.UI=UI;window.ERP=ERP;
window.Bus=Bus;window.Seed=Seed;window.VentasUI=VentasUI;window.ComprasUI=ComprasUI;
window.InventarioUI=InventarioUI;window.CajaUI=CajaUI;window.MaestrosUI=MaestrosUI;
window.InicioUI=InicioUI;window.DashboardUI=typeof DashboardUI!=='undefined'?DashboardUI:undefined;
window.ConfigUI=typeof ConfigUI!=='undefined'?ConfigUI:undefined;
window.TablaX=TablaX;window.OrdenesUI=OrdenesUI;window.ExportX=ExportX;`;
  w.eval(bundle);

  /* --- Boot: dispatch manual (idempotente gracias al guard de App._booted) --- */
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  await new Promise(r => setTimeout(r, 450));

  let pasa = 0, falla = 0;
  const ok = (cond, msg) => { cond ? pasa++ : falla++; console.log(`  ${cond ? '✔' : '✘'} ${msg}`); };
  const sinErroresNuevos = (msg) => {
    ok(errores.length === 0, msg + (errores.length ? `  →  ${errores[0]}` : ''));
    errores.length = 0;
  };
  const A = w.App, U = w.U;

  console.log('\n1) Boot');
  ok(!!A && !!w.Ops && !!w.Repo, 'App, Ops y Repo cargados');
  ok(A.actual === 'inicio', 'arranca en Inicio');
  sinErroresNuevos('boot sin errores');

  console.log('\n2) Menú de procesos (sidebar)');
  const filas = w.document.querySelectorAll('#sidebar-nav .menu-fila');
  const cabs = w.document.querySelectorAll('#sidebar-nav .menu-cab');
  ok(filas.length >= 33, `${filas.length} procesos pintados`);
  ok(cabs.length === w.ERP.modulos.length, `${cabs.length} grupos (uno por módulo)`);
  ok([...filas].every(f => !f.dataset.sub || w.document.querySelector(`#vista-${f.dataset.mod} .subtab-panel[data-panel="${f.dataset.sub}"]`) || ['inicio','dashboard'].includes(f.dataset.mod)),
     'cada proceso apunta a un subtab que existe');
  ok(w.document.querySelectorAll('#sb-paleta span').length === w.ERP.modulos.length, 'paleta de módulos pintada');

  console.log('\n3) Navegar todos los módulos y subtabs');
  for(const [mod, items] of Object.entries(A._menuProcesos())){
    for(const [label,, accion, sub] of items){
      if(sub === undefined) continue;                       // acciones modales se prueban aparte
      await A.navegar(mod, sub || undefined);
      const visible = w.document.querySelector('.vista.active');
      if(visible.id !== 'vista-' + mod){ ok(false, `${mod}/${sub || '—'} no activó su vista`); continue; }
    }
    sinErroresNuevos(`módulo ${mod}: todos sus procesos renderizan sin errores`);
  }

  console.log('\n4) Marcado activo del menú');
  await A.navegar('compras', 'porpagar');
  const activa = w.document.querySelector('#sidebar-nav .menu-fila.active');
  ok(activa && activa.dataset.mod === 'compras' && activa.dataset.sub === 'porpagar', 'la fila activa refleja compras/porpagar');
  ok(w.document.querySelector('#sidebar-nav .menu-cab.active').dataset.mod === 'compras', 'el grupo activo refleja compras');

  console.log('\n5) Abrir y cerrar todos los modales');
  const modales = [
    ['VentasUI.nueva',            () => w.VentasUI.nueva()],
    ['VentasUI.cobrar',           () => w.VentasUI.cobrar()],
    ['VentasUI.nuevaCot',         () => w.VentasUI.nuevaCot()],
    ['ComprasUI.nueva',           () => w.ComprasUI.nueva()],
    ['ComprasUI.pagar',           () => w.ComprasUI.pagar()],
    ['CajaUI.nuevoMov(entrada)',  () => w.CajaUI.nuevoMov('entrada')],
    ['CajaUI.nuevoMov(salida)',   () => w.CajaUI.nuevoMov('salida')],
    ['CajaUI.nuevaTransferencia', () => w.CajaUI.nuevaTransferencia()],
    ['InventarioUI.nuevoAjuste',  () => w.InventarioUI.nuevoAjuste()],
    ['MaestrosUI.nuevoCliente',   () => w.MaestrosUI.nuevoCliente()],
    ['MaestrosUI.nuevoProveedor', () => w.MaestrosUI.nuevoProveedor()],
    ['MaestrosUI.nuevoItem',      () => w.MaestrosUI.nuevoItem()],
  ];
  for(const [nombre, abrir] of modales){
    try{
      await abrir();
      await new Promise(r => setTimeout(r, 30));
      const abierto = w.document.querySelector('#modal .modal-overlay.visible, .modal-overlay.visible');
      ok(!!abierto, `${nombre} abre`);
      w.UI.cerrarModal(); w.UI.cerrarModal2 && w.UI.cerrarModal2();
    }catch(e){ ok(false, `${nombre} lanzó: ${e.message}`); }
  }
  sinErroresNuevos('modales sin errores de consola');

  console.log('\n6) Detalles con datos demo');
  const venta = (await w.Repo.list('ventas'))[0];
  await w.VentasUI.detalle(venta.id); w.UI.cerrarModal();
  const compra = (await w.Repo.list('compras'))[0];
  await w.ComprasUI.detalle(compra.id); w.UI.cerrarModal();
  const cliente = (await w.Repo.list('clientes'))[0];
  await A.navegar('maestros','clientes'); await w.MaestrosUI.detalleCliente(cliente.id); w.UI.cerrarModal();
  sinErroresNuevos('detalles de venta, compra y cliente sin errores');

  console.log('\n7) Alertas del menú');
  await A.refrescarAlertas();
  const cxc = w.document.getElementById('sb-num-cxc');
  ok(cxc && cxc.textContent !== '', `contador CxC pintado (${cxc && cxc.textContent})`);
  sinErroresNuevos('refrescarAlertas sin errores');

  console.log('\n8) CSS crítico del scroll (tripwire)');
  const css = fs.readFileSync('css/base.css', 'utf8');
  const regla = css.match(/\.menu-lista\{[^}]+\}/);
  ok(!!regla, 'existe la regla .menu-lista{}');
  ok(!!regla && /min-height:0/.test(regla[0]), 'tiene min-height:0 (sin esto el flex no encoge y no hay scroll)');
  ok(!!regla && /overflow-y:scroll/.test(regla[0]), 'fuerza overflow-y:scroll (barra siempre visible)');
  ok((css.match(/\.menu-lista\{/g) || []).length === 1, 'la regla existe exactamente una vez');
  ok(/\.sidebar\{[^}]*height:calc\(100vh - 60px\)/.test(css.replace(/\n/g,' ')), 'la sidebar tiene altura fija de viewport');

  console.log('\n9) TablaX: orden y filtros por columna (patrón HATTA)');
  await A.navegar('compras','compras');
  await new Promise(r => setTimeout(r, 50));
  const tablaC = w.document.querySelector('#vista-compras [data-panel="compras"] table.tabla');
  ok(!!tablaC && tablaC.dataset.tx === '1', 'la tabla de compras quedó montada');
  ok(tablaC.querySelectorAll('.hcol').length >= 7, 'cada columna tiene botón de orden');
  const thEstado = [...tablaC.querySelectorAll('th')].find(t => t.textContent.includes('Estado'));
  const hfEstado = thEstado.querySelector('.hfilter');
  ok(!!hfEstado, 'la columna Estado tiene botón de filtro ▾');

  hfEstado.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await new Promise(r => setTimeout(r, 30));
  const pop = w.document.getElementById('tx-pop');
  const items = pop ? pop.querySelectorAll('.pop-item') : [];
  ok(pop && pop.style.display === 'block' && items.length >= 2,
     `el popover abre con ${items.length} valores únicos y sus conteos`);

  items.forEach(it => { it.querySelector('input').checked = it.textContent.includes('Pagada'); });
  w.TablaX.aplicarFiltro();
  const visiblesC = [...tablaC.tBodies[0].rows].filter(r => r.style.display !== 'none' && !r.querySelector('.empty'));
  ok(visiblesC.length >= 1 && visiblesC.every(r => r.textContent.includes('Pagada')),
     `filtrar por "Pagada" deja solo esas filas (${visiblesC.length})`);
  ok(hfEstado.classList.contains('active'), 'el ▾ queda marcado como filtro activo');
  w.TablaX._ctx = { tabla: tablaC, col: +thEstado.dataset.txCol };
  w.TablaX.quitarFiltro();
  const trasQuitar = [...tablaC.tBodies[0].rows].filter(r => r.style.display !== 'none' && !r.querySelector('.empty'));
  ok(trasQuitar.length > visiblesC.length, 'Quitar restaura todas las filas');

  const thTotal = [...tablaC.querySelectorAll('th')].find(t => t.textContent.includes('Total'));
  ok(thTotal.querySelector('.hfilter').style.display === 'none', 'las columnas de montos solo ordenan (sin ▾), como HATTA');
  const colTotal = +thTotal.dataset.txCol;
  w.TablaX.ordenar(tablaC, colTotal, 'desc');
  const filasOrd = [...tablaC.tBodies[0].rows].filter(r => !r.querySelector('.empty'));
  const montos = filasOrd.map(r => parseFloat(r.cells[colTotal].textContent.replace(/[^\d.]/g,'')));
  ok(montos.every((m, i) => i === 0 || montos[i-1] >= m), `ordena por Total descendente (${montos[0]} → ${montos[montos.length-1]})`);
  ok(thTotal.querySelector('.sort-ind').textContent === '▼', 'el indicador ▼ se pinta en la columna ordenada');

  // El estado sobrevive a un re-render del módulo (el observer re-aplica)
  await w.ComprasUI.render();
  await new Promise(r => setTimeout(r, 60));
  const montos2 = [...tablaC.tBodies[0].rows].filter(r => !r.querySelector('.empty'))
    .map(r => parseFloat(r.cells[colTotal].textContent.replace(/[^\d.]/g,'')));
  ok(montos2.every((m, i) => i === 0 || montos2[i-1] >= m), 'el orden sobrevive al re-render del módulo');
  sinErroresNuevos('TablaX sin errores de consola');

  console.log('\n10) Órdenes de servicio (perfil Servicios)');
  ok(A.modulosVisibles().some(m => m.id === 'ordenes'), 'el módulo aparece con perfil de servicios');
  await A.navegar('ordenes');
  await new Promise(r => setTimeout(r, 40));
  const filasOs = w.document.querySelectorAll('#os-tbody tr');
  ok(filasOs.length >= 3, `la tabla pinta las órdenes demo (${filasOs.length})`);
  ok(w.document.getElementById('os-kpi-listas').textContent === '1', 'KPI de listas para entrega correcto');
  await w.OrdenesUI.nueva();
  ok(!!w.document.getElementById('os-cli'), 'el modal de nueva orden abre');
  w.UI.cerrarModal();
  // perfil "ventas" oculta el módulo
  const empCfg = w.Repo.configGet('empresa', w.ERP.empresaDefault);
  w.Repo.configSet('empresa', { ...empCfg, tipoNegocio:'ventas' });
  ok(!A.modulosVisibles().some(m => m.id === 'ordenes'), 'con perfil "ventas" el módulo desaparece');
  A.pintarSidebar();
  ok(!w.document.querySelector('#sidebar-nav .menu-cab[data-mod="ordenes"]'), 'la sidebar ya no lo pinta');
  w.Repo.configSet('empresa', empCfg);
  A.pintarSidebar();
  sinErroresNuevos('órdenes sin errores');

  console.log('\n11) Exportar Excel/PDF montado');
  await A.navegar('compras','compras');
  await new Promise(r => setTimeout(r, 40));
  const grupoExp = w.document.querySelector('#vista-compras [data-panel="compras"] .toolbar .exp-grupo');
  ok(!!grupoExp && grupoExp.querySelectorAll('button').length === 2, 'botones Excel y PDF presentes en el toolbar');
  const datosExp = w.ExportX._datos(w.document.querySelector('#vista-compras [data-panel="compras"] table.tabla'));
  ok(datosExp.cabecera.length >= 7 && datosExp.cuerpo.length >= 3,
     `la extracción lee ${datosExp.cabecera.length} columnas y ${datosExp.cuerpo.length} filas visibles`);
  sinErroresNuevos('export sin errores');

  console.log('\n12) Candado de consultor');
  w.Repo.configSet('consultorPin', await w.U.hash('4321'));
  A._consultorLibre = false;
  await A.navegar('maestros');
  ok(A.actual !== 'maestros', 'con PIN activo, Maestros no abre sin desbloquear');
  ok(!!w.document.getElementById('pin-input'), 'aparece el modal pidiendo el PIN');
  w.document.getElementById('pin-input').value = '0000';
  await A.confirmarPin();
  ok(A.actual !== 'maestros', 'un PIN incorrecto no desbloquea');
  w.document.getElementById('pin-input').value = '4321';
  await A.confirmarPin();
  await new Promise(r => setTimeout(r, 60));
  ok(A.actual === 'maestros', 'el PIN correcto desbloquea y navega a Maestros');
  A.bloquearConsultor();
  ok(A._consultorLibre === false && A.actual === 'inicio', '"Bloquear ahora" cierra y regresa al Inicio');
  w.Repo.configSet('consultorPin', null);
  A._consultorLibre = true;
  sinErroresNuevos('candado sin errores');

  console.log(`\n===== UI TEST: ${pasa} OK, ${falla} fallas =====\n`);
  process.exit(falla ? 1 : 0);
})().catch(e => { console.error('ERROR FATAL UI TEST:', e); process.exit(1); });
