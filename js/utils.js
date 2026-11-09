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
      pendiente: 'Pendiente', parcial: 'Parcial', pagada: 'Pagada', anulada: 'Anulada', borrador: 'Borrador',
      entrada: 'Entrada', salida: 'Salida', transferencia: 'Transferencia',
      manual: 'Registrado a mano', cobro: 'Cobro de venta', pago: 'Pago a proveedor',
      efectivo: 'Efectivo', banco: 'Banco',
      celular: 'Celular', accesorio: 'Accesorio', servicio: 'Servicio',
      persona: 'Persona', empresa: 'Empresa', activo: 'Activo', inactivo: 'Inactivo',
      venta: 'Venta', compra: 'Compra', 'ajuste+': 'Ajuste (entrada)', 'ajuste-': 'Ajuste (salida)'
    };
    return t[v] || v || '';
  },
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
