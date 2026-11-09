// caja.js
const CajaUI = {
  render() {
    this.renderCuentas();
    this.renderMovimientos();
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
    let list = Repo.get('movimientosCaja');
    if (tipo) list = list.filter(m => m.tipo === tipo);
    if (origen) list = list.filter(m => m.origen === origen);
    if (q) list = list.filter(m => (m.concepto||'').toLowerCase().includes(q));
    document.getElementById('cj-mov-count').textContent = list.length + ' movimientos';
    document.getElementById('cj-mov-tbody').innerHTML = list.slice().reverse().map(m => {
      const cta = Repo.find('cuentas', m.cuentaId);
      return `<tr><td>${Utils.formatDate(m.fecha)}</td><td>${Utils.etiqueta(m.tipo)}</td><td>${m.concepto}</td>
        <td>${cta?.nombre||''}</td><td>${Utils.etiqueta(m.origen||'manual')}</td>
        <td style="text-align:right">${Utils.formatMoney(m.monto)}</td><td></td></tr>`;
    }).join('') || '<tr><td colspan="7">Sin movimientos</td></tr>';
  },
  nuevoMov(tipo) {
    const cuentas = Repo.get('cuentas');
    const opts = cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    document.getElementById('modal').innerHTML = `
      <div class="modal">
        <h3>Nueva ${tipo}</h3>
        <div class="form-group"><label>Cuenta</label><select id="mv-cta" class="form-input">${opts}</select></div>
        <div class="form-group"><label>Monto</label><input id="mv-monto" type="number" class="form-input"></div>
        <div class="form-group"><label>Concepto</label><input id="mv-concepto" class="form-input"></div>
        <button class="btn btn-primary" onclick="CajaUI.guardarMov('${tipo}')">Registrar</button>
        <button class="btn" onclick="document.getElementById('modal').classList.remove('active')">Cancelar</button>
      </div>`;
    document.getElementById('modal').classList.add('active');
  },
  guardarMov(tipo) {
    const cuentaId = document.getElementById('mv-cta').value;
    const monto = +document.getElementById('mv-monto').value || 0;
    const concepto = document.getElementById('mv-concepto').value;
    if (monto <= 0) return;
    Repo.add('movimientosCaja', { fecha: Utils.today(), tipo, monto, cuentaId, concepto, origen: 'manual' });
    document.getElementById('modal').classList.remove('active');
    this.render();
    Utils.toast('Movimiento registrado');
  },
  nuevaTransferencia() { Utils.toast('Transferencia entre cuentas (demo)'); }
};
window.CajaUI = CajaUI;
