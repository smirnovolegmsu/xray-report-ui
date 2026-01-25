// ==================== SYSTEM ====================
// System-related functions (moved to init.js)
// This file is kept for backwards compatibility

async function loadSystemStatus() {
  try {
    const res = await api('/api/system/status');
    if (res.ok && res.status) {
      // Update UI badges
      const badgeUI = $('#badgeUI');
      const badgeXray = $('#badgeXray');

      if (badgeUI) {
        const uiStatus = res.status.ui;
        if (uiStatus && uiStatus.active) {
          badgeUI.classList.remove('badge-error');
          badgeUI.classList.add('badge-ok');
          badgeUI.textContent = 'UI: OK';
        } else {
          badgeUI.classList.remove('badge-ok');
          badgeUI.classList.add('badge-error');
          badgeUI.textContent = 'UI: Error';
        }
      }

      if (badgeXray) {
        const xrayStatus = res.status.xray;
        if (xrayStatus && xrayStatus.active) {
          badgeXray.classList.remove('badge-error');
          badgeXray.classList.add('badge-ok');
          badgeXray.textContent = 'Xray: OK';
        } else {
          badgeXray.classList.remove('badge-ok');
          badgeXray.classList.add('badge-error');
          badgeXray.textContent = 'Xray: Error';
        }
      }
    }
  } catch (e) {
    console.error('System status error:', e);
  }
}

async function loadCollectorStatus() {
  try {
    const res = await api('/api/collector/status');
    if (res.ok) {
      const badgeCollector = $('#badgeCollector');
      if (badgeCollector) {
        if (res.enabled) {
          badgeCollector.classList.remove('badge-error');
          badgeCollector.classList.add('badge-ok');
          badgeCollector.textContent = 'Collector: ON';
        } else {
          badgeCollector.classList.remove('badge-ok');
          badgeCollector.classList.add('badge-error');
          badgeCollector.textContent = 'Collector: OFF';
        }
      }
    }
  } catch (e) {
    console.error('Collector status error:', e);
  }
}

async function loadServices() {
  // Services management UI
  const servicesPane = document.querySelector('[data-system-pane="services"]');
  if (!servicesPane) return;

  try {
    const res = await api('/api/system/status');
    if (res.ok && res.status) {
      // Render services status
      console.log('Services loaded:', res.status);
    }
  } catch (e) {
    console.error('Load services error:', e);
  }
}

async function loadServiceJournal(service) {
  try {
    const res = await api(`/api/system/journal?service=${encodeURIComponent(service)}&limit=100`);
    if (res.ok && res.lines) {
      const journalOutput = $('#journalOutput');
      if (journalOutput) {
        journalOutput.textContent = res.lines.join('\n');
        journalOutput.scrollTop = journalOutput.scrollHeight;
      }
    }
  } catch (e) {
    console.error('Journal load error:', e);
  }
}
