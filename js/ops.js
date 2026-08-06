/* ============================================================
   OPS — Lógica de negocio (sin DOM)
   ------------------------------------------------------------
   Las vistas llaman a Ops; Ops habla con Repo y emite eventos.
   Aquí viven las reglas: totales, ITBIS, NCF, estados, saldos.
   ============================================================ */

const Ops = {

  /* ================= NUMERACIONES / NCF ================= */

  _nums(){ return Repo.configGet('numeraciones', JSON.parse(JSON.stringify(ERP.numeracionesDefault))); },

  siguienteNumero(tipo){                       // 'factura' | 'cotizacion'
    const n = Ops._nums();
    const serie = n[tipo] || { prefijo: tipo.slice(0,3).toUpperCase()+'-', proximo: 1 };
    const numero = serie.prefijo + String(serie.proximo).padStart(6,'0');
    serie.proximo++; n[tipo] = serie;
    Repo.configSet('numeraciones', n);
    return numero;
  },

  /* Estado de una secuencia NCF: rango autorizado por la DGII + vencimiento.
     hasta = 0 significa "sin rango definido" (instalación vieja): no se valida. */
  ncfEstado(tipoNcf){
    const n = Repo.configGet('numeraciones', ERP.numeracionesDefault);
    const c = (n.ncf || {})[tipoNcf] || {};
    const desde = U.num(c.desde) || 1;
    const hasta = U.num(c.hasta) || 0;
    const proximo = U.num(c.proximo) || 1;
    const vence = c.vence || '';
    const hoy = U.hoy();
    const total = hasta ? Math.max(0, hasta - desde + 1) : 0;
    const restantes = hasta ? Math.max(0, hasta - proximo + 1) : null;
    const diasVence = vence ? -U.diasEntre(vence, hoy) : null;   // negativo = ya venció
    return {
      tipo: tipoNcf, desde, hasta, proximo, vence, total, restantes, diasVence,
      agotado:  hasta ? proximo > hasta : false,
      vencido:  vence ? vence < hoy : false,
      porAgotarse: (hasta && total) ? (restantes <= Math.max(10, Math.ceil(total * 0.2))) : false,
      porVencer:   (diasVence !== null && diasVence >= 0 && diasVence <= 30),
    };
  },

  /* Avisos de comprobantes para la campana y el dashboard */
  ncfAvisos(){
    const avisos = [];
    for(const t of ERP.tiposNcf){
      if(t.id === 'SIN') continue;
      const e = Ops.ncfEstado(t.id);
      if(e.vencido)          avisos.push({ tipo:t.id, nivel:'mal',    texto:`La autorización de ${t.id} venció el ${U.fmtFecha(e.vence)}.` });
      else if(e.porVencer)   avisos.push({ tipo:t.id, nivel:'alerta', texto:`La autorización de ${t.id} vence en ${e.diasVence} día(s).` });
      if(e.agotado)          avisos.push({ tipo:t.id, nivel:'mal',    texto:`La secuencia ${t.id} se agotó (autorizada hasta ${e.hasta}).` });
      else if(e.porAgotarse) avisos.push({ tipo:t.id, nivel:'alerta', texto:`Quedan ${e.restantes} comprobantes ${t.id}.` });
    }
    return avisos;
  },

  ncfSiguiente(tipoNcf){                       // 'B01' | 'B02' | 'SIN'
    if(!tipoNcf || tipoNcf === 'SIN') return '';
    const est = Ops.ncfEstado(tipoNcf);
    if(est.vencido)
      throw new Error(`La autorización de los comprobantes ${tipoNcf} venció el ${U.fmtFecha(est.vence)}. Solicita una nueva secuencia a la DGII antes de facturar.`);
    if(est.agotado)
      throw new Error(`Se agotó la secuencia ${tipoNcf} (autorizada hasta el número ${est.hasta}). Solicita un nuevo rango a la DGII.`);
    const n = Ops._nums();
    n.ncf = n.ncf || {};
    const serie = n.ncf[tipoNcf] || { proximo: 1 };
    const ncf = tipoNcf + String(serie.proximo).padStart(8,'0');
    serie.proximo++; n.ncf[tipoNcf] = serie;
    Repo.configSet('numeraciones', n);
    return ncf;
  },

  /* ================= CÁLCULO DE LÍNEAS ================= */
  /* Precios SIN ITBIS: el impuesto se agrega por línea según su tasa. */

  calcularLineas(lineasRaw){
    /* Acepta líneas de catálogo (itemId) o libres (solo nombre), igual que Compras */
    const lineas = (lineasRaw || [])
      .filter(l => l && (l.itemId || String(l.nombre||'').trim()) && U.num(l.cant) > 0)
      .map(l => {
        const cant   = U.num(l.cant);
        const precio = U.round2(U.num(l.precio));
        const tasa   = U.num(l.tasa);
        const importe = U.round2(cant * precio);
        const itbis   = U.round2(importe * tasa / 100);
        return { itemId:l.itemId || null, nombre:String(l.nombre||'').trim(), unidad:l.unidad || '', cant, precio, tasa, importe, itbis };
      });
    const subtotal = U.round2(lineas.reduce((s,l) => s + l.importe, 0));
    const itbis    = U.round2(lineas.reduce((s,l) => s + l.itbis, 0));
    const total    = U.round2(subtotal + itbis);
    return { lineas, subtotal, itbis, total };
  },

  pendiente(v){ return U.round2(U.num(v.total) - U.num(v.cobrado)); },

  _estadoVenta(v){
    if(v.estado === 'anulada') return 'anulada';
    const p = Ops.pendiente(v);
    if(U.num(v.cobrado) <= 0.009) return 'pendiente';
    return p <= 0.009 ? 'pagada' : 'parcial';
  },

  /* ================= VENTAS ================= */

  async crearVenta(d){
    const cliente = await Repo.get('clientes', d.clienteId);
    if(!cliente) throw new Error('Selecciona un cliente.');
    const calc = Ops.calcularLineas(d.lineas);
    if(!calc.lineas.length) throw new Error('Agrega al menos una línea con cantidad.');

    const fecha = d.fecha || U.hoy();
    const condicion = d.condicion === 'credito' ? 'credito' : 'contado';
    const vence = condicion === 'credito'
      ? U.addDays(fecha, U.num(d.diasCredito) || ERP.diasCreditoDefault)
      : fecha;

    const venta = await Repo.create('ventas', {
      numero: Ops.siguienteNumero('factura'),
      ncfTipo: d.tipoNcf || 'SIN',
      ncf: Ops.ncfSiguiente(d.tipoNcf),
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteRnc: cliente.rnc || '',
      fecha, condicion, vence,
      lineas: calc.lineas,
      subtotal: calc.subtotal, itbis: calc.itbis, total: calc.total,
      cobrado: 0, estado: 'pendiente',
      notas: d.notas || '',
      origenCotId: d.origenCotId || null,
    });

    if(d.origenCotId){
      await Repo.update('cotizaciones', d.origenCotId, { estado:'convertida', ventaId: venta.id });
    }

    Repo.log('Ventas','Creó factura', `${venta.numero} · ${cliente.nombre} · ${U.fmtMoney(venta.total)}`);
    Bus.emit('VENTA_CREADA', venta);
    return venta;
  },

  async anularVenta(id){
    const v = await Repo.get('ventas', id);
    if(!v) throw new Error('Factura no encontrada.');
    if(U.num(v.cobrado) > 0.009) throw new Error('Tiene cobros registrados. Anula primero los cobros.');
    const upd = await Repo.update('ventas', id, { estado:'anulada' });
    Repo.log('Ventas','Anuló factura', `${v.numero} · ${v.clienteNombre}`);
    Bus.emit('VENTA_ANULADA', upd);
    return upd;
  },

  /* ================= COTIZACIONES ================= */

  async crearCotizacion(d){
    const cliente = await Repo.get('clientes', d.clienteId);
    if(!cliente) throw new Error('Selecciona un cliente.');
    const calc = Ops.calcularLineas(d.lineas);
    if(!calc.lineas.length) throw new Error('Agrega al menos una línea con cantidad.');

    const fecha = d.fecha || U.hoy();
    const cot = await Repo.create('cotizaciones', {
      numero: Ops.siguienteNumero('cotizacion'),
      clienteId: cliente.id, clienteNombre: cliente.nombre,
      fecha,
      vence: U.addDays(fecha, U.num(d.diasValidez) || ERP.diasValidezCotizacion),
      lineas: calc.lineas,
      subtotal: calc.subtotal, itbis: calc.itbis, total: calc.total,
      estado:'abierta', notas: d.notas || '',
    });
    Repo.log('Ventas','Creó cotización', `${cot.numero} · ${cliente.nombre} · ${U.fmtMoney(cot.total)}`);
    Bus.emit('COT_CREADA', cot);
    return cot;
  },

  async estadoCotizacion(id, estado){
    const c = await Repo.update('cotizaciones', id, { estado });
    if(c){ Repo.log('Ventas','Cotización '+estado, c.numero); Bus.emit('COT_ACTUALIZADA', c); }
    return c;
  },

  /* ================= COBROS ================= */

  async registrarCobro(d){
    const v = await Repo.get('ventas', d.ventaId);
    if(!v) throw new Error('Selecciona el documento a cobrar.');
    if(v.estado === 'anulada') throw new Error('La factura está anulada.');
    /* monto = dinero que entra a la cuenta.
       retItbis / retIsr = lo que el cliente retuvo y paga a la DGII por ti:
       NO entra a caja, pero SÍ salda la factura. Sin esto, una factura con
       retención queda "parcial" para siempre. */
    const monto    = U.round2(U.num(d.monto));
    const retItbis = U.round2(U.num(d.retItbis));
    const retIsr   = U.round2(U.num(d.retIsr));
    const aplicado = U.round2(monto + retItbis + retIsr);
    const pend = Ops.pendiente(v);

    if(monto < 0 || retItbis < 0 || retIsr < 0) throw new Error('Los montos no pueden ser negativos.');
    if(aplicado <= 0) throw new Error('Indica el monto recibido o la retención aplicada.');
    if(aplicado > pend + 0.01) throw new Error(`El cobro más las retenciones superan el pendiente (${U.fmtMoney(pend)}).`);

    let cuenta = null;
    if(monto > 0){
      cuenta = await Repo.get('cuentas', d.cuentaId);
      if(!cuenta) throw new Error('Selecciona la cuenta que recibe el dinero.');
    }

    const cobro = await Repo.create('cobros', {
      ventaId: v.id, ventaNumero: v.numero,
      clienteId: v.clienteId, clienteNombre: v.clienteNombre,
      fecha: d.fecha || U.hoy(),
      metodo: monto > 0 ? (d.metodo || 'Efectivo') : 'Retención',
      cuentaId: cuenta ? cuenta.id : null,
      cuentaNombre: cuenta ? cuenta.nombre : '',
      monto, retItbis, retIsr, aplicado, nota: d.nota || '',
    });

    const cobrado = U.round2(U.num(v.cobrado) + aplicado);
    const estado  = Ops._estadoVenta({ ...v, cobrado });
    await Repo.update('ventas', v.id, { cobrado, estado });

    if(monto > 0){
      await Repo.create('movimientos', {
        fecha: cobro.fecha, tipo:'entrada', cuentaId: cuenta.id,
        concepto: `Cobro ${v.numero} — ${v.clienteNombre}`,
        monto, origen:'cobro', refId: cobro.id,
      });
    }

    const detRet = (retItbis + retIsr) > 0 ? ` · retenido ${U.fmtMoney(retItbis + retIsr)}` : '';
    Repo.log('Cobros','Registró cobro', `${v.numero} · ${U.fmtMoney(monto)}${detRet} · ${cobro.metodo}`);
    Bus.emit('COBRO_CREADO', cobro);
    return cobro;
  },

  async anularCobro(id){
    const c = await Repo.get('cobros', id);
    if(!c) throw new Error('Cobro no encontrado.');
    await Repo.remove('cobros', id);

    const movs = await Repo.list('movimientos');
    const mov = movs.find(m => m.refId === id);
    if(mov) await Repo.remove('movimientos', mov.id);

    const v = await Repo.get('ventas', c.ventaId);
    if(v){
      const aplicado = U.num(c.aplicado) || U.num(c.monto);   // cobros viejos: sin retención
      const cobrado = U.round2(Math.max(0, U.num(v.cobrado) - aplicado));
      await Repo.update('ventas', v.id, { cobrado, estado: Ops._estadoVenta({ ...v, cobrado }) });
    }
    Repo.log('Cobros','Anuló cobro', `${c.ventaNumero} · ${U.fmtMoney(c.monto)}`);
    Bus.emit('COBRO_ANULADO', c);
    return true;
  },

  /* ================= COMPRAS ================= */
  /* Las líneas pueden ser de catálogo (itemId) o libres (solo nombre):
     gastos como internet o papelería no necesitan existir en Maestros.
     Solo las líneas de catálogo con "controlar inventario" mueven stock. */

  calcularLineasCompra(lineasRaw){
    const lineas = (lineasRaw || [])
      .filter(l => l && (l.itemId || String(l.nombre||'').trim()) && U.num(l.cant) > 0)
      .map(l => {
        const cant  = U.num(l.cant);
        const costo = U.round2(U.num(l.costo));
        const tasa  = U.num(l.tasa);
        const importe = U.round2(cant * costo);
        const itbis   = U.round2(importe * tasa / 100);
        return { itemId: l.itemId || null, nombre: String(l.nombre||'').trim(), unidad: l.unidad || '',
                 cant, costo, tasa, importe, itbis };
      });
    const subtotal = U.round2(lineas.reduce((s,l) => s + l.importe, 0));
    const itbis    = U.round2(lineas.reduce((s,l) => s + l.itbis, 0));
    return { lineas, subtotal, itbis, total: U.round2(subtotal + itbis) };
  },

  pendienteCompra(c){ return U.round2(U.num(c.total) - U.num(c.pagado)); },

  _estadoCompra(c){
    if(c.estado === 'anulada') return 'anulada';
    if(U.num(c.pagado) <= 0.009) return 'pendiente';
    return Ops.pendienteCompra(c) <= 0.009 ? 'pagada' : 'parcial';
  },

  async crearCompra(d){
    const prov = await Repo.get('proveedores', d.proveedorId);
    if(!prov) throw new Error('Selecciona un proveedor.');
    const calc = Ops.calcularLineasCompra(d.lineas);
    if(!calc.lineas.length) throw new Error('Agrega al menos una línea con cantidad.');

    const fecha = d.fecha || U.hoy();
    const condicion = d.condicion === 'credito' ? 'credito' : 'contado';
    const vence = condicion === 'credito'
      ? U.addDays(fecha, U.num(d.diasCredito) || ERP.diasCreditoDefault)
      : fecha;

    const compra = await Repo.create('compras', {
      numero: Ops.siguienteNumero('compra'),
      proveedorId: prov.id, proveedorNombre: prov.nombre, proveedorRnc: prov.rnc || '',
      ncfProveedor: String(d.ncfProveedor || '').trim().toUpperCase(),
      fecha, condicion, vence,
      lineas: calc.lineas,
      subtotal: calc.subtotal, itbis: calc.itbis, total: calc.total,
      pagado: 0, estado:'pendiente',
      notas: d.notas || '',
    });
    Repo.log('Compras','Registró compra', `${compra.numero} · ${prov.nombre} · ${U.fmtMoney(compra.total)}`);
    Bus.emit('COMPRA_CREADA', compra);
    return compra;
  },

  async anularCompra(id){
    const c = await Repo.get('compras', id);
    if(!c) throw new Error('Compra no encontrada.');
    if(U.num(c.pagado) > 0.009) throw new Error('Tiene pagos registrados. Anula primero los pagos.');
    const upd = await Repo.update('compras', id, { estado:'anulada' });
    Repo.log('Compras','Anuló compra', `${c.numero} · ${c.proveedorNombre}`);
    Bus.emit('COMPRA_ANULADA', upd);
    return upd;
  },

  /* ================= PAGOS A PROVEEDORES ================= */

  async registrarPago(d){
    const c = await Repo.get('compras', d.compraId);
    if(!c) throw new Error('Selecciona la compra a pagar.');
    if(c.estado === 'anulada') throw new Error('La compra está anulada.');
    const cuenta = await Repo.get('cuentas', d.cuentaId);
    if(!cuenta) throw new Error('Selecciona la cuenta de donde sale el dinero.');

    const monto = U.round2(U.num(d.monto));
    const pend = Ops.pendienteCompra(c);
    if(monto <= 0) throw new Error('El monto debe ser mayor que cero.');
    if(monto > pend + 0.01) throw new Error(`El monto supera el pendiente (${U.fmtMoney(pend)}).`);

    const pago = await Repo.create('pagos', {
      compraId: c.id, compraNumero: c.numero,
      proveedorId: c.proveedorId, proveedorNombre: c.proveedorNombre,
      fecha: d.fecha || U.hoy(),
      metodo: d.metodo || 'Efectivo',
      cuentaId: cuenta.id, cuentaNombre: cuenta.nombre,
      monto, nota: d.nota || '',
    });

    const pagado = U.round2(U.num(c.pagado) + monto);
    await Repo.update('compras', c.id, { pagado, estado: Ops._estadoCompra({ ...c, pagado }) });

    await Repo.create('movimientos', {
      fecha: pago.fecha, tipo:'salida', cuentaId: cuenta.id,
      concepto: `Pago ${c.numero} — ${c.proveedorNombre}`,
      monto, origen:'pago', refId: pago.id,
    });

    Repo.log('Pagos','Registró pago', `${c.numero} · ${U.fmtMoney(monto)} · ${pago.metodo}`);
    Bus.emit('PAGO_CREADO', pago);
    return pago;
  },

  async anularPago(id){
    const p = await Repo.get('pagos', id);
    if(!p) throw new Error('Pago no encontrado.');
    await Repo.remove('pagos', id);

    const movs = await Repo.list('movimientos');
    const mov = movs.find(m => m.refId === id);
    if(mov) await Repo.remove('movimientos', mov.id);

    const c = await Repo.get('compras', p.compraId);
    if(c){
      const pagado = U.round2(Math.max(0, U.num(c.pagado) - p.monto));
      await Repo.update('compras', c.id, { pagado, estado: Ops._estadoCompra({ ...c, pagado }) });
    }
    Repo.log('Pagos','Anuló pago', `${p.compraNumero} · ${U.fmtMoney(p.monto)}`);
    Bus.emit('PAGO_ANULADO', p);
    return true;
  },

  /* ================= INVENTARIO ================= */
  /* El stock nunca se guarda: se calcula (como los saldos de caja):
     stock = ajustes ± compras (+) − ventas (−), solo docs no anulados
     y solo artículos con "controlar inventario". */

  _sumaLineas(docs, itemId){
    return docs.filter(x => x.estado !== 'anulada')
      .reduce((s,x) => s + (x.lineas||[]).filter(l => l.itemId === itemId)
        .reduce((a,l) => a + U.num(l.cant), 0), 0);
  },

  async inventario(){
    const [items, compras, ventas, ajustes] = await Promise.all([
      Repo.list('items'), Repo.list('compras'), Repo.list('ventas'), Repo.list('ajustes'),
    ]);
    return items
      .filter(i => i.controlaInventario && i.tipo === 'articulo')
      .map(i => {
        const entradas = Ops._sumaLineas(compras, i.id);
        const salidas  = Ops._sumaLineas(ventas, i.id);
        const ajuste   = ajustes.filter(a => a.itemId === i.id).reduce((s,a) => s + U.num(a.cantidad), 0);
        const stock = U.round2(ajuste + entradas - salidas);
        const minimo = U.num(i.stockMinimo);
        const estadoStock = stock <= 0 ? 'sin' : (minimo > 0 && stock <= minimo ? 'bajo' : 'ok');
        return { item:i, stock, minimo, entradas, salidas, ajuste,
                 valor: stock > 0 ? U.round2(stock * U.num(i.costo)) : 0, estadoStock };
      })
      .sort((a,b) => a.item.nombre.localeCompare(b.item.nombre));
  },

  async kardex(itemId = null){
    const [items, compras, ventas, ajustes] = await Promise.all([
      Repo.list('items'), Repo.list('compras'), Repo.list('ventas'), Repo.list('ajustes'),
    ]);
    const controlados = new Set(items.filter(i => i.controlaInventario && i.tipo === 'articulo').map(i => i.id));
    const nombre = id => (items.find(i => i.id === id) || {}).nombre || '';
    const movs = [];
    for(const c of compras.filter(x => x.estado !== 'anulada'))
      for(const l of c.lineas || []) if(l.itemId && controlados.has(l.itemId))
        movs.push({ fecha:c.fecha, creado:c.creado, itemId:l.itemId, itemNombre:nombre(l.itemId),
                    tipo:'compra', cant:U.num(l.cant), ref:`${c.numero} · ${c.proveedorNombre}` });
    for(const v of ventas.filter(x => x.estado !== 'anulada'))
      for(const l of v.lineas || []) if(l.itemId && controlados.has(l.itemId))
        movs.push({ fecha:v.fecha, creado:v.creado, itemId:l.itemId, itemNombre:nombre(l.itemId),
                    tipo:'venta', cant:-U.num(l.cant), ref:`${v.numero} · ${v.clienteNombre}` });
    for(const a of ajustes)
      movs.push({ fecha:a.fecha, creado:a.creado, itemId:a.itemId, itemNombre:a.itemNombre,
                  tipo:'ajuste', cant:U.num(a.cantidad), ref:a.motivo });
    return movs
      .filter(m => !itemId || m.itemId === itemId)
      .sort((a,b) => b.fecha.localeCompare(a.fecha) || String(b.creado||'').localeCompare(a.creado||''));
  },

  async crearAjuste(d){
    const item = await Repo.get('items', d.itemId);
    if(!item) throw new Error('Selecciona el artículo.');
    if(!item.controlaInventario) throw new Error('Ese artículo no controla inventario.');
    const cantidad = U.num(d.cantidad);
    if(!cantidad) throw new Error('La cantidad no puede ser cero.');
    if(!String(d.motivo||'').trim()) throw new Error('Escribe el motivo del ajuste.');

    const aj = await Repo.create('ajustes', {
      itemId: item.id, itemNombre: item.nombre,
      fecha: d.fecha || U.hoy(), cantidad, motivo: d.motivo.trim(),
    });
    Repo.log('Inventario','Ajuste de stock', `${item.nombre} · ${cantidad > 0 ? '+' : ''}${cantidad} · ${aj.motivo}`);
    Bus.emit('AJUSTE_CREADO', aj);
    return aj;
  },

  async eliminarAjuste(id){
    const a = await Repo.get('ajustes', id);
    if(!a) throw new Error('Ajuste no encontrado.');
    await Repo.remove('ajustes', id);
    Repo.log('Inventario','Eliminó ajuste', `${a.itemNombre} · ${a.cantidad > 0 ? '+' : ''}${a.cantidad}`);
    Bus.emit('AJUSTE_ELIMINADO', a);
    return true;
  },

  /* ================= ÓRDENES DE SERVICIO ================= */
  /* El objeto del cliente y su recorrido: recibido → en proceso →
     listo → entregado. Facturar la orden crea la venta y las enlaza. */

  _flujoOrden: ['recibido','proceso','listo','entregado'],

  async crearOrden(d){
    const cli = await Repo.get('clientes', d.clienteId);
    if(!cli) throw new Error('Selecciona un cliente.');
    if(!String(d.equipo||'').trim()) throw new Error('Describe el equipo u objeto recibido.');
    const orden = await Repo.create('ordenes', {
      numero: Ops.siguienteNumero('orden'),
      clienteId: cli.id, clienteNombre: cli.nombre,
      equipo: d.equipo.trim(), falla: String(d.falla||'').trim(),
      diagnostico: String(d.diagnostico||'').trim(), tecnico: String(d.tecnico||'').trim(),
      fecha: d.fecha || U.hoy(), fechaPromesa: d.fechaPromesa || '',
      estado:'recibido', facturaId:null, facturaNumero:'',
      notas: d.notas || '',
    });
    Repo.log('Órdenes','Creó orden', `${orden.numero} · ${cli.nombre} · ${orden.equipo}`);
    Bus.emit('ORDEN_CREADA', orden);
    return orden;
  },

  async actualizarOrden(id, campos){
    const o = await Repo.get('ordenes', id);
    if(!o) throw new Error('Orden no encontrada.');
    const upd = await Repo.update('ordenes', id, campos);
    Bus.emit('ORDEN_ACTUALIZADA', upd);
    return upd;
  },

  async cambiarEstadoOrden(id, estado){
    if(!Ops._flujoOrden.includes(estado)) throw new Error('Estado inválido.');
    const o = await Repo.get('ordenes', id);
    if(!o) throw new Error('Orden no encontrada.');
    if(o.estado === 'anulada') throw new Error('La orden está anulada.');
    const upd = await Repo.update('ordenes', id, { estado });
    Repo.log('Órdenes','Cambió estado', `${o.numero} → ${ERP.estadosOrden[estado].label}`);
    Bus.emit('ORDEN_ACTUALIZADA', upd);
    return upd;
  },

  async avanzarOrden(id){
    const o = await Repo.get('ordenes', id);
    if(!o) throw new Error('Orden no encontrada.');
    const i = Ops._flujoOrden.indexOf(o.estado);
    if(i < 0 || i >= Ops._flujoOrden.length - 1) return o;
    return Ops.cambiarEstadoOrden(id, Ops._flujoOrden[i + 1]);
  },

  async anularOrden(id){
    const o = await Repo.get('ordenes', id);
    if(!o) throw new Error('Orden no encontrada.');
    if(o.facturaId) throw new Error('La orden ya tiene factura. Anula primero la factura en Ventas.');
    const upd = await Repo.update('ordenes', id, { estado:'anulada' });
    Repo.log('Órdenes','Anuló orden', o.numero);
    Bus.emit('ORDEN_ACTUALIZADA', upd);
    return upd;
  },

  async enlazarFacturaOrden(ordenId, venta){
    const o = await Repo.get('ordenes', ordenId);
    if(!o) return null;
    const campos = { facturaId: venta.id, facturaNumero: venta.numero };
    if(Ops._flujoOrden.includes(o.estado)) campos.estado = 'entregado';
    const upd = await Repo.update('ordenes', ordenId, campos);
    Repo.log('Órdenes','Facturó orden', `${o.numero} → ${venta.numero}`);
    Bus.emit('ORDEN_ACTUALIZADA', upd);
    return upd;
  },

  /* ================= CAJA Y BANCOS ================= */

  async crearMovimiento(d){
    const cuenta = await Repo.get('cuentas', d.cuentaId);
    if(!cuenta) throw new Error('Selecciona la cuenta.');
    const monto = U.round2(U.num(d.monto));
    if(monto <= 0) throw new Error('El monto debe ser mayor que cero.');
    if(!String(d.concepto||'').trim()) throw new Error('Escribe el concepto.');

    const mov = await Repo.create('movimientos', {
      fecha: d.fecha || U.hoy(),
      tipo: d.tipo === 'salida' ? 'salida' : 'entrada',
      cuentaId: cuenta.id, concepto: d.concepto.trim(),
      monto, origen:'manual', refId:null,
    });
    Repo.log('Caja', d.tipo === 'salida' ? 'Registró salida' : 'Registró entrada',
      `${cuenta.nombre} · ${U.fmtMoney(monto)} · ${mov.concepto}`);
    Bus.emit('MOV_CREADO', mov);
    return mov;
  },

  async transferir(d){
    const origen  = await Repo.get('cuentas', d.origenId);
    const destino = await Repo.get('cuentas', d.destinoId);
    if(!origen || !destino) throw new Error('Selecciona cuenta de origen y destino.');
    if(origen.id === destino.id) throw new Error('Origen y destino no pueden ser la misma cuenta.');
    const monto = U.round2(U.num(d.monto));
    if(monto <= 0) throw new Error('El monto debe ser mayor que cero.');

    const mov = await Repo.create('movimientos', {
      fecha: d.fecha || U.hoy(), tipo:'transferencia',
      cuentaId: origen.id, cuentaDestinoId: destino.id,
      concepto: d.concepto ? d.concepto.trim() : `Transferencia ${origen.nombre} → ${destino.nombre}`,
      monto, origen:'manual', refId:null,
    });
    Repo.log('Caja','Transferencia', `${origen.nombre} → ${destino.nombre} · ${U.fmtMoney(monto)}`);
    Bus.emit('MOV_CREADO', mov);
    return mov;
  },

  async eliminarMovimiento(id){
    const movs = await Repo.list('movimientos');
    const m = movs.find(x => x.id === id);
    if(!m) throw new Error('Movimiento no encontrado.');
    if(m.origen === 'cobro') throw new Error('Este movimiento nació de un cobro. Anúlalo dentro de la factura, en Ventas.');
    if(m.origen === 'pago')  throw new Error('Este movimiento nació de un pago. Anúlalo dentro de la compra, en Compras.');
    if(m.origen !== 'manual') throw new Error('Este movimiento es automático y no se puede eliminar aquí.');
    await Repo.remove('movimientos', id);
    Repo.log('Caja','Eliminó movimiento', `${m.concepto} · ${U.fmtMoney(m.monto)}`);
    Bus.emit('MOV_ELIMINADO', m);
    return true;
  },

  saldoCuenta(cuenta, movimientos){
    let s = U.num(cuenta.saldoInicial);
    for(const m of movimientos){
      if(m.tipo === 'entrada' && m.cuentaId === cuenta.id) s += m.monto;
      else if(m.tipo === 'salida' && m.cuentaId === cuenta.id) s -= m.monto;
      else if(m.tipo === 'transferencia'){
        if(m.cuentaId === cuenta.id) s -= m.monto;
        if(m.cuentaDestinoId === cuenta.id) s += m.monto;
      }
    }
    return U.round2(s);
  },

  async saldos(){
    const [cuentas, movs] = await Promise.all([Repo.list('cuentas'), Repo.list('movimientos')]);
    return cuentas.map(c => ({ cuenta:c, saldo: Ops.saldoCuenta(c, movs) }));
  },

  /* ================= USOS (para borrado seguro en Maestros) ================= */

  async usosCliente(id){
    const [v,c,co,ord] = await Promise.all([
      Repo.list('ventas'), Repo.list('cotizaciones'), Repo.list('cobros'), Repo.list('ordenes'),
    ]);
    return v.filter(x=>x.clienteId===id).length + c.filter(x=>x.clienteId===id).length
         + co.filter(x=>x.clienteId===id).length + ord.filter(x=>x.clienteId===id).length;
  },
  async usosItem(id){
    const [v,c,co,aj] = await Promise.all([
      Repo.list('ventas'), Repo.list('cotizaciones'), Repo.list('compras'), Repo.list('ajustes'),
    ]);
    const en = arr => arr.reduce((s,d)=> s + (d.lineas||[]).filter(l=>l.itemId===id).length, 0);
    return en(v) + en(c) + en(co) + aj.filter(a=>a.itemId===id).length;
  },
  async usosProveedor(id){
    const [c,p] = await Promise.all([Repo.list('compras'), Repo.list('pagos')]);
    return c.filter(x=>x.proveedorId===id).length + p.filter(x=>x.proveedorId===id).length;
  },
  async usosCuenta(id){
    const [m,co,pa] = await Promise.all([Repo.list('movimientos'), Repo.list('cobros'), Repo.list('pagos')]);
    return m.filter(x=>x.cuentaId===id || x.cuentaDestinoId===id).length
         + co.filter(x=>x.cuentaId===id).length + pa.filter(x=>x.cuentaId===id).length;
  },

  /* ================= ESTADÍSTICAS (Dashboard / Inicio) ================= */

  async stats(){
    const [ventasT, cotizaciones, cobros, cuentas, movs, clientes, items, comprasT, pagos] = await Promise.all([
      Repo.list('ventas'), Repo.list('cotizaciones'), Repo.list('cobros'),
      Repo.list('cuentas'), Repo.list('movimientos'), Repo.list('clientes'), Repo.list('items'),
      Repo.list('compras'), Repo.list('pagos'),
    ]);
    const ordenes = await Repo.list('ordenes');
    const hoy = U.hoy();
    const ventas = ventasT.filter(v => v.estado !== 'anulada');

    const ventasHoy = ventas.filter(v => v.fecha === hoy);
    const ventasMes = ventas.filter(v => U.esMesActual(v.fecha));
    const facturadoMes = U.round2(ventasMes.reduce((s,v)=>s+v.total,0));

    const pendientes = ventas.filter(v => Ops.pendiente(v) > 0.009);
    const vencidas   = pendientes.filter(v => v.vence < hoy);
    const porVencer7 = pendientes.filter(v => v.vence >= hoy && v.vence <= U.addDays(hoy,7));

    const sal = await Ops.saldos();
    const saldoCaja   = U.round2(sal.filter(s=>s.cuenta.tipo==='caja').reduce((a,s)=>a+s.saldo,0));
    const saldoBancos = U.round2(sal.filter(s=>s.cuenta.tipo==='banco').reduce((a,s)=>a+s.saldo,0));

    const compras = comprasT.filter(c => c.estado !== 'anulada');
    const comprasMes = compras.filter(c => U.esMesActual(c.fecha));
    const cxp = compras.filter(c => Ops.pendienteCompra(c) > 0.009);
    const cxpVencidas = cxp.filter(c => c.vence < hoy);

    const inv = await Ops.inventario();

    const movsMes = movs.filter(m => U.esMesActual(m.fecha));
    const entradasMes = U.round2(movsMes.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+m.monto,0));
    const salidasMes  = U.round2(movsMes.filter(m=>m.tipo==='salida').reduce((s,m)=>s+m.monto,0));

    return {
      ventasHoyCant: ventasHoy.length,
      ventasHoyMonto: U.round2(ventasHoy.reduce((s,v)=>s+v.total,0)),
      ventasMesCant: ventasMes.length,
      facturadoMes,
      ticketPromedio: ventasMes.length ? U.round2(facturadoMes/ventasMes.length) : 0,
      cotAbiertas: cotizaciones.filter(c=>c.estado==='abierta').length,

      cobradoHoy: U.round2(cobros.filter(c=>c.fecha===hoy).reduce((s,c)=>s+c.monto,0)),
      cobradoMes: U.round2(cobros.filter(c=>U.esMesActual(c.fecha)).reduce((s,c)=>s+c.monto,0)),
      porCobrar: U.round2(pendientes.reduce((s,v)=>s+Ops.pendiente(v),0)),
      vencidoMonto: U.round2(vencidas.reduce((s,v)=>s+Ops.pendiente(v),0)),
      vencidoCant: vencidas.length,
      porVencer7Monto: U.round2(porVencer7.reduce((s,v)=>s+Ops.pendiente(v),0)),

      saldoCaja, saldoBancos,
      saldoTotal: U.round2(saldoCaja + saldoBancos),
      entradasMes, salidasMes,
      flujoMes: U.round2(entradasMes - salidasMes),

      comprasMesCant: comprasMes.length,
      comprasMesMonto: U.round2(comprasMes.reduce((s,c)=>s+c.total,0)),
      pagadoMes: U.round2(pagos.filter(p=>U.esMesActual(p.fecha)).reduce((s,p)=>s+p.monto,0)),
      porPagar: U.round2(cxp.reduce((s,c)=>s+Ops.pendienteCompra(c),0)),
      cxpVencidoMonto: U.round2(cxpVencidas.reduce((s,c)=>s+Ops.pendienteCompra(c),0)),
      cxpVencidoCant: cxpVencidas.length,

      invControlados: inv.length,
      invValor: U.round2(inv.reduce((s,r)=>s+r.valor,0)),
      invBajo: inv.filter(r=>r.estadoStock==='bajo').length,
      invSin: inv.filter(r=>r.estadoStock==='sin').length,

      ordRecibidas: ordenes.filter(o=>o.estado==='recibido').length,
      ordProceso:   ordenes.filter(o=>o.estado==='proceso').length,
      ordListas:    ordenes.filter(o=>o.estado==='listo').length,
      ordEntregadasMes: ordenes.filter(o=>o.estado==='entregado' && U.esMesActual(o.fecha)).length,

      clientesActivos: clientes.filter(c=>c.activo!==false).length,
      itemsActivos: items.filter(i=>i.activo!==false).length,
    };
  },

  /* ================= BÚSQUEDA GLOBAL ================= */

  async buscar(q){
    q = String(q||'').trim().toLowerCase();
    if(q.length < 2) return null;
    const [clientes, proveedores, items, ventas, cotizaciones, compras] = await Promise.all([
      Repo.list('clientes'), Repo.list('proveedores'), Repo.list('items'),
      Repo.list('ventas'), Repo.list('cotizaciones'), Repo.list('compras'),
    ]);
    const m = (...campos) => campos.some(c => String(c||'').toLowerCase().includes(q));
    return {
      clientes:     clientes.filter(c => m(c.nombre,c.rnc,c.codigo,c.telefono)).slice(0,5),
      proveedores:  proveedores.filter(p => m(p.nombre,p.rnc,p.codigo)).slice(0,5),
      items:        items.filter(i => m(i.nombre,i.codigo)).slice(0,5),
      ventas:       ventas.filter(v => m(v.numero,v.clienteNombre,v.ncf)).slice(0,5),
      cotizaciones: cotizaciones.filter(c => m(c.numero,c.clienteNombre)).slice(0,5),
      compras:      compras.filter(c => m(c.numero,c.proveedorNombre,c.ncfProveedor)).slice(0,5),
      ordenes:      (await Repo.list('ordenes')).filter(o => m(o.numero,o.clienteNombre,o.equipo)).slice(0,5),
    };
  },
};

/* ============================================================
   SEED — Datos demo (empresa dominicana de servicios)
   ============================================================ */

const Seed = {

  async siVacio(){
    if(Repo.hayDatos()) return false;
    await Seed.crearDemo();
    return true;
  },

  async crearDemo(){
    const H = U.hoy();
    const d = n => U.addDays(H, n);

    Repo.configSet('empresa', {
      nombre:'Servitec RD SRL', rnc:'131-56789-2', telefono:'(809) 555-4021',
      email:'info@servitecrd.do', direccion:'Av. San Vicente de Paúl #45, Los Mina',
      ciudad:'Santo Domingo Este, R.D.',
    });
    Repo.configSet('numeraciones', JSON.parse(JSON.stringify(ERP.numeracionesDefault)));

    /* ---- Maestros base ---- */
    const impItbis  = await Repo.create('impuestos', { nombre:'ITBIS 18%', tasa:18 });
    const impExento = await Repo.create('impuestos', { nombre:'Exento', tasa:0 });

    for(const n of ['Unidad','Hora','Mes','Punto','Visita']) await Repo.create('unidades', { nombre:n });
    for(const n of ['Seguridad','Climatización','Redes','Soporte','Consultoría','Equipos'])
      await Repo.create('categorias', { nombre:n });

    const cxCaja = await Repo.create('cuentas', { nombre:'Caja principal', tipo:'caja', banco:'', numero:'', saldoInicial:15000 });
    const cxBP   = await Repo.create('cuentas', { nombre:'Banco Popular', tipo:'banco', banco:'Banco Popular', numero:'****1234', saldoInicial:120000 });
    const cxBR   = await Repo.create('cuentas', { nombre:'Banreservas', tipo:'banco', banco:'Banreservas', numero:'****5678', saldoInicial:45000 });

    const cli = async (o) => Repo.create('clientes', { activo:true, ...o });
    const cFerre = await cli({ codigo:'CL-001', nombre:'Ferretería El Progreso SRL', rnc:'130-11223-4', telefono:'(809) 555-0134', email:'compras@elprogreso.do', tipo:'empresa' });
    const cSuper = await cli({ codigo:'CL-002', nombre:'Supermercado La Economía', rnc:'131-99887-1', telefono:'(809) 555-0872', email:'admin@laeconomia.do', tipo:'empresa' });
    const cDra   = await cli({ codigo:'CL-003', nombre:'Dra. Carmen Rosario', rnc:'001-1456789-1', telefono:'(829) 555-3311', email:'c.rosario@gmail.com', tipo:'persona' });
    const cHotel = await cli({ codigo:'CL-004', nombre:'Hotel Costa Verde', rnc:'130-77665-9', telefono:'(809) 555-6600', email:'gerencia@costaverde.do', tipo:'empresa' });
    const cCole  = await cli({ codigo:'CL-005', nombre:'Colegio San Judas Tadeo', rnc:'430-05544-2', telefono:'(809) 555-2140', email:'direccion@sanjudas.edu.do', tipo:'empresa' });
    const cJuan  = await cli({ codigo:'CL-006', nombre:'Juan Pérez', rnc:'', telefono:'(849) 555-7788', email:'', tipo:'persona' });

    const prov = async (o) => Repo.create('proveedores', { activo:true, ...o });
    const pDee   = await prov({ codigo:'PR-001', nombre:'Distribuidora Eléctrica del Este', rnc:'130-44556-7', telefono:'(809) 555-9080', email:'ventas@dee.do' });
    const pPapel = await prov({ codigo:'PR-002', nombre:'Papelería Central', rnc:'131-22334-5', telefono:'(809) 555-4455', email:'' });
    const pClaro = await prov({ codigo:'PR-003', nombre:'Claro Dominicana', rnc:'101-00157-7', telefono:'(809) 220-1111', email:'' });

    const it = async (o) => Repo.create('items', { activo:true, impuestoId:impItbis.id, tasa:18, controlaInventario:false, ...o });
    const iInst   = await it({ codigo:'SV-001', tipo:'servicio', nombre:'Instalación de cámaras de seguridad', categoria:'Seguridad', unidad:'Unidad', costo:0, precio:8500 });
    const iMant   = await it({ codigo:'SV-002', tipo:'servicio', nombre:'Mantenimiento de aires acondicionados', categoria:'Climatización', unidad:'Visita', costo:0, precio:3500 });
    const iSop    = await it({ codigo:'SV-003', tipo:'servicio', nombre:'Soporte técnico', categoria:'Soporte', unidad:'Hora', costo:0, precio:1200 });
    const iIguala = await it({ codigo:'SV-004', tipo:'servicio', nombre:'Iguala mensual de soporte', categoria:'Soporte', unidad:'Mes', costo:0, precio:15000 });
    const iCable  = await it({ codigo:'SV-005', tipo:'servicio', nombre:'Cableado estructurado', categoria:'Redes', unidad:'Punto', costo:0, precio:2200 });
    const iCons   = await it({ codigo:'SV-006', tipo:'servicio', nombre:'Consultoría de procesos', categoria:'Consultoría', unidad:'Hora', costo:0, precio:6000 });
    const iCam    = await it({ codigo:'AR-001', tipo:'articulo', nombre:'Cámara IP 4MP', categoria:'Equipos', unidad:'Unidad', costo:3800, precio:5900, controlaInventario:true, stockMinimo:5 });
    const iRout   = await it({ codigo:'AR-002', tipo:'articulo', nombre:'Router inalámbrico AC1200', categoria:'Equipos', unidad:'Unidad', costo:2100, precio:3400, controlaInventario:true, stockMinimo:3 });
    const iDvr    = await it({ codigo:'AR-003', tipo:'articulo', nombre:'Disco duro 1TB para DVR', categoria:'Equipos', unidad:'Unidad', costo:2900, precio:4300, controlaInventario:true, stockMinimo:2 });

    const L = (item, cant, precio) => ({ itemId:item.id, nombre:item.nombre, unidad:item.unidad, cant, precio: precio ?? item.precio, tasa:item.tasa });
    const V = (o) => Ops.crearVenta(o);
    const C = (ventaId, fecha, monto, metodo, cuentaId) => {
      return (async () => {
        const v = await Repo.get('ventas', ventaId);
        return Ops.registrarCobro({ ventaId: v.id, fecha, monto, metodo, cuentaId });
      })();
    };

    /* ---- Facturas del mes (con historias distintas) ---- */
    const f1 = await V({ clienteId:cHotel.id, fecha:d(-38), condicion:'credito', diasCredito:30, tipoNcf:'B01',
      lineas:[ L(iIguala,1), L(iSop,2) ], notas:'Iguala de junio + horas adicionales.' });
    await C(f1.id, d(-20), 10000, 'Transferencia', cxBP.id);          // parcial y ya vencida

    const f2 = await V({ clienteId:cFerre.id, fecha:d(-26), condicion:'contado', tipoNcf:'B01',
      lineas:[ L(iInst,1), L(iCam,4) ] });
    await C(f2.id, d(-26), f2.total, 'Transferencia', cxBP.id);       // pagada

    const f3 = await V({ clienteId:cCole.id, fecha:d(-19), condicion:'credito', diasCredito:30, tipoNcf:'B01',
      lineas:[ L(iCable,18) ], notas:'Cableado laboratorio de informática.' });
    await C(f3.id, d(-5), 20000, 'Cheque', cxBR.id);                  // parcial, por vencer

    const f4 = await V({ clienteId:cDra.id, fecha:d(-12), condicion:'contado', tipoNcf:'B02',
      lineas:[ L(iMant,2) ] });
    await C(f4.id, d(-12), f4.total, 'Efectivo', cxCaja.id);          // pagada

    await V({ clienteId:cSuper.id, fecha:d(-7), condicion:'credito', diasCredito:15, tipoNcf:'B01',
      lineas:[ L(iSop,6), L(iRout,1) ] });                            // pendiente

    const f6 = await V({ clienteId:cJuan.id, fecha:d(-2), condicion:'contado', tipoNcf:'B02',
      lineas:[ L(iCons,2) ] });
    await C(f6.id, d(-2), f6.total, 'Tarjeta', cxBP.id);              // pagada

    await V({ clienteId:cHotel.id, fecha:H, condicion:'credito', diasCredito:30, tipoNcf:'B01',
      lineas:[ L(iIguala,1) ], notas:'Iguala del mes en curso.' });   // pendiente (hoy)

    const f8 = await V({ clienteId:cFerre.id, fecha:H, condicion:'contado', tipoNcf:'B01',
      lineas:[ L(iMant,1) ] });
    await C(f8.id, H, f8.total, 'Efectivo', cxCaja.id);               // pagada (hoy)

    /* ---- Cotizaciones ---- */
    await Ops.crearCotizacion({ clienteId:cCole.id, fecha:d(-9), diasValidez:15,
      lineas:[ L(iCam,6), L(iInst,1) ], notas:'Ampliación de circuito de cámaras.' });
    const c2 = await Ops.crearCotizacion({ clienteId:cSuper.id, fecha:d(-4), diasValidez:15,
      lineas:[ L(iIguala,1) ] });
    await Ops.estadoCotizacion(c2.id, 'aceptada');
    await Ops.crearCotizacion({ clienteId:cDra.id, fecha:d(-15), diasValidez:15,
      lineas:[ L(iCable,8) ] });

    /* ---- Inventario inicial (ajustes) ---- */
    await Ops.crearAjuste({ itemId:iCam.id,  fecha:d(-45), cantidad:6, motivo:'Inventario inicial' });

    /* ---- Compras (con historias distintas, como las ventas) ---- */
    const LC = (item, cant, costo) => ({ itemId:item.id, nombre:item.nombre, unidad:item.unidad, cant, costo: costo ?? item.costo, tasa:item.tasa });
    const LL = (nombre, cant, costo, tasa=18) => ({ itemId:null, nombre, cant, costo, tasa });

    const co1 = await Ops.crearCompra({ proveedorId:pDee.id, fecha:d(-30), condicion:'contado',
      ncfProveedor:'B0100004512', lineas:[ LC(iCam,10), LC(iRout,3) ], notas:'Reposición de equipos.' });
    await Ops.registrarPago({ compraId:co1.id, fecha:d(-30), monto:co1.total, metodo:'Transferencia', cuentaId:cxBP.id }); // pagada

    const co2 = await Ops.crearCompra({ proveedorId:pPapel.id, fecha:d(-40), condicion:'credito', diasCredito:15,
      ncfProveedor:'B0200341009', lineas:[ LL('Material gastable de oficina', 1, 5600) ] });
    await Ops.registrarPago({ compraId:co2.id, fecha:d(-30), monto:3000, metodo:'Efectivo', cuentaId:cxCaja.id });         // parcial y vencida

    await Ops.crearCompra({ proveedorId:pClaro.id, fecha:d(-20), condicion:'credito', diasCredito:30,
      ncfProveedor:'B0100887210', lineas:[ LL('Internet dedicado 100MB — mensualidad', 1, 4200) ] });                       // pendiente, por vencer

    await Ops.crearCompra({ proveedorId:pDee.id, fecha:d(-8), condicion:'credito', diasCredito:30,
      ncfProveedor:'B0100004987', lineas:[ LC(iCam,4) ], notas:'Pedido para proyecto del colegio.' });                      // pendiente

    /* ---- Órdenes de servicio demo ---- */
    const o1 = await Ops.crearOrden({ clienteId:cDra.id, fecha:d(-1), equipo:'iPhone 13 — pantalla rota',
      falla:'Cayó al piso, no enciende la pantalla', fechaPromesa:d(2) });
    const o2 = await Ops.crearOrden({ clienteId:cFerre.id, fecha:d(-3), equipo:'DVR Hikvision 8 canales',
      falla:'No graba en la noche', tecnico:'Luis M.', fechaPromesa:d(1) });
    await Ops.cambiarEstadoOrden(o2.id, 'proceso');
    await Ops.actualizarOrden(o2.id, { diagnostico:'Disco duro con sectores dañados. Requiere reemplazo (AR-003).' });
    const o3 = await Ops.crearOrden({ clienteId:cHotel.id, fecha:d(-5), equipo:'Laptop HP recepción',
      falla:'Mantenimiento preventivo anual', tecnico:'Ramón P.', fechaPromesa:d(-1) });
    await Ops.cambiarEstadoOrden(o3.id, 'proceso');
    await Ops.cambiarEstadoOrden(o3.id, 'listo');

    /* ---- Movimientos manuales de caja ---- */
    await Ops.crearMovimiento({ tipo:'salida', cuentaId:cxCaja.id, fecha:d(-15), concepto:'Compra de materiales — ferretería', monto:6800 });
    await Ops.crearMovimiento({ tipo:'salida', cuentaId:cxBP.id,  fecha:d(-10), concepto:'Nómina quincena', monto:38000 });
    await Ops.crearMovimiento({ tipo:'salida', cuentaId:cxBP.id,  fecha:d(-3),  concepto:'Alquiler del local', monto:25000 });
    await Ops.transferir({ origenId:cxCaja.id, destinoId:cxBP.id, fecha:d(-6), monto:10000, concepto:'Depósito de efectivo' });

    Repo.log('Sistema','Datos demo creados','Empresa Servitec RD SRL');
    return true;
  },
};
