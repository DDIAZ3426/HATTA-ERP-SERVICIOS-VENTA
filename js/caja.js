// caja.js
const CajaUI = {
  cierre: { modo: 'dia', fecha: null },

  render() {
    this.renderCuentas();
    this.renderMovimientos();
    this.renderCierre();
  },

  // ---------- Cierre por día, semana (lunes a domingo) o mes ----------
  cierreModo(modo) { this.cierre.modo = modo; this.renderCierre(); },
  cierreFecha(f) { if (f) { this.cierre.fecha = f; this.renderCierre(); } },
  cierreMover(paso) {
    const d = Utils.aFecha(this.cierre.fecha || Utils.today());
    if (this.cierre.modo === 'dia') d.setDate(d.getDate() + paso);
    else if (this.cierre.modo === 'semana') d.setDate(d.getDate() + 7 * paso);
    else { d.setDate(1); d.setMonth(d.getMonth() + paso); }
    this.cierre.fecha = Utils.aTexto(d);
    this.renderCierre();
  },
  rangoCierre() {
    const f = this.cierre.fecha || Utils.today();
    const d = Utils.aFecha(f);
    const largo = x => x.toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
    if (this.cierre.modo === 'semana') {
      const lunes = new Date(d); lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
      return { desde: Utils.aTexto(lunes), hasta: Utils.aTexto(domingo),
        titulo: `Cierre de la semana del ${lunes.getMonth() === domingo.getMonth() ? lunes.getDate()
          : lunes.toLocaleDateString('es-DO', { day: 'numeric', month: 'long' })} al ${largo(domingo)}` };
    }
    if (this.cierre.modo === 'mes') {
      const ini = new Date(d.getFullYear(), d.getMonth(), 1);
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { desde: Utils.aTexto(ini), hasta: Utils.aTexto(fin),
        titulo: 'Cierre de ' + ini.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' }) };
    }
    return { desde: f, hasta: f, titulo: 'Cierre del ' + d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
  },
  // Todos los números del cierre salen de aquí (pantalla e impresión dicen lo mismo)
  datosCierre() {
    const r = this.rangoCierre();
    const dentro = x => x.fecha >= r.desde && x.fecha <= r.hasta;
    const fac = Repo.get('facturas').filter(f => dentro(f) && f.estado !== 'anulada');
    const movs = Repo.get('movimientosCaja').filter(dentro);
    const suma = arr => arr.reduce((t, m) => t + (m.monto || 0), 0);
    const d = {
      ...r,
      facturas: fac.length,
      contado: fac.filter(f => f.formaPago !== 'fiado').reduce((t, f) => t + (f.total || 0), 0),
      fiado: fac.filter(f => f.formaPago === 'fiado').reduce((t, f) => t + (f.total || 0), 0),
      cobros: suma(movs.filter(m => m.tipo === 'entrada' && m.origen === 'cobro')),
      otrasEntradas: suma(movs.filter(m => m.tipo === 'entrada' && m.origen !== 'cobro')),
      pagos: suma(movs.filter(m => m.tipo === 'salida' && m.origen === 'pago')),
      devoluciones: suma(movs.filter(m => m.tipo === 'salida' && m.origen === 'devolucion')),
      gastos: suma(movs.filter(m => m.tipo === 'salida' && !['pago', 'devolucion'].includes(m.origen))),
      // Lo devuelto en el período (de facturas de cualquier fecha)
      devuelto: Repo.get('facturas').reduce((t, f) => t + (f.devoluciones || []).filter(dentro).reduce((u, x) => u + x.monto, 0), 0)
    };
    d.vendido = d.contado + d.fiado - d.devuelto;
    d.entro = d.cobros + d.otrasEntradas;
    d.salio = d.pagos + d.gastos + d.devoluciones;
    d.neto = d.entro - d.salio;
    d.cuentas = Repo.get('cuentas').map(c => {
      const mc = movs.filter(m => m.cuentaId === c.id);
      const entro = suma(mc.filter(m => m.tipo === 'entrada'));
      const salio = suma(mc.filter(m => m.tipo === 'salida'));
      const hastaFin = Repo.get('movimientosCaja').filter(m => m.cuentaId === c.id && m.fecha <= r.hasta);
      const saldo = (c.saldoInicial || 0) + suma(hastaFin.filter(m => m.tipo === 'entrada')) - suma(hastaFin.filter(m => m.tipo === 'salida'));
      return { nombre: c.nombre, entro, salio, neto: entro - salio, saldo };
    });
    return d;
  },
  renderCierre() {
    const cont = document.getElementById('cj-cierre-bloques');
    if (!cont) return;
    if (!this.cierre.fecha) this.cierre.fecha = Utils.today();
    document.getElementById('cj-cierre-fecha').value = this.cierre.fecha;
    document.querySelectorAll('#cj-cierre-modos .btn').forEach(b => b.classList.toggle('activo', b.dataset.modo === this.cierre.modo));
    const d = this.datosCierre();
    const M = Utils.formatMoney;
    const linea = (et, v, cls = '') => `<div class="cierre-linea ${cls}"><span>${et}</span><b>${v}</b></div>`;
    document.getElementById('cj-cierre-titulo').textContent = d.titulo;
    cont.innerHTML = `
      <div class="cierre-bloque" style="--c:#2563eb">
        <div class="cierre-cab">Ventas</div>
        ${linea('Facturas', d.facturas)}
        ${linea('De contado', M(d.contado))}
        ${linea('Fiado', M(d.fiado))}
        ${d.devuelto ? linea('Devuelto', '−' + M(d.devuelto)) : ''}
        ${linea('Total vendido', M(d.vendido), 'total')}
      </div>
      <div class="cierre-bloque" style="--c:#16a34a">
        <div class="cierre-cab">Entró</div>
        ${linea('Cobros de ventas', M(d.cobros))}
        ${linea('Otras entradas', M(d.otrasEntradas))}
        ${linea('Total que entró', M(d.entro), 'total')}
      </div>
      <div class="cierre-bloque" style="--c:#dc2626">
        <div class="cierre-cab">Salió</div>
        ${linea('Pagos a proveedores', M(d.pagos))}
        ${linea('Gastos', M(d.gastos))}
        ${linea('Devoluciones', M(d.devoluciones))}
        ${linea('Total que salió', M(d.salio), 'total')}
      </div>
      <div class="cierre-bloque" style="--c:${d.neto >= 0 ? '#16a34a' : '#dc2626'}">
        <div class="cierre-cab">Neto</div>
        <div class="cierre-neto">${M(d.neto)}</div>
      </div>`;
    document.getElementById('cj-cierre-tbody').innerHTML = d.cuentas.map(c => `
      <tr><td>${c.nombre}</td>
        <td style="text-align:right" class="num-entrada">${M(c.entro)}</td>
        <td style="text-align:right" class="num-salida">${M(c.salio)}</td>
        <td style="text-align:right"><b>${M(c.neto)}</b></td>
        <td style="text-align:right"><b>${M(c.saldo)}</b></td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">Sin cuentas</td></tr>';
  },
  imprimirCierre() {
    const d = this.datosCierre();
    const e = Repo.data.empresa || {};
    const M = Utils.formatMoney;
    const fila = (et, v, b) => `<div style="display:flex;justify-content:space-between;gap:8px${b ? ';font-weight:700' : ''}"><span>${et}</span><span>${v}</span></div>`;
    document.getElementById('print-area').innerHTML = `
      <div class="ticket">
        <div class="t-centro"><div class="t-empresa">${e.nombre || ''}</div></div>
        <div class="t-titulo">${d.titulo}</div>
        <div class="t-linea"></div>
        <b>Ventas</b>
        ${fila('Facturas', d.facturas)}${fila('De contado', M(d.contado))}${fila('Fiado', M(d.fiado))}${d.devuelto ? fila('Devuelto', '-' + M(d.devuelto)) : ''}${fila('Total vendido', M(d.vendido), 1)}
        <div class="t-linea"></div>
        <b>Entró</b>
        ${fila('Cobros de ventas', M(d.cobros))}${fila('Otras entradas', M(d.otrasEntradas))}${fila('Total', M(d.entro), 1)}
        <div class="t-linea"></div>
        <b>Salió</b>
        ${fila('Pagos a proveedores', M(d.pagos))}${fila('Gastos', M(d.gastos))}${fila('Devoluciones', M(d.devoluciones))}${fila('Total', M(d.salio), 1)}
        <div class="t-linea"></div>
        ${fila('NETO', M(d.neto), 1)}
        <div class="t-linea"></div>
        <b>Saldo al cierre</b>
        ${d.cuentas.map(c => fila(c.nombre, M(c.saldo))).join('')}
        <div class="t-linea"></div>
        <div style="font-size:11px">Impreso: ${Utils.formatFechaHora(new Date().toISOString())}</div>
        <div class="t-firma">Firma de quien cierra</div>
      </div>`;
    window.print();
  },
  renderCuentas() {
    const list = Repo.get('cuentas');
    document.getElementById('cj-cuentas-tbody').innerHTML = list.map(c => {
      const saldo = MaestrosUI.calcularSaldo(c.id);
      return `<tr><td>${c.nombre}</td><td>${Utils.etiqueta(c.tipo)}</td><td>${c.banco||''}</td>
        <td style="text-align:right">${Utils.formatMoney(saldo)}</td></tr>`;
    }).join('');
    // Tira resumen
    const total = list.reduce((s, c) => s + MaestrosUI.calcularSaldo(c.id), 0);
    document.getElementById('cj-tira').innerHTML = `<div class="kpi-card"><div class="kpi-label">Saldo total en cuentas</div><div class="kpi-value">${Utils.formatMoney(total)}</div></div>`;
  },
  renderMovimientos() {
    const q = (document.getElementById('cj-mov-buscar')?.value || '').toLowerCase();
    const tipo = document.getElementById('cj-mov-tipo')?.value || '';
    const origen = document.getElementById('cj-mov-origen')?.value || '';
    const fecha = document.getElementById('cj-mov-fecha')?.value || '';
    let list = Repo.get('movimientosCaja');
    if (tipo) list = list.filter(m => m.tipo === tipo);
    if (origen) list = list.filter(m => m.origen === origen);
    if (fecha) list = list.filter(m => m.fecha === fecha);
    if (q) list = list.filter(m => (m.concepto||'').toLowerCase().includes(q) || (Repo.find('cuentas', m.cuentaId)?.nombre||'').toLowerCase().includes(q));
    document.getElementById('cj-mov-count').textContent = list.length + ' movimientos';
    document.getElementById('cj-mov-tbody').innerHTML = Utils.ordenarPorFecha(list).map(m => {
      const cta = Repo.find('cuentas', m.cuentaId);
      return `<tr><td>${Utils.formatDate(m.fecha)}</td><td>${Utils.etiqueta(m.tipo)}</td><td>${m.concepto}</td>
        <td>${cta?.nombre||''}</td><td>${Utils.etiqueta(m.origen||'manual')}</td>
        <td style="text-align:right">${Utils.formatMoney(m.monto)}</td><td></td></tr>`;
    }).join('') || '<tr><td colspan="7">Sin movimientos</td></tr>';
  },
  // Gasto (salida) o entrada de dinero que no viene de una venta
  nuevoMov(tipo) {
    const opts = Repo.get('cuentas').map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    document.getElementById('modal').innerHTML = `
      <div class="modal" style="max-width:480px">
        <h3>${tipo === 'salida' ? 'Gasto' : 'Entrada'}</h3>
        <div class="form-group"><label>Concepto</label><input id="mv-concepto" class="form-input" list="mv-conceptos">
          <datalist id="mv-conceptos">${[...new Set(Repo.get('movimientosCaja').filter(m => m.tipo === tipo && ['manual', 'gasto'].includes(m.origen))
            .map(m => m.concepto).filter(Boolean))].map(c => `<option value="${c}">`).join('')}</datalist></div>
        <div class="form-row">
          <div class="form-group"><label>Monto</label><input id="mv-monto" type="number" min="0" step="0.01" class="form-input"></div>
          <div class="form-group"><label>Cuenta</label><select id="mv-cta" class="form-input">${opts}</select></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
          <button class="btn ${tipo === 'salida' ? 'btn-danger' : 'btn-success'}" onclick="CajaUI.guardarMov('${tipo}')">Registrar</button>
        </div>
      </div>`;
    document.getElementById('modal').classList.add('active');
  },
  guardarMov(tipo) {
    const cuentaId = document.getElementById('mv-cta').value;
    const monto = Math.round((+document.getElementById('mv-monto').value || 0) * 100) / 100;
    const concepto = document.getElementById('mv-concepto').value.trim();
    if (!concepto) return Utils.toast('Falta el concepto');
    if (monto <= 0) return Utils.toast('Falta el monto');
    if (!cuentaId) return Utils.toast('Falta la cuenta');
    Repo.add('movimientosCaja', { fecha: Utils.today(), tipo, monto, cuentaId, concepto, origen: tipo === 'salida' ? 'gasto' : 'manual' });
    document.getElementById('modal').classList.remove('active');
    this.render();
    Utils.toast(tipo === 'salida' ? 'Gasto registrado' : 'Entrada registrada');
  },
  nuevaTransferencia() { Utils.toast('Transferencia entre cuentas (demo)'); }
};
window.CajaUI = CajaUI;
