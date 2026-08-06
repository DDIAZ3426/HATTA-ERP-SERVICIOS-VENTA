# HATTA SERVICE — ERP de servicios (Etapa 2 · v0.2.6)

ERP sencillo, modular y rápido, pensado para negocios de servicios en República Dominicana.
Hereda la identidad visual de HATTA (colores, tipografías, iconos y estilo sobrio) y su nombre: **HATTA SERVICE**. La marca se cambia en `js/erp.config.js` si algún día hace falta.
**HATTA no fue modificado en absoluto**: este es un proyecto independiente.

---

## Cómo abrirlo

1. Descomprime la carpeta donde quieras.
2. Abre `index.html` en el navegador (doble clic). No hay que instalar nada ni compilar.
3. Se necesita internet la primera vez (fuentes de Google e iconos Lucide se cargan por CDN).

La primera vez se cargan **datos de ejemplo** (empresa "Servitec RD SRL", clientes,
servicios, facturas, cobros, compras, pagos, inventario y cuentas) para que explores todo
con datos realistas. Si ya usabas la Etapa 1, tus datos siguen funcionando; para ver la
demo nueva de Compras e Inventario usa `Configuración → Datos → Restablecer datos demo`.

## Qué incluye hasta la Etapa 2

| Módulo | Estado |
|---|---|
| Inicio (acciones rápidas y accesos) · navegación por "Menú de procesos": lista con divisores en la barra lateral con TODOS los procesos del sistema | ✔ completo |
| Dashboard (un bloque por módulo del menú, formato estado financiero) | ✔ completo |
| Ventas — **Facturas · Cotizaciones · Por cobrar** (cobrar es una acción, no una pestaña) | ✔ completo |
| Caja y Bancos — **Cuentas · Movimientos** (un listado con filtro de tipo y de origen) | ✔ completo |
| Maestros (clientes, proveedores, artículos y servicios, impuestos, categorías, unidades, cuentas) | ✔ completo |
| Configuración (empresa, numeraciones/NCF, respaldos, bitácora) | ✔ completo |
| Compras — **Compras · Por pagar** (aging, líneas libres para gastos, anulaciones) | ✔ completo |
| Inventario (existencias con estados OK/bajo/sin stock, kardex, ajustes) | ✔ completo |
| Fiscal (adaptador e-CF) · Reportes | Etapa 3 |

Reglas de negocio ya activas:

- Los **precios se guardan sin ITBIS**; el 18% (o la tasa del impuesto asignado) se suma por línea.
- Un **cobro genera automáticamente una entrada en Caja y Bancos**. Para revertirlo, se anula
  el cobro en Ventas (el movimiento de caja se elimina solo). No se puede borrar desde Caja.
- **NCF**: al elegir cliente con RNC de 9 dígitos se sugiere B01; sin RNC, B02. La secuencia
  se administra en Configuración → Numeraciones (serie + 8 dígitos, ej. `B0100000015`).
- **Rango autorizado y vencimiento del NCF** (v0.2.6): cada tipo tiene `desde`, `hasta` y
  `vence`, tal como los autoriza la DGII. El sistema **no deja emitir** fuera del rango ni
  después del vencimiento, y avisa en la campana cuando quedan pocos o falta poco para vencer.
  `hasta = 0` significa "sin rango definido": no valida (compatible con instalaciones viejas).
- **Retenciones de ITBIS e ISR** (v0.2.6): al registrar un cobro se puede marcar que el
  cliente retuvo impuestos. Lo retenido **no entra a Caja** (el cliente se lo paga a la DGII
  a tu nombre) pero **sí salda la factura**. Sin esto, toda factura con retención quedaba
  "parcial" para siempre. Las tasas sugeridas se configuran en Configuración → Empresa;
  siempre se puede escribir otro monto.
- **RNC del comprador en la factura impresa** (v0.2.6): una B01 sin el RNC del cliente no le
  sirve para el crédito fiscal. Ahora se guarda en la venta y se imprime, junto con la fecha
  de validez del comprobante. Las facturas viejas lo buscan en el maestro de clientes.
- Estados de venta: pendiente → parcial → pagada (o anulada, solo si no tiene cobros).
- Clientes/servicios con historial no se eliminan: se **desactivan** (se conserva el historial).

## Para usar tu empresa real

1. `Configuración → Datos → Exportar respaldo` (por si quieres conservar la demo).
2. `Configuración → Datos → Empezar de cero`: borra todo y deja catálogos mínimos.
3. Llena `Configuración → Empresa` y `Numeraciones` (tus secuencias NCF de la DGII).
4. Crea tus maestros (clientes, servicios, cuentas) y a trabajar.

**Importante:** los datos viven en el `localStorage` del navegador. Exporta respaldos
JSON con frecuencia (`Configuración → Datos`). El respaldo se importa en cualquier
otra computadora o navegador.

## Personalización

- **Nombre del sistema**: `js/erp.config.js` → `ERP.marca` (nombre, acento, eslogan).
- **Colores**: `css/base.css` → variables `:root` (mismos tokens que HATTA).
- **ITBIS por defecto, días de crédito, validez de cotizaciones, métodos de pago**: `js/erp.config.js`.

## Arquitectura (para las próximas etapas)

```
Vistas (ventas.js, caja.js, …)
   ↓ solo hablan con
Ops (ops.js — reglas de negocio, sin DOM)
   ↓ solo habla con
Repo (repo.js — hoy localStorage, mañana Supabase)
```

- `Repo` es la capa conectable: para migrar a Supabase/PostgreSQL se reescribe **solo**
  `repo.js` con las mismas funciones (`list/get/create/update/remove`); las vistas no cambian.
- `Bus` (en `utils.js`) emite eventos de negocio (`VENTA_CREADA`, `COBRO_CREADO`, …) y la UI
  se refresca sola: los módulos no se conocen entre sí.
- **Dos mundos en un sistema**: en Configuración → Empresa se elige el tipo de negocio.
  "Ventas" (tienda) oculta las Órdenes de servicio; "Servicios" o "Mixto" (taller/técnico)
  las muestra: recibido → en proceso → listo → entregado, con técnico, fecha prometida y
  botón Facturar que crea la venta enlazada.
- **Modo consultor**: un PIN (Configuración → Datos) bloquea Maestros y Configuración.
  La secretaria factura, cobra y consulta; solo el consultor edita catálogos y ajustes.
- **Exportar en un clic**: todas las tablas tienen botones Excel (.xlsx) y PDF que
  descargan exactamente lo que se ve (respetan buscador y filtros). Las facturas se ven
  en pantalla, se imprimen o se guardan como PDF.
- **Las ventas también aceptan líneas libres** (conceptos sin catálogo), igual que compras:
  ideal para facturar servicios puntuales o la reparación de una orden.
- **Todas las tablas ordenan y filtran por columna** (patrón del Historial de HATTA):
  clic en el título ordena (▲/▼) y el botón ▾ abre un panel con los valores únicos de esa
  columna, sus conteos, buscador y Todos/Ninguno. Las columnas de montos solo ordenan.
- Un **pago genera automáticamente una salida en Caja y Bancos**. Se revierte anulando el
  pago en Compras (el movimiento se elimina solo), igual que los cobros.
- Las **compras aceptan líneas libres** (gastos como internet o papelería) sin pasar por
  Maestros; esas líneas no mueven inventario.
- El **stock nunca se guarda: se calcula** (ajustes + compras − ventas de documentos no
  anulados), la misma filosofía de los saldos de caja. Solo aplica a artículos con
  "controlar inventario"; los servicios no llevan stock.
- El **NCF del proveedor** se guarda tal como viene en su factura (en mayúsculas): será la
  base del reporte 606 en la Etapa 3.
- `smoke_test.js` (herramienta de desarrollo): `node smoke_test.js` valida la lógica
  (totales, cobros/pagos, anulaciones, transferencias, numeración, stock, kardex y órdenes de servicio) — 60 pruebas.
- `ui_test.js` (herramienta de desarrollo): `npm i` y luego `node ui_test.js` arranca la app
  completa en jsdom y verifica boot, menú de procesos, navegación de todos los módulos,
  apertura de todos los modales, alertas, filtros por columna, órdenes, exportación y candado de consultor — 67 verificaciones.

## Roadmap

- **Etapa 3** — Fiscal con `FiscalAdapter` intercambiable (e-CF/DGII) y Reportes con exportación.
- **Después** — Backend: Supabase (auth, RLS multiempresa) cambiando únicamente la capa Repo.
