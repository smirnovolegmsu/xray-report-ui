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
      localStorage.setItem('overview.metric', state.overviewMetric);
      
      // Sync with users section filters (mainMetric and miniMetric)
      state.mainMetric = newMetric;
      state.miniMetric = newMetric;
      localStorage.setItem('users.mainMetric', state.mainMetric);
      localStorage.setItem('users.miniMetric', state.miniMetric);
      
      // Update global filter button states
      const btnTraffic = $('#btnOverviewTraffic');
      const btnConns = $('#btnOverviewConns');
      if (btnTraffic && btnConns) {
        if (newMetric === 'traffic') {
          btnTraffic.classList.add('active');
          btnConns.classList.remove('active');
        } else {
          btnConns.classList.add('active');
          btnTraffic.classList.remove('active');
        }
      }
      
      // Update users section filter buttons (sync them with global filter)
      const segCmpTraffic = $('#segCmpTraffic');
      const segCmpConns = $('#segCmpConns');
      const segMiniTraffic = $('#segMiniTraffic');
      const segMiniConns = $('#segMiniConns');
      
      if (segCmpTraffic && segCmpConns) {
        if (newMetric === 'traffic') {
          segCmpTraffic.classList.add('active');
          segCmpConns.classList.remove('active');
        } else {
          segCmpConns.classList.add('active');
          segCmpTraffic.classList.remove('active');
        }
      }
      
      if (segMiniTraffic && segMiniConns) {
        if (newMetric === 'traffic') {
          segMiniTraffic.classList.add('active');
          segMiniConns.classList.remove('active');
        } else {
          segMiniConns.classList.add('active');
          segMiniTraffic.classList.remove('active');
        }
      }
      
      // Re-render overview page with new filter
      if (state.dashboard) {
        renderManagement(state.dashboard);
      } else {
        loadManagement();
      }
      return;
    }
    
    // Chart Library Toggle
    if (e.target.id === 'btnChartAmCharts' || e.target.id === 'btnChartApex' || 
        e.target.id === 'btnChartObservable' || e.target.id === 'btnChartHighcharts' ||
        e.target.id === 'btnChartVegaLite' || e.target.id === 'btnChartRecharts') {
      e.preventDefault();
      e.stopPropagation();
      
      let newLibrary = 'amcharts';
      if (e.target.id === 'btnChartApex') newLibrary = 'apexcharts';
      else if (e.target.id === 'btnChartObservable') newLibrary = 'observable';
      else if (e.target.id === 'btnChartHighcharts') newLibrary = 'highcharts';
      else if (e.target.id === 'btnChartVegaLite') newLibrary = 'vegalite';
      else if (e.target.id === 'btnChartRecharts') newLibrary = 'recharts';
      
      state.chartLibrary = newLibrary;
      localStorage.setItem('ui.chartLibrary', state.chartLibrary);
      
      // Update all button states
      const btnAmCharts = $('#btnChartAmCharts');
      const btnApex = $('#btnChartApex');
      const btnObservable = $('#btnChartObservable');
      const btnHighcharts = $('#btnChartHighcharts');
      const btnVegaLite = $('#btnChartVegaLite');
      const btnRecharts = $('#btnChartRecharts');
      
      [btnAmCharts, btnApex, btnObservable, btnHighcharts, btnVegaLite, btnRecharts].forEach(btn => {
        if (btn) btn.classList.remove('active');
      });
      
      if (e.target.id === 'btnChartAmCharts' && btnAmCharts) btnAmCharts.classList.add('active');
      else if (e.target.id === 'btnChartApex' && btnApex) btnApex.classList.add('active');
      else if (e.target.id === 'btnChartObservable' && btnObservable) btnObservable.classList.add('active');
      else if (e.target.id === 'btnChartHighcharts' && btnHighcharts) btnHighcharts.classList.add('active');
      else if (e.target.id === 'btnChartVegaLite' && btnVegaLite) btnVegaLite.classList.add('active');
      else if (e.target.id === 'btnChartRecharts' && btnRecharts) btnRecharts.classList.add('active');
      
      // Re-render all charts with new library
      if (state.dashboard) {
        renderManagement(state.dashboard);
      } else {
        loadManagement();
      }
      return;
    }
    
    // Users: Traffic/Conns comparison toggle (synced with global overview filter)
    if (e.target.id === 'segCmpTraffic' || e.target.id === 'segCmpConns') {
      e.preventDefault();
      e.stopPropagation();
      const isTraffic = e.target.id === 'segCmpTraffic';
      const newMetric = isTraffic ? 'traffic' : 'conns';
      
      // Update both local and global metrics
      state.mainMetric = newMetric;
      state.overviewMetric = newMetric; // Sync with global filter
      state.miniMetric = newMetric; // Also sync mini metric
      localStorage.setItem('users.mainMetric', state.mainMetric);
      localStorage.setItem('overview.metric', state.overviewMetric);
      localStorage.setItem('users.miniMetric', state.miniMetric);
      
      // Update global filter buttons
      const btnTraffic = $('#btnOverviewTraffic');
      const btnConns = $('#btnOverviewConns');
      if (btnTraffic && btnConns) {
        if (isTraffic) {
          btnTraffic.classList.add('active');
          btnConns.classList.remove('active');
        } else {
          btnConns.classList.add('active');
          btnTraffic.classList.remove('active');
        }
      }
      
      // Update local filter buttons
      const segCmpTraffic = $('#segCmpTraffic');
      const segCmpConns = $('#segCmpConns');
      const segMiniTraffic = $('#segMiniTraffic');
      const segMiniConns = $('#segMiniConns');
      if (segCmpTraffic && segCmpConns) {
        if (isTraffic) {
          segCmpTraffic.classList.add('active');
          segCmpConns.classList.remove('active');
        } else {
          segCmpConns.classList.add('active');
          segCmpTraffic.classList.remove('active');
        }
      }
      if (segMiniTraffic && segMiniConns) {
        if (isTraffic) {
          segMiniTraffic.classList.add('active');
          segMiniConns.classList.remove('active');
        } else {
          segMiniConns.classList.add('active');
          segMiniTraffic.classList.remove('active');
        }
      }
      
      // Re-render entire overview page with new filter
      if (state.dashboard) {
        renderManagement(state.dashboard);
      } else {
        loadManagement();
      }
      return;
    }
    
    // Users: Mini Traffic/Conns toggle (synced with global overview filter)
    if (e.target.id === 'segMiniTraffic' || e.target.id === 'segMiniConns') {
      e.preventDefault();
      e.stopPropagation();
      const isTraffic = e.target.id === 'segMiniTraffic';
      const newMetric = isTraffic ? 'traffic' : 'conns';
      
      // Update both local and global metrics
      state.miniMetric = newMetric;
      state.overviewMetric = newMetric; // Sync with global filter
      state.mainMetric = newMetric; // Also sync main metric
      localStorage.setItem('users.miniMetric', state.miniMetric);
      localStorage.setItem('overview.metric', state.overviewMetric);
      localStorage.setItem('users.mainMetric', state.mainMetric);
      
      // Update global filter buttons
      const btnTraffic = $('#btnOverviewTraffic');
      const btnConns = $('#btnOverviewConns');
      if (btnTraffic && btnConns) {
        if (isTraffic) {
          btnTraffic.classList.add('active');
          btnConns.classList.remove('active');
        } else {
          btnConns.classList.add('active');
          btnTraffic.classList.remove('active');
        }
      }
      
      // Update local filter buttons
      const segCmpTraffic = $('#segCmpTraffic');
      const segCmpConns = $('#segCmpConns');
      const segMiniTraffic = $('#segMiniTraffic');
      const segMiniConns = $('#segMiniConns');
      if (segCmpTraffic && segCmpConns) {
        if (isTraffic) {
          segCmpTraffic.classList.add('active');
          segCmpConns.classList.remove('active');
        } else {
          segCmpConns.classList.add('active');
          segCmpTraffic.classList.remove('active');
        }
      }
      if (segMiniTraffic && segMiniConns) {
        if (isTraffic) {
          segMiniTraffic.classList.add('active');
          segMiniConns.classList.remove('active');
        } else {
          segMiniConns.classList.add('active');
          segMiniTraffic.classList.remove('active');
        }
      }
      
      // Re-render entire overview page with new filter
      if (state.dashboard) {
        renderManagement(state.dashboard);
      } else {
        loadManagement();
      }
      return;
    }
  });
  
  // Segmented controls handlers are already set via event delegation above
  // Just initialize visual state here
  
  // Legacy handlers (if elements exist)
  const btnRefreshDashboard = $('#btnRefreshDashboard');
  if (btnRefreshDashboard) btnRefreshDashboard.onclick = () => loadManagement();
  const periodSelect = $('#periodSelect');
  if (periodSelect) periodSelect.onchange = () => loadManagement();
  
  // Online pause button
  const btnPause = $('#btnPause');
  if (btnPause) {
    btnPause.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.livePaused = !state.livePaused;
      localStorage.setItem('live.paused', state.livePaused);
      btnPause.textContent = state.livePaused ? 'Resume' : 'Pause';
      if (state.livePaused) {
        stopOnlinePolling();
      } else {
        // Resume - запустить polling только если на вкладке online
        const paneOnline = document.querySelector('[data-pane="online"]');
        if (paneOnline && paneOnline.classList.contains('active')) {
          startOnlinePolling();
        }
      }
    };
  }
  
  // Initialize theme/unit/mode from state (with null checks)
  const segDark = $('#segDark');
  const segLight = $('#segLight');
  if (segDark && segLight) {
    if (state.theme === 'dark') {
      segDark.classList.add('active');
      segLight.classList.remove('active');
    } else {
      segLight.classList.add('active');
      segDark.classList.remove('active');
    }
  }
  
  
  const segDaily = $('#segDaily');
  const segCum = $('#segCum');
  if (segDaily && segCum) {
    if (state.mode === 'daily') {
      segDaily.classList.add('active');
      segCum.classList.remove('active');
    } else {
      segCum.classList.add('active');
      segDaily.classList.remove('active');
    }
  }
  
  // Initial load
  try {
    await loadSystemStatus();
    await updateDateSelect();
    // Ensure dashboard tab is active and management pane is shown
    const dashboardTab = document.querySelector('.tab[data-tab="dashboard"]');
    if (dashboardTab) {
      $$('.tab').forEach(t => t.classList.remove('active'));
      dashboardTab.classList.add('active');
    }
    // Show management pane, hide others
    $$('.pane').forEach(p => {
      if (p && p.dataset) {
        if (p.dataset.pane === 'management') {
          p.classList.add('active');
          p.style.display = 'block';
        } else {
          p.classList.remove('active');
          p.style.display = 'none';
        }
      }
    });
    
    // Deactivate nav pills
    $$('.nav-pill').forEach(p => p.classList.remove('active'));
    // Load management content
    await loadManagement();
    // Load collector status
    await loadCollectorStatus();
  } catch (e) {
    console.error('Init error:', e);
    // Load collector status even on error
    try {
      await loadCollectorStatus();
    } catch (e) {
      console.error('Collector status load error:', e);
    }
  }
  
  // Initialize Online segmented controls
  if (state.liveScope === 'global') {
    $('#segScopeGlobal').classList.add('active');
    $('#segScopeUsers').classList.remove('active');
  } else {
    $('#segScopeUsers').classList.add('active');
    $('#segScopeGlobal').classList.remove('active');
  }
  
  if (state.liveMetric === 'traffic') {
    $('#segMetricTraffic').classList.add('active');
  } else if (state.liveMetric === 'conns') {
    $('#segMetricConns').classList.add('active');
  } else {
    $('#segMetricOnline').classList.add('active');
  }
  
  if (state.livePeriod === 3600) {
    $('#segPeriod60m').classList.add('active');
  } else if (state.livePeriod === 21600) {
    $('#segPeriod6h').classList.add('active');
  } else {
    $('#segPeriod24h').classList.add('active');
  }
  
  if (state.liveGran === 60) {
    $('#segGran1m').classList.add('active');
  } else if (state.liveGran === 300) {
    $('#segGran5m').classList.add('active');
  } else {
    $('#segGran10m').classList.add('active');
  }
  
  // Initialize Overview Metric Filter
  const overviewFilter = $('#overviewMetricFilter');
  const btnOverviewTraffic = $('#btnOverviewTraffic');
  const btnOverviewConns = $('#btnOverviewConns');
  
  // Show filter only on dashboard tab (which is active by default)
  const activeTab = document.querySelector('.tab.active');
  const isDashboardActive = activeTab && activeTab.dataset.tab === 'dashboard';
  if (overviewFilter) {
    overviewFilter.style.display = isDashboardActive ? 'flex' : 'none';
  }
  
  if (btnOverviewTraffic && btnOverviewConns) {
    if (state.overviewMetric === 'traffic') {
      btnOverviewTraffic.classList.add('active');
      btnOverviewConns.classList.remove('active');
    } else {
      btnOverviewConns.classList.add('active');
      btnOverviewTraffic.classList.remove('active');
    }
  }
  
  // Initialize Chart library toggle
  const btnAmCharts = $('#btnChartAmCharts');
  const btnApex = $('#btnChartApex');
  const btnObservable = $('#btnChartObservable');
  const btnHighcharts = $('#btnChartHighcharts');
  const btnVegaLite = $('#btnChartVegaLite');
  const btnRecharts = $('#btnChartRecharts');
  
  [btnAmCharts, btnApex, btnObservable, btnHighcharts, btnVegaLite, btnRecharts].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });
  
  if (state.chartLibrary === 'amcharts' && btnAmCharts) {
    btnAmCharts.classList.add('active');
  } else if (state.chartLibrary === 'apexcharts' && btnApex) {
    btnApex.classList.add('active');
  } else if (state.chartLibrary === 'observable' && btnObservable) {
    btnObservable.classList.add('active');
  } else if (state.chartLibrary === 'highcharts' && btnHighcharts) {
    btnHighcharts.classList.add('active');
  } else if (state.chartLibrary === 'vegalite' && btnVegaLite) {
    btnVegaLite.classList.add('active');
  } else if (state.chartLibrary === 'recharts' && btnRecharts) {
    btnRecharts.classList.add('active');
  }
  
  // Initialize Users segmented controls
  if (state.mainMetric === 'traffic') {
    $('#segCmpTraffic').classList.add('active');
    $('#segCmpConns').classList.remove('active');
  } else {
    $('#segCmpConns').classList.add('active');
    $('#segCmpTraffic').classList.remove('active');
  }
  
  // Initialize Users section filters (synced with global overview filter)
  // Use overviewMetric if it exists, otherwise use mainMetric/miniMetric
  const activeMetric = state.overviewMetric || state.mainMetric || 'traffic';
  state.mainMetric = activeMetric;
  state.miniMetric = activeMetric;
  
  if (state.mainMetric === 'traffic') {
    $('#segCmpTraffic').classList.add('active');
    $('#segCmpConns').classList.remove('active');
  } else {
    $('#segCmpConns').classList.add('active');
    $('#segCmpTraffic').classList.remove('active');
  }
  
  if (state.miniMetric === 'traffic') {
    $('#segMiniTraffic').classList.add('active');
    $('#segMiniConns').classList.remove('active');
  } else {
    $('#segMiniConns').classList.add('active');
    $('#segMiniTraffic').classList.remove('active');
  }
  
  // Initialize Pause button state
  const btnPauseInit = $('#btnPause');
  if (btnPauseInit) {
    btnPauseInit.textContent = state.livePaused ? 'Resume' : 'Pause';
  }
  // Polling запустится автоматически при переходе на вкладку online через startOnlinePolling()
  
  // Status badges click handlers
  const badgeUI = $('#badgeUI');
  const badgeXray = $('#badgeXray');
  const xrayActionEl = $('#xrayAction');
  
  if (badgeUI) {
    badgeUI.onclick = () => {
      setTab('settings'); // Status info is in settings
    };
  }
  
  if (badgeXray) {
    badgeXray.onclick = () => {
      setTab('settings'); // Status info is in settings
    };
    
    // Quick restart Xray from status badge
    if (xrayActionEl) {
      xrayActionEl.onclick = async (e) => {
        e.stopPropagation();
        const confirmed = await modal(
          'Перезапустить Xray',
          'Вы уверены, что хотите перезапустить Xray сервис?<br><br>Это может прервать активные подключения пользователей.',
          '',
          'Отмена',
          'Перезапустить',
          true
        );
        if (!confirmed) return;
        
        try {
          const res = await api('/api/system/restart?target=xray', { method: 'POST' });
          if (res.ok) {
            showToast('✅', 'Xray перезапускается...');
            setTimeout(loadSystemStatus, 2000); // Refresh status after 2 seconds
          } else {
            showToast('❌', res.error || 'Ошибка перезапуска');
          }
        } catch (e) {
          console.error('Restart Xray error:', e);
          showToast('❌', 'Ошибка перезапуска Xray');
        }
      };
    }
  }
  
  // Collector badge click handler
  const badgeCollector = $('#badgeCollector');
  if (badgeCollector) {
    badgeCollector.onclick = () => {
      setTab('settings'); // Open settings where collector status is shown
    };
  }
  
  // Periodic refresh
  setInterval(loadSystemStatus, 10000);
  setInterval(loadCollectorStatus, 30000); // Refresh collector status every 30 seconds
  setInterval(() => {
    if (document.querySelector('.pane[data-pane="management"].active')) {
      loadManagement();
    }
  }, 60000);
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", init);
