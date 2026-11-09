// ordenes.js — Órdenes de servicio (taller): recepción, estados y ticket
const OrdenesUI = {
  // Colores con significado: gris recibido, azul el taller trabaja, amarillo se espera a alguien, verde listo
  estados: {
    recibido:    { txt: 'Recibido',             color: '#64748b' },
    diagnostico: { txt: 'En diagnóstico',       color: '#2563eb' },
    aprobacion:  { txt: 'Esperando aprobación', color: '#d97706' },
    pieza:       { txt: 'Esperando pieza',      color: '#d97706' },
    reparacion:  { txt: 'En reparación',        color: '#2563eb' },
    listo:       { txt: 'Listo',                color: '#16a34a' },
    entregado:   { txt: 'Entregado',            color: '#94a3b8' },
    devuelto:    { txt: 'Devuelto sin reparar', color: '#94a3b8' }
  },
  // A qué estado se puede pasar desde cada uno
  siguientes: {
    recibido:    ['diagnostico', 'reparacion'],
    diagnostico: ['aprobacion', 'reparacion', 'devuelto'],
    aprobacion:  ['reparacion', 'pieza', 'devuelto'],
    pieza:       ['reparacion'],
    reparacion:  ['listo', 'pieza'],
    listo:       ['entregado'],
    entregado:   [],
    devuelto:    []
  },
  cerrados: ['entregado', 'devuelto'],
  danos: ['No enciende', 'Pantalla rota', 'Tapa rota', 'Cámara dañada', 'Botones dañados', 'Mojado'],
  deja: ['Cargador', 'Chip', 'Memoria', 'Forro'],

  textoBoton(desde, hacia) {
    if (desde === 'aprobacion') return { reparacion: 'Aprobó: reparar', pieza: 'Aprobó: pedir pieza', devuelto: 'No aprobó: devolver' }[hacia];
    if (desde === 'pieza') return 'Llegó la pieza: reparar';
    return { diagnostico: 'Pasar a diagnóstico', aprobacion: 'Pedir aprobación', reparacion: 'En reparación',
      pieza: 'Esperando pieza', listo: 'Marcar listo', entregado: 'Entregar', devuelto: 'Devolver sin reparar' }[hacia];
  },

  // Datos guardados antes de este módulo no traen numeración ni lista de órdenes
  asegurarDatos() {
    if (!Repo.data.numeraciones.os) Repo.data.numeraciones.os = { pre: 'OS-', prox: 1 };
    if (!Repo.data.ordenes) Repo.data.ordenes = [];
  },

  // Pasó la fecha prometida y el equipo todavía no está listo
  atrasada(o) {
    return !!o.prometido && o.prometido < Utils.today() && !['listo', ...this.cerrados].includes(o.estado);
  },

  pill(estado) {
    const e = this.estados[estado] || { txt: estado, color: '#64748b' };
    return `<span class="estado-pill" style="--c:${e.color}">${e.txt}</span>`;
  },

  tecnicosDatalist() {
    const t = [...new Set(Repo.get('ordenes').map(x => x.tecnico).filter(Boolean))];
    return `<datalist id="os-tecnicos">${t.map(x => `<option value="${x}">`).join('')}</datalist>`;
  },

  render() {
    this.asegurarDatos();
    const todas = Repo.get('ordenes');
    const activas = todas.filter(o => !this.cerrados.includes(o.estado));
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('os-kpi-recibidas', activas.filter(o => o.estado === 'recibido').length);
    set('os-kpi-taller', activas.filter(o => ['diagnostico', 'reparacion'].includes(o.estado)).length);
    set('os-kpi-esperando', activas.filter(o => ['aprobacion', 'pieza'].includes(o.estado)).length);
    set('os-kpi-listas', activas.filter(o => o.estado === 'listo').length);
    set('os-kpi-atrasadas', activas.filter(o => this.atrasada(o)).length);

    const q = (document.getElementById('os-buscar')?.value || '').toLowerCase().trim();
    const est = document.getElementById('os-filtro-estado')?.value || 'activas';
    let list = est === 'activas' ? activas : est === 'todas' ? todas : todas.filter(o => o.estado === est);
    if (q) list = list.filter(o => [o.numero, o.clienteNombre, o.clienteTel, o.equipo, o.imei, o.tecnico]
      .some(v => (v || '').toLowerCase().includes(q)));
    set('os-count', list.length + (list.length === 1 ? ' orden' : ' órdenes'));

    const tbody = document.getElementById('os-tbody');
    if (!tbody) return;
    tbody.innerHTML = list.slice().reverse().map(o => `
      <tr class="fila-clic" onclick="OrdenesUI.abrir('${o.id}')">
        <td>${Utils.formatDate(o.fecha)}</td>
        <td>${o.numero}</td>
        <td>${o.clienteNombre}<div class="muted sub-dato">${o.clienteTel || ''}</div></td>
        <td>${o.equipo}${o.imei ? `<div class="muted sub-dato">${o.imei}</div>` : ''}</td>
        <td>${o.tecnico || '—'}</td>
        <td class="${this.atrasada(o) ? 'txt-atrasada' : ''}">${o.prometido ? Utils.formatDate(o.prometido) : '—'}</td>
        <td>${o.facturaNumero || '—'}</td>
        <td>${this.pill(o.estado)}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="muted">Sin órdenes</td></tr>';
  },

  // ---------- Recepción ----------
  nueva() { this.modalRecepcion(); },

  modalRecepcion(o = {}) {
    this.asegurarDatos();
    const cliOpts = '<option value="">Elegir cliente</option>' + Repo.get('clientes')
      .map(c => `<option value="${c.id}" ${o.clienteId === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('');
    const casillas = (lista, marcadas, pref) => lista.map((t, i) =>
      `<label class="chk"><input type="checkbox" id="${pref}${i}" ${(marcadas || []).includes(t) ? 'checked' : ''}> ${t}</label>`).join('');
    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:660px">
        <h3>${o.id ? 'Editar recepción ' + o.numero : 'Nueva orden'}</h3>
        <div class="form-row">
          <div class="form-group"><label>Cliente</label>
            <div style="display:flex;gap:6px"><select id="os-cliente" data-clientes class="form-input" style="flex:1" onchange="OrdenesUI.clienteCambio()">${cliOpts}</select>
            <button class="btn btn-sm" onclick="MaestrosUI.nuevoCliente('modal2')">Nuevo</button></div></div>
          <div class="form-group"><label>Teléfono / WhatsApp</label><input id="os-tel" class="form-input" inputmode="tel" value="${o.clienteTel || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Equipo (marca, modelo y color)</label><input id="os-equipo" class="form-input" placeholder="Ej.: Samsung A15 negro" value="${o.equipo || ''}"></div>
          <div class="form-group"><label>IMEI o serie</label><input id="os-imei" class="form-input" value="${o.imei || ''}"></div>
        </div>
        <div class="form-group"><label>Falla reportada</label><input id="os-falla" class="form-input" placeholder="Ej.: No carga" value="${o.falla || ''}"></div>
        <div class="form-group"><label>Estado al recibir (marcar lo que trae)</label><div class="chk-grupo">${casillas(this.danos, o.condicion, 'os-dano-')}</div></div>
        <div class="form-group"><label>Deja con el equipo</label><div class="chk-grupo">${casillas(this.deja, o.accesorios, 'os-deja-')}</div></div>
        <div class="form-row">
          <div class="form-group"><label>Clave o patrón (no sale en el ticket)</label><input id="os-clave" class="form-input" value="${o.clave || ''}"></div>
          <div class="form-group"><label>Observaciones</label><input id="os-obs" class="form-input" value="${o.obs || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Técnico</label><input id="os-tecnico" class="form-input" list="os-tecnicos" value="${o.tecnico || ''}"></div>
          <div class="form-group"><label>Fecha prometida</label><input id="os-prometido" type="date" class="form-input" value="${o.prometido || ''}"></div>
          <div class="form-group"><label>Presupuesto (si ya se sabe)</label><input id="os-presupuesto" type="number" min="0" class="form-input" value="${o.presupuesto ?? ''}"></div>
        </div>
        ${this.tecnicosDatalist()}
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
          <button class="btn btn-primary" onclick="OrdenesUI.guardarRecepcion('${o.id || ''}')">${o.id ? 'Guardar cambios' : 'Recibir equipo'}</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
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
    if (!cliente) return Utils.toast('Falta elegir el cliente');
    const tel = val('os-tel');
    if (!tel) return Utils.toast('Falta el teléfono / WhatsApp');
    if (!val('os-equipo')) return Utils.toast('Falta el equipo');
    if (!val('os-falla')) return Utils.toast('Falta la falla reportada');
    if (!cliente.tel) Repo.update('clientes', cliente.id, { tel });

    const marcadas = (lista, pref) => lista.filter((t, i) => document.getElementById(pref + i)?.checked);
    const pres = val('os-presupuesto');
    const datos = {
      clienteId: cliente.id, clienteNombre: cliente.nombre, clienteTel: tel,
      equipo: val('os-equipo'), imei: val('os-imei'), falla: val('os-falla'),
      condicion: marcadas(this.danos, 'os-dano-'), accesorios: marcadas(this.deja, 'os-deja-'),
      clave: val('os-clave'), obs: val('os-obs'),
      tecnico: val('os-tecnico'), prometido: val('os-prometido'),
      presupuesto: pres === '' ? null : +pres
    };
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
    const botones = (this.siguientes[o.estado] || []).map(h =>
      `<button class="btn btn-estado" style="--c:${this.cerrados.includes(h) ? '#334155' : this.estados[h].color}" onclick="OrdenesUI.cambiarEstado('${o.id}','${h}')">${this.textoBoton(o.estado, h)}</button>`).join('');
    const historial = (o.historial || []).slice().reverse().map(h =>
      `<div><span class="muted">${Utils.formatFechaHora(h.fechaHora)}</span> ${this.pill(h.estado)} ${h.nota || ''}</div>`).join('');

    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:660px">
        <div class="os-cabeza"><h3>Orden ${o.numero}</h3>${this.pill(o.estado)}</div>
        <div class="os-ficha">
          ${dato('Cliente', o.clienteNombre + ' — ' + o.clienteTel)}
          ${dato('Equipo', o.equipo + (o.imei ? ' — IMEI/serie ' + o.imei : ''))}
          ${dato('Falla reportada', o.falla)}
          ${dato('Estado al recibir', lista(o.condicion, 'Sin daños marcados'))}
          ${dato('Deja', lista(o.accesorios, 'Solo el equipo'))}
          ${dato('Clave o patrón', o.clave)}
          ${dato('Observaciones', o.obs)}
          ${dato('Recibido', Utils.formatDate(o.fecha))}
          ${cerrada ? dato('Técnico', o.tecnico) + dato('Presupuesto', o.presupuesto ? Utils.formatMoney(o.presupuesto) : '') : ''}
        </div>
        ${cerrada ? '' : `
        <div class="form-row">
          <div class="form-group"><label>Técnico</label><input id="od-tecnico" class="form-input" list="os-tecnicos" value="${o.tecnico || ''}"></div>
          <div class="form-group"><label>Fecha prometida</label><input id="od-prometido" type="date" class="form-input" value="${o.prometido || ''}"></div>
          <div class="form-group"><label>Presupuesto</label><input id="od-presupuesto" type="number" min="0" class="form-input" value="${o.presupuesto ?? ''}"></div>
        </div>
        ${this.tecnicosDatalist()}
        <div class="form-group"><label>Nota (queda en el historial)</label><input id="od-nota" class="form-input" placeholder="Ej.: Se cambió el pin de carga"></div>
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
  },

  leerEdicion() {
    const v = x => (document.getElementById(x)?.value || '').trim();
    const p = v('od-presupuesto');
    return { tecnico: v('od-tecnico'), prometido: v('od-prometido'), presupuesto: p === '' ? null : +p };
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
    if (hacia === 'aprobacion' && !(cambios.presupuesto > 0)) return Utils.toast('Falta el presupuesto para pedir aprobación');
    if (this.cerrados.includes(hacia) && !confirm(`¿Cerrar la orden ${o.numero} como "${this.estados[hacia].txt}"? No se puede deshacer.`)) return;
    const nota = (document.getElementById('od-nota')?.value || '').trim();
    const historial = (o.historial || []).concat({ estado: hacia, fechaHora: new Date().toISOString(), nota });
    Repo.update('ordenes', id, { ...cambios, estado: hacia, historial });
    this.render();
    Utils.toast('Orden ' + o.numero + ': ' + this.estados[hacia].txt);
    this.abrir(id);
  },

  // ---------- Ticket de recepción ----------
  imprimir(id) {
    const o = Repo.find('ordenes', id);
    if (!o) return;
    const e = Repo.data.empresa || {};
    const fila = (et, v) => v ? `<div><b>${et}:</b> ${v}</div>` : '';
    const recibido = (o.historial || [])[0]?.fechaHora;
    const nota = e.notaTicket ?? 'Presentar este ticket para retirar el equipo.';
    document.getElementById('print-area').innerHTML = `
      <div class="ticket">
        <div class="t-centro"><div class="t-empresa">${e.nombre || ''}</div>${e.dir ? e.dir + '<br>' : ''}${e.tel ? 'Tel. ' + e.tel : ''}</div>
        <div class="t-titulo">Orden de servicio<br>${o.numero}</div>
        ${fila('Recibido', recibido ? Utils.formatFechaHora(recibido) : Utils.formatDate(o.fecha))}
        <div class="t-linea"></div>
        ${fila('Cliente', o.clienteNombre)}
        ${fila('Teléfono', o.clienteTel)}
        <div class="t-linea"></div>
        ${fila('Equipo', o.equipo)}
        ${fila('IMEI o serie', o.imei)}
        ${fila('Falla reportada', o.falla)}
        ${fila('Estado al recibir', (o.condicion || []).length ? o.condicion.join(', ') : 'Sin daños marcados')}
        ${fila('Deja', (o.accesorios || []).length ? o.accesorios.join(', ') : 'Solo el equipo')}
        ${fila('Observaciones', o.obs)}
        ${fila('Fecha prometida', o.prometido ? Utils.formatDate(o.prometido) : '')}
        ${fila('Presupuesto', o.presupuesto ? Utils.formatMoney(o.presupuesto) : '')}
        <div class="t-linea"></div>
        ${nota ? `<div class="t-nota">${nota}</div>` : ''}
        <div class="t-firma">Firma del cliente</div>
      </div>`;
    window.print();
  }
};
window.OrdenesUI = OrdenesUI;
