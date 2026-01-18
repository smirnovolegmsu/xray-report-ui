// ==================== THEME ====================
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const themeIcon = $('#themeIcon');
  const themeText = $('#themeText');
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
  if (themeText) themeText.textContent = theme === 'dark' ? 'Тёмная' : 'Светлая';
  localStorage.setItem('theme', theme);
  localStorage.setItem('ui.theme', theme);
}

// ==================== TABS ====================
function setTab(tab) {
  if (!tab) {
    console.warn('setTab called without tab parameter');
    return;
  }
  
  // Update tabs
  $$('.tab').forEach(t => {
    if (t && t.dataset) {
      t.classList.toggle('active', t.dataset.tab === tab);
    }
  });
  
  // Show/hide overview metric filter (только для страницы "Обзор")
  const overviewFilter = $('#overviewMetricFilter');
  if (overviewFilter) {
    overviewFilter.style.display = (tab === 'dashboard') ? 'flex' : 'none';
  }
  
  // Update panes - hide all, show active
  // Map dashboard tab to management pane, system tab to system pane
  let targetPane;
  if (tab === 'dashboard') {
    targetPane = 'management';
  } else if (tab === 'system') {
    targetPane = 'system';
  } else {
    targetPane = tab;
  }
  
  $$('.pane').forEach(p => {
    if (p && p.dataset) {
      const paneName = p.dataset.pane;
      
      // Show target pane if it matches
      if (paneName === targetPane) {
        p.classList.add('active');
        p.style.display = 'block';
        // Force visibility - override any inline styles or CSS that might hide it
        p.style.visibility = 'visible';
        p.style.opacity = '1';
        // Force reflow
        void p.offsetWidth;
        console.log(`setTab: Showing pane "${paneName}", computed display: ${window.getComputedStyle(p).display}`);
      } 
      // Hide all other panes
      else {
        p.classList.remove('active');
        p.style.display = 'none';
      }
    }
  });
  
  // Debug: Check if target pane exists and is visible
  const targetPaneEl = document.querySelector(`[data-pane="${targetPane}"]`);
  if (!targetPaneEl) {
    console.error(`setTab: Pane "${targetPane}" not found!`);
  } else {
    const computedStyle = window.getComputedStyle(targetPaneEl);
    console.log(`setTab: Target pane "${targetPane}" found`);
    console.log(`setTab: - display: ${computedStyle.display}, visibility: ${computedStyle.visibility}, opacity: ${computedStyle.opacity}`);
    console.log(`setTab: - has active class: ${targetPaneEl.classList.contains('active')}`);
    const rect = targetPaneEl.getBoundingClientRect();
    console.log(`setTab: - bounds: ${rect.width}x${rect.height} at (${rect.left}, ${rect.top}), visible: ${rect.width > 0 && rect.height > 0}`);
  }
  
  // Deactivate nav pills when switching to tabs
  $$('.nav-pill').forEach(p => {
    if (p) p.classList.remove('active');
  });
  
  // Load content for active tab
  if (tab === 'dashboard') {
    // Dashboard directly shows management pane (no nav pill needed)
    loadManagement();
  } else if (tab === 'users') {
    console.log('setTab: Loading users tab');
    const usersPane = document.querySelector('[data-pane="users"]');
    if (usersPane) {
      console.log('setTab: Users pane found, ensuring it is visible');
      usersPane.classList.add('active');
      usersPane.style.display = 'block';
    } else {
      console.error('setTab: Users pane NOT found!');
    }
    loadUsers();
  } else if (tab === 'system') {
    // System tab - show first subpane (services) by default
    setSystemSubpane('services');
  }
}

// System sub-pane switcher
function setSystemSubpane(subpane) {
  if (!subpane) return;
  
  // Update system tabs
  $$('.system-tab').forEach(t => {
    if (t && t.dataset) {
      t.classList.toggle('active', t.dataset.systemTab === subpane);
    }
  });
  
  // Show/hide sub-panes
  $$('.system-subpane').forEach(p => {
    if (p && p.dataset) {
      const isActive = p.dataset.systemSubpane === subpane;
      p.classList.toggle('active', isActive);
      p.style.display = isActive ? 'block' : 'none';
    }
  });
  
  // Load content for active sub-pane
  if (subpane === 'services') {
    loadSystemStatus(); // Load service status
  } else if (subpane === 'events') {
    loadEvents();
  } else if (subpane === 'settings') {
    loadSettings(); // This will also load Xray config
  }
}

