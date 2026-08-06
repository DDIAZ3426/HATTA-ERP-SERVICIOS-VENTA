/* ============================================================
   UI — Toasts, modales, confirmaciones, iconos
   ============================================================ */

const UI = {

  icons(){ try{ if(window.lucide) lucide.createIcons(); }catch(e){} },

  /* Tira de indicadores: [[label, valor, estado?]] → contenedor .dash-resumen */
  tira(id, items){
    const el = U.$(id); if(!el) return;
    el.innerHTML = items.map(([l, v, e = '']) =>
      `<div class="rs"><div class="rs-label">${l}</div>
        <div class="rs-valor ${e}" title="${v}">${v}</div></div>`).join('');
  },

  /* ---- TOASTS ---- */
  toast(msg, tipo = 'success'){
    const cont = U.$('toast-container');
    if(!cont) return;
    const icono = { success:'check-circle-2', warning:'alert-triangle', danger:'x-circle', info:'info' }[tipo] || 'info';
    const el = document.createElement('div');
    el.className = 'toast toast-' + tipo;
    el.innerHTML = `<i data-lucide="${icono}"></i><span class="toast-msg">${U.esc(msg)}</span>`;
    cont.appendChild(el);
    UI.icons();
    setTimeout(() => { el.classList.add('saliendo'); setTimeout(() => el.remove(), 260); }, ERP.toastMs);
  },

  /* ---- MODAL PRINCIPAL ---- */
  modal({ titulo, icono = 'square-pen', cuerpo = '', pie = '', ancho = '' }){
    const ov = U.$('modal');
    ov.innerHTML = `
      <div class="modal-caja ${ancho}">
        <div class="modal-cabecera">
          <i data-lucide="${icono}"></i><h3>${U.esc(titulo)}</h3>
          <button class="modal-cerrar" onclick="UI.cerrarModal()" aria-label="Cerrar"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-cuerpo">${cuerpo}</div>
        ${pie ? `<div class="modal-pie">${pie}</div>` : ''}
      </div>`;
    ov.classList.add('visible');
    UI.icons();
  },
  cerrarModal(){ const ov = U.$('modal'); ov.classList.remove('visible'); ov.innerHTML = ''; },

  /* ---- MODAL SECUNDARIO (encima del principal) ---- */
  modal2({ titulo, icono = 'plus', cuerpo = '', pie = '' }){
    const ov = U.$('modal2');
    ov.innerHTML = `
      <div class="modal-caja">
        <div class="modal-cabecera">
          <i data-lucide="${icono}"></i><h3>${U.esc(titulo)}</h3>
          <button class="modal-cerrar" onclick="UI.cerrarModal2()" aria-label="Cerrar"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-cuerpo">${cuerpo}</div>
        ${pie ? `<div class="modal-pie">${pie}</div>` : ''}
      </div>`;
    ov.classList.add('visible');
    UI.icons();
  },
  cerrarModal2(){ const ov = U.$('modal2'); ov.classList.remove('visible'); ov.innerHTML = ''; },

  /* ---- CONFIRMACIÓN (Promise<boolean>) ---- */
  confirmar(titulo, mensaje, textoBoton = 'Sí, continuar', clase = 'btn-danger'){
    return new Promise(res => {
      UI._confRes = res;
      UI.modal2({
        titulo, icono:'alert-triangle',
        cuerpo:`<p style="font-size:14px;color:var(--text-dim);line-height:1.6">${U.esc(mensaje)}</p>`,
        pie:`<button class="btn" onclick="UI._conf(false)">Cancelar</button>
             <button class="btn ${clase}" onclick="UI._conf(true)">${U.esc(textoBoton)}</button>`,
      });
    });
  },
  _conf(v){ UI.cerrarModal2(); if(UI._confRes){ UI._confRes(v); UI._confRes = null; } },

  /* ---- HELPERS DE RENDER ---- */
  badge(mapa, estado){
    const e = (mapa || {})[estado] || { label: U.cap(estado), clase:'b-anulada' };
    return `<span class="badge ${e.clase}">${U.esc(e.label)}</span>`;
  },

  opciones(lista, valorSel, texto = x => x.nombre, valor = x => x.id){
    return lista.map(x =>
      `<option value="${U.esc(valor(x))}" ${valor(x) === valorSel ? 'selected' : ''}>${U.esc(texto(x))}</option>`
    ).join('');
  },
};

/* Cerrar modales con clic afuera o Escape */
document.addEventListener('click', e => {
  if(e.target.id === 'modal') UI.cerrarModal();
  if(e.target.id === 'modal2') UI.cerrarModal2();
});
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  if(U.$('modal2').classList.contains('visible')) UI.cerrarModal2();
  else if(U.$('modal').classList.contains('visible')) UI.cerrarModal();
});
