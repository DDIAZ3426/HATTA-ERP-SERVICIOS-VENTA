// dashboard.js
const DashboardUI = {
  render() {
    const facturas = Repo.get('facturas');
    const totalVentas = facturas.reduce((s, f) => s + (f.total || 0), 0);
    const pendientes = facturas.filter(f => f.estado !== 'pagada' && f.estado !== 'anulada').reduce((s, f) => s + (f.pendiente || 0), 0);
    const items = Repo.get('items');
    const ordenes = Repo.get('ordenes');
    const enTaller = ordenes.filter(o => !['entregado', 'devuelto'].includes(o.estado)).length;
    const listos = ordenes.filter(o => o.estado === 'listo').length;
    const stockBajo = items.filter(i => i.controlInv && (i.stock || 0) <= (i.minimo || 0)).length;
    document.getElementById('dash-resumen').innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Ventas totales</div><div class="kpi-value">${Utils.formatMoney(totalVentas)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Por cobrar</div><div class="kpi-value kpi-warn">${Utils.formatMoney(pendientes)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Equipos en taller</div><div class="kpi-value kpi-info">${enTaller}</div></div>
      <div class="kpi-card"><div class="kpi-label">Listos para entregar</div><div class="kpi-value kpi-ok">${listos}</div></div>
      <div class="kpi-card"><div class="kpi-label">Artículos</div><div class="kpi-value">${items.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Bajo mínimo</div><div class="kpi-value kpi-mal">${stockBajo}</div></div>
    `;
    document.getElementById('dash-bloques').innerHTML = '<div class="panel"><div class="panel-body">Resumen operativo de la tienda de celulares.</div></div>';
  }
};
window.DashboardUI = DashboardUI;
