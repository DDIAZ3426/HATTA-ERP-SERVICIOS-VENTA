// ordenes.js — Órdenes de servicio (taller): recepción, estados y ticket
const OrdenesUI = {
  // Colores con significado: gris recibido, azul el taller trabaja, amarillo se espera a alguien, verde listo
  estados: {
    recibido:    { txt: 'Recibido',            color: '#64748b' },
    reparacion:  { txt: 'En reparación',       color: '#2563eb' },
    pieza:       { txt: 'Esperando repuesto',  color: '#d97706' },
    listo:       { txt: 'Listo para entregar', color: '#16a34a' },
    entregado:   { txt: 'Entregado',           color: '#94a3b8' },
    devuelto:    { txt: 'No reparado',         color: '#94a3b8' },
    // Estados de antes: solo para mostrar el historial viejo
    diagnostico: { txt: 'En diagnóstico',      color: '#2563eb' },
    aprobacion:  { txt: 'Esperando aprobación', color: '#d97706' }
  },
  // A qué estado se puede pasar desde cada uno
  siguientes: {
    recibido:   ['reparacion', 'pieza', 'devuelto'],
    reparacion: ['listo', 'pieza', 'devuelto'],
    pieza:      ['reparacion', 'devuelto'],
    listo:      ['entregado'],
    entregado:  [],
    devuelto:   []
  },
  cerrados: ['entregado', 'devuelto'],

  textoBoton(desde, hacia) {
    if (desde === 'pieza' && hacia === 'reparacion') return 'Llegó el repuesto';
    return { reparacion: 'En reparación', pieza: 'Esperando repuesto', listo: 'Listo para entregar',
      entregado: 'Entregar', devuelto: 'No reparado' }[hacia];
  },

  // Datos guardados antes de este módulo no traen numeración ni lista de órdenes
  asegurarDatos() {
    if (!Repo.data.numeraciones.os) Repo.data.numeraciones.os = { pre: 'OS-', prox: 1 };
    if (!Repo.data.ordenes) Repo.data.ordenes = [];
    if (!Repo.data.estadosTaller2) {
      Repo.data.ordenes.forEach(o => { if (['diagnostico', 'aprobacion'].includes(o.estado)) o.estado = 'recibido'; });
      Repo.data.estadosTaller2 = true;
      Repo.save();
    }
  },
  // Fecha de salida: se guarda al entregar o cerrar; las viejas se sacan del historial
  fechaSalida(o) {
    if (o.fechaSalida) return o.fechaSalida;
    if (!this.cerrados.includes(o.estado)) return '';
    const h = (o.historial || []).slice().reverse().find(x => this.cerrados.includes(x.estado));
    return h ? Utils.aTexto(new Date(h.fechaHora)) : '';
  },
  // Días en el taller: desde que se recibió hasta hoy (o hasta que salió)
  dias(o) {
    const fin = this.fechaSalida(o) || Utils.today();
    return Math.max(0, Math.round((Utils.aFecha(fin) - Utils.aFecha(o.fecha || fin)) / 864e5));
  },
  textoDias(n) { return n === 1 ? '1 día' : n + ' días'; },

  // Pasó la fecha prometida y el equipo todavía no está listo
  atrasada(o) {
    return !!o.prometido && o.prometido < Utils.today() && !['listo', ...this.cerrados].includes(o.estado);
  },

  // Factura de la orden: la que la cobró, o la del chequeo pagado al recibir
  textoFactura(o) {
    if (o.facturaNumero) return o.facturaNumero;
    if (o.pagoAdelantado && o.pagoAdelantado.tipo === 'chequeo') return 'Chequeo ' + o.pagoAdelantado.factura;
    return '';
  },
  // Cobrar desde el taller: abre la venta con la orden cargada
  cobrar(id) {
    App.navegar('ventas');
    setTimeout(() => VentasUI.nuevaDesdeOrden(id), 150);
  },

  pill(estado) {
    const e = this.estados[estado] || { txt: estado, color: '#64748b' };
    return `<span class="estado-pill" style="--c:${e.color}">${e.txt}</span>`;
  },


  render() {
    this.asegurarDatos();
    const activas = Repo.get('ordenes').filter(o => !this.cerrados.includes(o.estado));
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('os-kpi-activas', activas.length);
    set('os-kpi-reparacion', activas.filter(o => o.estado === 'reparacion').length);
    set('os-kpi-pieza', activas.filter(o => o.estado === 'pieza').length);
    set('os-kpi-listas', activas.filter(o => o.estado === 'listo').length);
    set('os-kpi-atrasadas', activas.filter(o => this.atrasada(o)).length);

    const q = (document.getElementById('os-buscar')?.value || '').toLowerCase().trim();
    let list = activas;
    if (q) list = list.filter(o => [o.numero, o.clienteNombre, o.clienteTel, o.equipo, o.imei, o.motivo, o.falla]
      .some(v => (v || '').toLowerCase().includes(q)));
    set('os-count', list.length + (list.length === 1 ? ' orden' : ' órdenes'));

    const tbody = document.getElementById('os-tbody');
    if (!tbody) return;
    // La que más tiempo lleva, arriba
    tbody.innerHTML = Utils.ordenarPorFecha(list, 'asc').map(o => {
      const d = this.dias(o);
      return `
      <tr class="fila-clic" onclick="OrdenesUI.abrir('${o.id}')">
        <td>${o.numero}</td>
        <td>${o.clienteNombre}</td>
        <td>${o.equipo}</td>
        <td>${Utils.formatDate(o.fecha)}</td>
        <td class="${d > 30 ? 'txt-atrasada' : ''}">${this.textoDias(d)}</td>
        <td class="${this.atrasada(o) ? 'txt-atrasada' : ''}">${o.prometido ? Utils.formatDate(o.prometido) : '—'}</td>
        <td>${this.pill(o.estado)}</td>
        <td><button class="btn btn-sm" onclick="event.stopPropagation();OrdenesUI.imprimir('${o.id}')">Ticket</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="8" class="muted">Sin órdenes activas</td></tr>';

    this.renderHistorial();
  },

  // Clic en un indicador: muestra solo esas órdenes
  verKpi(clave) {
    const key = 'os-tbody';
    if (!clave) return TablaX.limpiar(key);
    if (clave === 'atrasadas') {
      const atr = Repo.get('ordenes').filter(o => this.atrasada(o));
      return TablaX.filtrarVarios(key, { Prometido: atr.map(o => Utils.formatDate(o.prometido)),
        Estado: [...new Set(atr.map(o => this.estados[o.estado].txt))] });
    }
    TablaX.filtrarPorTitulo(key, 'Estado', [this.estados[clave].txt]);
  },

  renderHistorial() {
    const q = (document.getElementById('os-hist-buscar')?.value || '').toLowerCase().trim();
    let list = Repo.get('ordenes').filter(o => this.cerrados.includes(o.estado));
    if (q) list = list.filter(o => [o.numero, o.clienteNombre, o.clienteTel, o.equipo, o.imei, o.motivo, o.falla]
      .some(v => (v || '').toLowerCase().includes(q)));
    list = Utils.ordenarPorFecha(list); // más recientes primero en historial
    const count = document.getElementById('os-hist-count');
    if (count) count.textContent = list.length + (list.length === 1 ? ' orden' : ' órdenes');
    const tbody = document.getElementById('os-hist-tbody');
    if (!tbody) return;
    tbody.innerHTML = list.map(o => {
      const salida = this.fechaSalida(o);
      return `
      <tr class="fila-clic" onclick="OrdenesUI.abrir('${o.id}')">
        <td>${o.numero}</td>
        <td>${o.clienteNombre}</td>
        <td>${o.equipo}</td>
        <td>${Utils.formatDate(o.fecha)}</td>
        <td>${salida ? Utils.formatDate(salida) : '—'}</td>
        <td>${this.textoDias(this.dias(o))}</td>
        <td>${this.pill(o.estado)}</td>
        <td><button class="btn btn-sm" onclick="event.stopPropagation();OrdenesUI.imprimir('${o.id}')">Ticket</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="8" class="muted">Sin órdenes en historial</td></tr>';
  },

  // ---------- Recepción ----------
  nueva() { this.modalRecepcion(); },

  // ---------- Recepción del equipo (el mismo formulario en Taller y en Ventas) ----------
  // Las listas (tipos, marcas, estado al recibir, viene con) se editan en Maestros → Recepción
  // y también aquí mismo con "+ Otro".
  listas() {
    const base = Repo.defaultData().listasTaller;
    if (!Repo.data.listasTaller) Repo.data.listasTaller = base;
    Object.keys(base).forEach(k => { if (!Repo.data.listasTaller[k]) Repo.data.listasTaller[k] = base[k]; });
    return Repo.data.listasTaller;
  },
  datalist(id, valores) {
    const v = [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    return `<datalist id="${id}">${v.map(x => `<option value="${x}">`).join('')}</datalist>`;
  },
  chips(clave, marcadas = []) {
    const lista = this.listas()[clave] || [];
    const todos = [...lista, ...marcadas.filter(m => !lista.includes(m))];
    return `<div class="chips" id="os-${clave}">${todos.map(t =>
      `<button type="button" class="chip ${marcadas.includes(t) ? 'on' : ''}" data-v="${t}" onclick="this.classList.toggle('on')">${t}</button>`).join('')}
      <input class="chip-nuevo" placeholder="+ Otro" onkeydown="if(event.key==='Enter'){event.preventDefault();OrdenesUI.chipNuevo(this,'${clave}')}" onblur="OrdenesUI.chipNuevo(this,'${clave}')"></div>`;
  },
  // Lo que se escribe en "+ Otro" queda marcado y guardado en la lista para la próxima vez
  chipNuevo(inp, clave) {
    const v = inp.value.trim();
    if (!v) return;
    const lista = this.listas()[clave];
    if (!lista.some(x => x.toLowerCase() === v.toLowerCase())) { lista.push(v); Repo.save(); }
    const ya = [...inp.parentNode.querySelectorAll('.chip')].find(c => c.dataset.v.toLowerCase() === v.toLowerCase());
    if (ya) ya.classList.add('on');
    else inp.insertAdjacentHTML('beforebegin', `<button type="button" class="chip on" data-v="${v}" onclick="this.classList.toggle('on')">${v}</button>`);
    inp.value = '';
  },
  camposEquipo(o = {}) {
    const L = this.listas(), ords = Repo.get('ordenes');
    // Órdenes viejas solo tienen "equipo": se pone en Modelo para poder editarlo
    const modelo = o.modelo ?? (o.marca ? '' : (o.equipo || ''));
    return `
      <div class="form-row">
        <div class="form-group"><label>Tipo de equipo</label><input id="os-tipo" class="form-input" list="os-l-tipo" value="${o.tipoEquipo || ''}"></div>
        <div class="form-group"><label>Marca</label><input id="os-marca" class="form-input" list="os-l-marca" value="${o.marca || ''}"></div>
        <div class="form-group"><label>Modelo</label><input id="os-modelo" class="form-input" list="os-l-modelo" value="${modelo}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Color</label><input id="os-color" class="form-input" value="${o.color || ''}"></div>
        <div class="form-group"><label>IMEI o serie</label><input id="os-imei" class="form-input" value="${o.imei || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Motivo de ingreso</label><input id="os-motivo" class="form-input" list="os-l-motivo" value="${o.motivo || ''}"></div>
        <div class="form-group"><label>Falla</label><input id="os-falla" class="form-input" list="os-l-falla" value="${o.falla || ''}"></div>
      </div>
      <div class="form-group"><label>Estado al recibir</label>${this.chips('estados', o.condicion || [])}</div>
      <div class="form-group"><label>Viene con</label>${this.chips('accesorios', o.accesorios || [])}</div>
      <div class="form-row">
        <div class="form-group"><label>Clave o patrón</label><input id="os-clave" class="form-input" value="${o.clave || ''}"></div>
        <div class="form-group"><label>Observaciones</label><input id="os-obs" class="form-input" value="${o.obs || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Fecha prometida</label><input id="os-prometido" type="date" class="form-input" value="${o.prometido || ''}"></div>
        <div class="form-group"><label>Presupuesto</label><input id="os-presupuesto" type="number" min="0" class="form-input" value="${o.presupuesto ?? ''}"></div>
      </div>
      ${this.datalist('os-l-tipo', [...L.tipos, ...ords.map(x => x.tipoEquipo)])}
      ${this.datalist('os-l-marca', [...L.marcas, ...ords.map(x => x.marca)])}
      ${this.datalist('os-l-modelo', ords.map(x => x.modelo))}
      ${this.datalist('os-l-motivo', [...(L.motivos || []), ...ords.map(x => x.motivo)])}
      ${this.datalist('os-l-falla', ords.map(x => x.falla))}`;
  },
  // Lee el formulario. Devuelve { datos } o { error }
  leerEquipo() {
    const val = x => (document.getElementById(x)?.value || '').trim();
    const marcados = clave => [...document.querySelectorAll(`#os-${clave} .chip.on`)].map(c => c.dataset.v);
    document.querySelectorAll('.chip-nuevo').forEach(inp => inp.value.trim() && inp.onblur && inp.onblur());
    const marca = val('os-marca'), modelo = val('os-modelo'), color = val('os-color');
    if (!marca && !modelo) return { error: 'Falta la marca o el modelo' };
    if (!val('os-falla')) return { error: 'Falta la falla' };
    const pres = val('os-presupuesto');
    return { datos: {
      tipoEquipo: val('os-tipo'), marca, modelo, color, equipo: [marca, modelo, color].filter(Boolean).join(' '),
      imei: val('os-imei'), falla: val('os-falla'), condicion: marcados('estados'), accesorios: marcados('accesorios'),
      motivo: val('os-motivo'), clave: val('os-clave'), obs: val('os-obs'), prometido: val('os-prometido'),
      presupuesto: pres === '' ? null : +pres
    } };
  },

  modalRecepcion(o = {}) {
    this.asegurarDatos();
    const cliOpts = '<option value="">Elegir cliente</option>' + Repo.get('clientes').slice()
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
      .map(c => `<option value="${c.id}" ${o.clienteId === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('');
    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:760px">
        <h3>${o.id ? 'Editar recepción ' + o.numero : 'Nueva orden'}</h3>
        <div class="form-row">
          <div class="form-group"><label>Cliente</label>
            <div style="display:flex;gap:6px"><select id="os-cliente" data-clientes class="form-input" style="flex:1" onchange="OrdenesUI.clienteCambio()">${cliOpts}</select>
            <button class="btn btn-sm" onclick="MaestrosUI.nuevoCliente('modal2')">Nuevo</button></div></div>
          <div class="form-group"><label>Teléfono</label><input id="os-tel" class="form-input" inputmode="tel" value="${o.clienteTel || ''}"></div>
        </div>
        ${this.camposEquipo(o)}
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
          <button class="btn btn-primary" onclick="OrdenesUI.guardarRecepcion('${o.id || ''}')">${o.id ? 'Guardar cambios' : 'Recibir equipo'}</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
  },

  // Desde la venta: mismo formulario; se guarda junto con la venta
  modalRecepcionVenta(d = {}) {
    document.getElementById('modal2').innerHTML = `
      <div class="modal" style="max-width:760px">
        <h3>Orden de taller</h3>
        <div class="form-row">
          <div class="form-group"><label>Teléfono</label><input id="os-tel" class="form-input" inputmode="tel" value="${d.clienteTel || ''}"></div>
        </div>
        ${this.camposEquipo(d)}
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('modal2').classList.remove('active')">Cancelar</button>
          <button class="btn btn-primary" onclick="VentasUI.recepcionLista()">Listo</button>
        </div>
      </div>`;
    document.getElementById('modal2').classList.add('active');
  },

  // Al elegir el cliente, se trae su teléfono
  clienteCambio() {
    const c = Repo.find('clientes', document.getElementById('os-cliente')?.value);
    const tel = document.getElementById('os-tel');
    if (c && c.tel && tel) tel.value = c.tel;
  },

  guardarRecepcion(id) {
    const val = x => (document.getElementById(x)?.value || '').trim();
    const cliente = Repo.find('clientes', val('os-cliente'));
    if (!cliente) return Utils.toast('Falta el cliente');
    const tel = val('os-tel');
    if (!tel) return Utils.toast('Falta el teléfono');
    const r = this.leerEquipo();
    if (r.error) return Utils.toast(r.error);
    if (!cliente.tel) Repo.update('clientes', cliente.id, { tel });
    const datos = { clienteId: cliente.id, clienteNombre: cliente.nombre, clienteTel: tel, ...r.datos };
    let o;
    if (id) {
      o = Repo.update('ordenes', id, datos);
    } else {
      this.asegurarDatos();
      const num = Repo.data.numeraciones.os;
      const numero = num.pre + String(num.prox).padStart(4, '0');
      num.prox++;
      o = Repo.add('ordenes', { ...datos, numero, fecha: Utils.today(), estado: 'recibido', facturaNumero: '',
        historial: [{ estado: 'recibido', fechaHora: new Date().toISOString(), nota: '' }] });
    }
    Repo.save();
    this.render();
    Utils.toast(id ? 'Orden ' + o.numero + ' actualizada' : 'Orden ' + o.numero + ' recibida');
    this.abrir(o.id);
  },

  // ---------- Ficha de la orden ----------
  abrir(id) {
    const o = Repo.find('ordenes', id);
    if (!o) return;
    const cerrada = this.cerrados.includes(o.estado);
    const lista = (arr, vacio) => (arr && arr.length) ? arr.join(', ') : vacio;
    const dato = (et, v) => v ? `<div class="os-dato"><span>${et}</span>${v}</div>` : '';
    let botones = (this.siguientes[o.estado] || []).map(h =>
      `<button class="btn btn-estado" style="--c:${this.cerrados.includes(h) ? '#334155' : this.estados[h].color}" onclick="OrdenesUI.cambiarEstado('${o.id}','${h}')">${this.textoBoton(o.estado, h)}</button>`).join('');
    // Lista sin cobrar: lo normal es cobrar y entregar; entregar sin cobrar queda para garantías
    if (o.estado === 'listo' && !o.facturaNumero) botones =
      `<button class="btn btn-success" onclick="OrdenesUI.cobrar('${o.id}')">Cobrar y entregar</button>
       <button class="btn btn-estado" style="--c:#334155" onclick="OrdenesUI.cambiarEstado('${o.id}','entregado')">Entregar sin cobrar</button>`;
    const pago = o.pagoAdelantado;
    const cobro = o.facturaNumero ? 'Pagada en ' + o.facturaNumero
      : pago && pago.tipo === 'chequeo' ? `Chequeo ${Utils.formatMoney(pago.monto)} (${pago.factura})` : 'Sin cobrar';
    const historial = (o.historial || []).slice().reverse().map(h =>
      `<div><span class="muted">${Utils.formatFechaHora(h.fechaHora)}</span> ${this.pill(h.estado)} ${h.nota || ''}</div>`).join('');

    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:660px">
        <div class="os-cabeza"><h3>Orden ${o.numero}</h3>${this.pill(o.estado)}</div>
        <div class="os-ficha">
          ${dato('Cliente', o.clienteNombre + ' — ' + o.clienteTel)}
          ${dato('Equipo', (o.tipoEquipo ? o.tipoEquipo + ': ' : '') + o.equipo + (o.imei ? ' — IMEI/serie ' + o.imei : ''))}
          ${dato('Motivo', o.motivo)}
          ${dato('Falla', o.falla)}
          ${dato('Estado al recibir', lista(o.condicion, 'Sin daños marcados'))}
          ${dato('Viene con', lista(o.accesorios, 'Solo el equipo'))}
          ${dato('Clave o patrón', o.clave)}
          ${dato('Observaciones', o.obs)}
          ${dato('Recibido', Utils.formatDate(o.fecha))}
          ${dato('Salida', this.fechaSalida(o) ? Utils.formatDate(this.fechaSalida(o)) : '')}
          ${dato('Tiempo en taller', this.textoDias(this.dias(o)))}
          ${dato('Cobro', cobro)}
          ${cerrada ? dato('Presupuesto', o.presupuesto ? Utils.formatMoney(o.presupuesto) : '') : ''}
          ${cerrada ? dato('Repuestos usados', (o.repuestos || []).map(x => x.cantidad + ' × ' + x.nombre).join(', ')) : ''}
        </div>
        ${cerrada ? '' : `
        <div class="form-row">
          <div class="form-group"><label>Fecha prometida</label><input id="od-prometido" type="date" class="form-input" value="${o.prometido || ''}"></div>
          <div class="form-group"><label>Presupuesto</label><input id="od-presupuesto" type="number" min="0" class="form-input" value="${o.presupuesto ?? ''}"></div>
        </div>
        <div class="seccion-titulo" style="margin-top:4px">Repuestos usados</div>
        <div id="od-repuestos"></div>
        <input id="od-rep-buscar" class="form-input" placeholder="Agregar repuesto" style="margin-bottom:12px">
        <div class="form-group"><label>Nota</label><input id="od-nota" class="form-input"></div>
        <div class="os-acciones">${botones}</div>`}
        <div class="seccion-titulo" style="margin-top:14px">Historial</div>
        <div class="os-historial">${historial}</div>
        <div class="os-pie">
          ${cerrada ? '' : `<button class="btn" onclick="OrdenesUI.modalRecepcion(Repo.find('ordenes','${o.id}'))">Editar recepción</button>`}
          <button class="btn" onclick="OrdenesUI.imprimir('${o.id}')">Imprimir ticket</button>
          ${cerrada ? '' : `<button class="btn btn-primary" onclick="OrdenesUI.guardarCambios('${o.id}')">Guardar cambios</button>`}
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cerrar</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
    if (!cerrada) {
      this.renderRepuestos(o.id);
      Selector.conectar(document.getElementById('od-rep-buscar'), () => ({
        columnas: [{ t: 'Código' }, { t: 'Artículo' }, { t: 'Costo', der: true }, { t: 'Hay', der: true }],
        grupos: Selector.gruposArticulos('costo').filter(g => g.titulo !== 'Celulares')
          .map(g => ({ ...g, filas: g.filas.filter(f => Repo.find('items', f.id)?.controlInv) })),
        onElegir: itemId => this.usarRepuesto(o.id, itemId)
      }));
    }
  },

  // ---------- Repuestos: salen del inventario al usarse en la orden ----------
  // No cambian el cobro: la reparación se cobra con el presupuesto (mano de obra y repuesto juntos).
  renderRepuestos(id) {
    const o = Repo.find('ordenes', id);
    const el = document.getElementById('od-repuestos');
    if (!o || !el) return;
    const reps = o.repuestos || [];
    el.innerHTML = reps.length ? `<div class="od-reps">${reps.map((x, i) => `
      <div class="od-rep"><span>${x.cantidad} × ${x.nombre}</span>
        <button class="btn btn-sm nv-quitar" onclick="OrdenesUI.quitarRepuesto('${o.id}', ${i})" title="Devolver al inventario">×</button></div>`).join('')}</div>` : '';
  },
  usarRepuesto(id, itemId) {
    const o = Repo.find('ordenes', id), item = Repo.find('items', itemId);
    if (!o || !item) return;
    if ((item.stock || 0) < 1) return Utils.toast(`No hay ${item.nombre} en inventario`);
    item.stock = (item.stock || 0) - 1;
    Repo.update('items', item.id, { stock: item.stock });
    Repo.add('movimientosInv', { itemId: item.id, tipo: 'ajuste-', cantidad: 1, motivo: 'Repuesto en reparación', referencia: o.numero, fecha: Utils.today() });
    const reps = (o.repuestos || []).slice();
    const ya = reps.find(x => x.itemId === item.id);
    if (ya) ya.cantidad++; else reps.push({ itemId: item.id, nombre: item.nombre, cantidad: 1, costo: item.costo || 0 });
    Repo.update('ordenes', o.id, { repuestos: reps });
    this.renderRepuestos(o.id);
    Utils.toast(`${item.nombre}: quedan ${item.stock}`);
  },
  quitarRepuesto(id, i) {
    const o = Repo.find('ordenes', id);
    const reps = (o?.repuestos || []).slice();
    const x = reps[i];
    if (!x) return;
    const item = Repo.find('items', x.itemId);
    if (item) {
      item.stock = (item.stock || 0) + 1;
      Repo.update('items', item.id, { stock: item.stock });
      Repo.add('movimientosInv', { itemId: item.id, tipo: 'ajuste+', cantidad: 1, motivo: 'Repuesto devuelto', referencia: o.numero, fecha: Utils.today() });
    }
    if (x.cantidad > 1) x.cantidad--; else reps.splice(i, 1);
    Repo.update('ordenes', o.id, { repuestos: reps });
    this.renderRepuestos(o.id);
  },

  leerEdicion() {
    const v = x => (document.getElementById(x)?.value || '').trim();
    const p = v('od-presupuesto');
    return { prometido: v('od-prometido'), presupuesto: p === '' ? null : +p };
  },

  guardarCambios(id) {
    const o = Repo.find('ordenes', id);
    if (!o) return;
    const nota = (document.getElementById('od-nota')?.value || '').trim();
    const historial = nota ? (o.historial || []).concat({ estado: o.estado, fechaHora: new Date().toISOString(), nota }) : o.historial;
    Repo.update('ordenes', id, { ...this.leerEdicion(), historial });
    this.render();
    Utils.toast('Cambios guardados');
    this.abrir(id);
  },

  cambiarEstado(id, hacia) {
    const o = Repo.find('ordenes', id);
    if (!o || !(this.siguientes[o.estado] || []).includes(hacia)) return;
    const cambios = this.leerEdicion();
    const sinCobrar = hacia === 'entregado' && !o.facturaNumero;
    if (this.cerrados.includes(hacia) && !confirm(sinCobrar
      ? `${o.numero} no está cobrada. ¿Entregar sin cobrar?`
      : `¿Cerrar la orden ${o.numero} como "${this.estados[hacia].txt}"? No se puede deshacer.`)) return;
    const nota = (document.getElementById('od-nota')?.value || '').trim();
    const historial = (o.historial || []).concat({ estado: hacia, fechaHora: new Date().toISOString(), nota });
    Repo.update('ordenes', id, { ...cambios, estado: hacia, historial, ...(this.cerrados.includes(hacia) ? { fechaSalida: Utils.today() } : {}) });
    this.render();
    Utils.toast('Orden ' + o.numero + ': ' + this.estados[hacia].txt);
    if (hacia === 'listo' && o.facturaNumero) Utils.toast('Ya está pagada');
    if (hacia === 'listo' && !o.facturaNumero) {
      setTimeout(() => {
        if (confirm('Orden lista. ¿Cobrar ahora?')) this.cobrar(o.id);
      }, 400);
    }
    this.abrir(id);
  },

  // ---------- Ticket de recepción ----------
  imprimir(id) {
    const html = this.ticketHTML(id);
    if (!html) return;
    document.getElementById('print-area').innerHTML = html;
    window.print();
  },
  ticketHTML(id) {
    const o = Repo.find('ordenes', id);
    if (!o) return '';
    const e = Repo.data.empresa || {};
    const fila = (et, v) => v ? `<div><b>${et}:</b> ${v}</div>` : '';
    const recibido = (o.historial || [])[0]?.fechaHora;
    const nota = e.notaTicket ?? `Presentar este ticket para retirar el equipo.

EQUIPOS DEJADOS POR MÁS DE 30 DÍAS:
No nos hacemos responsables por pérdida, daño o deterioro.
El cliente tiene 30 días para retirar el equipo después de ser notificado.
Pasado ese tiempo el equipo podrá ser considerado abandonado.`;
    return `
      <div class="ticket">
        <div class="t-centro"><div class="t-empresa">${e.nombre || ''}</div>${e.dir ? e.dir + '<br>' : ''}${e.tel ? 'Tel. ' + e.tel : ''}</div>
        <div class="t-titulo">Orden de servicio<br>${o.numero}</div>
        ${fila('Recibido', recibido ? Utils.formatFechaHora(recibido) : Utils.formatDate(o.fecha))}
        <div class="t-linea"></div>
        ${fila('Cliente', o.clienteNombre)}
        ${fila('Teléfono', o.clienteTel)}
        <div class="t-linea"></div>
        ${fila('Equipo', (o.tipoEquipo ? o.tipoEquipo + ': ' : '') + o.equipo)}
        ${fila('IMEI o serie', o.imei)}
        ${fila('Motivo', o.motivo)}
        ${fila('Falla', o.falla)}
        ${fila('Estado al recibir', (o.condicion || []).length ? o.condicion.join(', ') : 'Sin daños marcados')}
        ${fila('Viene con', (o.accesorios || []).length ? o.accesorios.join(', ') : 'Solo el equipo')}
        ${fila('Observaciones', o.obs)}
        ${fila('Fecha prometida', o.prometido ? Utils.formatDate(o.prometido) : '')}
        ${fila('Presupuesto', o.presupuesto ? Utils.formatMoney(o.presupuesto) : '')}
        ${fila('Pagado', o.pagoAdelantado ? Utils.formatMoney(o.pagoAdelantado.monto) + (o.pagoAdelantado.tipo === 'chequeo' ? ' (chequeo)' : '') + ' — ' + o.pagoAdelantado.factura : '')}
        <div class="t-linea"></div>
        ${nota ? `<div class="t-nota" style="white-space:pre-line;font-size:0.8rem;line-height:1.35">${nota}</div>` : ''}
        <div class="t-firma">Firma del cliente</div>
      </div>`;
  }
};
window.OrdenesUI = OrdenesUI;
