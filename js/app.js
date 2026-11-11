// app.js
// Si no hay internet, lucide no carga: el sistema sigue funcionando sin íconos.
if (!window.lucide) window.lucide = { createIcons() {} };

const App = {
  // Andon: cada módulo tiene su color. color = marcador, tinta = texto e ícono.
  // Principales para tienda informal: Taller visible, Dashboard como inicio.
  modulos: [
    { id: 'dashboard',  icon: 'gauge',         label: 'Dashboard',     color: '#60a5fa', tinta: '#1d4ed8', principal: true },
    { id: 'ventas',     icon: 'receipt-text',  label: 'Ventas',        color: '#22c55e', tinta: '#15803d', principal: true },
    { id: 'ordenes',    icon: 'wrench',        label: 'Taller',        color: '#ec4899', tinta: '#be185d', principal: true },
    { id: 'inventario', icon: 'boxes',         label: 'Inventario',    color: '#f59e0b', tinta: '#92400e', principal: true },
    { id: 'caja',       icon: 'landmark',      label: 'Caja',          color: '#2dd4bf', tinta: '#0f766e', principal: true },
    { id: 'compras',    icon: 'shopping-cart', label: 'Compras',       color: '#a78bfa', tinta: '#6d28d9', principal: false },
    { id: 'maestros',   icon: 'database',      label: 'Maestros',      color: '#fb7185', tinta: '#9f1239', principal: false },
    { id: 'config',     icon: 'settings',      label: 'Configuración', color: '#64748b', tinta: '#334155', principal: false }
  ],
  init() {
    this.renderSidebar();
    this.renderBottomNav();
    this.navegar('dashboard');
    document.getElementById('btn-hamburguesa').onclick = () => this.toggleSidebar();
    document.getElementById('sidebar-overlay').onclick = () => this.toggleSidebar(false);
    lucide.createIcons();
    document.getElementById('logo-texto').textContent = Repo.data.empresa.nombre || 'ERP Celulares';
  },
  renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    const principales = this.modulos.filter(m => m.principal);
    const secundarios = this.modulos.filter(m => !m.principal);
    let html = '<div class="menu-grupo">Principales</div>';
    html += principales.map(m => this.menuItem(m)).join('');
    html += '<div class="menu-grupo" style="margin-top:12px">Más</div>';
    html += secundarios.map(m => this.menuItem(m)).join('');
    nav.innerHTML = html;
    document.getElementById('sb-paleta').innerHTML = this.modulos.map(m =>
      `<span style="background:${m.color}" title="${m.label}"></span>`).join('');
    document.getElementById('sidebar-pie').innerHTML = `<div>${Repo.data.empresa.nombre || ''}</div><div style="font-size:0.75rem">${Repo.data.empresa.rnc || ''}</div>`;
    lucide.createIcons();
  },
  menuItem(m) {
    return `<div class="menu-item" data-mod="${m.id}" style="--mc:${m.color};--mt:${m.tinta}" onclick="App.navegar('${m.id}')">
      <i data-lucide="${m.icon}" class="menu-ico"></i> ${m.label}
      <i data-lucide="bookmark" class="menu-marca"></i>
    </div>`;
  },
  renderBottomNav() {
    const principales = this.modulos.filter(m => m.principal);
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    nav.innerHTML = principales.map(m => `
      <button class="bnav-btn" data-mod="${m.id}" style="--mc:${m.color};--mt:${m.tinta}" onclick="App.navegar('${m.id}')">
        <i data-lucide="${m.icon}"></i>
        <span>${m.label}</span>
      </button>
    `).join('') + `
      <button class="bnav-btn" onclick="App.toggleSidebar()">
        <i data-lucide="menu"></i>
        <span>Más</span>
      </button>`;
    lucide.createIcons();
  },
  navegar(mod, sub) {
    document.querySelectorAll('.vista').forEach(v => v.classList.remove('active'));
    const vista = document.getElementById('vista-' + mod);
    if (vista) vista.classList.add('active');
    document.querySelectorAll('.menu-item').forEach(el => el.classList.toggle('active', el.dataset.mod === mod));
    document.querySelectorAll('.bnav-btn').forEach(el => el.classList.toggle('active', el.dataset.mod === mod));
    const m = this.modulos.find(x => x.id === mod);
    if (m) {
      document.documentElement.style.setProperty('--mod', m.color);
      document.documentElement.style.setProperty('--mod-tinta', m.tinta);
    }
    this.toggleSidebar(false);
    if (mod === 'dashboard') DashboardUI.render && DashboardUI.render();
    if (mod === 'ventas') VentasUI.render && VentasUI.render();
    if (mod === 'ordenes') OrdenesUI.render && OrdenesUI.render();
    if (mod === 'compras') ComprasUI.render && ComprasUI.render();
    if (mod === 'inventario') InventarioUI.render && InventarioUI.render();
    if (mod === 'caja') CajaUI.render && CajaUI.render();
    if (mod === 'maestros') MaestrosUI.render && MaestrosUI.render();
    if (mod === 'config') ConfigUI.render && ConfigUI.render();
    if (sub && vista) {
      const btnSub = vista.querySelector(`.subtab-btn[data-panel="${sub}"]`);
      if (btnSub) btnSub.click();
    }
    lucide.createIcons();
  },
  toggleSidebar(force) {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    const open = force !== undefined ? force : !sb.classList.contains('open');
    sb.classList.toggle('open', open);
    ov.classList.toggle('open', open);
  },
  bloquearConsultor() {
    Utils.toast('Modo consultor bloqueado (demo)');
  }
};
window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());

// Subtabs handling
document.addEventListener('click', e => {
  const btn = e.target.closest('.subtab-btn');
  if (btn) {
    const panel = btn.dataset.panel;
    const container = btn.closest('.vista') || btn.parentElement.parentElement;
    container.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
    container.querySelectorAll('.subtab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const target = container.querySelector(`.subtab-panel[data-panel="${panel}"]`);
    if (target) target.classList.add('active');
    lucide.createIcons();
  }
});
