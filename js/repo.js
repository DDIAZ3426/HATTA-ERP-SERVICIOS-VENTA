// repo.js - localStorage data layer
const Repo = {
  key: 'erp_celular_data',
  data: null,
  init() {
    const raw = localStorage.getItem(this.key);
    if (raw) {
      this.data = JSON.parse(raw);
      // Si hay pocos datos, cargar demo para probar la UI
      if ((this.data.facturas || []).length < 20) {
        this.data = this.defaultData();
        this.seedDemo();
        this.save();
      }
    } else {
      this.data = this.defaultData();
      this.seedDemo();
      this.save();
    }
  },
  seedDemo() {
    // Datos de prueba para tienda de celulares informal (RD)
    const nombres = ['Juan Pérez','María González','Carlos Rodríguez','Ana Martínez','Pedro Sánchez','Luisa Fernández','José Ramírez','Carmen Díaz','Miguel Torres','Rosa Jiménez','Francisco López','Isabel Castro','Antonio Ruiz','Patricia Morales','Luis García','Elena Vargas','Rafael Ortiz','Silvia Núñez','Jorge Herrera','Beatriz Rivas'];
    const apellidos = ['Polanco','De la Cruz','Méndez','Valdez','Santana','Peña','Báez','Almonte','Franco','Reyes'];
    const equipos = ['iPhone 13','iPhone 14','iPhone 15','Samsung A54','Samsung S23','Redmi Note 13','Motorola G84','Huawei P60','iPhone 12','Samsung A34','Redmi 12','Nokia G22'];
    const fallas = ['Pantalla rota','No enciende','Batería hinchada','Cámara dañada','No carga','Botones no responden','Mojado','Tapa rota','No tiene señal','Se reinicia solo'];
    const tecnicos = ['José','Carlos','Miguel','Luis'];

    // Clientes (50)
    for (let i = 0; i < 50; i++) {
      const nom = nombres[i % nombres.length] + ' ' + apellidos[i % apellidos.length];
      this.data.clientes.push({
        id: 'cli' + i,
        codigo: 'CLI-' + String(i+1).padStart(3,'0'),
        nombre: nom,
        rnc: i % 7 === 0 ? '1' + String(100000000 + i).slice(0,9) : '',
        tel: '809' + String(1000000 + i).slice(0,7),
        tipo: i % 5 === 0 ? 'empresa' : 'persona',
        estado: 'activo'
      });
    }

    // Proveedores (12)
    const provs = ['Distribuidora Celulares RD','Importadora Tech','Mayorista Samsung','Distribuidor iPhone','Accesorios Plus','Piezas y Partes','China Direct','Miami Imports','Local Tech','Repuestos Express','Distribuidora Norte','Sur Celulares'];
    provs.forEach((n, i) => {
      this.data.proveedores.push({ id: 'prov' + i, codigo: 'PRV-' + String(i+1).padStart(3,'0'), nombre: n, rnc: '', tel: '809555' + String(1000+i) });
    });

    // Items extra (celulares y accesorios)
    const extras = [
      { codigo: 'IP13-128', nombre: 'iPhone 13 128GB', tipo: 'celular', precio: 28000, costo: 23000, stock: 8 },
      { codigo: 'IP14-128', nombre: 'iPhone 14 128GB', tipo: 'celular', precio: 36000, costo: 30000, stock: 6 },
      { codigo: 'S23-128', nombre: 'Samsung S23 128GB', tipo: 'celular', precio: 32000, costo: 27000, stock: 4 },
      { codigo: 'A54', nombre: 'Samsung A54', tipo: 'celular', precio: 18000, costo: 14500, stock: 12 },
      { codigo: 'RN13', nombre: 'Redmi Note 13', tipo: 'celular', precio: 12000, costo: 9500, stock: 15 },
      { codigo: 'FUND-SAM', nombre: 'Funda Samsung', tipo: 'accesorio', precio: 400, costo: 120, stock: 30 },
      { codigo: 'PROT-VID', nombre: 'Protector de vidrio', tipo: 'accesorio', precio: 250, costo: 50, stock: 50 },
      { codigo: 'AURI-BT', nombre: 'Audífonos Bluetooth', tipo: 'accesorio', precio: 850, costo: 350, stock: 18 },
      { codigo: 'SERV-BAT', nombre: 'Cambio de batería', tipo: 'servicio', precio: 1200, costo: 0, stock: 0 },
      { codigo: 'SERV-PIN', nombre: 'Cambio pin de carga', tipo: 'servicio', precio: 800, costo: 0, stock: 0 }
    ];
    extras.forEach((e, i) => {
      this.data.items.push({
        id: 'extra' + i, codigo: e.codigo, nombre: e.nombre, tipo: e.tipo,
        categoriaId: e.tipo === 'celular' ? 'cat1' : e.tipo === 'servicio' ? 'cat5' : 'cat2',
        precio: e.precio, costo: e.costo, itbis: e.tipo !== 'servicio', controlInv: e.tipo !== 'servicio',
        controlImei: e.tipo === 'celular', minimo: e.tipo === 'celular' ? 2 : 5, stock: e.stock
      });
    });

    const hoy = new Date();
    const fechaAtras = (dias) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() - dias);
      return d.toISOString().slice(0,10);
    };

    // 50 ventas
    for (let i = 0; i < 50; i++) {
      const cli = this.data.clientes[i % this.data.clientes.length];
      const item = this.data.items.filter(it => it.tipo === 'celular')[i % 8] || this.data.items[0];
      const total = item.precio + (i % 3 === 0 ? 450 : 0);
      const pagado = i % 4 === 0 ? total : (i % 3 === 0 ? Math.round(total * 0.6) : 0);
      const estado = pagado >= total ? 'pagada' : pagado > 0 ? 'parcial' : 'pendiente';
      const num = 'FAC-' + String(i+1).padStart(4,'0');
      this.data.facturas.push({
        id: 'fac' + i, numero: num, fecha: fechaAtras(i % 30),
        clienteId: cli.id, clienteNombre: cli.nombre,
        total, pagado, pendiente: total - pagado, estado,
        formaPago: pagado >= total ? 'contado' : 'fiado',
        cobros: pagado > 0 ? [{ fecha: fechaAtras(i % 30), monto: pagado, cuentaId: 'cta1' }] : [],
        ncf: '', items: [{ itemId: item.id, nombre: item.nombre, cantidad: 1, precio: item.precio, controlInv: true }]
      });
      if (pagado > 0) {
        this.data.movimientosCaja.push({
          id: 'mc' + i, fecha: fechaAtras(i % 30), tipo: 'entrada', monto: pagado,
          cuentaId: 'cta1', concepto: 'Venta ' + num, origen: 'cobro'
        });
      }
    }
    this.data.numeraciones.fac.prox = 51;

    // 15 compras de equipos
    for (let i = 0; i < 15; i++) {
      const prov = this.data.proveedores[i % this.data.proveedores.length];
      const item = this.data.items.filter(it => it.tipo === 'celular')[i % 6];
      const cant = [5, 8, 12, 6, 10][i % 5];
      const total = item.costo * cant;
      const num = 'COM-' + String(i+1).padStart(4,'0');
      this.data.compras.push({
        id: 'com' + i, numero: num, fecha: fechaAtras(10 + i),
        proveedorId: prov.id, proveedorNombre: prov.nombre,
        total, pagado: i % 3 === 0 ? total : 0, pendiente: i % 3 === 0 ? 0 : total,
        estado: i % 3 === 0 ? 'pagada' : 'pendiente', ncfProv: '',
        items: [{ itemId: item.id, cantidad: cant, costo: item.costo }]
      });
      item.stock = (item.stock || 0) + cant;
      this.data.movimientosInv.push({
        id: 'mi' + i, itemId: item.id, tipo: 'compra', cantidad: cant, referencia: num, fecha: fechaAtras(10 + i)
      });
    }
    this.data.numeraciones.com.prox = 16;

    // 15 equipos en taller
    const estados = ['recibido','diagnostico','reparacion','aprobacion','pieza','listo','reparacion','diagnostico','recibido','listo','reparacion','pieza','diagnostico','listo','recibido'];
    for (let i = 0; i < 15; i++) {
      const cli = this.data.clientes[(i+5) % this.data.clientes.length];
      const eq = equipos[i % equipos.length];
      const est = estados[i];
      const num = 'OS-' + String(i+1).padStart(4,'0');
      this.data.ordenes.push({
        id: 'os' + i, numero: num, fecha: fechaAtras(i % 12),
        clienteId: cli.id, clienteNombre: cli.nombre, clienteTel: cli.tel,
        equipo: eq + ' ' + (128 + (i%3)*128) + 'GB', imei: '35' + String(1000000000000 + i).slice(0,13),
        falla: fallas[i % fallas.length], condicion: i % 3 === 0 ? ['Pantalla rota'] : [],
        accesorios: i % 2 === 0 ? ['Cargador'] : [], clave: '', obs: '',
        tecnico: tecnicos[i % tecnicos.length], prometido: fechaAtras(- (3 + i%5)),
        presupuesto: 800 + (i % 5) * 300, estado: est, facturaNumero: '',
        historial: [{ estado: est, fechaHora: new Date().toISOString(), nota: '' }]
      });
    }
    this.data.numeraciones.os.prox = 16;
  },
  defaultData() {
    return {
      empresa: {
        nombre: 'Mi Tienda de Celulares',
        rnc: '',
        tel: '',
        email: '',
        dir: '',
        ciudad: 'Santo Domingo',
        tipo: 'mixto',
        notaTicket: 'Presentar este ticket para retirar el equipo.',
        retItbis: 30,
        retIsr: 10
      },
      numeraciones: {
        fac: { pre: 'FAC-', prox: 1 },
        com: { pre: 'COM-', prox: 1 },
        cot: { pre: 'COT-', prox: 1 },
        os: { pre: 'OS-', prox: 1 }
      },
      clientes: [],
      proveedores: [],
      items: [
        { id: 'p1', codigo: 'IP15-128', nombre: 'iPhone 15 128GB', tipo: 'celular', categoriaId: 'cat1', precio: 45000, costo: 38000, itbis: true, controlInv: true, controlImei: true, minimo: 2, stock: 5 },
        { id: 'p2', codigo: 'S24-256', nombre: 'Samsung S24 256GB', tipo: 'celular', categoriaId: 'cat1', precio: 38000, costo: 32000, itbis: true, controlInv: true, controlImei: true, minimo: 2, stock: 3 },
        { id: 'p3', codigo: 'FUND-IP', nombre: 'Funda iPhone', tipo: 'accesorio', categoriaId: 'cat3', precio: 450, costo: 150, itbis: true, controlInv: true, controlImei: false, minimo: 5, stock: 20 },
        { id: 'p4', codigo: 'CARG-USBC', nombre: 'Cargador USB-C 20W', tipo: 'accesorio', categoriaId: 'cat4', precio: 650, costo: 250, itbis: true, controlInv: true, controlImei: false, minimo: 5, stock: 15 },
        { id: 's1', codigo: 'SERV-PANT', nombre: 'Cambio de pantalla (mano de obra)', tipo: 'servicio', categoriaId: 'cat5', precio: 1500, costo: 0, itbis: false, controlInv: false, controlImei: false, minimo: 0, stock: 0 }
      ],
      categorias: [
        { id: 'cat1', nombre: 'Celulares' },
        { id: 'cat2', nombre: 'Accesorios' },
        { id: 'cat3', nombre: 'Fundas' },
        { id: 'cat4', nombre: 'Cargadores' },
        { id: 'cat5', nombre: 'Reparaciones' }
      ],
      unidades: [{ id: 'u1', nombre: 'Unidad' }],
      impuestos: [{ id: 'imp1', nombre: 'ITBIS 18%', tasa: 18 }],
      cuentas: [
        { id: 'cta1', nombre: 'Caja principal', tipo: 'efectivo', banco: '', saldoInicial: 0 }
      ],
      facturas: [],
      cotizaciones: [],
      ordenes: [],
      compras: [],
      movimientosCaja: [],
      ajustesInv: [],
      movimientosInv: [],
      imeis: [],
      bitacora: []
    };
  },
  save() {
    localStorage.setItem(this.key, JSON.stringify(this.data));
  },
  get(collection) { return this.data[collection] || []; },
  set(collection, arr) { this.data[collection] = arr; this.save(); },
  add(collection, obj) {
    if (!this.data[collection]) this.data[collection] = [];
    obj.id = obj.id || Utils.uid();
    this.data[collection].push(obj);
    this.save();
    return obj;
  },
  update(collection, id, patch) {
    const arr = this.data[collection];
    const i = arr.findIndex(x => x.id === id);
    if (i >= 0) {
      arr[i] = { ...arr[i], ...patch };
      this.save();
      return arr[i];
    }
  },
  remove(collection, id) {
    this.data[collection] = (this.data[collection] || []).filter(x => x.id !== id);
    this.save();
  },
  find(collection, id) {
    return (this.data[collection] || []).find(x => x.id === id);
  }
};
window.Repo = Repo;
Repo.init();
