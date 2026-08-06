/* ============================================================
   ERP.CONFIG — Fuente única de verdad
   ------------------------------------------------------------
   Todo valor que pueda variar por empresa o preferencia vive
   aquí. El resto del código lee de este objeto. Cuando llegue
   Supabase, solo cambia la capa Repo — los módulos no se enteran.
   ============================================================ */

const ERP = {

  /* ---- SISTEMA ---- */
  version: '0.2.6',
  etapa: 'Etapa 2',
  storagePrefix: 'erp_serv_v1_',

  /* ---- MARCA (cámbiala a tu gusto: se refleja en toda la UI) ---- */
  marca: {
    nombre: 'HATTA',     // parte blanca del logo
    acento: 'SERVICE',   // parte azul clara del logo
    eslogan: 'ERP de servicios',
  },

  /* ---- MONEDA / REGIÓN ---- */
  moneda: { codigo: 'DOP', locale: 'es-DO' },
  itbisDefault: 18,

  /* Retenciones sugeridas al cobrar (las tasas varían por caso — el usuario
     las ajusta en Configuración → Empresa). Se aplican sobre el ITBIS
     facturado y sobre el subtotal, respectivamente. */
  retencionesDefault: { itbisPct: 30, isrPct: 10 },
  diasCreditoDefault: 30,
  diasValidezCotizacion: 15,

  /* ---- MÓDULOS (sidebar) — color decorativo / tinta AA ---- */
  modulos: [
    { id:'inicio',      label:'Inicio',        icono:'house',           color:'#38bdf8', tinta:'#075985' },
    { id:'dashboard',   label:'Dashboard',     icono:'gauge',           color:'#60a5fa', tinta:'#1e40af' },
    { id:'ventas',      label:'Ventas',        icono:'receipt-text',    color:'#22c55e', tinta:'#166534' },
    { id:'ordenes', label:'Órdenes de servicio', icono:'clipboard-list', color:'#ec4899', tinta:'#9d174d', soloServicios:true },
    { id:'compras',     label:'Compras',       icono:'shopping-cart',   color:'#a78bfa', tinta:'#6d28d9' },
    { id:'inventario',  label:'Inventario',    icono:'boxes',           color:'#f59e0b', tinta:'#92400e' },
    { id:'caja',        label:'Caja y Bancos', icono:'landmark',        color:'#2dd4bf', tinta:'#0f766e' },
    { id:'maestros',    label:'Maestros',      icono:'database',        color:'#fb7185', tinta:'#9f1239' },
    { id:'fiscal',      label:'Fiscal',        icono:'file-badge',      color:'#ef4444', tinta:'#b91c1c', proxEtapa:'Etapa 3' },
    { id:'reportes',    label:'Reportes',      icono:'bar-chart-3',     color:'#94a3b8', tinta:'#334155', proxEtapa:'Etapa 3' },
    { id:'config',      label:'Configuración', icono:'settings',        color:'#64748b', tinta:'#1e293b' },
  ],

  /* ---- MÉTODOS DE PAGO ---- */
  metodosPago: ['Efectivo','Transferencia','Tarjeta','Cheque','Depósito'],

  /* ---- COMPROBANTES FISCALES (RD) ---- */
  tiposNcf: [
    { id:'B01', label:'B01 — Crédito fiscal' },
    { id:'B02', label:'B02 — Consumo' },
    { id:'SIN', label:'Sin comprobante' },
  ],

  /* ---- ESTADOS: diccionario único ---- */
  estadosVenta: {
    pendiente: { label:'Pendiente', clase:'b-pendiente' },
    parcial:   { label:'Parcial',   clase:'b-parcial' },
    pagada:    { label:'Pagada',    clase:'b-pagada' },
    anulada:   { label:'Anulada',   clase:'b-anulada' },
  },
  estadosCompra: {
    pendiente: { label:'Pendiente', clase:'b-pendiente' },
    parcial:   { label:'Parcial',   clase:'b-parcial' },
    pagada:    { label:'Pagada',    clase:'b-pagada' },
    anulada:   { label:'Anulada',   clase:'b-anulada' },
  },
  estadosCotizacion: {
    abierta:    { label:'Abierta',    clase:'b-abierta' },
    aceptada:   { label:'Aceptada',   clase:'b-aceptada' },
    rechazada:  { label:'Rechazada',  clase:'b-rechazada' },
    convertida: { label:'Convertida', clase:'b-convertida' },
    vencida:    { label:'Vencida',    clase:'b-vencida' },
  },

  /* ---- VALORES POR DEFECTO de empresa y numeraciones ---- */
  empresaDefault: {
    nombre:'Mi Empresa SRL', rnc:'', telefono:'', email:'', direccion:'', ciudad:'Santo Domingo, R.D.',
    retItbisPct:30, retIsrPct:10,
    tipoNegocio:'servicios',   // 'ventas' | 'servicios' | 'mixto'
  },
  tiposNegocio: {
    ventas:    'Ventas (tienda / comercio)',
    servicios: 'Servicios (taller / técnico)',
    mixto:     'Mixto (vende y repara)',
  },
  estadosOrden: {
    recibido:  { label:'Recibido',   clase:'b-pendiente' },
    proceso:   { label:'En proceso', clase:'b-parcial' },
    listo:     { label:'Listo',      clase:'b-pagada' },
    entregado: { label:'Entregado',  clase:'b-anulada' },
    anulada:   { label:'Anulada',    clase:'b-vencida' },
  },
  numeracionesDefault: {
    factura:    { prefijo:'FAC-', proximo:1 },
    cotizacion: { prefijo:'COT-', proximo:1 },
    compra:     { prefijo:'COM-', proximo:1 },
    orden:      { prefijo:'OS-',  proximo:1 },
    /* NCF: la DGII autoriza un RANGO con fecha de vencimiento.
       hasta:0 = sin rango definido (el sistema no valida). */
    ncf: {
      B01:{ desde:1, hasta:0, proximo:1, vence:'' },
      B02:{ desde:1, hasta:0, proximo:1, vence:'' },
    },
  },

  /* ---- UI ---- */
  toastMs: 3200,
  bitacoraCap: 300,
};
