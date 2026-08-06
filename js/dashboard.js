/* ============================================================
   DASHBOARD — Formato estado financiero.
   Franja de resumen arriba + UN bloque por módulo del menú (1:1).
   Color solo cuando significa algo (vencido, flujo negativo).
   ============================================================ */

const DashUI = {

  async render(){
    const st = await Ops.stats();
    const M  = U.fmtMoney;

    /* --- Franja superior: lo que se mira de un vistazo --- */
    const rs = (label, valor, estado = '') =>
      `<div class="rs"><div class="rs-label">${label}</div>
        <div class="rs-valor ${estado}" title="${valor}">${valor}</div></div>`;

    U.$('dash-resumen').innerHTML =
      rs('Disponible',     M(st.saldoTotal)) +
      rs('Facturado mes',  M(st.facturadoMes)) +
      rs('Por cobrar',     M(st.porCobrar),    st.porCobrar    > 0 ? 'alerta' : '') +
      rs('Vencido',        M(st.vencidoMonto), st.vencidoMonto > 0 ? 'mal'    : '') +
      rs('Flujo mes',      M(st.flujoMes),     st.flujoMes     < 0 ? 'mal'    : '');

    /* --- Filas dentro de cada bloque --- */
    const fila = (label, valor, estado = '', dest = false) =>
      `<div class="fila-kpi${dest ? ' destacado' : ''}">
        <span class="fk-label">${label}</span>
        <span class="fk-valor ${estado}">${valor}</span></div>`;

    const bloque = (icono, titulo, vistaId, cuerpo, subtab = '') => `
      <div class="bloque">
        <div class="bloque-cab"><i data-lucide="${icono}"></i><h3>${titulo}</h3>
          <button class="bloque-ver" onclick="App.navegar('${vistaId}'${subtab ? `,'${subtab}'` : ''})">
            Abrir <i data-lucide="arrow-right"></i></button>
        </div>
        <div class="bloque-cuerpo">${cuerpo}</div>
      </div>`;

    const apagado = (icono, titulo, etapa) => `
      <div class="bloque apagado">
        <div class="bloque-cab"><i data-lucide="${icono}"></i><h3>${titulo}</h3>
          <span class="etiqueta-etapa">${etapa}</span></div>
        <div class="bloque-cuerpo">Disponible en la ${etapa}.</div>
      </div>`;

    U.$('dash-bloques').innerHTML =
      bloque('receipt-text','Ventas','ventas',
        fila('Ventas hoy',            M(st.ventasHoyMonto), '', true) +
        fila('Facturado mes',         M(st.facturadoMes)) +
        fila('Cobrado mes',           M(st.cobradoMes)) +
        fila('Por cobrar',            M(st.porCobrar), st.porCobrar > 0 ? 'alerta' : '') +
        fila('Vencido',               M(st.vencidoMonto), st.vencidoMonto > 0 ? 'mal' : '') +
        fila('Cotizaciones abiertas', st.cotAbiertas)
      ) +
      (App.modulosVisibles().some(m => m.id === 'ordenes') ?
        bloque('clipboard-list','Órdenes de servicio','ordenes',
          fila('Recibidas',           st.ordRecibidas, st.ordRecibidas > 0 ? 'alerta' : '', true) +
          fila('En proceso',          st.ordProceso) +
          fila('Listas para entrega', st.ordListas) +
          fila('Entregadas este mes', st.ordEntregadasMes)
        ) : '') +
      bloque('shopping-cart','Compras','compras',
        fila('Por pagar',             M(st.porPagar), st.porPagar > 0 ? 'alerta' : '', true) +
        fila('Vencido',               M(st.cxpVencidoMonto), st.cxpVencidoMonto > 0 ? 'mal' : '') +
        fila('Compras mes',           M(st.comprasMesMonto)) +
        fila('Pagado mes',            M(st.pagadoMes)) +
        fila('Documentos mes',        st.comprasMesCant)
      , 'porpagar') +
      bloque('boxes','Inventario','inventario',
        fila('Valor a costo',         M(st.invValor), '', true) +
        fila('Artículos controlados', st.invControlados) +
        fila('Bajo mínimo',           st.invBajo, st.invBajo > 0 ? 'alerta' : '') +
        fila('Sin stock',             st.invSin, st.invSin > 0 ? 'mal' : '')
      ) +
      bloque('landmark','Caja y Bancos','caja',
        fila('Total disponible',      M(st.saldoTotal), st.saldoTotal < 0 ? 'mal' : '', true) +
        fila('Caja',                  M(st.saldoCaja)) +
        fila('Bancos',                M(st.saldoBancos)) +
        fila('Entradas mes',          M(st.entradasMes)) +
        fila('Salidas mes',           M(st.salidasMes)) +
        fila('Flujo mes',             M(st.flujoMes), st.flujoMes < 0 ? 'mal' : '')
      ) +
      apagado('file-badge','Fiscal','Etapa 3');

    UI.icons();
  },
};

App.registrar('dashboard', DashUI);
