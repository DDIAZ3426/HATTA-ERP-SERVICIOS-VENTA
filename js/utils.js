// utils.js
const Utils = {
  formatMoney(n) {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(n || 0);
  },
  formatDate(d) {
    if (!d) return '—';
    // 'AAAA-MM-DD' se lee como fecha local (si no, en RD sale un día antes)
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
    return dt.toLocaleDateString('es-DO');
  },
  today() {
    // Fecha local de la tienda, no la de Greenwich
    const h = new Date();
    return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
  },
  formatFechaHora(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-DO', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  },
  // Texto que ve el usuario para los códigos internos (estados, tipos, orígenes)
  etiqueta(v) {
    const t = {
      pendiente: 'Pendiente', parcial: 'Parcial', pagada: 'Pagada', anulada: 'Anulada', borrador: 'Borrador', devuelta: 'Devuelta', contado: 'Contado', fiado: 'Fiado',
      entrada: 'Entrada', salida: 'Salida', transferencia: 'Transferencia',
      manual: 'Registrado a mano', cobro: 'Cobro de venta', pago: 'Pago a proveedor', gasto: 'Gasto', devolucion: 'Devolución',
      efectivo: 'Efectivo', banco: 'Banco',
      celular: 'Celular', pieza: 'Pieza', accesorio: 'Accesorio', servicio: 'Servicio',
      persona: 'Persona', empresa: 'Empresa', activo: 'Activo', inactivo: 'Inactivo',
      venta: 'Venta', compra: 'Compra', 'ajuste+': 'Ajuste (entrada)', 'ajuste-': 'Ajuste (salida)'
    };
    return t[v] || v || '';
  },
  // Orden por fecha para todas las listas. 'desc' = lo más reciente arriba.
  // Mismo día: por número de documento y, si no hay, por orden de registro.
  ordenarPorFecha(list, dir = 'desc', campo = 'fecha') {
    const s = dir === 'desc' ? -1 : 1;
    return list.map((x, i) => ({ x, i })).sort((a, b) => s * (
      String(a.x[campo] || '').localeCompare(String(b.x[campo] || '')) ||
      String(a.x.numero || '').localeCompare(String(b.x.numero || ''), 'es', { numeric: true }) ||
      a.i - b.i)).map(o => o.x);
  },
  // 'AAAA-MM-DD' <-> fecha local
  aFecha(ymd) { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d); },
  aTexto(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); },
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },
  toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },
  confirm(msg) {
    return confirm(msg);
  }
};
window.Utils = Utils;
