/* ============================================================
   EXPORTX — Excel (.xlsx) y PDF en cualquier tabla del sistema
   ------------------------------------------------------------
   Se monta solo en cada barra de herramientas que tenga tabla.
   Exporta exactamente lo que se ve: respeta el buscador y los
   filtros por columna (TablaX). Las librerías (SheetJS, jsPDF)
   se cargan por CDN solo la primera vez que se usan.
   ============================================================ */

const ExportX = {

  montar(vistaEl){
    if(!vistaEl) return;
    vistaEl.querySelectorAll('.subtab-panel').forEach(panel => {
      const tabla = panel.querySelector('table.tabla');
      const tb = panel.querySelector('.toolbar');
      if(!tabla || !tb || tb.querySelector('.exp-grupo')) return;
      const grupo = document.createElement('span');
      grupo.className = 'exp-grupo';
      grupo.innerHTML = `
        <button type="button" class="btn btn-sm" title="Descargar en Excel" onclick="ExportX.excel(this)">
          <i data-lucide="file-spreadsheet"></i> Excel</button>
        <button type="button" class="btn btn-sm" title="Descargar en PDF" onclick="ExportX.pdf(this)">
          <i data-lucide="file-down"></i> PDF</button>`;
      const count = tb.querySelector('.toolbar-count');
      count ? tb.insertBefore(grupo, count) : tb.appendChild(grupo);
    });
  },

  /* ---------- Lectura de lo visible ---------- */
  _tablaDe(btn){ return btn.closest('.subtab-panel').querySelector('table.tabla'); },

  _datos(tabla){
    const ths = [...tabla.querySelectorAll('thead th')];
    const cols = ths.map((th, i) => ({ i, titulo: (th.querySelector('.hcol') || th).textContent.replace(/[▲▼▾]/g,'').trim() }))
      .filter(c => c.titulo);                                       // fuera columnas de acciones
    const filas = tabla.tBodies[0]
      ? [...tabla.tBodies[0].rows].filter(r => r.style.display !== 'none' && !r.querySelector('.empty'))
      : [];
    const cuerpo = filas.map(r => cols.map(c => {
      const celda = r.cells[c.i];
      return celda ? celda.textContent.replace(/\s+/g,' ').trim() : '';
    }));
    return { cabecera: cols.map(c => c.titulo), cuerpo };
  },

  _titulo(btn){
    const vista = btn.closest('.vista');
    const modulo = vista ? vista.querySelector('.vista-titulo').textContent.trim() : '';
    const sub = btn.closest('.subtab-panel');
    const btnSub = vista ? vista.querySelector(`.subtab-btn[data-panel="${sub.dataset.panel}"]`) : null;
    return `${modulo}${btnSub ? ' — ' + btnSub.textContent.replace(/\d+$/,'').trim() : ''}`;
  },

  _nombreArchivo(titulo){
    return (ERP.marca.nombre + '-' + titulo)
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') + '-' + U.hoy();
  },

  /* ---------- Carga perezosa de librerías (CDN) ---------- */
  _cargar(src){
    return new Promise((res, rej) => {
      if(document.querySelector(`script[src="${src}"]`)) return res();
      const sc = document.createElement('script');
      sc.src = src; sc.onload = res;
      sc.onerror = () => rej(new Error('No se pudo cargar la librería. Revisa tu conexión a internet.'));
      document.head.appendChild(sc);
    });
  },

  /* ---------- Excel ---------- */
  async excel(btn){
    try{
      UI.toast('Preparando Excel…', 'info');
      await ExportX._cargar('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const tabla = ExportX._tablaDe(btn);
      const { cabecera, cuerpo } = ExportX._datos(tabla);
      const ws = XLSX.utils.aoa_to_sheet([cabecera, ...cuerpo]);
      ws['!cols'] = cabecera.map((t, i) => ({
        wch: Math.min(42, Math.max(t.length, ...cuerpo.map(f => (f[i] || '').length), 8) + 2),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Datos');
      XLSX.writeFile(wb, ExportX._nombreArchivo(ExportX._titulo(btn)) + '.xlsx');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },

  /* ---------- PDF ---------- */
  async pdf(btn){
    try{
      UI.toast('Preparando PDF…', 'info');
      await ExportX._cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await ExportX._cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
      const tabla = ExportX._tablaDe(btn);
      const { cabecera, cuerpo } = ExportX._datos(tabla);
      const emp = Repo.configGet('empresa', ERP.empresaDefault);
      const titulo = ExportX._titulo(btn);

      const doc = new jspdf.jsPDF({ orientation: cabecera.length > 6 ? 'landscape' : 'portrait' });
      doc.setFontSize(13); doc.setTextColor(26, 79, 191);
      doc.text(emp.nombre || 'HATTA SERVICE', 14, 14);
      doc.setFontSize(10); doc.setTextColor(90);
      doc.text(`${titulo} · ${U.fmtFecha(U.hoy())}`, 14, 20);
      doc.autoTable({
        head: [cabecera], body: cuerpo, startY: 25,
        styles: { fontSize: 8.5, cellPadding: 2.4 },
        headStyles: { fillColor: [26, 79, 191], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [238, 244, 253] },
      });
      doc.save(ExportX._nombreArchivo(titulo) + '.pdf');
    }catch(e){ UI.toast(e.message, 'warning'); }
  },
};
