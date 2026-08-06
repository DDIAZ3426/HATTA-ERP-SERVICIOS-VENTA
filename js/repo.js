/* ============================================================
   REPO — Capa de datos (patrón Repository)
   ------------------------------------------------------------
   Hoy: localStorage. Mañana: Supabase.
   Toda la app habla con Repo; NUNCA con localStorage directo.
   La API es async a propósito: al migrar a Supabase solo se
   reescriben estos métodos y las vistas no cambian.
   ============================================================ */

const Repo = {

  colecciones: [
    'clientes','proveedores','items','categorias','unidades','impuestos',
    'cuentas','ventas','cotizaciones','cobros','compras','pagos','ajustes','ordenes','movimientos','bitacora',
  ],

  _k(nombre){ return ERP.storagePrefix + nombre; },

  _leer(col){
    try{ return JSON.parse(localStorage.getItem(Repo._k(col))) || []; }
    catch(e){ console.error('[Repo] lectura corrupta:', col, e); return []; }
  },
  _escribir(col, arr){ localStorage.setItem(Repo._k(col), JSON.stringify(arr)); },

  /* ---- CRUD genérico ---- */
  async list(col){ return Repo._leer(col); },

  async get(col, id){ return Repo._leer(col).find(x => x.id === id) || null; },

  async create(col, obj){
    const arr = Repo._leer(col);
    const nuevo = { id: U.uid(), creado: U.ahora(), ...obj };
    arr.push(nuevo);
    Repo._escribir(col, arr);
    return nuevo;
  },

  async update(col, id, patch){
    const arr = Repo._leer(col);
    const i = arr.findIndex(x => x.id === id);
    if(i === -1) return null;
    arr[i] = { ...arr[i], ...patch, actualizado: U.ahora() };
    Repo._escribir(col, arr);
    return arr[i];
  },

  async remove(col, id){
    const arr = Repo._leer(col);
    const filtrado = arr.filter(x => x.id !== id);
    Repo._escribir(col, filtrado);
    return filtrado.length < arr.length;
  },

  /* ---- CONFIG suelta (empresa, numeraciones) ---- */
  configGet(clave, porDefecto){
    try{
      const v = JSON.parse(localStorage.getItem(Repo._k('cfg_' + clave)));
      return (v === null || v === undefined) ? porDefecto : v;
    }catch(e){ return porDefecto; }
  },
  configSet(clave, valor){
    localStorage.setItem(Repo._k('cfg_' + clave), JSON.stringify(valor));
    return valor;
  },

  /* ---- BITÁCORA (auditoría ligera) ---- */
  log(modulo, accion, detalle){
    const arr = Repo._leer('bitacora');
    arr.unshift({ id:U.uid(), fecha:U.ahora(), usuario:'Admin', modulo, accion, detalle: String(detalle||'') });
    if(arr.length > ERP.bitacoraCap) arr.length = ERP.bitacoraCap;
    Repo._escribir('bitacora', arr);
  },

  /* ---- RESPALDO ---- */
  exportar(){
    const data = { _app:'ERP-Servicios', _version:ERP.version, _fecha:U.ahora() };
    Repo.colecciones.forEach(c => data[c] = Repo._leer(c));
    data.cfg_empresa = Repo.configGet('empresa', ERP.empresaDefault);
    data.cfg_numeraciones = Repo.configGet('numeraciones', ERP.numeracionesDefault);
    return JSON.stringify(data, null, 2);
  },

  importar(json){
    const data = JSON.parse(json);
    if(data._app !== 'ERP-Servicios') throw new Error('El archivo no es un respaldo válido de este ERP.');
    Repo.colecciones.forEach(c => { if(Array.isArray(data[c])) Repo._escribir(c, data[c]); });
    if(data.cfg_empresa) Repo.configSet('empresa', data.cfg_empresa);
    if(data.cfg_numeraciones) Repo.configSet('numeraciones', data.cfg_numeraciones);
    return true;
  },

  borrarTodo(){
    Object.keys(localStorage)
      .filter(k => k.startsWith(ERP.storagePrefix))
      .forEach(k => localStorage.removeItem(k));
  },

  hayDatos(){ return Repo._leer('clientes').length > 0 || Repo._leer('items').length > 0; },
};
