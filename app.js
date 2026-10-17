/**
 * SERVICIO AUTOELÉCTRICO BRIBIESCA - CORE LOGIC (v2.1 ULTRA PERSISTENCE)
 * Conectado a Base de Datos Híbrida (PostgreSQL Render + SQLite Local de Contingencia)
 * Doble persistencia, auto-recuperación de caché local, y respaldo permanente.
 */

// Global State
const STORAGE_KEY = 'autoelectrico_bribiesca_db_v1';
let isCentralDbConnected = false;
let currentDbStatus = null;

let appState = {
  Clientes: [],
  Vehiculos: [],
  Tecnicos: [],
  Servicios_Catalogo: [],
  Inventario_Refacciones: [],
  Ordenes_Trabajo: [],
  Detalle_Servicios: [],
  Detalle_Refacciones: [],
  Configuracion_Taller: []
};

// Initialize State from Central API with LocalStorage Fallback and Auto-Recovery
async function initDatabase() {
  const badge = document.getElementById('db-status-badge');
  try {
    const [resAll, resStatus] = await Promise.all([
      fetch('/api/all'),
      fetch('/api/status').catch(() => null)
    ]);

    if (resStatus && resStatus.ok) {
      currentDbStatus = await resStatus.json();
    }

    if (resAll.ok) {
      const serverData = await resAll.json();
      const localSaved = localStorage.getItem(STORAGE_KEY);
      let localData = null;
      if (localSaved) {
        try { localData = JSON.parse(localSaved); } catch (e) {}
      }

      // Si el caché local tiene más órdenes que el servidor (ej. tras reinicio en Render plan gratuito)
      const serverOrdersCount = (serverData.Ordenes_Trabajo || []).length;
      const localOrdersCount = (localData && localData.Ordenes_Trabajo) ? localData.Ordenes_Trabajo.length : 0;

      if (localData && localOrdersCount > serverOrdersCount) {
        console.log(`Auto-recuperación activa: ${localOrdersCount} órdenes locales vs ${serverOrdersCount} en servidor. Sincronizando...`);
        try {
          await fetch('/api/sync-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localData)
          });
          const refetch = await fetch('/api/all');
          if (refetch.ok) {
            appState = await refetch.json();
          } else {
            appState = localData;
          }
        } catch (syncErr) {
          appState = localData;
        }
      } else {
        appState = serverData;
      }

      isCentralDbConnected = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      updateDbStatusBadge(currentDbStatus);
      renderAll();
      return;
    }
  } catch (err) {
    console.warn('Servidor central no alcanzable, operando en almacenamiento local:', err);
  }

  // Fallback a localStorage
  isCentralDbConnected = false;
  updateDbStatusBadge(null);

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      appState = JSON.parse(saved);
    } catch (e) {
      if (typeof INITIAL_DATABASE !== 'undefined') {
        appState = JSON.parse(JSON.stringify(INITIAL_DATABASE));
      }
    }
  } else if (typeof INITIAL_DATABASE !== 'undefined') {
    appState = JSON.parse(JSON.stringify(INITIAL_DATABASE));
  }
  renderAll();
}

function updateDbStatusBadge(statusInfo) {
  const badge = document.getElementById('db-status-badge');
  if (!badge) return;
  badge.style.cursor = 'pointer';

  if (isCentralDbConnected) {
    const engine = (statusInfo && statusInfo.active_engine) ? statusInfo.active_engine : 'BD Central';
    badge.innerHTML = `🟢 ${engine} (En línea)`;
    badge.style.color = '#34d399';
    badge.style.borderColor = '#10b981';
    badge.title = 'Haz clic para ver detalles de la Base de Datos y Persistencia';
  } else {
    badge.innerHTML = '🟡 Modo Local (Offline / Respaldo)';
    badge.style.color = '#fbbf24';
    badge.style.borderColor = '#f59e0b';
    badge.title = 'Haz clic para ver detalles de conexión';
  }
}

function saveLocalCache() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  updateKPIs();
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : '⚡';
  toast.innerHTML = `<span aria-hidden="true">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupTheme();
  setupSignaturePad();
  setupOrderModal();
  setupInventoryModule();
  setupServicesModule();
  setupClientsModule();
  setupDiagnosticsTool();
  setupPrintableReceipt();
  setupGlobalSearch();
  setupBackupAndSyncModule();

  // Load from Central DB
  initDatabase();

  // Polling seguro cada 15s (evita sobreescritura accidental)
  setInterval(async () => {
    try {
      const res = await fetch('/api/all');
      if (res.ok) {
        const data = await res.json();
        const curOrders = (appState.Ordenes_Trabajo || []).length;
        const newOrders = (data.Ordenes_Trabajo || []).length;
        if (newOrders >= curOrders && JSON.stringify(data) !== JSON.stringify(appState)) {
          appState = data;
          saveLocalCache();
          renderDashboard();
          renderOrders();
          renderInventory();
        }
      }
    } catch (e) {}
  }, 15000);
});

function renderAll() {
  updateKPIs();
  renderDashboard();
  renderOrders();
  renderInventory();
  renderServices();
  renderClients();
  populateFormSelects();
}

// Navigation Tabs
function setupNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-tab');
      document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
      const activeSection = document.getElementById(`view-${target}`);
      if (activeSection) {
        activeSection.classList.add('active');
      }
    });
  });

  const viewAllBtn = document.getElementById('btn-view-all-orders');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      document.getElementById('tab-orders').click();
    });
  }

  // Sincronizar hacia Excel
  const syncExcelBtn = document.getElementById('btn-sync-excel');
  if (syncExcelBtn) {
    syncExcelBtn.addEventListener('click', async () => {
      try {
        showToast('Sincronizando con Excel...', 'info');
        const res = await fetch('/api/sync-excel');
        const result = await res.json();
        if (result.success) {
          showToast('✅ Archivo Excel actualizado desde Base de Datos', 'success');
        } else {
          showToast('Error al sincronizar Excel: ' + (result.error || ''), 'error');
        }
      } catch (err) {
        showToast('No se pudo contactar el servidor central', 'error');
      }
    });
  }
}

// Theme Switcher (Dark / Light)
function setupTheme() {
  const toggleBtn = document.getElementById('btn-toggle-theme');
  const icon = document.getElementById('theme-icon');
  const currentTheme = localStorage.getItem('theme_preference') || 'dark';

  document.documentElement.setAttribute('data-theme', currentTheme);
  icon.textContent = currentTheme === 'light' ? '🌙' : '☀️';

  toggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme_preference', newTheme);
    icon.textContent = newTheme === 'light' ? '🌙' : '☀️';
  });
}

// KPIs Calculation
function updateKPIs() {
  const orders = appState.Ordenes_Trabajo || [];
  const inventory = appState.Inventario_Refacciones || [];

  const activeOrders = orders.filter(o => o.Estado !== 'Entregado' && o.Estado !== 'Cancelado');
  document.getElementById('kpi-active-orders').textContent = activeOrders.length;

  const lowStock = inventory.filter(item => Number(item.Stock_Actual) <= Number(item.Stock_Minimo));
  document.getElementById('kpi-low-stock').textContent = lowStock.length;

  const monthRevenue = orders
    .filter(o => o.Estado_Pago === 'Pagado' || o.Estado === 'Entregado')
    .reduce((sum, o) => sum + (Number(o.Total_General) || 0), 0);
  document.getElementById('kpi-month-revenue').textContent = `$${monthRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const readyOrders = orders.filter(o => o.Estado === 'Listo para Entrega');
  document.getElementById('kpi-ready-orders').textContent = readyOrders.length;
}

// Helper: Get Client & Vehicle Info
function getClientByVehicleId(vehId) {
  const veh = (appState.Vehiculos || []).find(v => v.ID_Vehiculo === vehId);
  if (!veh) return { cliente: null, vehiculo: null };
  const cli = (appState.Clientes || []).find(c => c.ID_Cliente === veh.ID_Cliente);
  return { cliente: cli || null, vehiculo: veh };
}

function getTechnician(techId) {
  return (appState.Tecnicos || []).find(t => t.ID_Tecnico === techId) || { Nombre_Tecnico: 'Sin Asignar' };
}

// DASHBOARD MODULE
function renderDashboard() {
  const tbody = document.getElementById('recent-orders-table');
  if (!tbody) return;

  const orders = [...(appState.Ordenes_Trabajo || [])].reverse().slice(0, 5);

  tbody.innerHTML = orders.map(order => {
    const { cliente, vehiculo } = getClientByVehicleId(order.ID_Vehiculo);
    const tech = getTechnician(order.ID_Tecnico);
    const vehName = vehiculo ? `${vehiculo.Marca} ${vehiculo.Modelo}` : 'Vehículo no reg.';
    const placa = vehiculo ? vehiculo.Placa : '---';
    const cliName = cliente ? cliente.Nombre_Completo : 'Cliente no reg.';

    const statusClass = 
      order.Estado === 'Recepcionado' ? 'status-recepcionado' :
      order.Estado === 'En Diagnóstico' ? 'status-diagnostico' :
      order.Estado === 'En Reparación' ? 'status-reparacion' :
      order.Estado === 'Listo para Entrega' ? 'status-listo' : 'status-entregado';

    return `
      <tr>
        <td><span class="order-id-badge">${order.ID_Orden}</span></td>
        <td>
          <strong>${vehName}</strong>
          <span class="plate-tag" style="margin-left: 0.3rem;">${placa}</span>
        </td>
        <td>${cliName}</td>
        <td>👨‍🔧 ${tech.Nombre_Tecnico.split(' ')[0]}</td>
        <td><span class="status-pill ${statusClass}">${order.Estado}</span></td>
        <td style="font-weight: 700; color: var(--accent-electric);">$${Number(order.Total_General || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td>
          <button type="button" class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="openOrderModal('${order.ID_Orden}')">
            Abrir
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ORDERS KANBAN MODULE
function renderOrders() {
  const diagCol = document.getElementById('col-diagnostico');
  const repCol = document.getElementById('col-reparacion');
  const listoCol = document.getElementById('col-listo');
  const entregadoCol = document.getElementById('col-entregado');

  if (!diagCol) return;

  diagCol.innerHTML = '';
  repCol.innerHTML = '';
  listoCol.innerHTML = '';
  entregadoCol.innerHTML = '';

  const filterStatus = document.getElementById('filter-order-status').value;
  const orders = appState.Ordenes_Trabajo || [];

  let countDiag = 0, countRep = 0, countListo = 0, countEnt = 0;

  orders.forEach(order => {
    if (filterStatus !== 'ALL' && order.Estado !== filterStatus) return;

    const cardHtml = createOrderCardHtml(order);

    if (order.Estado === 'Recepcionado' || order.Estado === 'En Diagnóstico') {
      diagCol.insertAdjacentHTML('beforeend', cardHtml);
      countDiag++;
    } else if (order.Estado === 'En Reparación') {
      repCol.insertAdjacentHTML('beforeend', cardHtml);
      countRep++;
    } else if (order.Estado === 'Listo para Entrega') {
      listoCol.insertAdjacentHTML('beforeend', cardHtml);
      countListo++;
    } else {
      entregadoCol.insertAdjacentHTML('beforeend', cardHtml);
      countEnt++;
    }
  });

  document.getElementById('count-col-diag').textContent = countDiag;
  document.getElementById('count-col-rep').textContent = countRep;
  document.getElementById('count-col-listo').textContent = countListo;
  document.getElementById('count-col-entregado').textContent = countEnt;

  attachOrderCardEvents(document.getElementById('orders-kanban-board'));
}

// Order Card Template
function createOrderCardHtml(order) {
  const { cliente, vehiculo } = getClientByVehicleId(order.ID_Vehiculo);
  const tech = getTechnician(order.ID_Tecnico);

  const statusClass = 
    order.Estado === 'Recepcionado' ? 'status-recepcionado' :
    order.Estado === 'En Diagnóstico' ? 'status-diagnostico' :
    order.Estado === 'En Reparación' ? 'status-reparacion' :
    order.Estado === 'Listo para Entrega' ? 'status-listo' : 'status-entregado';

  const batV = Number(order.Voltaje_Bateria_V) || 0;
  const altV = Number(order.Voltaje_Alternador_V) || 0;

  const batClass = batV >= 12.4 ? 'voltage-ok' : batV > 0 ? 'voltage-low' : '';
  const altClass = altV >= 13.8 && altV <= 14.8 ? 'voltage-charge' : altV > 0 ? 'voltage-low' : '';

  const total = Number(order.Total_General) || 0;
  const saldo = Number(order.Saldo_Pendiente) || 0;

  const vehTitle = vehiculo ? `${vehiculo.Marca} ${vehiculo.Modelo} (${vehiculo.Anio})` : 'Vehículo Desconocido';
  const placa = vehiculo ? vehiculo.Placa : '---';
  const cliName = cliente ? cliente.Nombre_Completo : 'Cliente no registrado';

  return `
    <article class="order-card" data-order-id="${order.ID_Orden}">
      <div class="order-card-header">
        <span class="order-id-badge">${order.ID_Orden}</span>
        <span class="status-pill ${statusClass}">${order.Estado}</span>
      </div>

      <h3 class="vehicle-info">
        ${vehTitle} <span class="plate-tag">${placa}</span>
      </h3>

      <p class="client-name">
        <span aria-hidden="true">👤</span> ${cliName}
      </p>

      <div class="symptom-box">
        <strong>Falla:</strong> ${order.Falla_Reportada || 'Sin descripción'}
      </div>

      <div class="electric-badges">
        ${batV > 0 ? `<span class="electric-badge ${batClass}">🔋 Bat: ${batV}V</span>` : ''}
        ${altV > 0 ? `<span class="electric-badge ${altClass}">⚙️ Alt: ${altV}V</span>` : ''}
        <span class="electric-badge">👨‍🔧 ${tech.Nombre_Tecnico.split(' ')[0]}</span>
      </div>

      <div class="order-financials">
        <div>
          <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Total:</span>
          <span class="order-total">$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Saldo Pendiente:</span>
          <span class="order-pending">$${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div class="order-card-actions no-print">
        <button type="button" class="btn btn-whatsapp btn-order-wa" data-id="${order.ID_Orden}" title="Enviar WhatsApp con estatus y presupuesto">
          <span>💬</span> WhatsApp
        </button>
        <button type="button" class="btn btn-secondary btn-order-ticket" data-id="${order.ID_Orden}" title="Ver Ticket / Imprimir">
          <span>📄</span> Ticket
        </button>
        <button type="button" class="btn btn-outline btn-order-edit" data-id="${order.ID_Orden}" title="Editar orden">
          <span>✏️</span>
        </button>
      </div>
    </article>
  `;
}

// Order Actions
function attachOrderCardEvents(parent) {
  if (!parent) return;

  parent.querySelectorAll('.btn-order-wa').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.getAttribute('data-id');
      sendWhatsAppReport(orderId);
    });
  });

  parent.querySelectorAll('.btn-order-ticket').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.getAttribute('data-id');
      openReceiptModal(orderId);
    });
  });

  parent.querySelectorAll('.btn-order-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.getAttribute('data-id');
      openOrderModal(orderId);
    });
  });

  parent.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', () => {
      const orderId = card.getAttribute('data-order-id');
      openOrderModal(orderId);
    });
  });
}

// WhatsApp Message Generator
function sendWhatsAppReport(orderId) {
  const order = appState.Ordenes_Trabajo.find(o => o.ID_Orden === orderId);
  if (!order) return;

  const { cliente, vehiculo } = getClientByVehicleId(order.ID_Vehiculo);
  if (!cliente || !cliente.Telefono) {
    showToast('El cliente no tiene teléfono registrado', 'warning');
    return;
  }

  let cleanPhone = cliente.Telefono.toString().replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '52' + cleanPhone; // LADA México
  }

  const vehDesc = vehiculo ? `${vehiculo.Marca} ${vehiculo.Modelo} (Placa: ${vehiculo.Placa})` : 'su vehículo';
  const total = Number(order.Total_General) || 0;
  const saldo = Number(order.Saldo_Pendiente) || 0;

  const message = 
`⚡ *SERVICIO AUTOELÉCTRICO BRIBIESCA* ⚡
Hola Estimado(a) *${cliente.Nombre_Completo}*:

Le compartimos el estatus de su unidad *${vehDesc}*:

📋 *Orden:* ${order.ID_Orden}
🔧 *Estatus:* ${order.Estado}
🔋 *Diagnóstico Eléctrico:* ${order.Diagnostico_Tecnico || order.Falla_Reportada || 'En revisión'}
💰 *Presupuesto Total:* $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
💵 *Saldo a Liquidar:* $${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}

📍 *Servicio Autoeléctrico Bribiesca*
Horario: Lun-Vie 8:00 AM - 6:30 PM | Sáb 8:00 AM - 2:00 PM
¡Quedamos a sus órdenes para cualquier duda!`;

  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  showToast('Abriendo WhatsApp...', 'success');
}

// INVENTORY MODULE
function renderInventory() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const query = (document.getElementById('inventory-search')?.value || '').toLowerCase();
  const items = appState.Inventario_Refacciones || [];

  tbody.innerHTML = items
    .filter(item => item.Nombre_Pieza.toLowerCase().includes(query) || item.Categoria.toLowerCase().includes(query) || item.Marca.toLowerCase().includes(query))
    .map(item => {
      const stock = Number(item.Stock_Actual) || 0;
      const min = Number(item.Stock_Minimo) || 2;
      const isLow = stock <= min;

      return `
        <tr>
          <td><span class="order-id-badge">${item.ID_Refaccion}</span></td>
          <td><strong>${item.Nombre_Pieza}</strong></td>
          <td>${item.Categoria}</td>
          <td>${item.Marca}</td>
          <td>
            <span class="${isLow ? 'stock-critical' : 'stock-ok'}">
              ${isLow ? '⚠️ ' : ''}${stock} pza(s)
            </span>
          </td>
          <td>$${Number(item.Precio_Venta || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
          <td><span class="plate-tag">${item.Ubicacion_Almacen || 'Estante'}</span></td>
          <td>
            <div style="display: flex; gap: 0.25rem;">
              <button type="button" class="btn btn-outline btn-stock-adjust" data-id="${item.ID_Refaccion}" data-delta="-1" style="padding: 0.2rem 0.5rem;" title="Disminuir 1 stock">-1</button>
              <button type="button" class="btn btn-outline btn-stock-adjust" data-id="${item.ID_Refaccion}" data-delta="1" style="padding: 0.2rem 0.5rem;" title="Aumentar 1 stock">+1</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('.btn-stock-adjust').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const delta = parseInt(btn.getAttribute('data-delta'), 10);
      adjustStock(id, delta);
    });
  });
}

async function adjustStock(partId, delta) {
  const part = appState.Inventario_Refacciones.find(p => p.ID_Refaccion === partId);
  if (!part) return;

  const newStock = Math.max(0, (Number(part.Stock_Actual) || 0) + delta);
  part.Stock_Actual = newStock;
  saveLocalCache();
  renderInventory();

  // Persistir en Base de Datos Central
  try {
    const res = await fetch(`/api/parts/${partId}/adjust-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    });
    const resJson = await res.json();
    if (res.ok && resJson.success !== false) {
      showToast(`✅ Stock guardado en BD: ${part.Nombre_Pieza} (${newStock})`, 'info');
      return;
    }
  } catch (err) {}
  showToast(`Stock actualizado localmente: ${part.Nombre_Pieza} (${newStock})`, 'info');
}

function setupInventoryModule() {
  document.getElementById('inventory-search')?.addEventListener('input', renderInventory);

  const btnOpenPart = document.getElementById('btn-open-new-part');
  const modalPart = document.getElementById('modal-part');
  const btnClosePart = document.getElementById('btn-close-part-modal');
  const btnCancelPart = document.getElementById('btn-cancel-part');
  const formPart = document.getElementById('form-part');

  if (btnOpenPart && modalPart) {
    btnOpenPart.addEventListener('click', () => modalPart.classList.add('open'));
    btnClosePart.addEventListener('click', () => modalPart.classList.remove('open'));
    btnCancelPart.addEventListener('click', () => modalPart.classList.remove('open'));

    formPart.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPart = {
        ID_Refaccion: `REF-${String(appState.Inventario_Refacciones.length + 1).padStart(3, '0')}`,
        Nombre_Pieza: document.getElementById('part-name').value.trim(),
        Categoria: document.getElementById('part-cat').value,
        Marca: document.getElementById('part-marca').value.trim(),
        Stock_Actual: Number(document.getElementById('part-stock').value) || 0,
        Stock_Minimo: Number(document.getElementById('part-min').value) || 2,
        Precio_Costo: Number(document.getElementById('part-costo').value) || 0,
        Precio_Venta: Number(document.getElementById('part-venta').value) || 0,
        Ubicacion_Almacen: document.getElementById('part-ubi').value.trim()
      };

      appState.Inventario_Refacciones.push(newPart);
      saveLocalCache();
      renderInventory();
      modalPart.classList.remove('open');
      formPart.reset();

      try {
        const res = await fetch('/api/parts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPart)
        });
        const resJson = await res.json();
        if (res.ok && resJson.success !== false) {
          showToast('✅ Refacción guardada en Base de Datos Central', 'success');
        } else {
          showToast('Refacción guardada localmente', 'warning');
        }
      } catch (err) {
        showToast('Guardada en almacenamiento local', 'warning');
      }
    });
  }
}

// SERVICES MODULE
function renderServices() {
  const tbody = document.getElementById('services-table-body');
  if (!tbody) return;

  tbody.innerHTML = (appState.Servicios_Catalogo || [])
    .map(srv => `
      <tr>
        <td><span class="order-id-badge">${srv.ID_Servicio}</span></td>
        <td><strong>${srv.Categoria}</strong></td>
        <td>${srv.Nombre_Servicio}</td>
        <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 300px;">${srv.Descripcion || ''}</td>
        <td>⏱️ ${srv.Tiempo_Estimado_Min || 45} min</td>
        <td style="font-weight: 700; color: var(--accent-electric);">$${Number(srv.Precio_Sugerido || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td>
          <button type="button" class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="addServiceToNewOrder('${srv.ID_Servicio}')">
            Usar en Orden
          </button>
        </td>
      </tr>
    `)
    .join('');
}

function setupServicesModule() {
  const btnNewSrv = document.getElementById('btn-open-new-service');
  if (btnNewSrv) {
    btnNewSrv.addEventListener('click', async () => {
      const name = prompt('Nombre del nuevo servicio:');
      if (!name) return;
      const price = parseFloat(prompt('Precio sugerido ($):', '500') || '0');
      const cat = prompt('Categoría (Alternador, Marcha, Batería, Luces, Diagnóstico):', 'General') || 'General';

      const newSrv = {
        ID_Servicio: `SRV-${String(appState.Servicios_Catalogo.length + 1).padStart(3, '0')}`,
        Categoria: cat,
        Nombre_Servicio: name,
        Descripcion: 'Registrado desde la aplicación',
        Precio_Sugerido: price,
        Tiempo_Estimado_Min: 60,
        Activo: 'Sí'
      };

      appState.Servicios_Catalogo.push(newSrv);
      saveLocalCache();
      renderServices();

      try {
        const res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSrv)
        });
        const resJson = await res.json();
        if (res.ok && resJson.success !== false) {
          showToast('✅ Servicio guardado en Base de Datos Central', 'success');
        } else {
          showToast('Servicio guardado en almacenamiento local', 'warning');
        }
      } catch (e) {
        showToast('Guardado localmente', 'warning');
      }
    });
  }
}

window.addServiceToNewOrder = function(srvId) {
  const srv = appState.Servicios_Catalogo.find(s => s.ID_Servicio === srvId);
  if (!srv) return;
  openOrderModal();
  document.getElementById('order-mano-obra').value = srv.Precio_Sugerido;
  document.getElementById('order-diag').value = srv.Nombre_Servicio;
  showToast(`Servicio "${srv.Nombre_Servicio}" precargado en nueva orden`, 'info');
};

// CLIENTS & VEHICLES MODULE
function renderClients() {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;

  const query = (document.getElementById('clients-search')?.value || '').toLowerCase();
  const clients = appState.Clientes || [];
  const vehicles = appState.Vehiculos || [];

  tbody.innerHTML = clients
    .filter(cli => {
      const cliVehs = vehicles.filter(v => v.ID_Cliente === cli.ID_Cliente);
      const matchVeh = cliVehs.some(v => (v.Placa || '').toLowerCase().includes(query) || (v.Modelo || '').toLowerCase().includes(query));
      return (cli.Nombre_Completo || '').toLowerCase().includes(query) || (cli.Telefono || '').toString().includes(query) || matchVeh;
    })
    .map(cli => {
      const cliVehs = vehicles.filter(v => v.ID_Cliente === cli.ID_Cliente);
      const vehListHtml = cliVehs.map(v => `
        <div style="font-size: 0.8rem; margin-bottom: 0.2rem;">
          🚗 <strong>${v.Marca} ${v.Modelo}</strong> (${v.Anio}) <span class="plate-tag">${v.Placa}</span>
        </div>
      `).join('') || '<span style="color: var(--text-muted); font-size: 0.8rem;">Sin vehículos</span>';

      return `
        <tr>
          <td><span class="order-id-badge">${cli.ID_Cliente}</span></td>
          <td><strong>${cli.Nombre_Completo}</strong></td>
          <td><a href="tel:${cli.Telefono}" style="color: var(--accent-electric); text-decoration: none;">📞 ${cli.Telefono}</a></td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">${cli.Email || '---'}</td>
          <td>${vehListHtml}</td>
          <td>
            <button type="button" class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="createOrderForClient('${cli.ID_Cliente}')">
              ➕ Crear Orden
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function setupClientsModule() {
  document.getElementById('clients-search')?.addEventListener('input', renderClients);

  const btnOpenClient = document.getElementById('btn-open-new-client');
  const modalClient = document.getElementById('modal-client');
  const btnCloseClient = document.getElementById('btn-close-client-modal');
  const btnCancelClient = document.getElementById('btn-cancel-client');
  const formClient = document.getElementById('form-client');

  if (btnOpenClient && modalClient) {
    btnOpenClient.addEventListener('click', () => modalClient.classList.add('open'));
    btnCloseClient.addEventListener('click', () => modalClient.classList.remove('open'));
    btnCancelClient.addEventListener('click', () => modalClient.classList.remove('open'));

    formClient.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newClientId = `CLI-${String(appState.Clientes.length + 1).padStart(3, '0')}`;
      const newVehId = `VEH-${String(appState.Vehiculos.length + 1).padStart(3, '0')}`;

      const clientData = {
        ID_Cliente: newClientId,
        Nombre_Completo: document.getElementById('client-name').value.trim(),
        Telefono: document.getElementById('client-phone').value.trim(),
        Email: document.getElementById('client-email').value.trim(),
        Direccion: '',
        RFC_Facturacion: '',
        Fecha_Registro: new Date().toISOString().slice(0, 10),
        Notas: '',
        ID_Vehiculo: newVehId,
        Marca: document.getElementById('veh-marca').value.trim(),
        Modelo: document.getElementById('veh-modelo').value.trim(),
        Anio: Number(document.getElementById('veh-anio').value) || new Date().getFullYear(),
        Placa: document.getElementById('veh-placa').value.trim().toUpperCase(),
        Color: document.getElementById('veh-color').value.trim()
      };

      const newClient = {
        ID_Cliente: newClientId,
        Nombre_Completo: clientData.Nombre_Completo,
        Telefono: clientData.Telefono,
        Email: clientData.Email,
        Direccion: '',
        RFC_Facturacion: '',
        Fecha_Registro: clientData.Fecha_Registro,
        Notas: ''
      };

      const newVeh = {
        ID_Vehiculo: newVehId,
        ID_Cliente: newClientId,
        Marca: clientData.Marca,
        Modelo: clientData.Modelo,
        Anio: clientData.Anio,
        Placa: clientData.Placa,
        Color: clientData.Color,
        Kilometraje_Actual: 0,
        Tipo_Combustible: 'Gasolina'
      };

      appState.Clientes.push(newClient);
      appState.Vehiculos.push(newVeh);
      saveLocalCache();
      renderClients();
      populateFormSelects();

      modalClient.classList.remove('open');
      formClient.reset();

      try {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientData)
        });
        const resJson = await res.json();
        if (res.ok && resJson.success !== false) {
          showToast(`✅ Cliente ${newClient.Nombre_Completo} guardado en Base de Datos`, 'success');
        } else {
          showToast(`Cliente guardado localmente (${resJson.error || ''})`, 'warning');
        }
      } catch (err) {
        showToast('Guardado en almacenamiento local', 'warning');
      }
    });
  }
}

window.createOrderForClient = function(cliId) {
  const veh = appState.Vehiculos.find(v => v.ID_Cliente === cliId);
  openOrderModal();
  if (veh) {
    document.getElementById('order-vehiculo-select').value = veh.ID_Vehiculo;
  }
};

// SIGNATURE CANVAS
let sigCanvas, sigCtx, isDrawing = false, hasSignature = false;

function setupSignaturePad() {
  sigCanvas = document.getElementById('signature-canvas');
  if (!sigCanvas) return;
  sigCtx = sigCanvas.getContext('2d');

  function resizeCanvas() {
    const rect = sigCanvas.parentElement.getBoundingClientRect();
    sigCanvas.width = rect.width;
    sigCanvas.height = rect.height;
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.strokeStyle = '#0f172a';
  }

  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 300);

  function getPos(e) {
    const rect = sigCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function startDrawing(e) {
    isDrawing = true;
    hasSignature = true;
    document.getElementById('sig-hint').style.display = 'none';
    const pos = getPos(e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
    e.preventDefault();
  }

  function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
    e.preventDefault();
  }

  function stopDrawing() {
    isDrawing = false;
  }

  sigCanvas.addEventListener('mousedown', startDrawing);
  sigCanvas.addEventListener('mousemove', draw);
  sigCanvas.addEventListener('mouseup', stopDrawing);
  sigCanvas.addEventListener('mouseleave', stopDrawing);

  sigCanvas.addEventListener('touchstart', startDrawing, { passive: false });
  sigCanvas.addEventListener('touchmove', draw, { passive: false });
  sigCanvas.addEventListener('touchend', stopDrawing);

  document.getElementById('btn-clear-canvas')?.addEventListener('click', () => {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    hasSignature = false;
    document.getElementById('sig-hint').style.display = 'block';
  });
}

// ORDER MODAL & FORM
function populateFormSelects() {
  const vehSelect = document.getElementById('order-vehiculo-select');
  const techSelect = document.getElementById('order-tecnico-select');

  if (vehSelect) {
    vehSelect.innerHTML = (appState.Vehiculos || []).map(v => {
      const cli = appState.Clientes.find(c => c.ID_Cliente === v.ID_Cliente);
      const owner = cli ? cli.Nombre_Completo : 'Sin dueño';
      return `<option value="${v.ID_Vehiculo}">${v.Placa} - ${v.Marca} ${v.Modelo} (${owner})</option>`;
    }).join('');
  }

  if (techSelect) {
    techSelect.innerHTML = (appState.Tecnicos || []).map(t => `
      <option value="${t.ID_Tecnico}">${t.Nombre_Tecnico} (${t.Especialidad})</option>
    `).join('');
  }
}

function openOrderModal(orderId = null) {
  const modal = document.getElementById('modal-order');
  const form = document.getElementById('form-order');
  const modeTitle = document.getElementById('modal-order-mode');
  const btnDelete = document.getElementById('btn-delete-order');
  populateFormSelects();

  if (sigCtx) {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    document.getElementById('sig-hint').style.display = 'block';
    hasSignature = false;
  }

  if (orderId) {
    const order = appState.Ordenes_Trabajo.find(o => o.ID_Orden === orderId);
    if (!order) return;

    if (btnDelete) {
      btnDelete.style.display = 'inline-block';
      btnDelete.setAttribute('data-id', order.ID_Orden);
    }

    modeTitle.textContent = `Editar Orden ${order.ID_Orden}`;
    document.getElementById('order-edit-id').value = order.ID_Orden;
    document.getElementById('order-vehiculo-select').value = order.ID_Vehiculo;
    document.getElementById('order-tecnico-select').value = order.ID_Tecnico;
    document.getElementById('order-estado-select').value = order.Estado;
    document.getElementById('order-km').value = order.Kilometraje_Ingreso || '';
    document.getElementById('order-volt-bat').value = order.Voltaje_Bateria_V || '';
    document.getElementById('order-volt-alt').value = order.Voltaje_Alternador_V || '';
    document.getElementById('order-marcha-select').value = order.Estado_Marcha || 'Normal';
    document.getElementById('order-obd2').value = order.Codigos_Falla_OBD2 || '';
    document.getElementById('order-falla').value = order.Falla_Reportada || '';
    document.getElementById('order-diag').value = order.Diagnostico_Tecnico || '';
    document.getElementById('order-mano-obra').value = order.Total_Mano_Obra || 0;
    document.getElementById('order-refacciones-cost').value = order.Total_Refacciones || 0;
    document.getElementById('order-anticipo').value = order.Anticipo || 0;
    document.getElementById('order-metodo-pago').value = order.Metodo_Pago || 'Efectivo';
  } else {
    if (btnDelete) btnDelete.style.display = 'none';
    modeTitle.textContent = 'Nueva Orden de Recepción';
    form.reset();
    document.getElementById('order-edit-id').value = '';
    document.getElementById('order-estado-select').value = 'Recepcionado';
  }

  modal.classList.add('open');
}

function setupOrderModal() {
  const modal = document.getElementById('modal-order');
  const btnClose = document.getElementById('btn-close-modal-order');
  const btnCancel = document.getElementById('btn-cancel-order');
  const btnOpenHeader = document.getElementById('btn-open-new-order');
  const btnOpenTab = document.getElementById('btn-create-order-tab');
  const form = document.getElementById('form-order');
  const btnDelete = document.getElementById('btn-delete-order');

  if (btnOpenHeader) btnOpenHeader.addEventListener('click', () => openOrderModal());
  if (btnOpenTab) btnOpenTab.addEventListener('click', () => openOrderModal());
  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('open'));
  if (btnCancel) btnCancel.addEventListener('click', () => modal.classList.remove('open'));

  // Eliminar orden
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const orderId = btnDelete.getAttribute('data-id');
      if (!orderId) return;
      if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente la orden ${orderId}?`)) return;

      try {
        const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
        const resJson = await res.json();
        if (res.ok && resJson.success !== false) {
          showToast(`✅ Orden ${orderId} eliminada de la Base de Datos`, 'success');
        } else {
          showToast(`Error al eliminar: ${resJson.error || ''}`, 'warning');
        }
      } catch (err) {
        showToast('Eliminada localmente', 'info');
      }

      appState.Ordenes_Trabajo = (appState.Ordenes_Trabajo || []).filter(o => o.ID_Orden !== orderId);
      saveLocalCache();
      renderOrders();
      renderDashboard();
      modal.classList.remove('open');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editId = document.getElementById('order-edit-id').value;
    const manoObra = Number(document.getElementById('order-mano-obra').value) || 0;
    const refacciones = Number(document.getElementById('order-refacciones-cost').value) || 0;
    const anticipo = Number(document.getElementById('order-anticipo').value) || 0;
    const total = manoObra + refacciones;
    const saldo = Math.max(0, total - anticipo);

    let sigData = '';
    if (hasSignature && sigCanvas) {
      sigData = sigCanvas.toDataURL('image/png');
    }

    const orderPayload = {
      ID_Orden: editId || `ORD-${String(appState.Ordenes_Trabajo.length + 1).padStart(3, '0')}`,
      ID_Vehiculo: document.getElementById('order-vehiculo-select').value,
      ID_Tecnico: document.getElementById('order-tecnico-select').value,
      Fecha_Ingreso: editId ? (appState.Ordenes_Trabajo.find(o => o.ID_Orden === editId)?.Fecha_Ingreso || new Date().toLocaleString()) : new Date().toLocaleString(),
      Fecha_Entrega_Estimada: '',
      Fecha_Entrega_Real: '',
      Estado: document.getElementById('order-estado-select').value,
      Prioridad: 'Normal',
      Kilometraje_Ingreso: Number(document.getElementById('order-km').value) || 0,
      Nivel_Combustible: '1/2',
      Voltaje_Bateria_V: Number(document.getElementById('order-volt-bat').value) || 0,
      Voltaje_Alternador_V: Number(document.getElementById('order-volt-alt').value) || 0,
      Estado_Marcha: document.getElementById('order-marcha-select').value,
      Codigos_Falla_OBD2: document.getElementById('order-obd2').value.trim(),
      Falla_Reportada: document.getElementById('order-falla').value.trim(),
      Diagnostico_Tecnico: document.getElementById('order-diag').value.trim(),
      Trabajo_Realizado: '',
      Total_Mano_Obra: manoObra,
      Total_Refacciones: refacciones,
      Subtotal: total,
      Descuento: 0,
      Total_General: total,
      Anticipo: anticipo,
      Saldo_Pendiente: saldo,
      Metodo_Pago: document.getElementById('order-metodo-pago').value,
      Estado_Pago: saldo === 0 ? 'Pagado' : anticipo > 0 ? 'Anticipo Parcial' : 'Pendiente',
      Notas_Internas: ''
    };

    if (sigData) {
      orderPayload.Firma_Cliente_Ingreso = sigData;
    } else if (editId) {
      orderPayload.Firma_Cliente_Ingreso = appState.Ordenes_Trabajo.find(o => o.ID_Orden === editId)?.Firma_Cliente_Ingreso || '';
    }

    if (editId) {
      const idx = appState.Ordenes_Trabajo.findIndex(o => o.ID_Orden === editId);
      if (idx !== -1) appState.Ordenes_Trabajo[idx] = orderPayload;
    } else {
      appState.Ordenes_Trabajo.push(orderPayload);
    }

    saveLocalCache();
    renderOrders();
    renderDashboard();
    modal.classList.remove('open');

    // Persistir permanentemente en Base de Datos Central
    try {
      const url = editId ? `/api/orders/${editId}` : '/api/orders';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const resJson = await res.json();
      if (res.ok && resJson.success !== false) {
        showToast(`✅ Guardado permanentemente en Base de Datos (${orderPayload.ID_Orden})`, 'success');
      } else {
        showToast(`⚠️ Guardado localmente. Servidor reportó: ${resJson.error || 'Aviso'}`, 'warning');
      }
    } catch (err) {
      console.warn('Error al guardar en BD central:', err);
      showToast('⚠️ Guardado en caché local del navegador (Servidor desconectado)', 'warning');
    }
  });

  document.getElementById('filter-order-status')?.addEventListener('change', renderOrders);
}

// PRINTABLE RECEIPT MODAL
let currentReceiptOrderId = null;

function openReceiptModal(orderId) {
  currentReceiptOrderId = orderId;
  const modal = document.getElementById('modal-receipt');
  const container = document.getElementById('printable-receipt');
  const order = appState.Ordenes_Trabajo.find(o => o.ID_Orden === orderId);
  if (!order) return;

  const { cliente, vehiculo } = getClientByVehicleId(order.ID_Vehiculo);
  const tech = getTechnician(order.ID_Tecnico);

  container.innerHTML = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.4;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="logo hugo.jpeg" alt="Logo" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px;">
          <div>
            <h1 style="font-size: 1.25rem; font-weight: bold; margin: 0; text-transform: uppercase;">Servicio Autoeléctrico Bribiesca</h1>
            <p style="margin: 2px 0; font-size: 0.8rem; color: #444;">Especialistas en Marchas, Alternadores, Baterías y Diagnóstico</p>
            <p style="margin: 0; font-size: 0.75rem; color: #555;">📞 Tel / WhatsApp: 555-123-4567 | Horario: Lun-Sáb</p>
          </div>
        </div>
        <div style="text-align: right;">
          <h2 style="font-size: 1.15rem; color: #b91c1c; margin: 0;">ORDEN: ${order.ID_Orden}</h2>
          <p style="margin: 4px 0 0; font-size: 0.8rem;"><strong>Fecha:</strong> ${order.Fecha_Ingreso || new Date().toLocaleDateString()}</p>
          <p style="margin: 0; font-size: 0.8rem;"><strong>Estado:</strong> ${order.Estado}</p>
        </div>
      </div>

      <!-- Info Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; font-size: 0.85rem; background: #f8fafc; padding: 10px; border-radius: 6px;">
        <div>
          <h4 style="margin: 0 0 4px; color: #0369a1; text-transform: uppercase;">Datos del Cliente:</h4>
          <p style="margin: 2px 0;"><strong>Nombre:</strong> ${cliente ? cliente.Nombre_Completo : '---'}</p>
          <p style="margin: 2px 0;"><strong>Teléfono:</strong> ${cliente ? cliente.Telefono : '---'}</p>
          <p style="margin: 2px 0;"><strong>Email:</strong> ${cliente && cliente.Email ? cliente.Email : 'N/A'}</p>
        </div>
        <div>
          <h4 style="margin: 0 0 4px; color: #0369a1; text-transform: uppercase;">Datos del Vehículo:</h4>
          <p style="margin: 2px 0;"><strong>Unidad:</strong> ${vehiculo ? `${vehiculo.Marca} ${vehiculo.Modelo} (${vehiculo.Anio})` : '---'}</p>
          <p style="margin: 2px 0;"><strong>Placas:</strong> ${vehiculo ? vehiculo.Placa : '---'} | <strong>Color:</strong> ${vehiculo ? vehiculo.Color : '---'}</p>
          <p style="margin: 2px 0;"><strong>Técnico:</strong> ${tech.Nombre_Tecnico}</p>
        </div>
      </div>

      <!-- Checklist Eléctrico -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; font-size: 0.8rem; background: #fff;">
        <h4 style="margin: 0 0 6px; color: #0f172a; text-transform: uppercase; font-size: 0.85rem;">⚡ Diagnóstico Eléctrico de Entrada:</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
          <div><strong>Bat. Reposo:</strong> ${order.Voltaje_Bateria_V || '--'} V</div>
          <div><strong>Alt. Carga:</strong> ${order.Voltaje_Alternador_V || '--'} V</div>
          <div><strong>Marcha:</strong> ${order.Estado_Marcha || 'Normal'}</div>
          <div><strong>Códigos:</strong> ${order.Codigos_Falla_OBD2 || 'Ninguno'}</div>
        </div>
      </div>

      <!-- Desglose de Servicios & Falla -->
      <div style="margin-bottom: 16px; font-size: 0.85rem;">
        <p style="margin: 4px 0;"><strong>Falla Reportada:</strong> ${order.Falla_Reportada || 'Revisión general'}</p>
        <p style="margin: 4px 0;"><strong>Diagnóstico & Solución:</strong> ${order.Diagnostico_Tecnico || 'En proceso'}</p>
      </div>

      <!-- Totales Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.85rem;">
        <thead>
          <tr style="background: #e2e8f0; border-bottom: 1px solid #94a3b8;">
            <th style="padding: 6px; text-align: left;">Concepto</th>
            <th style="padding: 6px; text-align: right;">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">Servicios y Mano de Obra Eléctrica</td>
            <td style="padding: 6px; text-align: right; border-bottom: 1px solid #e2e8f0;">$${Number(order.Total_Mano_Obra || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">Refacciones e Insumos Eléctricos</td>
            <td style="padding: 6px; text-align: right; border-bottom: 1px solid #e2e8f0;">$${Number(order.Total_Refacciones || 0).toFixed(2)}</td>
          </tr>
          <tr style="font-weight: bold; background: #f1f5f9;">
            <td style="padding: 6px;">TOTAL GENERAL:</td>
            <td style="padding: 6px; text-align: right; font-size: 1rem;">$${Number(order.Total_General || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px; color: #15803d;">Anticipo Abonado:</td>
            <td style="padding: 6px; text-align: right; color: #15803d;">-$${Number(order.Anticipo || 0).toFixed(2)}</td>
          </tr>
          <tr style="font-weight: bold; color: #b91c1c; font-size: 1rem; border-top: 1px solid #000;">
            <td style="padding: 6px;">SALDO PENDIENTE POR LIQUIDAR:</td>
            <td style="padding: 6px; text-align: right;">$${Number(order.Saldo_Pendiente || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Firmas y Términos -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 12px;">
        <div style="width: 45%; text-align: center;">
          ${order.Firma_Cliente_Ingreso ? `<img src="${order.Firma_Cliente_Ingreso}" style="max-height: 50px; display: block; margin: 0 auto;">` : '<div style="height: 50px;"></div>'}
          <div style="border-top: 1px solid #000; padding-top: 4px; font-size: 0.75rem;">Firma de Conformidad del Cliente</div>
        </div>
        <div style="width: 45%; text-align: center;">
          <div style="height: 50px; display: flex; align-items: flex-end; justify-content: center; font-weight: bold; font-size: 0.8rem;">
            Autoeléctrico Bribiesca
          </div>
          <div style="border-top: 1px solid #000; padding-top: 4px; font-size: 0.75rem;">Sello y Firma del Taller</div>
        </div>
      </div>

      <p style="font-size: 0.65rem; color: #64748b; margin-top: 16px; text-align: center;">
        Garantía de 30 días en mano de obra eléctrica. Garantía de refacciones sujeta a políticas de fabricante. No nos hacemos responsables por pertenencias no inventariadas.
      </p>
    </div>
  `;

  modal.classList.add('open');
}

function setupPrintableReceipt() {
  const modal = document.getElementById('modal-receipt');
  document.getElementById('btn-close-receipt')?.addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('btn-close-receipt-btn')?.addEventListener('click', () => modal.classList.remove('open'));

  document.getElementById('btn-print-receipt')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btn-receipt-whatsapp')?.addEventListener('click', () => {
    if (currentReceiptOrderId) {
      sendWhatsAppReport(currentReceiptOrderId);
    }
  });
}

// DIAGNOSTICS & CALCULATOR ASSISTANT
function setupDiagnosticsTool() {
  const batInput = document.getElementById('diag-battery-input');
  const batFill = document.getElementById('diag-battery-fill');
  const batResult = document.getElementById('diag-battery-result');

  function updateBat() {
    const v = parseFloat(batInput.value) || 0;
    if (v >= 12.6) {
      batFill.style.width = '100%';
      batFill.style.background = '#10b981';
      batResult.style.color = '#10b981';
      batResult.innerHTML = `✅ 100% Carga (${v}V): Batería en Excelente Estado Químico`;
    } else if (v >= 12.4) {
      batFill.style.width = '75%';
      batFill.style.background = '#38bdf8';
      batResult.style.color = '#38bdf8';
      batResult.innerHTML = `🔋 75% Carga (${v}V): Batería Buena, carga aceptable`;
    } else if (v >= 12.0) {
      batFill.style.width = '45%';
      batFill.style.background = '#f59e0b';
      batResult.style.color = '#f59e0b';
      batResult.innerHTML = `⚠️ 25% - 50% Carga (${v}V): Descarga Media. Requiere carga lenta o revisión de alternador`;
    } else {
      batFill.style.width = '20%';
      batFill.style.background = '#ef4444';
      batResult.style.color = '#ef4444';
      batResult.innerHTML = `🚨 Descarga Profunda (${v}V): Batería Agotada o celda comunicada. Peligro de daño a marcha`;
    }
  }

  batInput?.addEventListener('input', updateBat);

  const altInput = document.getElementById('diag-alt-input');
  const altFill = document.getElementById('diag-alt-fill');
  const altResult = document.getElementById('diag-alt-result');

  function updateAlt() {
    const v = parseFloat(altInput.value) || 0;
    if (v >= 13.8 && v <= 14.7) {
      altFill.style.width = '85%';
      altFill.style.background = '#10b981';
      altResult.style.color = '#10b981';
      altResult.innerHTML = `✅ Sistema de Carga Normal (${v}V): Alternador y regulador funcionando óptimamente`;
    } else if (v > 14.7) {
      altFill.style.width = '100%';
      altFill.style.background = '#ef4444';
      altResult.style.color = '#ef4444';
      altResult.innerHTML = `🚨 SOBRECARGA PELIGROSA (${v}V): Regulador en corto. Puede hervir la batería o quemar computadoras`;
    } else if (v >= 13.2) {
      altFill.style.width = '60%';
      altFill.style.background = '#f59e0b';
      altResult.style.color = '#f59e0b';
      altResult.innerHTML = `⚠️ Carga Baja (${v}V): Diodo abierto o carbones gastados. No mantendrá la batería en tráfico nocturno`;
    } else {
      altFill.style.width = '25%';
      altFill.style.background = '#ef4444';
      altResult.style.color = '#ef4444';
      altResult.innerHTML = `🚨 ALTERNADOR NO CARGA (${v}V): Sistema operando solo con la reserva de la batería`;
    }
  }

  altInput?.addEventListener('input', updateAlt);
}

// GLOBAL SEARCH
function setupGlobalSearch() {
  const searchInput = document.getElementById('global-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderOrders();
      return;
    }

    document.getElementById('tab-orders').click();

    const allCards = document.querySelectorAll('.order-card');
    allCards.forEach(card => {
      const text = card.textContent.toLowerCase();
      if (text.includes(q)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

// BACKUP, IMPORT AND DATABASE STATUS MODULE
function setupBackupAndSyncModule() {
  // Exportar respaldo JSON
  const exportBtn = document.getElementById('btn-export-data');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute("href", dataStr);
      dlAnchor.setAttribute("download", `Respaldo_Autoelectrico_Bribiesca_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
      showToast('✅ Respaldo JSON descargado correctamente', 'success');
    });
  }

  // Importar / Restaurar respaldo JSON
  const importBtn = document.getElementById('btn-import-data');
  const fileInput = document.getElementById('file-import-data');
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!parsed.Clientes && !parsed.Ordenes_Trabajo) {
            showToast('El archivo no parece ser un respaldo válido del sistema', 'error');
            return;
          }
          appState = parsed;
          saveLocalCache();
          renderAll();

          // Sincronizar inmediatamente con base de datos del servidor
          showToast('Sincronizando respaldo con base de datos...', 'info');
          const res = await fetch('/api/sync-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appState)
          });
          const resJson = await res.json();
          if (res.ok && resJson.success !== false) {
            showToast('✅ Respaldo restaurado y persistido permanentemente en Base de Datos', 'success');
          } else {
            showToast('Respaldo cargado localmente', 'warning');
          }
        } catch (err) {
          showToast('Error al leer el archivo JSON: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  // Modal Estado de Base de Datos y Persistencia
  const badge = document.getElementById('db-status-badge');
  const modalStatus = document.getElementById('modal-db-status');
  const btnCloseModal = document.getElementById('btn-close-db-status-modal');
  const btnClose = document.getElementById('btn-close-db-status');
  const btnForceSync = document.getElementById('btn-force-sync');
  const statusContent = document.getElementById('db-status-modal-content');

  async function openDbStatusModal() {
    if (!modalStatus) return;
    modalStatus.classList.add('open');
    if (statusContent) {
      statusContent.innerHTML = '<p>Consultando estado del servidor y persistencia...</p>';
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const s = await res.json();
          statusContent.innerHTML = `
            <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--border-color);">
              <div style="font-size: 1.1rem; font-weight: 700; color: ${s.pg_healthy ? '#34d399' : '#38bdf8'}; margin-bottom: 0.5rem;">
                ${s.pg_healthy ? '🟢' : '📁'} Motor Activo: ${s.active_engine}
              </div>
              <p style="margin: 0.25rem 0;"><strong>Tipo Base de Datos:</strong> ${s.database_type}</p>
              <p style="margin: 0.25rem 0;"><strong>PostgreSQL en la Nube:</strong> ${s.pg_healthy ? '✅ Conectado y Saludable' : '⚠️ No activo (usando SQLite de contingencia)'}</p>
              <p style="margin: 0.25rem 0;"><strong>Doble Escritura Automática:</strong> ${s.dual_write_enabled ? '✅ Activa (PostgreSQL + SQLite)' : 'Inactiva'}</p>
              <p style="margin: 0.25rem 0;"><strong>Persistencia Permanente:</strong> ${s.is_persistent ? '✅ Garantizada' : 'Modo memoria'}</p>
            </div>
            <h4 style="margin: 0.5rem 0; color: var(--accent-electric);">Registros Persistidos en Base de Datos:</h4>
            <ul style="margin: 0.5rem 0; padding-left: 1.25rem;">
              <li>Órdenes de Trabajo: <strong>${s.counts?.orders || 0}</strong></li>
              <li>Clientes Registrados: <strong>${s.counts?.clients || 0}</strong></li>
              <li>Vehículos Registrados: <strong>${s.counts?.vehicles || 0}</strong></li>
              <li>Refacciones en Inventario: <strong>${s.counts?.parts || 0}</strong></li>
            </ul>
            <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-secondary); background: rgba(56, 189, 248, 0.08); padding: 0.75rem; border-radius: 6px; border-left: 3px solid var(--accent-electric);">
              💡 <strong>Garantía de Persistencia en Render:</strong> El sistema guarda cada cambio en PostgreSQL y SQLite simultáneamente. Si el contenedor de Render se reinicia, el navegador auto-sincroniza los registros pendientes sin perder información.
            </div>
          `;
        } else {
          statusContent.innerHTML = '<p style="color: #ef4444;">Error al obtener estado del servidor.</p>';
        }
      } catch (e) {
        statusContent.innerHTML = `<p style="color: #f59e0b;">Servidor no alcanzable en este momento. Los cambios se conservan en tu navegador (${(appState.Ordenes_Trabajo || []).length} órdenes locales).</p>`;
      }
    }
  }

  if (badge) badge.addEventListener('click', openDbStatusModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', () => modalStatus.classList.remove('open'));
  if (btnClose) btnClose.addEventListener('click', () => modalStatus.classList.remove('open'));

  if (btnForceSync) {
    btnForceSync.addEventListener('click', async () => {
      btnForceSync.disabled = true;
      btnForceSync.textContent = 'Sincronizando...';
      try {
        const res = await fetch('/api/sync-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appState)
        });
        const resJson = await res.json();
        if (res.ok && resJson.success !== false) {
          showToast(`✅ Sincronización exitosa: ${resJson.orders_synced} órdenes persistidas`, 'success');
          openDbStatusModal();
        } else {
          showToast('Error al sincronizar: ' + (resJson.error || ''), 'error');
        }
      } catch (e) {
        showToast('Error de red al sincronizar: ' + e.message, 'error');
      } finally {
        btnForceSync.disabled = false;
        btnForceSync.textContent = 'Forzar Sincronización Ahora';
      }
    });
  }
}
