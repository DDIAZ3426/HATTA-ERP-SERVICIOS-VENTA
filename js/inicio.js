// inicio.js
const InicioUI = {
  render() {
    const principales = App.modulos.filter(m => m.principal && m.id !== 'inicio');
    const accesos = document.getElementById('inicio-accesos');
    if (!accesos) return;
    accesos.innerHTML = principales.map(m => `
      <button class="acceso-card" style="--mc:${m.color};--mt:${m.tinta}" onclick="App.navegar('${m.id}')">
        <div class="acceso-ico"><i data-lucide="${m.icon}"></i></div>
        <div class="acceso-label">${m.label}</div>
        <div class="acceso-sub">${this.sub(m.id)}</div>
      </button>
    `).join('');
    lucide.createIcons();
  },
  sub(id) {
    const t = {
      ventas: 'Facturas y cobros',
      ordenes: 'Reparaciones y equipos',
      inventario: 'Existencias y ajustes',
      caja: 'Efectivo y movimientos'
    };
    return t[id] || '';
  }
};
window.InicioUI = InicioUI;
