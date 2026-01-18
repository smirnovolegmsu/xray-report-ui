// ==================== COLLECTOR STATUS ====================
async function loadCollectorStatus() {
  try {
    const data = await api('/api/collector/status');
    const enabled = data.enabled || false;
    const lagDays = data.lag_days;
    
    const dotEl = $('#dotCollector');
    
    if (dotEl) {
      if (!enabled) {
        dotEl.className = 'dot bad'; // красный = не работает
      } else if (lagDays !== null && lagDays > 1) {
        dotEl.className = 'dot bad'; // красный = критический лаг
      } else if (lagDays === 1) {
        dotEl.className = 'dot warn'; // жёлтый = есть проблемы (лаг 1 день)
      } else {
        dotEl.className = 'dot ok'; // зелёный = всё отлично
      }
    }
  } catch (e) {
    console.error('Collector status load error:', e);
    const dotEl = $('#dotCollector');
    if (dotEl) dotEl.className = 'dot bad'; // красный = ошибка
  }
}

// ==================== SYSTEM STATUS ====================
function updateHeaderStatusBadges(services) {
  // services is { ui: {...}, xray: {...} }
  const ui = services.ui || {};
  const xray = services.xray || {};
  
  // UI status - only color indicator (green = ok, red = bad, yellow = warn)
  const uiActive = Boolean(ui.active);
  const dotUI = $('#dotUI');
  if (dotUI) {
    // Determine status: ok (green), bad (red), or warn (yellow)
    let statusClass = 'bad'; // default to red
    if (uiActive) {
      statusClass = 'ok'; // green = работает
    } else {
      statusClass = 'bad'; // red = не работает
    }
    dotUI.className = 'dot ' + statusClass;
  }
  
  // Xray status - only color indicator
  const xrayActive = Boolean(xray.active);
  const dotXray = $('#dotXray');
  if (dotXray) {
    let statusClass = 'bad';
    if (xrayActive) {
      statusClass = 'ok'; // green = работает
    } else {
      statusClass = 'bad'; // red = не работает
    }
    dotXray.className = 'dot ' + statusClass;
  }
}

async function loadSystemStatus() {
  try {
    const data = await api('/api/system/status');
    if (!data.ok) return;
    
    // API returns ui and xray directly, not inside services
    const ui = data.ui || {};
    const xray = data.xray || {};
    
    updateHeaderStatusBadges({ ui, xray });
  } catch (e) {
    console.error('Status load error:', e);
    const dotUI = $('#dotUI');
    const dotXray = $('#dotXray');
    if (dotUI) dotUI.className = 'dot bad';
    if (dotXray) dotXray.className = 'dot bad';
  }
}

