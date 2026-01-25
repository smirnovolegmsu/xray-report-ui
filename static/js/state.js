// ==================== STATE & LOCALSTORAGE ====================

// Safe JSON parse helper
function safeJsonParse(str, defaultValue) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn('Failed to parse JSON from localStorage:', e);
    return defaultValue;
  }
}

// Safe parseInt helper
function safeParseInt(str, defaultValue) {
  if (!str) return defaultValue;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const state = {
  settings: null,
  users: [],
  lang: localStorage.getItem('ui.lang') || 'ru',
  theme: localStorage.getItem('ui.theme') || 'dark',
  unit: localStorage.getItem('ui.unit') || 'gb',
  chartLibrary: localStorage.getItem('ui.chartLibrary') || 'amcharts', // 'amcharts', 'apexcharts', 'observable', 'highcharts', 'vegalite', 'recharts'
  mode: localStorage.getItem('usage.mode') || 'daily',
  date: localStorage.getItem('usage.date') || '',
  selectedUsers: safeJsonParse(localStorage.getItem('users.selected'), []),
  mainMetric: localStorage.getItem('users.mainMetric') || 'traffic',
  miniMetric: localStorage.getItem('users.miniMetric') || 'traffic',
  overviewMetric: localStorage.getItem('overview.metric') || 'traffic', // 'traffic' | 'conns' - единый фильтр для страницы "Обзор"
  livePeriod: safeParseInt(localStorage.getItem('live.period'), 3600),
  liveGran: safeParseInt(localStorage.getItem('live.gran'), 300),
  liveMetric: localStorage.getItem('live.metric') || 'conns',
  liveScope: localStorage.getItem('live.scope') || 'global',
  livePaused: localStorage.getItem('live.paused') === 'true',
  dashboard: null,
};

// ==================== NAVIGATION ====================
function setNav(nav) {
  if (!nav) {
    console.warn('setNav called without nav parameter');
    return;
  }
  
  // Update nav pills
  const navPills = $$('.nav-pill');
  navPills.forEach(p => {
    if (p && p.dataset) {
      const isActive = p.dataset.nav === nav;
      if (isActive) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    }
  });
  
  // Update panes - hide all, show active
  const panes = $$('.pane');
  panes.forEach(p => {
    if (p && p.dataset) {
      const paneName = p.dataset.pane;
      
      // Show target nav pane
      if (paneName === nav) {
        p.classList.add('active');
        p.style.display = 'block';
      } 
      // Hide all other panes
      else {
        p.classList.remove('active');
        p.style.display = 'none';
      }
    }
  });
  
  // Deactivate tabs when switching to nav pills
  $$('.tab').forEach(t => {
    if (t) t.classList.remove('active');
  });
  
  // Load content for active pane
  if (nav === 'online') {
    startOnlinePolling(); // Запустить online polling только на вкладке online
  } else if (nav === 'status') {
    // Status section removed - info is in header badges and settings
    setTab('settings');
  } else if (nav === 'services') {
    stopOnlinePolling();
    loadServices(); // Load services management
  }
}
