/* ============================================================
   PRUEBA DE HUMO (desarrollo) — ejecutar con:  node smoke_test.js
   Valida la lógica de negocio (Ops/Repo) sin navegador.
   ============================================================ */
const fs = require('fs');
const vm = require('vm');

/* localStorage simulado */
const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  key: i => [...store.keys()][i],
  get length(){ return store.size; },
};

const ctx = vm.createContext({ console, localStorage, Date, JSON, Math, setTimeout, Intl });
for(const f of ['js/erp.config.js','js/utils.js','js/repo.js','js/ops.js']){
  vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8'), ctx, { filename: f });
}

let pasa = 0, falla = 0;
const ok = (cond, msg) => {
  if(cond){ pasa++; console.log('  ✔', msg); }
  else{ falla++; console.log('  ✘', msg); }
};
const casi = (a, b) => Math.abs(a - b) < 0.011;

(async () => {
  /* los const de nivel superior viven en el entorno léxico del contexto,
     no como propiedades del objeto: se extraen evaluando dentro */
  const { Seed, Ops, Repo, U, ERP } = vm.runInContext('({ Seed, Ops, Repo, U, ERP })', ctx);

  console.log('\n1) Datos demo');
  await Seed.crearDemo();
  ok((await Repo.list('clientes')).length >= 6, 'seed crea clientes');
  ok((await Repo.list('items')).length >= 8, 'seed crea artículos/servicios');
  ok((await Repo.list('ventas')).length >= 8, 'seed crea ventas');
  ok((await Repo.list('cuentas')).length === 3, 'seed crea 3 cuentas');

  console.log('\n2) Totales con ITBIS');
  const cli = (await Repo.list('clientes'))[0];
  const cta = (await Repo.list('cuentas'))[0];
  const venta = await Ops.crearVenta({
    clienteId: cli.id, fecha: U.hoy(), condicion:'credito', diasCredito: 30, tipoNcf:'B02',
    lineas: [
      { itemId:'x', nombre:'Serv A', cant:2, precio:100, tasa:18 },
      { itemId:'y', nombre:'Serv B', cant:1, precio:50,  tasa:0  },
    ],
  });
  ok(casi(venta.subtotal, 250), `subtotal 250 (=${venta.subtotal})`);
  ok(casi(venta.itbis, 36), `itbis 36 (=${venta.itbis})`);
  ok(casi(venta.total, 286), `total 286 (=${venta.total})`);
  ok(venta.estado === 'pendiente', 'nace pendiente');

  console.log('\n3) Cobro parcial y total');
  const movsAntes = (await Repo.list('movimientos')).length;
  const saldoAntes = (await Ops.saldos()).find(s => s.cuenta.id === cta.id).saldo;
  await Ops.registrarCobro({ ventaId: venta.id, monto: 100, fecha: U.hoy(), metodo:'Efectivo', cuentaId: cta.id });
  let v = await Repo.get('ventas', venta.id);
  ok(v.estado === 'parcial' && casi(v.cobrado, 100), 'cobro parcial → estado parcial');
  const saldoDespues = (await Ops.saldos()).find(s => s.cuenta.id === cta.id).saldo;
  ok(casi(saldoDespues - saldoAntes, 100), 'el cobro sube el saldo de la cuenta (+100)');
  ok((await Repo.list('movimientos')).length === movsAntes + 1, 'el cobro crea 1 movimiento');
  const cobro2 = await Ops.registrarCobro({ ventaId: venta.id, monto: 186, fecha: U.hoy(), metodo:'Transferencia', cuentaId: cta.id });
  v = await Repo.get('ventas', venta.id);
  ok(v.estado === 'pagada' && casi(Ops.pendiente(v), 0), 'cobro del resto → pagada, pendiente 0');

  console.log('\n4) Sobrecobro rechazado');
  let rechazo = false;
  try{ await Ops.registrarCobro({ ventaId: venta.id, monto: 10, fecha: U.hoy(), metodo:'Efectivo', cuentaId: cta.id }); }
  catch(e){ rechazo = true; }
  ok(rechazo, 'no permite cobrar más que el pendiente');

  console.log('\n5) Anular cobro revierte todo');
  await Ops.anularCobro(cobro2.id);
  v = await Repo.get('ventas', venta.id);
  ok(v.estado === 'parcial' && casi(v.cobrado, 100), 'anular cobro → vuelve a parcial');
  ok((await Repo.list('movimientos')).length === movsAntes + 1, 'y elimina su movimiento de caja');

  console.log('\n6) Anular venta');
  let bloqueada = false;
  try{ await Ops.anularVenta(venta.id); }catch(e){ bloqueada = true; }
  ok(bloqueada, 'no se anula una venta con cobros');
  const venta2 = await Ops.crearVenta({
    clienteId: cli.id, fecha: U.hoy(), condicion:'contado', tipoNcf:'SIN',
    lineas: [{ itemId:'x', nombre:'Serv', cant:1, precio:10, tasa:0 }],
  });
  await Ops.anularVenta(venta2.id);
  ok((await Repo.get('ventas', venta2.id)).estado === 'anulada', 'venta sin cobros sí se anula');

  console.log('\n7) Transferencia');
  const ctas = await Repo.list('cuentas');
  const antesO = (await Ops.saldos()).find(s => s.cuenta.id === ctas[0].id).saldo;
  const antesD = (await Ops.saldos()).find(s => s.cuenta.id === ctas[1].id).saldo;
  await Ops.transferir({ origenId: ctas[0].id, destinoId: ctas[1].id, monto: 500, fecha: U.hoy(), concepto:'Prueba' });
  const despO = (await Ops.saldos()).find(s => s.cuenta.id === ctas[0].id).saldo;
  const despD = (await Ops.saldos()).find(s => s.cuenta.id === ctas[1].id).saldo;
  ok(casi(antesO - despO, 500) && casi(despD - antesD, 500), 'transferencia mueve ambos saldos ±500');
  let mismaCta = false;
  try{ await Ops.transferir({ origenId: ctas[0].id, destinoId: ctas[0].id, monto: 5, fecha: U.hoy() }); }
  catch(e){ mismaCta = true; }
  ok(mismaCta, 'no permite transferir a la misma cuenta');

  console.log('\n8) Movimiento de cobro protegido');
  const movCobro = (await Repo.list('movimientos')).find(m => m.origen === 'cobro');
  let protegido = false;
  try{ await Ops.eliminarMovimiento(movCobro.id); }catch(e){ protegido = true; }
  ok(protegido, 'no deja borrar el movimiento nacido de un cobro');

  console.log('\n9) Numeración y NCF');
  const a = await Ops.crearVenta({ clienteId: cli.id, fecha: U.hoy(), condicion:'contado', tipoNcf:'B01',
    lineas:[{ itemId:'x', nombre:'S', cant:1, precio:1, tasa:0 }] });
  const b = await Ops.crearVenta({ clienteId: cli.id, fecha: U.hoy(), condicion:'contado', tipoNcf:'B01',
    lineas:[{ itemId:'x', nombre:'S', cant:1, precio:1, tasa:0 }] });
  const nA = parseInt(a.numero.replace(/\D/g,'')), nB = parseInt(b.numero.replace(/\D/g,''));
  ok(nB === nA + 1, `números consecutivos (${a.numero} → ${b.numero})`);
  const sA = parseInt(a.ncf.slice(3)), sB = parseInt(b.ncf.slice(3));
  ok(a.ncf.startsWith('B01') && sB === sA + 1, `NCF B01 consecutivos (${a.ncf} → ${b.ncf})`);

  console.log('\n10) Búsqueda global');
  const r = await Ops.buscar('progreso');
  ok(r && r.clientes.some(c => c.nombre.includes('Progreso')), 'buscar("progreso") encuentra al cliente');

  /* ================= ETAPA 2: COMPRAS, PAGOS E INVENTARIO ================= */

  console.log('\n11) Totales de compra (líneas de catálogo y libres)');
  const cc = Ops.calcularLineasCompra([
    { itemId:'x', nombre:'Artículo', cant:2, costo:100, tasa:18 },
    { itemId:null, nombre:'Gasto libre', cant:1, costo:50, tasa:0 },
    { itemId:null, nombre:'', cant:3, costo:10, tasa:0 },            // sin nombre ni item: se descarta
  ]);
  ok(cc.lineas.length === 2, 'descarta la línea sin item y sin nombre');
  ok(casi(cc.subtotal, 250) && casi(cc.itbis, 36) && casi(cc.total, 286),
     `subtotal 250, ITBIS 36, total 286 (${cc.total})`);

  console.log('\n12) Compra + pago = salida automática en Caja');
  const provs = await Repo.list('proveedores');
  const co = await Ops.crearCompra({ proveedorId: provs[0].id, fecha: U.hoy(), condicion:'credito', diasCredito:30,
    ncfProveedor:'b0100009999', lineas:[{ itemId:null, nombre:'Prueba etapa 2', cant:1, costo:1000, tasa:18 }] });
  ok(co.estado === 'pendiente' && casi(co.total, 1180), `compra creada pendiente por 1,180 (${co.numero})`);
  ok(co.ncfProveedor === 'B0100009999', 'el NCF del proveedor se guarda en mayúsculas');

  const ctaPago = ctas[0];
  const pgAntes = (await Ops.saldos()).find(s => s.cuenta.id === ctaPago.id).saldo;
  const pg1 = await Ops.registrarPago({ compraId: co.id, monto: 500, metodo:'Efectivo', cuentaId: ctaPago.id });
  const pgDesp = (await Ops.saldos()).find(s => s.cuenta.id === ctaPago.id).saldo;
  ok(casi(pgAntes - pgDesp, 500), 'el pago baja el saldo de la cuenta en 500');
  const movPago = (await Repo.list('movimientos')).find(m => m.refId === pg1.id);
  ok(movPago && movPago.tipo === 'salida' && movPago.origen === 'pago', 'se creó la salida automática origen "pago"');

  let co2 = await Repo.get('compras', co.id);
  ok(co2.estado === 'parcial' && casi(Ops.pendienteCompra(co2), 680), 'pago parcial → estado parcial, pendiente 680');

  let e2Sobre = false;
  try{ await Ops.registrarPago({ compraId: co.id, monto: 9999, metodo:'Efectivo', cuentaId: ctaPago.id }); }
  catch(e){ e2Sobre = true; }
  ok(e2Sobre, 'rechaza pagar más que el pendiente');

  await Ops.registrarPago({ compraId: co.id, monto: 680, metodo:'Efectivo', cuentaId: ctaPago.id });
  co2 = await Repo.get('compras', co.id);
  ok(co2.estado === 'pagada' && casi(co2.pagado, 1180), 'pago del resto → estado pagada');

  console.log('\n13) Anulaciones de pago y compra');
  let e2Bloqueada = false;
  try{ await Ops.anularCompra(co.id); }catch(e){ e2Bloqueada = true; }
  ok(e2Bloqueada, 'no deja anular una compra con pagos');

  let e2ProtPago = false;
  try{ await Ops.eliminarMovimiento(movPago.id); }catch(e){ e2ProtPago = true; }
  ok(e2ProtPago, 'no deja borrar el movimiento nacido de un pago');

  await Ops.anularPago(pg1.id);
  co2 = await Repo.get('compras', co.id);
  ok(casi(co2.pagado, 680) && co2.estado === 'parcial', 'anular pago revierte el pagado (queda 680)');
  ok(!(await Repo.list('movimientos')).some(m => m.refId === pg1.id), 'la salida del pago anulado desaparece');

  const pagosCo = (await Repo.list('pagos')).filter(p => p.compraId === co.id);
  for(const p of pagosCo) await Ops.anularPago(p.id);
  await Ops.anularCompra(co.id);
  co2 = await Repo.get('compras', co.id);
  ok(co2.estado === 'anulada', 'sin pagos sí se puede anular la compra');

  console.log('\n14) Inventario: stock calculado (demo)');
  const inv = await Ops.inventario();
  const porCodigo = cod => inv.find(x => x.item.codigo === cod);
  const rCam = porCodigo('AR-001'), rRout = porCodigo('AR-002'), rDvr = porCodigo('AR-003');
  ok(rCam && rCam.stock === 16 && rCam.estadoStock === 'ok', `cámara: 6 aj + 10 + 4 compra − 4 venta = 16 OK (${rCam && rCam.stock})`);
  ok(rRout && rRout.stock === 2 && rRout.estadoStock === 'bajo', `router: 3 compra − 1 venta = 2, bajo mínimo 3 (${rRout && rRout.stock})`);
  ok(rDvr && rDvr.stock === 0 && rDvr.estadoStock === 'sin', 'disco duro sin movimientos = sin stock');
  ok(inv.every(x => x.item.tipo === 'articulo' && x.item.controlaInventario), 'los servicios no aparecen en inventario');
  ok(casi(rCam.valor, 16 * 3800), 'valor a costo = stock × costo');

  console.log('\n15) Inventario: ajustes y kardex');
  const aj = await Ops.crearAjuste({ itemId: rCam.item.id, cantidad: -3, motivo:'Prueba de merma' });
  let inv2 = await Ops.inventario();
  ok(inv2.find(x => x.item.codigo === 'AR-001').stock === 13, 'ajuste de −3 deja la cámara en 13');
  let e2SinMotivo = false;
  try{ await Ops.crearAjuste({ itemId: rCam.item.id, cantidad: 1, motivo:'  ' }); }catch(e){ e2SinMotivo = true; }
  ok(e2SinMotivo, 'ajuste sin motivo se rechaza');
  const kx = await Ops.kardex(rCam.item.id);
  ok(kx.length >= 4 && kx.every(m => m.itemId === rCam.item.id), 'kardex filtrado por artículo');
  ok(kx.every((m, i) => i === 0 || kx[i-1].fecha >= m.fecha), 'kardex ordenado del más reciente al más viejo');
  await Ops.eliminarAjuste(aj.id);
  inv2 = await Ops.inventario();
  ok(inv2.find(x => x.item.codigo === 'AR-001').stock === 16, 'eliminar el ajuste devuelve el stock a 16');

  console.log('\n16) Numeración de compras y búsqueda');
  const provX = provs[0];
  const cA = await Ops.crearCompra({ proveedorId: provX.id, fecha: U.hoy(), condicion:'contado',
    lineas:[{ itemId:null, nombre:'N1', cant:1, costo:10, tasa:0 }] });
  const cB = await Ops.crearCompra({ proveedorId: provX.id, fecha: U.hoy(), condicion:'contado',
    lineas:[{ itemId:null, nombre:'N2', cant:1, costo:10, tasa:0 }] });
  const cnA = parseInt(cA.numero.replace(/\D/g,'')), cnB = parseInt(cB.numero.replace(/\D/g,''));
  ok(cA.numero.startsWith('COM-') && cnB === cnA + 1, `números COM- consecutivos (${cA.numero} → ${cB.numero})`);
  const rb = await Ops.buscar('B0100887210');
  ok(rb && rb.compras.length === 1 && rb.compras[0].proveedorNombre.includes('Claro'),
     'buscar por NCF del proveedor encuentra la compra de Claro');

  console.log('\n17) Órdenes de servicio (mundo taller)');
  const ordenes = await Repo.list('ordenes');
  ok(ordenes.length === 3, `seed crea 3 órdenes demo (${ordenes.length})`);
  ok(ordenes.every(o => o.numero.startsWith('OS-')), 'numeración OS- aplicada');
  const oLista = ordenes.find(o => o.estado === 'listo');
  ok(!!oLista, 'hay una orden lista para entrega (demo)');

  const clientesT = await Repo.list('clientes');
  const oN = await Ops.crearOrden({ clienteId: clientesT[0].id, equipo:'Impresora Epson L3250', falla:'No agarra papel' });
  ok(oN.estado === 'recibido', 'una orden nueva nace en "recibido"');
  await Ops.avanzarOrden(oN.id); await Ops.avanzarOrden(oN.id);
  ok((await Repo.get('ordenes', oN.id)).estado === 'listo', 'avanzar dos veces la deja en "listo"');

  let sinEquipo = false;
  try{ await Ops.crearOrden({ clienteId: clientesT[0].id, equipo:'  ' }); }catch(e){ sinEquipo = true; }
  ok(sinEquipo, 'rechaza orden sin describir el equipo');

  console.log('\n18) Facturar orden con línea libre (ventas)');
  const cv = Ops.calcularLineas([
    { itemId:null, nombre:'Servicio de reparación', cant:1, precio:2500, tasa:18 },
    { itemId:null, nombre:'', cant:1, precio:100, tasa:0 },
  ]);
  ok(cv.lineas.length === 1 && casi(cv.total, 2950), `ventas acepta líneas libres y descarta vacías (total ${cv.total})`);

  const vOrden = await Ops.crearVenta({ clienteId: oN.clienteId, condicion:'contado', tipoNcf:'B02',
    lineas:[{ itemId:null, nombre:`Servicio ${oN.numero}: reparación de impresora`, cant:1, precio:2500, tasa:18 }] });
  await Ops.enlazarFacturaOrden(oN.id, vOrden);
  const oFact = await Repo.get('ordenes', oN.id);
  ok(oFact.facturaId === vOrden.id && oFact.facturaNumero === vOrden.numero, 'la orden queda enlazada a su factura');
  ok(oFact.estado === 'entregado', 'al facturarse pasa a "entregado"');

  let noAnula = false;
  try{ await Ops.anularOrden(oN.id); }catch(e){ noAnula = true; }
  ok(noAnula, 'no deja anular una orden ya facturada');
  const rbo = await Ops.buscar('Epson');
  ok(rbo.ordenes && rbo.ordenes.length === 1, 'buscar() encuentra la orden por el equipo');

  console.log('\n19) Retenciones: la factura cierra aunque el cliente retenga');
  const cliRet = (await Repo.list('clientes'))[0];
  const ctaRet = (await Repo.list('cuentas'))[0];
  const fRet = await Ops.crearVenta({
    clienteId: cliRet.id, fecha: U.hoy(), condicion:'credito', diasCredito:30, tipoNcf:'SIN',
    lineas: [{ itemId:'x', nombre:'Consultoría', cant:1, precio:10000, tasa:18 }],
  });
  ok(casi(fRet.subtotal, 10000) && casi(fRet.itbis, 1800) && casi(fRet.total, 11800),
     'factura 10,000 + 18% ITBIS = 11,800');
  const movsPre = (await Repo.list('movimientos')).length;
  const cRet = await Ops.registrarCobro({
    ventaId: fRet.id, monto: 9460, retItbis: 540, retIsr: 1000,
    fecha: U.hoy(), metodo:'Transferencia', cuentaId: ctaRet.id,
  });
  const vRet = await Repo.get('ventas', fRet.id);
  ok(casi(cRet.aplicado, 11000), 'aplicado = recibido + retenciones');
  ok(vRet.estado === 'parcial' && casi(Ops.pendiente(vRet), 800), 'la retención sí salda la factura');
  const movsPost = await Repo.list('movimientos');
  const movRet = movsPost.find(m => m.refId === cRet.id);
  ok(movsPost.length === movsPre + 1 && casi(movRet.monto, 9460),
     'a caja solo entra el dinero recibido, no lo retenido');
  await Ops.registrarCobro({ ventaId: fRet.id, monto: 800, fecha: U.hoy(), metodo:'Efectivo', cuentaId: ctaRet.id });
  ok((await Repo.get('ventas', fRet.id)).estado === 'pagada', 'con el resto, la factura queda pagada');
  await Ops.anularCobro(cRet.id);
  ok(casi(Ops.pendiente(await Repo.get('ventas', fRet.id)), 11000),
     'anular un cobro con retención revierte el monto completo aplicado');

  console.log('\n20) NCF: rango autorizado y vencimiento');
  Repo.configSet('numeraciones', {
    ...Repo.configGet('numeraciones', ERP.numeracionesDefault),
    ncf: { B01:{ desde:1, hasta:3, proximo:3, vence:'2099-12-31' },
           B02:{ desde:1, hasta:0, proximo:1, vence:'' } },
  });
  const V1 = { clienteId: cliRet.id, fecha: U.hoy(), condicion:'contado', tipoNcf:'B01',
               lineas:[{ itemId:'x', nombre:'S', cant:1, precio:100, tasa:0 }] };
  const fNcf = await Ops.crearVenta(V1);
  ok(fNcf.ncf === 'B0100000003', 'emite el NCF con el número de la secuencia');
  let agot = false;
  try{ await Ops.crearVenta(V1); }catch(e){ agot = /agot/i.test(e.message); }
  ok(agot, 'al pasar del rango autorizado, no deja emitir');

  Repo.configSet('numeraciones', {
    ...Repo.configGet('numeraciones', ERP.numeracionesDefault),
    ncf: { B01:{ desde:1, hasta:100, proximo:5, vence:'2020-01-01' }, B02:{ desde:1, hasta:0, proximo:1, vence:'' } },
  });
  let venc = false;
  try{ await Ops.crearVenta(V1); }catch(e){ venc = /venc/i.test(e.message); }
  ok(venc, 'con la autorización vencida, tampoco deja emitir');
  ok(Ops.ncfAvisos().some(a => a.nivel === 'mal'), 'y genera un aviso para la campana');

  console.log('\n21) RNC del cliente viaja en la factura');
  ok(fRet.clienteRnc === (cliRet.rnc || ''), 'la venta guarda el RNC del cliente para el comprobante');

  console.log(`\n===== RESULTADO: ${pasa} pruebas OK, ${falla} fallas =====\n`);
  process.exit(falla ? 1 : 0);
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
