/* ============================================================
   UTILS — Formatos, fechas, ids, escape. Sin dependencias.
   BUS — Mini bus de eventos para desacoplar módulos.
   ============================================================ */

const U = {
  /* SHA-256 en hex (para el PIN del consultor) */
  async hash(txt){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(txt)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  },


  uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); },

  round2(n){ return Math.round((Number(n)||0) * 100) / 100; },
  num(v){ const n = parseFloat(v); return isNaN(n) ? 0 : n; },

  _fmt: null,
  fmtMoney(n){
    if(!U._fmt) U._fmt = new Intl.NumberFormat(ERP.moneda.locale, {
      style:'currency', currency:ERP.moneda.codigo, minimumFractionDigits:2, maximumFractionDigits:2 });
    return U._fmt.format(Number(n)||0);
  },

  hoy(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  },
  ahora(){ return new Date().toISOString(); },

  addDays(iso, dias){
    const [y,m,d] = String(iso).split('-').map(Number);
    const f = new Date(y, m-1, d + Number(dias||0));
    return f.getFullYear() + '-' + String(f.getMonth()+1).padStart(2,'0') + '-' + String(f.getDate()).padStart(2,'0');
  },

  diasEntre(desdeIso, hastaIso){
    const a = new Date(desdeIso + 'T00:00:00');
    const b = new Date(hastaIso + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  },

  esMesActual(iso){ return String(iso||'').slice(0,7) === U.hoy().slice(0,7); },

  fmtFecha(iso){
    if(!iso) return '—';
    const [y,m,d] = String(iso).slice(0,10).split('-');
    return `${d}/${m}/${y}`;
  },
  fmtFechaHora(isoFull){
    if(!isoFull) return '—';
    const f = new Date(isoFull);
    if(isNaN(f)) return U.fmtFecha(isoFull);
    return U.fmtFecha(f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0')+'-'+String(f.getDate()).padStart(2,'0'))
      + ' ' + String(f.getHours()).padStart(2,'0') + ':' + String(f.getMinutes()).padStart(2,'0');
  },

  esc(s){
    return String(s ?? '').replace(/[&<>"']/g, c => (
      {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
    ));
  },

  cap(s){ s = String(s||''); return s.charAt(0).toUpperCase() + s.slice(1); },

  $(id){ return document.getElementById(id); },
};

/* ---- BUS DE EVENTOS ----
   La lógica transaccional vive en Ops (atómica sobre el Repo).
   El bus se usa para que los módulos de UI se refresquen sin
   conocerse entre sí — el patrón de eventos del plan, en chico. */
const Bus = {
  _l: {},
  on(evento, fn){ (Bus._l[evento] = Bus._l[evento] || []).push(fn); },
  emit(evento, data){
    (Bus._l[evento] || []).forEach(fn => { try{ fn(data); }catch(e){ console.error('[Bus]', evento, e); } });
    (Bus._l['*'] || []).forEach(fn => { try{ fn(evento, data); }catch(e){ console.error('[Bus:*]', e); } });
  },
};
