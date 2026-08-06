/* ============================================================
   INVENTARIO — Existencias · Movimientos (kardex) · Ajustes
   El stock NUNCA se guarda: se calcula con compras − ventas ±
   ajustes (igual que los saldos de caja). Solo aplica a los
   artículos con "controlar inventario"; los servicios no tienen
   stock, como debe ser en un negocio de servicios.
   ============================================================ */

const InventarioUI = {

  async render(){
    const inv = await Ops.inventario();
    const st = await Ops.stats();
    const M = U.fmtMoney;

    /* --- KPIs --- */
    U.$('inv-kpi-items').textContent = st.invControlados;
    U.$('inv-kpi-valor').textContent = M(st.invValor);
    U.$('inv-kpi-bajo').textContent = st.invBajo;
    U.$('inv-kpi-sin').textContent = st.invSin;

    /* --- Existencias --- */
    const q = (U.$('inv-exi-buscar').value || '').toLowerCase();
    const badgeStock = e =>
      e === 'sin'  ? '<span class="badge b-vencida">Sin stock</span>' :
      e === 'bajo' ? '<span class="badge b-parcial">Bajo</span>' :
                     '<span class="badge b-pagada">OK</span>';

    const exiFiltradas = inv
      .filter(r => !q || r.item.nombre.toLowerCase().includes(q) || (r.item.codigo||'').toLowerCase().includes(q));
    U.$('inv-count').textContent = exiFiltradas.length + ' registros';
    U.$('inv-exi-tbody').innerHTML = exiFiltradas
      .map(r => `
        <tr class="fila-click" onclick="InventarioUI.verMovimientos('${r.item.id}')">
          <td class="doc">${U.esc(r.item.codigo || '')}</td>
          <td>${U.esc(r.item.nombre)}</td>
          <td>${U.esc(r.item.categoria || '—')}</td>
          <td class="num" style="font-size:15px;font-weight:800;color:${r.stock <= 0 ? 'var(--danger)' : 'var(--text)'}">${r.stock}</td>
          <td class="num">${r.minimo || '—'}</td>
          <td class="num">${M(r.item.costo)}</td>
          <td class="num">${M(r.valor)}</td>
          <td>${badgeStock(r.estadoStock)}</td>
          <td class="acciones" onclick="event.stopPropagation()">
            <button class="btn btn-sm" title="Ajustar" onclick="InventarioUI.nuevoAjuste('${r.item.id}')"><i data-lucide="sliders-horizontal"></i></button>
          </td>
        </tr>`).join('')
      || `<tr><td colspan="9" class="empty">No hay artículos con "controlar inventario".
            Actívalo en Maestros → Artículos y servicios.</td></tr>`;

    /* --- Movimientos (kardex) --- */
    const filtro = U.$('inv-mov-item').value;
    const sel = U.$('inv-mov-item');
    const opciones = `<option value="">Todos los artículos</option>` +
      inv.map(r => `<option value="${r.item.id}" ${filtro === r.item.id ? 'selected' : ''}>${U.esc(r.item.nombre)}</option>`).join('');
    if(sel.innerHTML !== opciones) sel.innerHTML = opciones;

    const kardex = await Ops.kardex(filtro || null);
    const badgeMov = t =>
      t === 'compra' ? '<span class="badge b-entrada">Compra</span>' :
      t === 'venta'  ? '<span class="badge b-salida">Venta</span>' :
                       '<span class="badge b-transferencia">Ajuste</span>';
    U.$('inv-mov-tbody').innerHTML = kardex.slice(0, 60).map(m => `
      <tr>
        <td>${U.fmtFecha(m.fecha)}</td>
        <td>${U.esc(m.itemNombre)}</td>
        <td>${badgeMov(m.tipo)}</td>
        <td class="num" style="font-weight:700;color:${m.cant >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${m.cant >= 0 ? '+' : ''}${m.cant}</td>
        <td style="color:var(--text-dim)">${U.esc(m.ref || '')}</td>
      </tr>`).join('')
      || `<tr><td colspan="5" class="empty">Sin movimientos de inventario todavía.</td></tr>`;

    /* --- Ajustes --- */
    const ajustes = (await Repo.list('ajustes'))
      .sort((a,b)=> b.fecha.localeCompare(a.fecha) || (b.creado||'').localeCompare(a.creado||''));
    U.$('inv-aju-tbody').innerHTML = ajustes.map(a => `
      <tr>
        <td>${U.fmtFecha(a.fecha)}</td>
        <td>${U.esc(a.itemNombre)}</td>
        <td class="num" style="font-weight:700;color:${a.cantidad >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${a.cantidad >= 0 ? '+' : ''}${a.cantidad}</td>
        <td>${U.esc(a.motivo)}</td>
        <td class="acciones">
          <button class="btn btn-sm" onclick="InventarioUI.eliminarAjuste('${a.id}')"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('')
      || `<tr><td colspan="5" class="empty">Sin ajustes registrados.</td></tr>`;

    UI.icons();
  },

  verMovimientos(itemId){
    U.$('inv-mov-item').value = itemId;
    App.activarSubtab('inventario', 'movimientos');
    InventarioUI.render();
  },

  /* ---- Ajuste manual ---- */
  async nuevoAjuste(itemId = ''){
    const items = (await Repo.list('items'))
      .filter(i => i.controlaInventario && i.tipo === 'articulo' && i.activo !== false)
      .sort((a,b)=>a.nombre.localeCompare(b.nombre));
    if(!items.length) return UI.toast('No hay artículos con control de inventario. Actívalo en Maestros.', 'warning');

    UI.modal({
      titulo:'Ajuste de inventario', icono:'sliders-horizontal',
      cuerpo:`
        <div class="form-group"><label>Artículo</label>
          <select id="aj-item" class="form-input">${UI.opciones(items, itemId)}</select></div>
        <div class="form-row">
          <div class="form-group"><label>Tipo</label>
            <select id="aj-tipo" class="form-input">
              <option value="entrada">Entrada (+ suma al stock)</option>
              <option value="salida">Salida (− resta del stock)</option>
            </select></div>
          <div class="form-group"><label>Cantidad</label>
            <input id="aj-cant" type="number" min="0" step="0.5" class="form-input"></div>
          <div class="form-group"><label>Fecha</label>
            <input id="aj-fecha" type="date" class="form-input" value="${U.hoy()}"></div>
        </div>
        <div class="form-group"><label>Motivo</label>
          <input id="aj-motivo" class="form-input" placeholder="Ej.: Inventario inicial, conteo físico, merma, daño…"></div>
        <p class="form-ayuda">Las compras y las ventas mueven el stock solas; los ajustes son para todo lo demás.</p>`,
      pie:`<button class="btn" onclick="UI.cerrarModal()">Cancelar</button>
           <button class="btn btn-primary" onclick="InventarioUI.guardarAjuste()"><i data-lucide="check"></i> Registrar ajuste</button>`,
    });
  },

  async guardarAjuste(){
    try{
      const cant = U.num(U.$('aj-cant').value);
      await Ops.crearAjuste({
        itemId: U.$('aj-item').value,
        fecha: U.$('aj-fecha').value,
        cantidad: U.$('aj-tipo').value === 'salida' ? -cant : cant,
        motivo: U.$('aj-motivo').value,
      });
      UI.cerrarModal();
      UI.toast('Ajuste registrado.');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  async eliminarAjuste(id){
    const ok = await UI.confirmar('Eliminar ajuste',
      'Se eliminará el ajuste y el stock se recalculará.', 'Sí, eliminar');
    if(!ok) return;
    try{
      await Ops.eliminarAjuste(id);
      UI.toast('Ajuste eliminado.', 'info');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },
};

App.registrar('inventario', InventarioUI);
