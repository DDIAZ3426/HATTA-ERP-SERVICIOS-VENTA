/* ============================================================
   INICIO — Saludo, acciones rápidas y accesos
   (La navegación completa vive en la sidebar: Menú de procesos)
   ============================================================ */

const InicioUI = {

  async render(){
    /* ---- Saludo sobrio ---- */
    const h = new Date().getHours();
    U.$('in-saludo').textContent = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    U.$('in-fecha').textContent = new Date().toLocaleDateString(ERP.moneda.locale,
      { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    /* ---- Accesos a módulos, con el color de cada uno ---- */
    const visibles = App.modulosVisibles().map(m => m.id);
    const objetivo = ['ventas','ordenes','compras','inventario','caja','maestros','dashboard']
      .filter(id => visibles.includes(id));
    const desc = {
      ventas:'Facturas, cotizaciones y cobros', compras:'Facturas de proveedores y pagos',
      inventario:'Existencias, kardex y ajustes', caja:'Cuentas, entradas y salidas',
      maestros:'Clientes, artículos y catálogos', dashboard:'Indicadores por módulo',
      ordenes:'Estado de cada trabajo del taller',
    };
    U.$('inicio-accesos').innerHTML = objetivo.map(id => {
      const m = ERP.modulos.find(x => x.id === id);
      return `
        <button class="acceso-card" style="--ac:${m.color};--tinta:${m.tinta}" onclick="App.navegar('${m.id}')">
          <span class="acceso-icono"><i data-lucide="${m.icono}"></i></span>
          <span><strong>${U.esc(m.label)}</strong><small>${U.esc(desc[id] || '')}</small></span>
        </button>`;
    }).join('');
    const btnOrden = U.$('accion-orden');
    if(btnOrden) btnOrden.style.display = visibles.includes('ordenes') ? '' : 'none';
    UI.icons();
  },
};

App.registrar('inicio', InicioUI);
