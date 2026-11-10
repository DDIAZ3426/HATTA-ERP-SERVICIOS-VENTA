// dashboard.js
const DashboardUI = {
  render() {
    const facturas = Repo.get('facturas');
    const hoy = new Date();
    const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
    const delMes = facturas.filter(f => (f.fecha || '').startsWith(mesActual) && f.estado !== 'anulada');
    const ventasMes = delMes.reduce((s, f) => s + (f.total || 0) - (f.devuelto || 0), 0);
    const totalVentas = facturas.reduce((s, f) => s + (f.total || 0), 0);
    const pendientes = facturas.filter(f => f.estado !== 'pagada' && f.estado !== 'anulada').reduce((s, f) => s + (f.pendiente || 0), 0);

    // Costo aproximado del mes (solo líneas con itemId)
    let costoMes = 0;
    delMes.forEach(f => {
      (f.items || []).forEach(l => {
        if (l.itemId) {
          const it = Repo.find('items', l.itemId);
          if (it) costoMes += (it.costo || 0) * (l.cantidad || 1);
        }
      });
    });
    const gananciaMes = ventasMes - costoMes;

    const items = Repo.get('items');
    const ordenes = Repo.get('ordenes');
    const enTaller = ordenes.filter(o => !['entregado', 'devuelto'].includes(o.estado)).length;
    const listos = ordenes.filter(o => o.estado === 'listo').length;
    // Mismo criterio que la pantalla de Inventario
    const inv = items.filter(i => i.controlInv);
    const agotados = inv.filter(i => InventarioUI.estadoStock(i) === 'agotado').length;

    // Equipos con más de 30 días
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    const hace30str = hace30.toISOString().slice(0, 10);
    const abandonados = ordenes.filter(o => !['entregado', 'devuelto'].includes(o.estado) && o.fecha < hace30str).length;

    document.getElementById('dash-resumen').innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Ventas del mes</div><div class="kpi-value">${Utils.formatMoney(ventasMes)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Ganancia aprox. mes</div><div class="kpi-value ${gananciaMes >= 0 ? 'kpi-ok' : 'kpi-mal'}">${Utils.formatMoney(gananciaMes)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Por cobrar</div><div class="kpi-value kpi-warn">${Utils.formatMoney(pendientes)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Órdenes activas</div><div class="kpi-value kpi-info">${enTaller}</div></div>
      <div class="kpi-card"><div class="kpi-label">Listos para entregar</div><div class="kpi-value kpi-ok">${listos}</div></div>
      <div class="kpi-card"><div class="kpi-label">Más de 30 días</div><div class="kpi-value ${abandonados ? 'kpi-mal' : ''}">${abandonados}</div></div>
      <div class="kpi-card kpi-clic" onclick="InventarioUI.irA('agotado')" title="Ver en Inventario"><div class="kpi-label">Agotados</div><div class="kpi-value kpi-mal">${agotados}</div></div>
    `;
    document.getElementById('dash-bloques').innerHTML = '';
  }
};
window.DashboardUI = DashboardUI;
