// ==================== INIT ====================
let initCalled = false;
async function init() {
  if (initCalled) {
    console.warn('init() already called, skipping');
    return;
  }
  initCalled = true;
  
  // Theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
  
  // Lang
  const savedLang = localStorage.getItem('lang') || 'ru';
  state.lang = savedLang;
  const langToggle = $('#langToggle');
  if (langToggle) langToggle.textContent = savedLang.toUpperCase();
  applyI18n();
  
  // Event handlers for tabs (Пользователи, События, Xray, Настройки)
  const tabsContainer = document.querySelector('.tabs');
  if (tabsContainer) {
    tabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (tab && tab.dataset && tab.dataset.tab) {
        e.preventDefault();
        e.stopPropagation();
        setTab(tab.dataset.tab);
      }
    });
  } else {
    // Fallback: direct handlers
    const tabs = $$('.tab');
    if (tabs.length > 0) {
      tabs.forEach(tab => {
        if (tab && tab.dataset && tab.dataset.tab) {
          tab.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setTab(tab.dataset.tab);
          };
        }
      });
    }
  }
  
  // Event handlers for system sub-tabs (Services, Events, Settings)
  document.addEventListener('click', (e) => {
    const systemTab = e.target.closest('.system-tab');
    if (systemTab && systemTab.dataset && systemTab.dataset.systemTab) {
      e.preventDefault();
      e.stopPropagation();
      setSystemSubpane(systemTab.dataset.systemTab);
    }
  });
  
  const themeToggle = $('#themeToggle');
  if (themeToggle) {
    themeToggle.onclick = () => {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
    };
  }
  
  if (langToggle) {
    langToggle.onclick = () => {
      state.lang = state.lang === 'ru' ? 'en' : 'ru';
      localStorage.setItem('lang', state.lang);
      langToggle.textContent = state.lang.toUpperCase();
      applyI18n();
      loadDashboard();
    };
  }
  
  // User management buttons
  const btnAddUser = $('#btnAddUser');
  if (btnAddUser) btnAddUser.onclick = addUser;
  const btnRefreshUsers = $('#btnRefreshUsers');
  if (btnRefreshUsers) btnRefreshUsers.onclick = loadUsers;
  const btnRefreshEvents = $('#btnRefreshEvents');
  if (btnRefreshEvents) btnRefreshEvents.onclick = loadEvents;
  const eventsFilter = $('#eventsFilter');
  if (eventsFilter) {
    eventsFilter.onkeyup = (e) => { if (e.key === 'Enter') loadEvents(); };
  }
  const btnReloadXray = $('#btnReloadXray');
  if (btnReloadXray) btnReloadXray.onclick = loadXrayConfig;
  const btnSaveSettings = $('#btnSaveSettings');
  if (btnSaveSettings) btnSaveSettings.onclick = saveSettings;
  const btnReloadSettings = $('#btnReloadSettings');
  if (btnReloadSettings) btnReloadSettings.onclick = loadSettings;
  
  // Journal - load on init if pane is active
  const paneJournal = document.querySelector('[data-pane="journal"]');
  if (paneJournal && paneJournal.classList.contains('active')) {
    loadJournal('xray'); // Load Xray logs by default
  }
  // Navigation pills - use event delegation
  const navContainer = document.querySelector('.nav-pills') || document.querySelector('.header-right');
  if (navContainer) {
    navContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.nav-pill');
      if (pill && pill.dataset && pill.dataset.nav) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Nav pill clicked:', pill.dataset.nav);
        setNav(pill.dataset.nav);
      }
    });
  }
  
  // Date select
  const dateSelect = $('#dateSelect');
  if (dateSelect) {
    dateSelect.onchange = () => {
      state.date = dateSelect.value;
      localStorage.setItem('usage.date', state.date);
      loadManagement();
    };
  } else {
    console.warn('dateSelect element not found');
  }
  
  // Segmented controls - use event delegation
  document.addEventListener('click', (e) => {
    // Daily/Cumulative
    if (e.target.id === 'segDaily' || e.target.id === 'segCum') {
      e.preventDefault();
      e.stopPropagation();
      const isDaily = e.target.id === 'segDaily';
      state.mode = isDaily ? 'daily' : 'cumulative';
      localStorage.setItem('usage.mode', state.mode);
      const segDaily = $('#segDaily');
      const segCum = $('#segCum');
      if (segDaily && segCum) {
        if (isDaily) {
          segDaily.classList.add('active');
          segCum.classList.remove('active');
        } else {
          segCum.classList.add('active');
          segDaily.classList.remove('active');
        }
      }
      loadManagement();
      return;
    }
    
    // Dark/Light
    if (e.target.id === 'segDark' || e.target.id === 'segLight') {
      e.preventDefault();
      e.stopPropagation();
      const isDark = e.target.id === 'segDark';
      setTheme(isDark ? 'dark' : 'light');
      const segDark = $('#segDark');
      const segLight = $('#segLight');
      if (segDark && segLight) {
        if (isDark) {
          segDark.classList.add('active');
          segLight.classList.remove('active');
        } else {
          segLight.classList.add('active');
          segDark.classList.remove('active');
        }
      }
      return;
    }
    
    
    // Overview Metric Filter (Traffic/Connections)
    if (e.target.id === 'btnOverviewTraffic' || e.target.id === 'btnOverviewConns') {
      e.preventDefault();
      e.stopPropagation();
      
      const newMetric = e.target.id === 'btnOverviewTraffic' ? 'traffic' : 'conns';
      state.overviewMetric = newMetric;
