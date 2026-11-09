// configuracion.js
const ConfigUI = {
  render() {
    const e = Repo.data.empresa;
    document.getElementById('cf-emp-nombre').value = e.nombre || '';
    document.getElementById('cf-emp-rnc').value = e.rnc || '';
    document.getElementById('cf-emp-tel').value = e.tel || '';
    document.getElementById('cf-emp-email').value = e.email || '';
    document.getElementById('cf-emp-dir').value = e.dir || '';
    document.getElementById('cf-emp-ciudad').value = e.ciudad || '';
    document.getElementById('cf-emp-nota').value = e.notaTicket ?? 'Presentar este ticket para retirar el equipo.';
    document.getElementById('cf-emp-tipo').value = e.tipo || 'ventas';
    document.getElementById('cf-emp-ret-itbis').value = e.retItbis || 0;
    document.getElementById('cf-emp-ret-isr').value = e.retIsr || 0;
    // Numeraciones
    const n = Repo.data.numeraciones;
    document.getElementById('cf-num-fac-pre').value = n.fac.pre;
    document.getElementById('cf-num-fac-prox').value = n.fac.prox;
    document.getElementById('cf-num-com-pre').value = n.com.pre;
    document.getElementById('cf-num-com-prox').value = n.com.prox;
    document.getElementById('cf-num-cot-pre').value = n.cot.pre;
    document.getElementById('cf-num-cot-prox').value = n.cot.prox;
    if (!n.os) n.os = { pre: 'OS-', prox: 1 };
    document.getElementById('cf-num-os-pre').value = n.os.pre;
    document.getElementById('cf-num-os-prox').value = n.os.prox;
    document.getElementById('cf-pin-estado').textContent = 'PIN no configurado (demo)';
    this.renderBitacora();
  },
  guardarEmpresa() {
    Repo.data.empresa = {
      nombre: document.getElementById('cf-emp-nombre').value,
      rnc: document.getElementById('cf-emp-rnc').value,
      tel: document.getElementById('cf-emp-tel').value,
      email: document.getElementById('cf-emp-email').value,
      dir: document.getElementById('cf-emp-dir').value,
      ciudad: document.getElementById('cf-emp-ciudad').value,
      notaTicket: document.getElementById('cf-emp-nota').value,
      tipo: document.getElementById('cf-emp-tipo').value,
      retItbis: +document.getElementById('cf-emp-ret-itbis').value || 0,
      retIsr: +document.getElementById('cf-emp-ret-isr').value || 0
    };
    Repo.save();
    document.getElementById('logo-texto').textContent = Repo.data.empresa.nombre;
    App.renderSidebar();
    Utils.toast('Empresa guardada');
  },
  guardarNumeraciones() {
    const n = Repo.data.numeraciones;
    n.fac.pre = document.getElementById('cf-num-fac-pre').value;
    n.fac.prox = Math.max(1, +document.getElementById('cf-num-fac-prox').value || 1);
    n.com.pre = document.getElementById('cf-num-com-pre').value;
    n.com.prox = Math.max(1, +document.getElementById('cf-num-com-prox').value || 1);
    if (!n.os) n.os = { pre: 'OS-', prox: 1 };
    n.os.pre = document.getElementById('cf-num-os-pre').value;
    n.os.prox = Math.max(1, +document.getElementById('cf-num-os-prox').value || 1);
    Repo.save();
    Utils.toast('Numeraciones guardadas');
  },
  exportar() {
    const data = JSON.stringify(Repo.data, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'respaldo-erp-celulares.json';
    a.click();
    Utils.toast('Respaldo exportado');
  },
  importar(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        Repo.data = JSON.parse(e.target.result);
        Repo.save();
        location.reload();
      } catch (err) { Utils.toast('Archivo inválido'); }
    };
    reader.readAsText(file);
  },
  cargarPrueba() {
    if (!confirm('¿Cargar datos de prueba? Se agregarán 50 ventas, 15 compras, 15 equipos en taller, clientes, etc. Los datos actuales se reemplazarán.')) return;
    Repo.data = Repo.defaultData();
    Repo.seedDemo();
    Repo.save();
    Utils.toast('Datos de prueba cargados');
    location.reload();
  },
  restablecerDemo() {
    if (!confirm('¿Restablecer datos demo? Se perderán los datos actuales.')) return;
    Repo.data = Repo.defaultData();
    Repo.save();
    location.reload();
  },
  vaciar() {
    if (!confirm('¿Empezar de cero? Se borrarán todos los datos.')) return;
    const limpio = Repo.defaultData();
    limpio.items = [];
    Repo.data = limpio;
    Repo.save();
    location.reload();
  },
  guardarPin() { Utils.toast('PIN demo'); },
  quitarPin() { Utils.toast('PIN removido'); },
  renderBitacora() {
    const list = Repo.get('bitacora');
    document.getElementById('cf-bit-tbody').innerHTML = list.slice().reverse().map(b => `
      <tr><td>${Utils.formatDate(b.fecha)}</td><td>${b.usuario||'Admin'}</td><td>${b.modulo}</td><td>${b.accion}</td><td>${b.detalle||''}</td></tr>`).join('') || '<tr><td colspan="5">Sin registros</td></tr>';
  }
};
window.ConfigUI = ConfigUI;
