// ==================== MANAGEMENT (История) ====================
async function loadManagement() {
  try {
    let date = state.date;
    if (!date) {
      date = await getLastAvailableDate();
    }
    if (!date) {
      console.warn('No date available for dashboard');
      showToast('⚠️', 'Нет доступных дат для отображения');
      return;
    }
    
    console.log('Loading dashboard for date:', date, 'mode:', state.mode);
    const data = await api(`/api/usage/dashboard?date=${date}&mode=${state.mode}&windowDays=7`);
    
    // API returns {ok: true, ...} or just data
    if (data && (data.ok !== false)) {
      console.log('Dashboard data loaded successfully:', {
        summary: data.summary ? 'present' : 'missing',
        trends: data.trends ? 'present' : 'missing',
        users: data.users ? `${data.users.length} users` : 'missing',
        meta: data.meta || {}
      });
      state.dashboard = data;
      renderManagement(data);
    } else {
      console.error('Dashboard data invalid:', data);
      showToast('❌', 'Неверный формат данных');
    }
  } catch (e) {
    console.error('Management load error:', e);
    showToast('❌', 'Ошибка загрузки данных: ' + (e.message || 'неизвестная ошибка'));
  }
}

async function getLastAvailableDate() {
  try {
    const res = await api('/api/usage/dates');
    // Handle both {ok: true, dates: [...]} and {dates: [...]} formats
    const dates = (res && res.ok && res.dates) ? res.dates : (res && res.dates ? res.dates : []);
    if (dates && dates.length > 0) {
      // Prefer today's date, otherwise use the first (most recent) date
      const today = new Date().toISOString().split('T')[0];
      const date = dates.includes(today) ? today : dates[0];
      state.date = date;
      localStorage.setItem('usage.date', state.date);
      return date;
    }
  } catch (e) {
    console.error('Error getting last available date:', e);
  }
  return null;
}

function renderManagement(data) {
  if (!data) {
    console.warn('renderManagement: no data');
    return;
  }
  // Handle both {ok: true, ...} and direct data formats
  if (data.hasOwnProperty('ok') && !data.ok) {
    console.warn('renderManagement: data.ok is false', data);
    return;
  }
  
  console.log('renderManagement: rendering data', {
    summary: data.summary ? 'present' : 'missing',
    trends: data.trends ? 'present' : 'missing',
    topDomains: data.topDomains ? 'present' : 'missing',
    users: data.users ? `${data.users.length} users` : 'missing',
    userDetails: data.userDetails ? `${Object.keys(data.userDetails).length} details` : 'missing',
    meta: data.meta || {}
  });
  
  // Ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderManagement(data));
    return;
  }
  
  const s = data.summary || {};
  const t = data.trends || {};
  const td = data.topDomains || { traffic: [], conns: [] };
  const u = data.users || [];
  const ud = data.userDetails || {};
  const meta = data.meta || {};
  
  // Render KPI cards
  try {
    console.log('renderManagement: calling renderKPICards with summary:', s);
    renderKPICards(s, td, state.unit);
    console.log('renderManagement: renderKPICards completed');
  } catch (e) {
    console.error('Error rendering KPI cards:', e);
    console.error('Error stack:', e.stack);
  }
  
  // Render trends charts - force update by disposing old charts first
  // Destroy amCharts
  if (typeof trafficChart !== 'undefined' && trafficChart) {
    try {
      trafficChart.dispose();
    } catch (e) {
      console.warn('Error disposing traffic chart:', e);
    }
    trafficChart = null;
  }
  if (typeof connsChart !== 'undefined' && connsChart) {
    try {
      connsChart.dispose();
    } catch (e) {
      console.warn('Error disposing conns chart:', e);
    }
    connsChart = null;
  }
  // Destroy ApexCharts
  if (typeof trafficChartApex !== 'undefined' && trafficChartApex) {
    try {
      trafficChartApex.destroy();
    } catch (e) {
      console.warn('Error destroying traffic ApexChart:', e);
    }
    trafficChartApex = null;
  }
  if (typeof connsChartApex !== 'undefined' && connsChartApex) {
    try {
      connsChartApex.destroy();
    } catch (e) {
      console.warn('Error destroying conns ApexChart:', e);
    }
    connsChartApex = null;
  }
  // Destroy Highcharts
  if (window.trafficChartHighcharts) {
    try {
      window.trafficChartHighcharts.destroy();
    } catch (e) {
      console.warn('Error destroying traffic Highcharts:', e);
    }
    window.trafficChartHighcharts = null;
  }
  if (window.connsChartHighcharts) {
    try {
      window.connsChartHighcharts.destroy();
    } catch (e) {
      console.warn('Error destroying conns Highcharts:', e);
    }
    window.connsChartHighcharts = null;
  }
  // Destroy users comparison charts
  if (usersCmpChart) {
    try {
      usersCmpChart.dispose();
    } catch (e) {
      console.warn('Error disposing users comparison chart:', e);
    }
    usersCmpChart = null;
  }
  if (window.usersCmpChartApex) {
    try {
      window.usersCmpChartApex.destroy();
    } catch (e) {
      console.warn('Error destroying users comparison ApexChart:', e);
    }
    window.usersCmpChartApex = null;
  }
  if (window.usersCmpChartHighcharts) {
    try {
      window.usersCmpChartHighcharts.destroy();
    } catch (e) {
      console.warn('Error destroying users comparison Highcharts:', e);
    }
    window.usersCmpChartHighcharts = null;
  }
  // Clear Observable Plot and Vega-Lite charts (they are DOM-based)
  const chartElements = ['chTraffic', 'chConns', 'chUsersTraffic', 'chUsersConns', 'chUsersCmp'];
  chartElements.forEach(id => {
    const el = document.getElementById(id);
    if (el && (state.chartLibrary === 'observable' || state.chartLibrary === 'vegalite')) {
      el.innerHTML = '';
    }
  });
  renderTrendsCharts(t, state.mode, state.unit);
  
  // Render top domains tables
  renderTopDomainsTables(td, state.unit);
  
  // Render users histograms (always show ALL users, not filtered)
  // These are separate from the user filter in the Users section
  renderUsersHistograms(u, state.unit);
  
  // Render users section
  renderUsersSection(u, ud, state.selectedUsers, state.mainMetric, state.miniMetric, state.mode, state.unit);
  
  // Update date select
  updateDateSelect();
}

function renderKPICards(summary, topDomains, unit) {
  if (!summary) {
    console.warn('renderKPICards: no summary data');
    return;
  }
  if (!topDomains) {
    console.warn('renderKPICards: no topDomains data');
    topDomains = { traffic: [], conns: [], top3TrafficDomains: [], top3ConnsDomains: [] };
  }
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  // Today traffic
  const todayTraffic = (summary.todayTrafficBytes || 0) / base;
  const yesterdayTraffic = (summary.yesterdayTrafficBytes || 0) / base;
  const avg7dTraffic = (summary.avg7dTrafficBytes || 0) / base;
  const deltaTodayTraffic = summary.deltaTodayTrafficPct;
  
  const el1 = $('#kpiTodayTrafficValue');
  const el2 = $('#kpiTodayTrafficAvg');
  if (el1) el1.textContent = todayTraffic.toFixed(2) + ' ' + unitLabel;
  if (el2) el2.textContent = avg7dTraffic.toFixed(2) + ' ' + unitLabel;
  renderBubble($('#kpiTodayTrafficBubble'), deltaTodayTraffic);
  
  // Today conns
  const todayConns = summary.todayConns || 0;
  const yesterdayConns = summary.yesterdayConns || 0;
  const avg7dConns = Math.round(summary.avg7dConns || 0);
  const deltaTodayConns = summary.deltaTodayConnsPct;
  
  const el3 = $('#kpiTodayConnsValue');
  const el4 = $('#kpiTodayConnsAvg');
  if (el3) el3.textContent = todayConns.toLocaleString('ru-RU');
  if (el4) el4.textContent = avg7dConns.toLocaleString('ru-RU');
  renderBubble($('#kpiTodayConnsBubble'), deltaTodayConns);
  
  // 7d total traffic
  const total7dTraffic = (summary.total7dTrafficBytes || 0) / base;
  const prevTotal7dTraffic = (summary.prevTotal7dTrafficBytes || 0) / base;
  const deltaTotal7dTraffic = summary.deltaTotal7dTrafficPct;
  
  const el5 = $('#kpiTotal7dTrafficValue');
  if (el5) el5.textContent = total7dTraffic.toFixed(2) + ' ' + unitLabel;
  renderBubble($('#kpiTotal7dTrafficBubble'), deltaTotal7dTraffic);
  
  // 7d total conns
  const total7dConns = summary.total7dConns || 0;
  const prevTotal7dConns = summary.prevTotal7dConns || 0;
  const deltaTotal7dConns = summary.deltaTotal7dConnsPct;
  
  const el6 = $('#kpiTotal7dConnsValue');
  if (el6) el6.textContent = total7dConns.toLocaleString('ru-RU');
  renderBubble($('#kpiTotal7dConnsBubble'), deltaTotal7dConns);
  
  // Top domains traffic (top-3) - display with traffic data
  const top3TrafficData = (topDomains.traffic || []).slice(0, 3);
  const el7 = $('#kpiTopDomainsTrafficList');
  if (el7) {
    if (top3TrafficData.length > 0) {
      const domainsText = top3TrafficData.map(d => {
        const domain = d.domain || '—';
        const traffic = ((d.trafficBytes || 0) / base).toFixed(2);
        return `${domain} (${traffic} ${unitLabel})`;
      }).join(' | ');
      el7.innerHTML = `<div class="kpi-list-item" style="padding:2px 0;justify-content:flex-start;"><span>${domainsText}</span></div>`;
    } else {
      el7.innerHTML = '<div class="kpi-list-item" style="padding:2px 0;"><span>—</span></div>';
    }
  }
  renderBubble($('#kpiTopDomainsTrafficBubble'), deltaTotal7dTraffic);
  
  // Top domains conns (top-3) - display with conns data
  const top3ConnsData = (topDomains.conns || []).slice(0, 3);
  const el8 = $('#kpiTopDomainsConnsList');
  if (el8) {
    if (top3ConnsData.length > 0) {
      const domainsText = top3ConnsData.map(d => {
        const domain = d.domain || '—';
        const conns = (d.conns || 0).toLocaleString('ru-RU');
        return `${domain} (${conns})`;
      }).join(' | ');
      el8.innerHTML = `<div class="kpi-list-item" style="padding:2px 0;justify-content:flex-start;"><span>${domainsText}</span></div>`;
    } else {
      el8.innerHTML = '<div class="kpi-list-item" style="padding:2px 0;"><span>—</span></div>';
    }
  }
  renderBubble($('#kpiTopDomainsConnsBubble'), deltaTotal7dConns);
  
  // Apply overview metric filter - show/hide cards based on selected metric
  const overviewMetric = state.overviewMetric || 'traffic';
  const trafficCards = [$('#kpiTodayTraffic'), $('#kpiTotal7dTraffic'), $('#kpiTopDomainsTraffic')];
  const connsCards = [$('#kpiTodayConns'), $('#kpiTotal7dConns'), $('#kpiTopDomainsConns')];
  
  if (overviewMetric === 'traffic') {
    // Show traffic cards, hide conns cards
    trafficCards.forEach(card => { if (card) card.style.display = ''; });
    connsCards.forEach(card => { if (card) card.style.display = 'none'; });
  } else {
    // Show conns cards, hide traffic cards
    trafficCards.forEach(card => { if (card) card.style.display = 'none'; });
    connsCards.forEach(card => { if (card) card.style.display = ''; });
  }
}

function renderBubble(el, delta) {
  if (!el) return;
  if (delta === null || delta === undefined) {
    el.textContent = '—';
    el.className = 'kpi-bubble na';
    return;
  }
  const sign = delta >= 0 ? '+' : '';
  // If delta < -10% or > 10%, round to integer; otherwise 1 decimal place
  let formatted;
  if (delta < -10 || delta > 10) {
    formatted = Math.round(delta).toString();
  } else {
    formatted = delta.toFixed(1);
  }
  el.textContent = `${sign}${formatted}%`;
  el.className = `kpi-bubble ${delta >= 0 ? 'up' : 'down'}`;
}

// ==================== HELPERS ====================
/**
 * Получает вычисленное значение CSS переменной
 * @param {string} varName - имя переменной (например "--text" или "--muted")
 * @param {string} fallback - значение по умолчанию если переменная не найдена
 * @returns {string} - вычисленное значение цвета (например "#e6edf3")
 */
function getCSSColor(varName, fallback = '#8b949e') {
  try {
    const root = document.documentElement;
    if (!root || typeof root !== 'object') {
      return fallback;
    }
    const style = getComputedStyle(root);
    if (!style) {
      return fallback;
    }
    const value = style.getPropertyValue(varName).trim();
    return value || fallback;
  } catch (e) {
    console.warn(`Failed to get CSS color for ${varName}:`, e);
    return fallback;
  }
}

/**
 * Обёртка для am5.color с поддержкой CSS переменных
 * @param {string} varName - имя CSS переменной (например "--text")
 * @param {string} fallback - значение по умолчанию
 * @returns {am5.Color} - объект цвета amCharts
 */
function amColorVar(varName, fallback = '#8b949e') {
  const colorValue = getCSSColor(varName, fallback);
  return am5.color(colorValue);
}

/**
 * Проверяет, можно ли рендерить график в элементе
 * @param {HTMLElement} el - элемент контейнера
 * @returns {boolean} - true если элемент готов для рендеринга
 */
function isRenderable(el) {
  if (!el || !(el instanceof Element)) {
    return false;
  }
  try {
    const rect = el.getBoundingClientRect();
    // Элемент должен быть в DOM и иметь размеры
    return rect.width > 0 && rect.height > 0;
  } catch (e) {
    return false;
  }
}

let trafficChart = null;
let connsChart = null;
// ApexCharts instances
let trafficChartApex = null;
let connsChartApex = null;

// Chart library wrapper - routes to appropriate renderer
function renderTrendsCharts(trends, mode, unit) {
  // Apply overview metric filter - show/hide chart containers (vertical layout)
  const overviewMetric = state.overviewMetric || 'traffic';
  const elTraffic = $('#chTraffic');
  const elConns = $('#chConns');
  const containerTraffic = elTraffic ? elTraffic.closest('.chartbox') : null;
  const containerConns = elConns ? elConns.closest('.chartbox') : null;
  
  if (overviewMetric === 'traffic') {
    // Show traffic chart, hide conns chart
    if (containerTraffic) containerTraffic.style.display = 'block';
    if (containerConns) containerConns.style.display = 'none';
  } else {
    // Show conns chart, hide traffic chart
    if (containerTraffic) containerTraffic.style.display = 'none';
    if (containerConns) containerConns.style.display = 'block';
  }
  
  // Render charts (both will render, but only one will be visible)
  if (state.chartLibrary === 'apexcharts' && typeof ApexCharts !== 'undefined') {
    renderTrendsChartsApex(trends, mode, unit);
  } else if (state.chartLibrary === 'observable') {
    renderTrendsChartsObservable(trends, mode, unit);
  } else if (state.chartLibrary === 'highcharts' && typeof Highcharts !== 'undefined') {
    renderTrendsChartsHighcharts(trends, mode, unit);
  } else if (state.chartLibrary === 'vegalite' && typeof vegaEmbed !== 'undefined') {
    renderTrendsChartsVegaLite(trends, mode, unit);
  } else if (state.chartLibrary === 'recharts' && typeof d3 !== 'undefined') {
    renderTrendsChartsRecharts(trends, mode, unit);
  } else {
    renderTrendsChartsAmCharts(trends, mode, unit);
  }
}

// amCharts version (original)
function renderTrendsChartsAmCharts(trends, mode, unit) {
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  // Traffic chart
  const trafficData = trends.trafficDailyBytes || [];
  if (trafficData.length === 0) {
    console.warn('renderTrendsCharts: no traffic data');
  }
  
  const trafficLabels = trafficData.map(t => {
    try {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      if (!dateStr) return '—';
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      console.error('Error parsing traffic date:', t, e);
      return '—';
    }
  });
  const trafficValues = trafficData.map(t => {
    const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
    return Number(val) / base;
  });
  
  const elTraffic = document.getElementById('chTraffic');
  if (!elTraffic) {
    console.warn('chTraffic element not found');
    return;
  }
  
  // Destroy existing chart if exists (amCharts)
  if (trafficChart) {
    try {
      trafficChart.dispose();
    } catch (e) {
      console.warn('Error disposing traffic chart:', e);
    }
    trafficChart = null;
  }
  // Destroy ApexCharts if exists
  if (trafficChartApex) {
    try {
      trafficChartApex.destroy();
    } catch (e) {
      console.warn('Error destroying traffic ApexChart:', e);
    }
    trafficChartApex = null;
  }
  
  am5.ready(() => {
    try {
      // Повторная проверка элемента
      const elCheck = document.getElementById('chTraffic');
      if (!elCheck || elCheck !== elTraffic) {
        console.warn('renderTrendsCharts: chTraffic element changed');
        return;
      }
      
      const maxValue = Math.max(...trafficValues, 1);
      
      // Create root element
      const root = am5.Root.new(elCheck);
    root.setThemes([
      am5themes_Animated.new(root)
    ]);
    
    // Create chart
    const chart = root.container.children.push(am5xy.XYChart.new(root, {
      panX: false,
      panY: false,
      wheelX: "none",
      wheelY: "none",
      paddingLeft: 0,
      paddingRight: 0
    }));
    
    // Create axes
    const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
      categoryField: "category",
      renderer: am5xy.AxisRendererX.new(root, {
        cellStartLocation: 0.1,
        cellEndLocation: 0.9,
        minGridDistance: 30
      })
    }));
    
    xAxis.data.setAll(trafficLabels.map((label, idx) => ({
      category: label
    })));
    
    const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
      renderer: am5xy.AxisRendererY.new(root, {})
    }));
    
    // Create series
    const series = chart.series.push(am5xy.ColumnSeries.new(root, {
      name: `Traffic (${unitLabel})`,
      xAxis: xAxis,
      yAxis: yAxis,
      valueYField: "value",
      categoryXField: "category"
    }));
    
    // Configure columns with gradient fill
    series.columns.template.setAll({
      tooltipText: "{categoryX}: {valueY.formatNumber('#.00')} {unitLabel}",
      tooltipY: 0,
      strokeOpacity: 0,
      cornerRadiusTL: 8,
      cornerRadiusTR: 8,
      cornerRadiusBL: 8,
      cornerRadiusBR: 8
    });
    
    // Dynamic fill color based on value
    series.columns.template.adapters.add("fill", (fill, target) => {
      const dataItem = target.dataItem;
      if (dataItem) {
        const value = dataItem.get("valueY");
        const ratio = maxValue > 0 ? value / maxValue : 0;
        const opacity = 0.4 + ratio * 0.4;
        return am5.color(`rgba(88, 166, 255, ${opacity})`);
      }
      return fill;
    });
    
    // Labels added via bullets for ColumnSeries
    series.bullets.push(function() {
      const label = am5.Label.new(root, {
        text: "",
        fill: amColorVar("--text"),
        centerY: 0,
        centerX: am5.p50,
        fontSize: 11,
        fontWeight: "bold",
        dy: -5
      });
      // Format text using adapter
      label.adapters.add("text", (text, target) => {
        const dataItem = target.dataItem;
        if (dataItem) {
          const value = dataItem.get("valueY");
          return value ? value.toFixed(2) : "";
        }
        return "";
      });
      return am5.Bullet.new(root, {
        locationY: 1,
        sprite: label
      });
    });
    
    // Set data
    series.data.setAll(trafficValues.map((val, idx) => ({
      category: trafficLabels[idx],
      value: val,
      unitLabel: unitLabel
    })));
    
    // Add cursor
    chart.set("cursor", am5xy.XYCursor.new(root, {}));
    
      trafficChart = root;
    } catch (e) {
      console.error('Error creating traffic chart:', e);
      trafficChart = null;
    }
  });
  
  // Conns chart
  const connsData = trends.connsDaily || [];
  if (connsData.length === 0) {
    console.warn('renderTrendsCharts: no conns data');
  }
  
  const connsLabels = connsData.map(t => {
    try {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      if (!dateStr) {
        console.warn('renderTrendsCharts: empty dateStr in conns data:', t);
        return '—';
      }
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) {
        console.warn('renderTrendsCharts: invalid date for conns:', dateStr, t);
        return '—';
      }
      const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      return label;
    } catch (e) {
      console.error('Error parsing conns date:', t, e);
      return '—';
    }
  });
  const connsValues = connsData.map(t => {
    const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
    const numVal = Number(val) || 0;
    return numVal;
  });
  
  // Debug: log data for troubleshooting
  console.log('renderTrendsCharts: connsData length:', connsData.length);
  console.log('renderTrendsCharts: connsLabels:', connsLabels);
  console.log('renderTrendsCharts: connsValues:', connsValues);
  
  const elConns = document.getElementById('chConns');
  if (!elConns) {
    console.warn('chConns element not found');
    return;
  }
  
  // Destroy existing chart if exists (amCharts)
  if (connsChart) {
    try {
      connsChart.dispose();
    } catch (e) {
      console.warn('Error disposing conns chart:', e);
    }
    connsChart = null;
  }
  // Destroy ApexCharts if exists
  if (connsChartApex) {
    try {
      connsChartApex.destroy();
    } catch (e) {
      console.warn('Error destroying conns ApexChart:', e);
    }
    connsChartApex = null;
  }
  
  am5.ready(() => {
    try {
      // Повторная проверка элемента
      const elCheck = document.getElementById('chConns');
      if (!elCheck || elCheck !== elConns) {
        console.warn('renderTrendsCharts: chConns element changed');
        return;
      }
      
      const maxValue = Math.max(...connsValues, 1);
      
      // Create root element
      const root = am5.Root.new(elCheck);
    root.setThemes([
      am5themes_Animated.new(root)
    ]);
    
    // Create chart
    const chart = root.container.children.push(am5xy.XYChart.new(root, {
      panX: false,
      panY: false,
      wheelX: "none",
      wheelY: "none",
      paddingLeft: 0,
      paddingRight: 0
    }));
    
    // Create axes
    const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
      categoryField: "category",
      renderer: am5xy.AxisRendererX.new(root, {
        cellStartLocation: 0.1,
        cellEndLocation: 0.9,
        minGridDistance: 30
      })
    }));
    
    // Set X-axis data - ensure all categories are included, even with 0 values
    const xAxisData = connsLabels.map((label, idx) => ({
      category: label
    }));
    xAxis.data.setAll(xAxisData);
    console.log('renderTrendsCharts: xAxis data set:', xAxisData.length, 'categories');
    
    const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
      renderer: am5xy.AxisRendererY.new(root, {}),
      min: 0  // Ensure Y-axis starts at 0 to show zero values
    }));
    
    // Create series
    const series = chart.series.push(am5xy.ColumnSeries.new(root, {
      name: "Connections",
      xAxis: xAxis,
      yAxis: yAxis,
      valueYField: "value",
      categoryXField: "category"
    }));
    
    // Configure columns with gradient fill
    series.columns.template.setAll({
      tooltipText: "{categoryX}: {valueY.formatNumber('#,###')} connections",
      tooltipY: 0,
      strokeOpacity: 0,
      cornerRadiusTL: 8,
      cornerRadiusTR: 8,
      cornerRadiusBL: 8,
      cornerRadiusBR: 8
    });
    
    // Ensure zero values create visible columns (minimum height)
    series.columns.template.adapters.add("height", (height, target) => {
      const dataItem = target.dataItem;
      if (dataItem) {
        const value = dataItem.get("valueY");
        // For zero values, show a minimal visible bar (2px) so the date is visible on graph
        if (value === 0 || value === null || value === undefined) {
          return 2;  // 2px minimum height for zero values
        }
      }
      return height;
    });
    
    // Dynamic fill color based on value
    series.columns.template.adapters.add("fill", (fill, target) => {
      const dataItem = target.dataItem;
      if (dataItem) {
        const value = dataItem.get("valueY");
        // For zero values, use a very light color but still visible
        if (value === 0 || value === null || value === undefined) {
          return am5.color(`rgba(63, 185, 80, 0.15)`);  // Very light green for zero (slightly more visible)
        }
        const ratio = maxValue > 0 ? value / maxValue : 0;
        const opacity = 0.4 + ratio * 0.4;
        return am5.color(`rgba(63, 185, 80, ${opacity})`);
      }
      return fill;
    });
    
    // Labels added via bullets for ColumnSeries
    series.bullets.push(function() {
      const label = am5.Label.new(root, {
        text: "",
        fill: amColorVar("--text"),
        centerY: 0,
        centerX: am5.p50,
        fontSize: 11,
        fontWeight: "bold",
        dy: -5
      });
      // Format text using adapter
      label.adapters.add("text", (text, target) => {
        const dataItem = target.dataItem;
        if (dataItem) {
          const value = dataItem.get("valueY");
          return value ? value.toLocaleString('ru-RU') : "";
        }
        return "";
      });
      return am5.Bullet.new(root, {
        locationY: 1,
        sprite: label
      });
    });
    
    // Set data - ensure all data points are included, even with 0 values
    const seriesData = connsValues.map((val, idx) => ({
      category: connsLabels[idx],
      value: val
    }));
    console.log('renderTrendsCharts: series data set:', seriesData.length, 'points');
    console.log('renderTrendsCharts: series data sample:', seriesData.slice(0, 3));
    series.data.setAll(seriesData);
    
    // Add cursor
    chart.set("cursor", am5xy.XYCursor.new(root, {}));
    
      connsChart = root;
    } catch (e) {
      console.error('Error creating conns chart:', e);
      connsChart = null;
    }
  });
}

// ApexCharts version (alternative - красивые графики)
function renderTrendsChartsApex(trends, mode, unit) {
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  // Prepare data (same logic as amCharts version)
  const trafficData = trends.trafficDailyBytes || [];
  const trafficLabels = trafficData.map(t => {
    try {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      if (!dateStr) return '—';
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return '—';
    }
  });
  const trafficValues = trafficData.map(t => {
    const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
    return Number(val) / base;
  });
  
  const connsData = trends.connsDaily || [];
  const connsLabels = connsData.map(t => {
    try {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      if (!dateStr) return '—';
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return '—';
    }
  });
  const connsValues = connsData.map(t => {
    const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
    return Number(val) || 0;
  });
  
  // Get theme colors
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.5)' : 'rgba(208, 215, 222, 0.5)';
  const accentColor = isDark ? '#58a6ff' : '#0969da';
  const okColor = isDark ? '#3fb950' : '#1a7f37';
  
  // Destroy existing ApexCharts
  if (trafficChartApex) {
    trafficChartApex.destroy();
    trafficChartApex = null;
  }
  if (connsChartApex) {
    connsChartApex.destroy();
    connsChartApex = null;
  }
  
  // Traffic chart
  const elTraffic = document.getElementById('chTraffic');
  if (elTraffic) {
    elTraffic.innerHTML = ''; // Clear for ApexCharts
    
    const maxValue = Math.max(...trafficValues, 1);
    
    trafficChartApex = new ApexCharts(elTraffic, {
      series: [{
        name: `Traffic (${unitLabel})`,
        data: trafficValues
      }],
      chart: {
        type: 'bar',
        height: '100%',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 800 }
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '60%',
          dataLabels: { position: 'top' }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => val.toFixed(2),
        offsetY: -20,
        style: { fontSize: '11px', colors: [textColor], fontWeight: 'bold' }
      },
      xaxis: {
        categories: trafficLabels,
        labels: { style: { colors: textColor } },
        axisBorder: { color: gridColor },
        axisTicks: { color: gridColor }
      },
      yaxis: {
        labels: { style: { colors: textColor } },
        title: { text: unitLabel, style: { color: textColor } }
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 4
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: { formatter: (val) => `${val.toFixed(2)} ${unitLabel}` }
      },
      colors: [accentColor],
      fill: {
        type: 'gradient',
        gradient: {
          shade: isDark ? 'dark' : 'light',
          type: 'vertical',
          shadeIntensity: 0.5,
          gradientToColors: [accentColor],
          inverseColors: false,
          opacityFrom: 0.6,
          opacityTo: 0.3,
          stops: [0, 100]
        }
      }
    });
    
    trafficChartApex.render();
  }
  
  // Conns chart
  const elConns = document.getElementById('chConns');
  if (elConns) {
    elConns.innerHTML = ''; // Clear for ApexCharts
    
    const maxValue = Math.max(...connsValues, 1);
    
    connsChartApex = new ApexCharts(elConns, {
      series: [{
        name: 'Connections',
        data: connsValues
      }],
      chart: {
        type: 'bar',
        height: '100%',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 800 }
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '60%',
          dataLabels: { position: 'top' }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => val.toLocaleString('ru-RU'),
        offsetY: -20,
        style: { fontSize: '11px', colors: [textColor], fontWeight: 'bold' }
      },
      xaxis: {
        categories: connsLabels,
        labels: { style: { colors: textColor } },
        axisBorder: { color: gridColor },
        axisTicks: { color: gridColor }
      },
      yaxis: {
        labels: { style: { colors: textColor } },
        min: 0
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 4
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: { formatter: (val) => `${val.toLocaleString('ru-RU')} connections` }
      },
      colors: [okColor],
      fill: {
        type: 'gradient',
        gradient: {
          shade: isDark ? 'dark' : 'light',
          type: 'vertical',
          shadeIntensity: 0.5,
          gradientToColors: [okColor],
          inverseColors: false,
          opacityFrom: 0.6,
          opacityTo: 0.3,
          stops: [0, 100]
        }
      }
    });
    
    connsChartApex.render();
  }
}

// Observable Plot version - Data Journalism / Bloomberg style (минимализм, типографика)
function renderTrendsChartsObservable(trends, mode, unit) {
  // Observable Plot через UMD экспортируется как глобальный объект Plot
  if (typeof Plot === 'undefined' || typeof Plot.plot !== 'function') {
    console.error('Observable Plot: Plot.plot is not available');
    console.error('typeof Plot:', typeof Plot);
    console.error('Plot object:', Plot);
    if (typeof Plot !== 'undefined') {
      console.error('Plot keys:', Object.keys(Plot));
    }
    return;
  }
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const accentColor = isDark ? '#58a6ff' : '#0969da';
  const okColor = isDark ? '#3fb950' : '#1a7f37';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)';
  
  // Traffic chart
  const trafficData = trends.trafficDailyBytes || [];
  const elTraffic = document.getElementById('chTraffic');
  if (elTraffic && trafficData.length > 0) {
    try {
      // Check if Plot is available (try different ways)
      const PlotLib = typeof Plot !== 'undefined' ? Plot : (typeof window !== 'undefined' && window.Plot ? window.Plot : null);
      if (!PlotLib) {
        console.error('Observable Plot: Plot is not defined. Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('plot')));
        return;
      }
      
      elTraffic.innerHTML = '';
      
      const plotData = trafficData.map(t => {
        const dateStr = typeof t === 'object' ? (t.date || '') : '';
        const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
        if (!dateStr) return null;
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return null;
        return {
          date: d,
          value: Number(val) / base
        };
      }).filter(d => d !== null && d.value !== undefined && !isNaN(d.value));
      
      if (plotData.length === 0) {
        console.warn('renderTrendsChartsObservable: no valid traffic data');
        return;
      }
      
      const width = Math.max(elTraffic.clientWidth || 600, 300);
      const height = Math.max(elTraffic.clientHeight || 300, 200);
      
      console.log('Observable Plot: rendering traffic chart with', plotData.length, 'data points');
      console.log('Observable Plot: Plot object', typeof PlotLib, PlotLib);
      console.log('Observable Plot: sample data', plotData.slice(0, 3));
      
      // Use simpler syntax
      const trafficChart = Plot.plot({
        style: { 
          background: bgColor, 
          color: textColor
        },
        width: width,
        height: height,
        marginTop: 20,
        marginRight: 20,
        marginBottom: 40,
        marginLeft: 60,
        x: { 
          type: 'time', 
          grid: true
        },
        y: { 
          grid: true, 
          label: `Traffic (${unitLabel})`
        },
        marks: [
          Plot.ruleY([0], { stroke: gridColor }),
          Plot.areaY(plotData, { 
            x: 'date', 
            y: 'value', 
            fill: accentColor, 
            fillOpacity: 0.15
          }),
          Plot.lineY(plotData, { 
            x: 'date', 
            y: 'value', 
            stroke: accentColor, 
            strokeWidth: 2
          }),
          Plot.dot(plotData, { 
            x: 'date', 
            y: 'value', 
            fill: accentColor,
            r: 2.5
          })
        ]
      });
      
      if (trafficChart) {
        elTraffic.appendChild(trafficChart);
        console.log('Observable Plot: traffic chart appended successfully');
      } else {
        console.error('Observable Plot: traffic chart is null');
      }
    } catch (e) {
      console.error('Error rendering Observable traffic chart:', e);
      console.error('Error stack:', e.stack);
    }
  }
  
  // Connections chart
  const connsData = trends.connsDaily || [];
  const elConns = document.getElementById('chConns');
  if (elConns && connsData.length > 0) {
    try {
      const PlotLib = typeof Plot !== 'undefined' ? Plot : (typeof window !== 'undefined' && window.Plot ? window.Plot : null);
      if (!PlotLib) {
        console.error('Observable Plot: Plot is not defined');
        return;
      }
      
      elConns.innerHTML = '';
      
      const plotData = connsData.map(t => {
        const dateStr = typeof t === 'object' ? (t.date || '') : '';
        const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
        if (!dateStr) return null;
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return null;
        return {
          date: d,
          value: Number(val) || 0
        };
      }).filter(d => d !== null && d.value !== undefined && !isNaN(d.value));
      
      if (plotData.length === 0) {
        console.warn('renderTrendsChartsObservable: no valid conns data');
        return;
      }
      
      const width = Math.max(elConns.clientWidth || 600, 300);
      const height = Math.max(elConns.clientHeight || 300, 200);
      
      console.log('Observable Plot: rendering conns chart with', plotData.length, 'data points');
      
      const connsChart = Plot.plot({
        style: { 
          background: bgColor, 
          color: textColor
        },
        width: width,
        height: height,
        marginTop: 20,
        marginRight: 20,
        marginBottom: 40,
        marginLeft: 60,
        x: { 
          type: 'time', 
          grid: true
        },
        y: { 
          grid: true, 
          label: 'Connections'
        },
        marks: [
          Plot.ruleY([0], { stroke: gridColor }),
          Plot.areaY(plotData, { 
            x: 'date', 
            y: 'value', 
            fill: okColor, 
            fillOpacity: 0.15
          }),
          Plot.lineY(plotData, { 
            x: 'date', 
            y: 'value', 
            stroke: okColor, 
            strokeWidth: 2
          }),
          Plot.dot(plotData, { 
            x: 'date', 
            y: 'value', 
            fill: okColor,
            r: 2.5
          })
        ]
      });
      
      if (connsChart) {
        elConns.appendChild(connsChart);
        console.log('Observable Plot: conns chart appended successfully');
      } else {
        console.error('Observable Plot: conns chart is null');
      }
    } catch (e) {
      console.error('Error rendering Observable conns chart:', e);
      console.error('Error stack:', e.stack);
    }
  }
}

// Highcharts version - корпоративный премиум стиль
function renderTrendsChartsHighcharts(trends, mode, unit) {
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const accentColor = isDark ? '#58a6ff' : '#0969da';
  const okColor = isDark ? '#3fb950' : '#1a7f37';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)';
  
  if (typeof Highcharts === 'undefined') {
    console.warn('Highcharts not available');
    return;
  }
  
  // Destroy existing charts
  const trafficEl = document.getElementById('chTraffic');
  const connsEl = document.getElementById('chConns');
  
  if (window.trafficChartHighcharts) {
    window.trafficChartHighcharts.destroy();
    window.trafficChartHighcharts = null;
  }
  if (window.connsChartHighcharts) {
    window.connsChartHighcharts.destroy();
    window.connsChartHighcharts = null;
  }
  
  // Traffic chart
  const trafficData = trends.trafficDailyBytes || [];
  if (trafficEl && trafficData.length > 0) {
    const data = trafficData.map(t => {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
      return [d.getTime(), Number((val / base).toFixed(2))];
    });
    
    window.trafficChartHighcharts = Highcharts.chart(trafficEl, {
      chart: {
        type: 'column',
        backgroundColor: bgColor,
        height: trafficEl.clientHeight || 300
      },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        type: 'datetime',
        labels: { style: { color: textColor } },
        gridLineColor: gridColor,
        lineColor: gridColor,
        tickColor: gridColor
      },
      yAxis: {
        title: { text: `Traffic (${unitLabel})`, style: { color: textColor } },
        labels: { style: { color: textColor } },
        gridLineColor: gridColor
      },
      legend: { enabled: false },
      tooltip: {
        backgroundColor: bgColor,
        borderColor: textColor,
        style: { color: textColor },
        formatter: function() {
          return `<b>${Highcharts.dateFormat('%d.%m.%Y', this.x)}</b><br/>${this.y.toFixed(2)} ${unitLabel}`;
        }
      },
      plotOptions: {
        column: {
          borderRadius: 4,
          color: accentColor,
          borderWidth: 0
        }
      },
      series: [{
        name: `Traffic (${unitLabel})`,
        data: data
      }]
    });
  }
  
  // Connections chart
  const connsData = trends.connsDaily || [];
  if (connsEl && connsData.length > 0) {
    const data = connsData.map(t => {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
      return [d.getTime(), Number(val) || 0];
    });
    
    window.connsChartHighcharts = Highcharts.chart(connsEl, {
      chart: {
        type: 'column',
        backgroundColor: bgColor,
        height: connsEl.clientHeight || 300
      },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        type: 'datetime',
        labels: { style: { color: textColor } },
        gridLineColor: gridColor,
        lineColor: gridColor,
        tickColor: gridColor
      },
      yAxis: {
        title: { text: 'Connections', style: { color: textColor } },
        labels: { style: { color: textColor } },
        gridLineColor: gridColor
      },
      legend: { enabled: false },
      tooltip: {
        backgroundColor: bgColor,
        borderColor: textColor,
        style: { color: textColor },
        formatter: function() {
          return `<b>${Highcharts.dateFormat('%d.%m.%Y', this.x)}</b><br/>${this.y.toLocaleString('ru-RU')} connections`;
        }
      },
      plotOptions: {
        column: {
          borderRadius: 4,
          color: okColor,
          borderWidth: 0
        }
      },
      series: [{
        name: 'Connections',
        data: data
      }]
    });
  }
}

// Vega-Lite version - чистый BI-минимализм
function renderTrendsChartsVegaLite(trends, mode, unit) {
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const accentColor = isDark ? '#58a6ff' : '#0969da';
  const okColor = isDark ? '#3fb950' : '#1a7f37';
  
  if (typeof vegaEmbed === 'undefined') {
    console.warn('Vega-Lite not available');
    return;
  }
  
  // Traffic chart
  const trafficData = trends.trafficDailyBytes || [];
  const elTraffic = document.getElementById('chTraffic');
  if (elTraffic && trafficData.length > 0) {
    elTraffic.innerHTML = '';
    const data = trafficData.map(t => {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
      return {
        date: d.toISOString().split('T')[0],
        value: Number((val / base).toFixed(2))
      };
    });
    
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: data },
      width: elTraffic.clientWidth || 600,
      height: elTraffic.clientHeight || 300,
      background: bgColor,
      config: {
        axis: { labelColor: textColor, titleColor: textColor, gridColor: isDark ? 'rgba(48, 54, 61, 0.2)' : 'rgba(208, 215, 222, 0.2)', domainColor: isDark ? 'rgba(48, 54, 61, 0.5)' : 'rgba(208, 215, 222, 0.5)', tickColor: isDark ? 'rgba(48, 54, 61, 0.5)' : 'rgba(208, 215, 222, 0.5)' },
        text: { color: textColor, fontSize: 11 },
        view: { stroke: null }
      },
      layer: [
        {
          mark: { type: 'area', color: accentColor, opacity: 0.3, interpolate: 'monotone' }
        },
        {
          mark: { type: 'line', color: accentColor, strokeWidth: 2.5, interpolate: 'monotone' }
        },
        {
          mark: { type: 'point', color: accentColor, size: 40, opacity: 0.7 }
        }
      ],
      encoding: {
        x: { field: 'date', type: 'temporal', title: null, axis: { format: '%d.%m', labelAngle: -45 } },
        y: { field: 'value', type: 'quantitative', title: `Traffic (${unitLabel})` }
      }
    };
    
    vegaEmbed(elTraffic, spec, { actions: false });
  }
  
  // Connections chart
  const connsData = trends.connsDaily || [];
  const elConns = document.getElementById('chConns');
  if (elConns && connsData.length > 0) {
    elConns.innerHTML = '';
    const data = connsData.map(t => {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
      return {
        date: d.toISOString().split('T')[0],
        value: Number(val) || 0
      };
    });
    
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: data },
      width: elConns.clientWidth || 600,
      height: elConns.clientHeight || 300,
      background: bgColor,
      config: {
        axis: { labelColor: textColor, titleColor: textColor, gridColor: isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)' },
        text: { color: textColor }
      },
      layer: [
        {
          mark: { type: 'area', color: okColor, opacity: 0.3, interpolate: 'monotone' }
        },
        {
          mark: { type: 'line', color: okColor, strokeWidth: 2.5, interpolate: 'monotone' }
        },
        {
          mark: { type: 'point', color: okColor, size: 40, opacity: 0.7 }
        }
      ],
      encoding: {
        x: { field: 'date', type: 'temporal', title: null, axis: { format: '%d.%m', labelAngle: -45 } },
        y: { field: 'value', type: 'quantitative', title: 'Connections' }
      }
    };
    
    vegaEmbed(elConns, spec, { actions: false });
  }
}

// Recharts version (D3.js-based, стиль Recharts)
function renderTrendsChartsRecharts(trends, mode, unit) {
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const accentColor = isDark ? '#58a6ff' : '#0969da';
  const okColor = isDark ? '#3fb950' : '#1a7f37';
  const gridColor = isDark ? '#303639' : '#d0d7de';
  
  if (typeof d3 === 'undefined') {
    console.warn('D3.js not available');
    return;
  }
  
  // Traffic chart
  const trafficData = trends.trafficDailyBytes || [];
  const elTraffic = document.getElementById('chTraffic');
  if (elTraffic && trafficData.length > 0) {
    elTraffic.innerHTML = '';
    const data = trafficData.map(t => {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
      return {
        date: d,
        dateLabel: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        value: Number((val / base).toFixed(2))
      };
    });
    
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = elTraffic.clientWidth - margin.left - margin.right;
    const height = (elTraffic.clientHeight || 300) - margin.top - margin.bottom;
    
    const svg = d3.select(elTraffic)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);
    
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleBand()
      .domain(data.map(d => d.dateLabel))
      .range([0, width])
      .padding(0.2);
    
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) * 1.1])
      .nice()
      .range([height, 0]);
    
    // Grid lines
    g.selectAll('.grid-line')
      .data(y.ticks(5))
      .enter().append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d))
      .attr('stroke', gridColor)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.5);
    
    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.dateLabel))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.value))
      .attr('height', d => height - y(d.value))
      .attr('fill', accentColor)
      .attr('rx', 4);
    
    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr('color', textColor);
    
    // Y axis
    g.append('g')
      .call(d3.axisLeft(y))
      .attr('color', textColor);
    
    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', bgColor)
      .style('color', textColor)
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('border', `1px solid ${textColor}`)
      .style('pointer-events', 'none');
    
    g.selectAll('.bar')
      .on('mouseover', function(event, d) {
        tooltip.transition().style('opacity', 1);
        tooltip.html(`${d.value.toFixed(2)} ${unitLabel}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        tooltip.transition().style('opacity', 0);
      });
  }
  
  // Connections chart
  const connsData = trends.connsDaily || [];
  const elConns = document.getElementById('chConns');
  if (elConns && connsData.length > 0) {
    elConns.innerHTML = '';
    const data = connsData.map(t => {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
      const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
      return {
        date: d,
        dateLabel: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        value: Number(val) || 0
      };
    });
    
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = elConns.clientWidth - margin.left - margin.right;
    const height = (elConns.clientHeight || 300) - margin.top - margin.bottom;
    
    const svg = d3.select(elConns)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);
    
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleBand()
      .domain(data.map(d => d.dateLabel))
      .range([0, width])
      .padding(0.2);
    
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) * 1.1])
      .nice()
      .range([height, 0]);
    
    // Grid lines
    g.selectAll('.grid-line')
      .data(y.ticks(5))
      .enter().append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d))
      .attr('stroke', gridColor)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.5);
    
    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.dateLabel))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.value))
      .attr('height', d => height - y(d.value))
      .attr('fill', okColor)
      .attr('rx', 4);
    
    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr('color', textColor);
    
    // Y axis
    g.append('g')
      .call(d3.axisLeft(y))
      .attr('color', textColor);
    
    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', bgColor)
      .style('color', textColor)
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('border', `1px solid ${textColor}`)
      .style('pointer-events', 'none');
    
    g.selectAll('.bar')
      .on('mouseover', function(event, d) {
        tooltip.transition().style('opacity', 1);
        tooltip.html(`${d.value.toLocaleString('ru-RU')} connections`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        tooltip.transition().style('opacity', 0);
      });
  }
}

function renderTopDomainsTables(topDomains, unit) {
  if (!topDomains) return;
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  // Traffic table - ограничено до top-7
  const trafficTbody = $('#tblTopTraffic tbody');
  if (trafficTbody) {
    const trafficRows = (topDomains.traffic || []).slice(0, 7).map(d => `
      <tr>
        <td>${d.domain || '—'}</td>
        <td>${((d.trafficBytes || 0) / base).toFixed(2)} ${unitLabel}</td>
        <td>${(d.sharePct || 0).toFixed(2)}%</td>
      </tr>
    `).join('') || '<tr><td colspan="3">Нет данных</td></tr>';
    trafficTbody.innerHTML = trafficRows;
  }
  
  // Conns table - ограничено до top-7
  const connsTbody = $('#tblTopConns tbody');
  if (connsTbody) {
    const connsRows = (topDomains.conns || []).slice(0, 7).map(d => `
      <tr>
        <td>${d.domain || '—'}</td>
        <td>${(d.conns || 0).toLocaleString('ru-RU')}</td>
        <td>${(d.sharePct || 0).toFixed(2)}%</td>
      </tr>
    `).join('') || '<tr><td colspan="3">Нет данных</td></tr>';
    connsTbody.innerHTML = connsRows;
  }
  
  // Apply overview metric filter - show/hide tables based on selected metric (vertical layout)
  const overviewMetric = state.overviewMetric || 'traffic';
  const trafficTableEl = $('#tblTopTraffic');
  const connsTableEl = $('#tblTopConns');
  
  // Find parent div that contains both title and table (domains-single-table)
  const trafficContainer = trafficTableEl ? trafficTableEl.closest('.domains-single-table') : null;
  const connsContainer = connsTableEl ? connsTableEl.closest('.domains-single-table') : null;
  
  if (overviewMetric === 'traffic') {
    // Show traffic table block (with title), hide conns table block
    if (trafficContainer) trafficContainer.style.display = 'block';
    if (connsContainer) connsContainer.style.display = 'none';
  } else {
    // Show conns table block (with title), hide traffic table block
    if (trafficContainer) trafficContainer.style.display = 'none';
    if (connsContainer) connsContainer.style.display = 'block';
  }
}

let usersCmpChart = null;
let usersTrafficChart = null;
let usersConnsChart = null;
let usersDomChart = null;
// ApexCharts instances
let usersTrafficChartApex = null;
let usersConnsChartApex = null;
const userColors = {}; // userId -> color

function getColorForUser(userId) {
  if (!userColors[userId]) {
    const colors = [
      '#8ab4ff', '#26c281', '#ff5d5d', '#d29922', '#a371f7',
      '#58a6ff', '#3fb950', '#f85149', '#d29922', '#bc8cff'
    ];
    const idx = Object.keys(userColors).length % colors.length;
    userColors[userId] = colors[idx];
  }
  return userColors[userId];
}

// Helper function to darken a hex color (for line stroke)
function darkenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) - Math.round(255 * percent / 100)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) - Math.round(255 * percent / 100)));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) - Math.round(255 * percent / 100)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function renderUsersSection(users, userDetails, selectedUsers, mainMetric, miniMetric, mode, unit) {
  // Filter users
  const filteredUsers = selectedUsers.length === 0 || selectedUsers.includes('all') 
    ? users 
    : users.filter(u => selectedUsers.includes(u.userId));
  
  // Render filter chips
  renderUserFilters(users, selectedUsers);
  
  // Note: comparison charts are now rendered separately in renderUsersHistograms
  // and are NOT affected by the user filter - they always show ALL users
  
  // Render user cards
  renderUserCards(filteredUsers, userDetails, mode, unit, miniMetric);
}

function renderUserFilters(users, selectedUsers) {
  const container = $('#userFilters');
  if (!container) return;
  
  const allSelected = selectedUsers.length === 0 || selectedUsers.includes('all');
  const html = `
    <div class="filter-chip ${allSelected ? 'active' : ''}" data-user="all">Все</div>
    ${users.map(u => {
      const isSelected = selectedUsers.includes(u.userId);
      return `<div class="filter-chip ${isSelected ? 'active' : ''}" data-user="${u.userId}">${u.displayName || u.userId}</div>`;
    }).join('')}
  `;
  container.innerHTML = html;
  
  // Add click handlers
  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.onclick = () => {
      const userId = chip.dataset.user;
      if (userId === 'all') {
        state.selectedUsers = ['all'];
      } else {
        if (state.selectedUsers.includes('all')) {
          state.selectedUsers = [userId];
        } else {
          const idx = state.selectedUsers.indexOf(userId);
          if (idx >= 0) {
            state.selectedUsers.splice(idx, 1);
            if (state.selectedUsers.length === 0) {
              state.selectedUsers = ['all'];
            }
          } else {
            state.selectedUsers.push(userId);
          }
        }
      }
      localStorage.setItem('users.selected', JSON.stringify(state.selectedUsers));
      if (state.dashboard) {
        renderUsersSection(state.dashboard.users, state.dashboard.userDetails, 
                          state.selectedUsers, state.mainMetric, state.miniMetric, state.mode, state.unit);
      }
    };
  });
}

// Chart library wrapper for users comparison chart
function renderUsersComparisonChart(users, metric, unit) {
  if (state.chartLibrary === 'apexcharts' && typeof ApexCharts !== 'undefined') {
    renderUsersComparisonChartApex(users, metric, unit);
  } else if (state.chartLibrary === 'observable') {
    renderUsersComparisonChartObservable(users, metric, unit);
  } else if (state.chartLibrary === 'highcharts' && typeof Highcharts !== 'undefined') {
    renderUsersComparisonChartHighcharts(users, metric, unit);
  } else if (state.chartLibrary === 'vegalite' && typeof vegaEmbed !== 'undefined') {
    renderUsersComparisonChartVegaLite(users, metric, unit);
  } else if (state.chartLibrary === 'recharts' && typeof d3 !== 'undefined') {
    renderUsersComparisonChartRecharts(users, metric, unit);
  } else {
    renderUsersComparisonChartAmCharts(users, metric, unit);
  }
}

// amCharts version (original)
function renderUsersComparisonChartAmCharts(users, metric, unit) {
  const el = document.getElementById('chUsersCmp');
  if (!el) return;
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  // Prepare data with users
  const userData = users.map(u => {
    const value = metric === 'traffic' 
      ? Number(((u.traffic7dBytes || 0) / base).toFixed(2))
      : Number(u.conns7d || 0);
    return {
      user: u,
      label: u.displayName || u.userId,
      value: value,
      color: getColorForUser(u.userId)
    };
  });
  
  // Sort by value descending (top user first)
  userData.sort((a, b) => b.value - a.value);
  
  const labels = userData.map(d => d.label);
  const data = userData.map(d => d.value);
  const colors = userData.map(d => d.color);
  
  // Destroy existing chart if exists
  if (usersCmpChart) {
    try {
      usersCmpChart.dispose();
    } catch (e) {
      console.warn('Error disposing users comparison chart:', e);
    }
  }
  
  am5.ready(() => {
    try {
      // Повторная проверка элемента
      const elCheck = document.getElementById('chUsersCmp');
      if (!elCheck || elCheck !== el) {
        console.warn('renderUsersComparisonChart: element changed');
        return;
      }
      
      // Create root element
      const root = am5.Root.new(elCheck);
      root.setThemes([
        am5themes_Animated.new(root)
      ]);
      
      // Create chart
      const chart = root.container.children.push(am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 0
      }));
      
      // Create axes - vertical bar chart (categories on Y, values on X)
      const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererY.new(root, {
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          minGridDistance: 20,
          inversed: false
        })
      }));
      
      yAxis.data.setAll(labels.map((label, idx) => ({
        category: label
      })));
      
      const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {})
      }));
      
      // Create series - horizontal bar chart
      const series = chart.series.push(am5xy.ColumnSeries.new(root, {
        name: metric === 'traffic' ? `Traffic (${unitLabel})` : 'Connections',
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "value",
        categoryYField: "category"
      }));
      
      // Configure columns with user-specific colors (horizontal bars)
      series.columns.template.setAll({
        tooltipText: "{categoryY}: {valueX.formatNumber(metric === 'traffic' ? '#.00' : '#,###')} {unitLabel}",
        tooltipX: 0,
        strokeOpacity: 0,
        cornerRadiusTL: 4,
        cornerRadiusTR: 4,
        cornerRadiusBL: 4,
        cornerRadiusBR: 4
      });
      
      // Dynamic fill color based on user
      series.columns.template.adapters.add("fill", (fill, target) => {
        const dataItem = target.dataItem;
        if (dataItem) {
          const idx = dataItem.get("index");
          if (idx !== undefined && colors[idx]) {
            return am5.color(colors[idx] + 'CC');
          }
        }
        return fill;
      });
      
      series.columns.template.adapters.add("stroke", (stroke, target) => {
        const dataItem = target.dataItem;
        if (dataItem) {
          const idx = dataItem.get("index");
          if (idx !== undefined && colors[idx]) {
            return am5.color(colors[idx]);
          }
        }
        return stroke;
      });
      
      // Labels added via bullets for ColumnSeries (horizontal bars)
      series.bullets.push(function() {
        const label = am5.Label.new(root, {
          text: "",
          fill: amColorVar("--text"),
          centerY: am5.p50,
          centerX: 0,
          fontSize: 10,
          fontWeight: "bold",
          dx: 5
        });
        // Format text using adapter
        label.adapters.add("text", (text, target) => {
          const dataItem = target.dataItem;
          if (dataItem) {
            const value = dataItem.get("valueX");
            if (!value) return "";
            if (metric === 'traffic') {
              return value.toFixed(2);
            } else {
              return value.toLocaleString('ru-RU');
            }
          }
          return "";
        });
        return am5.Bullet.new(root, {
          locationX: 1,
          sprite: label
        });
      });
      
      // Set data
      series.data.setAll(data.map((val, idx) => ({
        category: labels[idx],
        value: val,
        unitLabel: metric === 'traffic' ? unitLabel : 'connections',
        metric: metric
      })));
      
      // Add cursor
      chart.set("cursor", am5xy.XYCursor.new(root, {}));
      
      usersCmpChart = root;
    } catch (e) {
      console.error('Error creating users comparison chart:', e);
      usersCmpChart = null;
    }
  });
}

// Observable Plot version - Data Journalism style
function renderUsersComparisonChartObservable(users, metric, unit) {
  if (typeof Plot === 'undefined' || typeof Plot.plot !== 'function') {
    console.error('Observable Plot: Plot is not available');
    return;
  }
  
  const el = document.getElementById('chUsersCmp');
  if (!el) return;
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)';
  
  try {
    el.innerHTML = '';
    
    const userData = users.map(u => {
      const value = metric === 'traffic' 
        ? Number(((u.traffic7dBytes || 0) / base).toFixed(2))
        : Number(u.conns7d || 0);
      return {
        user: u.displayName || u.userId,
        value: value,
        color: getColorForUser(u.userId)
      };
    }).sort((a, b) => b.value - a.value).filter(d => d.value > 0);
    
    if (userData.length === 0) {
      console.warn('renderUsersComparisonChartObservable: no valid data');
      return;
    }
    
    const width = Math.max(el.clientWidth || 600, 300);
    const height = Math.max(el.clientHeight || 300, 200);
    
    console.log('Observable Plot: rendering users comparison chart with', userData.length, 'users');
    
    const chart = Plot.plot({
      style: { 
        background: bgColor, 
        color: textColor, 
        fontSize: '12px', 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
      },
      width: width,
      height: height,
      marginTop: 20,
      marginRight: 20,
      marginBottom: 40,
      marginLeft: 120,
      y: { 
        label: null, 
        domain: userData.map(d => d.user)
      },
      x: { 
        label: metric === 'traffic' ? `Traffic (${unitLabel})` : 'Connections', 
        grid: true
      },
      marks: [
        Plot.ruleX([0], { stroke: gridColor, strokeWidth: 1 }),
        Plot.barX(userData, { 
          y: 'user', 
          x: 'value', 
          fill: d => d.color, 
          fillOpacity: 0.85, 
          rx: 3 
        })
      ]
    });
    
    if (chart) {
      el.appendChild(chart);
      console.log('Observable Plot: users comparison chart appended successfully');
    } else {
      console.error('Observable Plot: users comparison chart is null');
    }
  } catch (e) {
    console.error('Error rendering Observable users comparison chart:', e);
  }
}

// Highcharts version
function renderUsersComparisonChartHighcharts(users, metric, unit) {
  const el = document.getElementById('chUsersCmp');
  if (!el || typeof Highcharts === 'undefined') return;
  const gbBase = 1000000000, mbBase = 1000000, base = unit === 'gb' ? gbBase : mbBase, unitLabel = unit === 'gb' ? 'GB' : 'MB';
  const isDark = state.theme === 'dark', textColor = isDark ? '#e6edf3' : '#24292f', bgColor = isDark ? '#161b22' : '#ffffff', gridColor = isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)';
  if (window.usersCmpChartHighcharts) { window.usersCmpChartHighcharts.destroy(); window.usersCmpChartHighcharts = null; }
  const userData = users.map(u => {
    const value = metric === 'traffic' ? Number(((u.traffic7dBytes || 0) / base).toFixed(2)) : Number(u.conns7d || 0);
    return { name: u.displayName || u.userId, y: value, color: getColorForUser(u.userId) };
  }).sort((a, b) => b.y - a.y);
  window.usersCmpChartHighcharts = Highcharts.chart(el, {
    chart: { type: 'bar', backgroundColor: bgColor, height: el.clientHeight || 300 },
    title: { text: null }, credits: { enabled: false },
    xAxis: { categories: userData.map(d => d.name), labels: { style: { color: textColor } }, lineColor: gridColor, tickColor: gridColor },
    yAxis: { title: { text: metric === 'traffic' ? `Traffic (${unitLabel})` : 'Connections', style: { color: textColor } }, labels: { style: { color: textColor } }, gridLineColor: gridColor },
    legend: { enabled: false },
    tooltip: { backgroundColor: bgColor, borderColor: textColor, style: { color: textColor }, formatter: function() {
      const val = metric === 'traffic' ? `${this.point.y.toFixed(2)} ${unitLabel}` : `${this.point.y.toLocaleString('ru-RU')} connections`;
      return `<b>${this.point.name}</b><br/>${val}`;
    }},
    plotOptions: { bar: { borderRadius: 4, borderWidth: 0, colorByPoint: true, colors: userData.map(d => d.color) } },
    series: [{ name: metric === 'traffic' ? `Traffic (${unitLabel})` : 'Connections', data: userData }]
  });
}

// Vega-Lite version
function renderUsersComparisonChartVegaLite(users, metric, unit) {
  const el = document.getElementById('chUsersCmp');
  if (!el || typeof vegaEmbed === 'undefined') return;
  const gbBase = 1000000000, mbBase = 1000000, base = unit === 'gb' ? gbBase : mbBase, unitLabel = unit === 'gb' ? 'GB' : 'MB';
  const isDark = state.theme === 'dark', textColor = isDark ? '#e6edf3' : '#24292f', bgColor = isDark ? '#161b22' : '#ffffff';
  el.innerHTML = '';
  const userData = users.map(u => {
    const value = metric === 'traffic' ? Number(((u.traffic7dBytes || 0) / base).toFixed(2)) : Number(u.conns7d || 0);
    return { user: u.displayName || u.userId, value: value };
  }).sort((a, b) => b.value - a.value);
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: { values: userData },
    width: el.clientWidth || 600, height: el.clientHeight || 300, background: bgColor,
    config: { axis: { labelColor: textColor, titleColor: textColor, gridColor: isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)' }, text: { color: textColor } },
    mark: { type: 'bar', color: '#58a6ff', cornerRadius: 4 },
    encoding: { y: { field: 'user', type: 'ordinal', title: null, sort: '-x' }, x: { field: 'value', type: 'quantitative', title: metric === 'traffic' ? `Traffic (${unitLabel})` : 'Connections' } }
  };
  vegaEmbed(el, spec, { actions: false });
}

// Recharts version (D3.js-based)
function renderUsersComparisonChartRecharts(users, metric, unit) {
  const el = document.getElementById('chUsersCmp');
  if (!el || typeof d3 === 'undefined') return;
  const gbBase = 1000000000, mbBase = 1000000, base = unit === 'gb' ? gbBase : mbBase, unitLabel = unit === 'gb' ? 'GB' : 'MB';
  const isDark = state.theme === 'dark', textColor = isDark ? '#e6edf3' : '#24292f', bgColor = isDark ? '#161b22' : '#ffffff', gridColor = isDark ? '#303639' : '#d0d7de';
  el.innerHTML = '';
  const userData = users.map(u => {
    const value = metric === 'traffic' ? Number(((u.traffic7dBytes || 0) / base).toFixed(2)) : Number(u.conns7d || 0);
    return { user: u.displayName || u.userId, value: value, color: getColorForUser(u.userId) };
  }).sort((a, b) => b.value - a.value);
  const margin = { top: 20, right: 20, bottom: 40, left: 120 }, width = el.clientWidth - margin.left - margin.right, height = (el.clientHeight || 300) - margin.top - margin.bottom;
  const svg = d3.select(el).append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain([0, d3.max(userData, d => d.value) * 1.1]).nice().range([0, width]);
  const y = d3.scaleBand().domain(userData.map(d => d.user)).range([0, height]).padding(0.2);
  g.selectAll('.grid-line').data(x.ticks(5)).enter().append('line').attr('class', 'grid-line').attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', 0).attr('y2', height).attr('stroke', gridColor).attr('stroke-dasharray', '3,3').attr('opacity', 0.5);
  g.selectAll('.bar').data(userData).enter().append('rect').attr('class', 'bar').attr('x', 0).attr('y', d => y(d.user)).attr('width', d => x(d.value)).attr('height', y.bandwidth()).attr('fill', d => d.color).attr('rx', 4);
  g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x)).attr('color', textColor);
  g.append('g').call(d3.axisLeft(y)).attr('color', textColor);
  const tooltip = d3.select('body').append('div').attr('class', 'tooltip').style('opacity', 0).style('position', 'absolute').style('background', bgColor).style('color', textColor).style('padding', '8px').style('border-radius', '4px').style('border', `1px solid ${textColor}`).style('pointer-events', 'none');
  g.selectAll('.bar').on('mouseover', function(event, d) {
    tooltip.transition().style('opacity', 1);
    const val = metric === 'traffic' ? `${d.value.toFixed(2)} ${unitLabel}` : `${d.value.toLocaleString('ru-RU')} connections`;
    tooltip.html(`${d.user}: ${val}`).style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 10) + 'px');
  }).on('mouseout', function() { tooltip.transition().style('opacity', 0); });
}

// ApexCharts version
function renderUsersComparisonChartApex(users, metric, unit) {
  const el = document.getElementById('chUsersCmp');
  if (!el || typeof ApexCharts === 'undefined') return;
  const gbBase = 1000000000, mbBase = 1000000, base = unit === 'gb' ? gbBase : mbBase, unitLabel = unit === 'gb' ? 'GB' : 'MB';
  const isDark = state.theme === 'dark', textColor = isDark ? '#e6edf3' : '#24292f', bgColor = isDark ? '#161b22' : '#ffffff', gridColor = isDark ? 'rgba(48, 54, 61, 0.5)' : 'rgba(208, 215, 222, 0.5)';
  if (window.usersCmpChartApex) { window.usersCmpChartApex.destroy(); window.usersCmpChartApex = null; }
  el.innerHTML = '';
  const userData = users.map(u => {
    const value = metric === 'traffic' ? Number(((u.traffic7dBytes || 0) / base).toFixed(2)) : Number(u.conns7d || 0);
    return { label: u.displayName || u.userId, value: value, color: getColorForUser(u.userId) };
  }).sort((a, b) => b.value - a.value);
  const labels = userData.map(d => d.label), values = userData.map(d => d.value), colors = userData.map(d => d.color);
  window.usersCmpChartApex = new ApexCharts(el, {
    series: [{ name: metric === 'traffic' ? `Traffic (${unitLabel})` : 'Connections', data: values }],
    chart: { type: 'bar', height: '100%', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 800 }, horizontal: true },
    plotOptions: { bar: { borderRadius: 6, barHeight: '70%', dataLabels: { position: 'right' }, distributed: true } },
    dataLabels: { enabled: true, formatter: (val) => metric === 'traffic' ? val.toFixed(2) : val.toLocaleString('ru-RU'), style: { fontSize: '11px', colors: [textColor], fontWeight: 'bold' } },
    xaxis: { labels: { style: { colors: textColor } }, title: { text: metric === 'traffic' ? unitLabel : 'Connections', style: { color: textColor } } },
    yaxis: { labels: { style: { colors: textColor } }, categories: labels },
    grid: { borderColor: gridColor, strokeDashArray: 4 },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (val) => metric === 'traffic' ? `${val.toFixed(2)} ${unitLabel}` : `${val.toLocaleString('ru-RU')} connections` } },
    colors: colors, fill: { type: 'solid', opacity: 0.8 }
  });
  window.usersCmpChartApex.render();
}

// Render two histograms for users: traffic (top) and connections (bottom)
// These always show ALL users, regardless of filter in Users section
// Chart library wrapper for user histograms
function renderUsersHistograms(users, unit) {
  // Apply overview metric filter - show/hide user histogram containers
  const overviewMetric = state.overviewMetric || 'traffic';
  const elUsersTraffic = $('#chUsersTraffic');
  const elUsersConns = $('#chUsersConns');
  const containerUsersTraffic = elUsersTraffic ? elUsersTraffic.closest('.chartbox') : null;
  const containerUsersConns = elUsersConns ? elUsersConns.closest('.chartbox') : null;
  
  if (overviewMetric === 'traffic') {
    // Show traffic histogram, hide conns histogram (vertical layout)
    if (containerUsersTraffic) containerUsersTraffic.style.display = 'flex';
    if (containerUsersConns) containerUsersConns.style.display = 'none';
  } else {
    // Show conns histogram, hide traffic histogram (vertical layout)
    if (containerUsersTraffic) containerUsersTraffic.style.display = 'none';
    if (containerUsersConns) containerUsersConns.style.display = 'flex';
  }
  
  // Render histograms (both will render, but only one will be visible)
  if (state.chartLibrary === 'apexcharts' && typeof ApexCharts !== 'undefined') {
    renderUsersHistogramsApex(users, unit);
  } else if (state.chartLibrary === 'observable') {
    renderUsersHistogramsObservable(users, unit);
  } else if (state.chartLibrary === 'highcharts' && typeof Highcharts !== 'undefined') {
    renderUsersHistogramsHighcharts(users, unit);
  } else if (state.chartLibrary === 'vegalite' && typeof vegaEmbed !== 'undefined') {
    renderUsersHistogramsVegaLite(users, unit);
  } else if (state.chartLibrary === 'recharts' && typeof d3 !== 'undefined') {
    renderUsersHistogramsRecharts(users, unit);
  } else {
    renderUsersHistogramsAmCharts(users, unit);
  }
}

// amCharts version (original)
function renderUsersHistogramsAmCharts(users, unit) {
  if (!users || !Array.isArray(users) || users.length === 0) {
    console.warn('renderUsersHistograms: no users data');
    return;
  }
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  // Prepare data for traffic histogram
  const trafficData = users.map(u => ({
    user: u,
    label: u.displayName || u.userId,
    value: Number(((u.traffic7dBytes || 0) / base).toFixed(2)),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.value - a.value); // Sort descending
  
  // Prepare data for connections histogram
  const connsData = users.map(u => ({
    user: u,
    label: u.displayName || u.userId,
    value: Number(u.conns7d || 0),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.value - a.value); // Sort descending
  
  // Render traffic histogram
  renderUserHistogram('chUsersTraffic', trafficData, unitLabel, 'traffic', unit);
  
  // Render connections histogram
  renderUserHistogram('chUsersConns', connsData, 'connections', 'conns', unit);
}

// ApexCharts version (alternative - красивые горизонтальные бары)
function renderUsersHistogramsApex(users, unit) {
  if (!users || !Array.isArray(users) || users.length === 0) {
    console.warn('renderUsersHistograms: no users data');
    return;
  }
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  // Prepare data for traffic histogram
  const trafficData = users.map(u => ({
    user: u,
    label: u.displayName || u.userId,
    value: Number(((u.traffic7dBytes || 0) / base).toFixed(2)),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.value - a.value); // Sort descending
  
  // Prepare data for connections histogram
  const connsData = users.map(u => ({
    user: u,
    label: u.displayName || u.userId,
    value: Number(u.conns7d || 0),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.value - a.value); // Sort descending
  
  // Get theme colors
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.5)' : 'rgba(208, 215, 222, 0.5)';
  const accentColor = isDark ? '#58a6ff' : '#0969da';
  const okColor = isDark ? '#3fb950' : '#1a7f37';
  
  // Destroy existing ApexCharts
  if (usersTrafficChartApex) {
    usersTrafficChartApex.destroy();
    usersTrafficChartApex = null;
  }
  if (usersConnsChartApex) {
    usersConnsChartApex.destroy();
    usersConnsChartApex = null;
  }
  
  // Traffic histogram - horizontal bar chart
  const elTraffic = document.getElementById('chUsersTraffic');
  if (elTraffic) {
    if (!isElementRenderable(elTraffic)) {
      console.log('renderUsersHistogramsApex: chUsersTraffic not visible, skipping');
      return;
    }
    elTraffic.innerHTML = '';
    
    const labels = trafficData.map(d => d.label);
    const values = trafficData.map(d => d.value);
    const colors = trafficData.map(d => d.color);
    
    usersTrafficChartApex = new ApexCharts(elTraffic, {
      series: [{
        name: `Traffic (${unitLabel})`,
        data: values
      }],
      chart: {
        type: 'bar',
        height: '100%',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 800 },
        horizontal: true
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          barHeight: '70%',
          dataLabels: { position: 'right' },
          distributed: true
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => val.toFixed(2),
        style: { fontSize: '11px', colors: [textColor], fontWeight: 'bold' }
      },
      xaxis: {
        labels: { style: { colors: textColor } },
        title: { text: unitLabel, style: { color: textColor } }
      },
      yaxis: {
        labels: { style: { colors: textColor } },
        categories: labels
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 4
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: { formatter: (val) => `${val.toFixed(2)} ${unitLabel}` }
      },
      colors: colors,
      fill: {
        type: 'solid',
        opacity: 0.8
      }
    });
    
    usersTrafficChartApex.render();
  }
  
  // Conns histogram - horizontal bar chart
  const elConns = document.getElementById('chUsersConns');
  if (elConns) {
    if (!isElementRenderable(elConns)) {
      console.log('renderUsersHistogramsApex: chUsersConns not visible, skipping');
      return;
    }
    elConns.innerHTML = '';
    
    const labels = connsData.map(d => d.label);
    const values = connsData.map(d => d.value);
    const colors = connsData.map(d => d.color);
    
    usersConnsChartApex = new ApexCharts(elConns, {
      series: [{
        name: 'Connections',
        data: values
      }],
      chart: {
        type: 'bar',
        height: '100%',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 800 },
        horizontal: true
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          barHeight: '70%',
          dataLabels: { position: 'right' },
          distributed: true
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => val.toLocaleString('ru-RU'),
        style: { fontSize: '11px', colors: [textColor], fontWeight: 'bold' }
      },
      xaxis: {
        labels: { style: { colors: textColor } },
        title: { text: 'Connections', style: { color: textColor } }
      },
      yaxis: {
        labels: { style: { colors: textColor } },
        categories: labels
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 4
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: { formatter: (val) => `${val.toLocaleString('ru-RU')} connections` }
      },
      colors: colors,
      fill: {
        type: 'solid',
        opacity: 0.8
      }
    });
    
    usersConnsChartApex.render();
  }
}

// Observable Plot version
// Observable Plot version - Data Journalism / Bloomberg style (минимализм, типографика)
function renderUsersHistogramsObservable(users, unit) {
  let PlotLib = null;
  if (typeof Plot !== 'undefined') {
    PlotLib = Plot;
  } else if (typeof window !== 'undefined' && window.Plot) {
    PlotLib = window.Plot;
  } else if (typeof globalThis !== 'undefined' && globalThis.Plot) {
    PlotLib = globalThis.Plot;
  }
  
  if (!PlotLib) {
    console.error('Observable Plot: Plot library not found');
    return;
  }
  
  if (!users || !Array.isArray(users) || users.length === 0) {
    console.warn('renderUsersHistogramsObservable: no users data');
    return;
  }
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)';
  
  // Traffic histogram
  const trafficData = users.map(u => ({
    user: u.displayName || u.userId,
    value: Number(((u.traffic7dBytes || 0) / base).toFixed(2)),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.value - a.value).filter(d => d.value > 0);
  
  const trafficEl = document.getElementById('chUsersTraffic');
  if (trafficEl && trafficData.length > 0) {
    if (!isElementRenderable(trafficEl)) {
      console.log('renderUsersHistogramsObservable: chUsersTraffic not visible, skipping');
      return;
    }
    try {
      trafficEl.innerHTML = '';
      const width = Math.max(trafficEl.clientWidth || 600, 300);
      const height = Math.max(trafficEl.clientHeight || 300, 200);
      
      console.log('Observable Plot: rendering traffic histogram with', trafficData.length, 'users');
      
      const trafficChart = Plot.plot({
        style: { 
          background: bgColor, 
          color: textColor,
          fontSize: '12px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        width: width,
        height: height,
        marginTop: 20,
        marginRight: 20,
        marginBottom: 40,
        marginLeft: 120,
        y: { 
          label: null,
          domain: trafficData.map(d => d.user)
        },
        x: { 
          label: `Traffic (${unitLabel})`,
          grid: true
        },
        marks: [
          Plot.ruleX([0], { stroke: gridColor, strokeWidth: 1 }),
          Plot.barX(trafficData, { 
            y: 'user', 
            x: 'value', 
            fill: d => d.color,
            fillOpacity: 0.85,
            rx: 3
          })
        ]
      });
      
      if (trafficChart) {
        trafficEl.appendChild(trafficChart);
        console.log('Observable Plot: traffic histogram appended successfully');
      } else {
        console.error('Observable Plot: traffic histogram is null');
      }
    } catch (e) {
      console.error('Error rendering Observable traffic histogram:', e);
    }
  }
  
  // Connections histogram
  const connsData = users.map(u => ({
    user: u.displayName || u.userId,
    value: Number(u.conns7d || 0),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.value - a.value).filter(d => d.value > 0);
  
  const connsEl = document.getElementById('chUsersConns');
  if (connsEl && connsData.length > 0) {
    // Check if element is visible before rendering
    if (!isElementRenderable(connsEl)) {
      console.log('renderUsersHistogramsObservable: chUsersConns not visible, skipping');
      return;
    }
    try {
      connsEl.innerHTML = '';
      const width = Math.max(connsEl.clientWidth || 600, 300);
      const height = Math.max(connsEl.clientHeight || 300, 200);
      
      console.log('Observable Plot: rendering conns histogram with', connsData.length, 'users');
      
      const connsChart = Plot.plot({
        style: { 
          background: bgColor, 
          color: textColor,
          fontSize: '12px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        width: width,
        height: height,
        marginTop: 20,
        marginRight: 20,
        marginBottom: 40,
        marginLeft: 120,
        y: { 
          label: null,
          domain: connsData.map(d => d.user)
        },
        x: { 
          label: 'Connections',
          grid: true
        },
        marks: [
          Plot.ruleX([0], { stroke: gridColor, strokeWidth: 1 }),
          Plot.barX(connsData, { 
            y: 'user', 
            x: 'value', 
            fill: d => d.color,
            fillOpacity: 0.85,
            rx: 3
          })
        ]
      });
      
      if (connsChart) {
        connsEl.appendChild(connsChart);
        console.log('Observable Plot: conns histogram appended successfully');
      } else {
        console.error('Observable Plot: conns histogram is null');
      }
    } catch (e) {
      console.error('Error rendering Observable conns histogram:', e);
    }
  }
}

// Highcharts version - корпоративный премиум стиль
function renderUsersHistogramsHighcharts(users, unit) {
  if (!users || !Array.isArray(users) || users.length === 0) {
    console.warn('renderUsersHistogramsHighcharts: no users data');
    return;
  }
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)';
  
  if (typeof Highcharts === 'undefined') {
    console.warn('Highcharts not available');
    return;
  }
  
  // Destroy existing charts
  if (window.usersTrafficChartHighcharts) {
    window.usersTrafficChartHighcharts.destroy();
    window.usersTrafficChartHighcharts = null;
  }
  if (window.usersConnsChartHighcharts) {
    window.usersConnsChartHighcharts.destroy();
    window.usersConnsChartHighcharts = null;
  }
  
  // Traffic histogram
  const trafficData = users.map(u => ({
    name: u.displayName || u.userId,
    y: Number(((u.traffic7dBytes || 0) / base).toFixed(2)),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.y - a.y);
  
  const trafficEl = document.getElementById('chUsersTraffic');
  if (trafficEl && trafficData.length > 0) {
    if (!isElementRenderable(trafficEl)) {
      console.log('renderUsersHistogramsHighcharts: chUsersTraffic not visible, skipping');
      return;
    }
    window.usersTrafficChartHighcharts = Highcharts.chart(trafficEl, {
      chart: {
        type: 'bar',
        backgroundColor: bgColor,
        height: trafficEl.clientHeight || 300
      },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        categories: trafficData.map(d => d.name),
        labels: { style: { color: textColor } },
        lineColor: gridColor,
        tickColor: gridColor
      },
      yAxis: {
        title: { text: `Traffic (${unitLabel})`, style: { color: textColor } },
        labels: { style: { color: textColor } },
        gridLineColor: gridColor
      },
      legend: { enabled: false },
      tooltip: {
        backgroundColor: bgColor,
        borderColor: textColor,
        style: { color: textColor },
        formatter: function() {
          return `<b>${this.point.name}</b><br/>${this.point.y.toFixed(2)} ${unitLabel}`;
        }
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          borderWidth: 0,
          colorByPoint: true,
          colors: trafficData.map(d => d.color)
        }
      },
      series: [{
        name: `Traffic (${unitLabel})`,
        data: trafficData
      }]
    });
  }
  
  // Connections histogram
  const connsData = users.map(u => ({
    name: u.displayName || u.userId,
    y: Number(u.conns7d || 0),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.y - a.y);
  
  const connsEl = document.getElementById('chUsersConns');
  if (connsEl && connsData.length > 0) {
    if (!isElementRenderable(connsEl)) {
      console.log('renderUsersHistogramsHighcharts: chUsersConns not visible, skipping');
      return;
    }
    window.usersConnsChartHighcharts = Highcharts.chart(connsEl, {
      chart: {
        type: 'bar',
        backgroundColor: bgColor,
        height: connsEl.clientHeight || 300
      },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        categories: connsData.map(d => d.name),
        labels: { style: { color: textColor } },
        lineColor: gridColor,
        tickColor: gridColor
      },
      yAxis: {
        title: { text: 'Connections', style: { color: textColor } },
        labels: { style: { color: textColor } },
        gridLineColor: gridColor
      },
      legend: { enabled: false },
      tooltip: {
        backgroundColor: bgColor,
        borderColor: textColor,
        style: { color: textColor },
        formatter: function() {
          return `<b>${this.point.name}</b><br/>${this.point.y.toLocaleString('ru-RU')} connections`;
        }
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          borderWidth: 0,
          colorByPoint: true,
          colors: connsData.map(d => d.color)
        }
      },
      series: [{
        name: 'Connections',
        data: connsData
      }]
    });
  }
}

// Vega-Lite version - чистый BI-минимализм
function renderUsersHistogramsVegaLite(users, unit) {
  if (!users || !Array.isArray(users) || users.length === 0) {
    console.warn('renderUsersHistogramsVegaLite: no users data');
    return;
  }
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  
  if (typeof vegaEmbed === 'undefined') {
    console.warn('Vega-Lite not available');
    return;
  }
  
  // Traffic histogram
  const trafficData = users.map(u => ({
    user: u.displayName || u.userId,
    value: Number(((u.traffic7dBytes || 0) / base).toFixed(2))
  })).sort((a, b) => b.value - a.value);
  
  const trafficEl = document.getElementById('chUsersTraffic');
  if (trafficEl && trafficData.length > 0) {
    if (!isElementRenderable(trafficEl)) {
      console.log('renderUsersHistogramsVegaLite: chUsersTraffic not visible, skipping');
      return;
    }
    trafficEl.innerHTML = '';
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: trafficData },
      width: trafficEl.clientWidth || 600,
      height: trafficEl.clientHeight || 300,
      background: bgColor,
      config: {
        axis: { labelColor: textColor, titleColor: textColor, gridColor: isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)' },
        text: { color: textColor }
      },
      mark: { type: 'bar', color: '#58a6ff', cornerRadius: 4 },
      encoding: {
        y: { field: 'user', type: 'ordinal', title: null, sort: '-x' },
        x: { field: 'value', type: 'quantitative', title: `Traffic (${unitLabel})` }
      }
    };
    vegaEmbed(trafficEl, spec, { actions: false });
  }
  
  // Connections histogram
  const connsData = users.map(u => ({
    user: u.displayName || u.userId,
    value: Number(u.conns7d || 0)
  })).sort((a, b) => b.value - a.value);
  
  const connsEl = document.getElementById('chUsersConns');
  if (connsEl && connsData.length > 0) {
    if (!isElementRenderable(connsEl)) {
      console.log('renderUsersHistogramsVegaLite: chUsersConns not visible, skipping');
      return;
    }
    connsEl.innerHTML = '';
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: connsData },
      width: connsEl.clientWidth || 600,
      height: connsEl.clientHeight || 300,
      background: bgColor,
      config: {
        axis: { labelColor: textColor, titleColor: textColor, gridColor: isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)' },
        text: { color: textColor }
      },
      mark: { type: 'bar', color: '#3fb950', cornerRadius: 4 },
      encoding: {
        y: { field: 'user', type: 'ordinal', title: null, sort: '-x' },
        x: { field: 'value', type: 'quantitative', title: 'Connections' }
      }
    };
    vegaEmbed(connsEl, spec, { actions: false });
  }
}

// Recharts version (D3.js-based, стиль Recharts)
function renderUsersHistogramsRecharts(users, unit) {
  if (!users || !Array.isArray(users) || users.length === 0) {
    console.warn('renderUsersHistogramsRecharts: no users data');
    return;
  }
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const gridColor = isDark ? '#303639' : '#d0d7de';
  
  if (typeof d3 === 'undefined') {
    console.warn('D3.js not available');
    return;
  }
  
  // Traffic histogram
  const trafficData = users.map(u => ({
    user: u.displayName || u.userId,
    value: Number(((u.traffic7dBytes || 0) / base).toFixed(2)),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.value - a.value);
  
  const trafficEl = document.getElementById('chUsersTraffic');
  if (trafficEl && trafficData.length > 0) {
    if (!isElementRenderable(trafficEl)) {
      console.log('renderUsersHistogramsRecharts: chUsersTraffic not visible, skipping');
      return;
    }
    trafficEl.innerHTML = '';
    const margin = { top: 20, right: 20, bottom: 40, left: 120 };
    const width = trafficEl.clientWidth - margin.left - margin.right;
    const height = (trafficEl.clientHeight || 300) - margin.top - margin.bottom;
    
    const svg = d3.select(trafficEl)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);
    
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleLinear()
      .domain([0, d3.max(trafficData, d => d.value) * 1.1])
      .nice()
      .range([0, width]);
    
    const y = d3.scaleBand()
      .domain(trafficData.map(d => d.user))
      .range([0, height])
      .padding(0.2);
    
    // Grid lines
    g.selectAll('.grid-line')
      .data(x.ticks(5))
      .enter().append('line')
      .attr('class', 'grid-line')
      .attr('x1', d => x(d))
      .attr('x2', d => x(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', gridColor)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.5);
    
    // Bars
    g.selectAll('.bar')
      .data(trafficData)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => y(d.user))
      .attr('width', d => x(d.value))
      .attr('height', y.bandwidth())
      .attr('fill', d => d.color)
      .attr('rx', 4);
    
    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr('color', textColor);
    
    // Y axis
    g.append('g')
      .call(d3.axisLeft(y))
      .attr('color', textColor);
    
    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', bgColor)
      .style('color', textColor)
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('border', `1px solid ${textColor}`)
      .style('pointer-events', 'none');
    
    g.selectAll('.bar')
      .on('mouseover', function(event, d) {
        tooltip.transition().style('opacity', 1);
        tooltip.html(`${d.user}: ${d.value.toFixed(2)} ${unitLabel}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        tooltip.transition().style('opacity', 0);
      });
  }
  
  // Connections histogram
  const connsData = users.map(u => ({
    user: u.displayName || u.userId,
    value: Number(u.conns7d || 0),
    color: getColorForUser(u.userId)
  })).sort((a, b) => b.value - a.value);
  
  const connsEl = document.getElementById('chUsersConns');
  if (connsEl && connsData.length > 0) {
    if (!isElementRenderable(connsEl)) {
      console.log('renderUsersHistogramsRecharts: chUsersConns not visible, skipping');
      return;
    }
    connsEl.innerHTML = '';
    const margin = { top: 20, right: 20, bottom: 40, left: 120 };
    const width = connsEl.clientWidth - margin.left - margin.right;
    const height = (connsEl.clientHeight || 300) - margin.top - margin.bottom;
    
    const svg = d3.select(connsEl)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);
    
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleLinear()
      .domain([0, d3.max(connsData, d => d.value) * 1.1])
      .nice()
      .range([0, width]);
    
    const y = d3.scaleBand()
      .domain(connsData.map(d => d.user))
      .range([0, height])
      .padding(0.2);
    
    // Grid lines
    g.selectAll('.grid-line')
      .data(x.ticks(5))
      .enter().append('line')
      .attr('class', 'grid-line')
      .attr('x1', d => x(d))
      .attr('x2', d => x(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', gridColor)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.5);
    
    // Bars
    g.selectAll('.bar')
      .data(connsData)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => y(d.user))
      .attr('width', d => x(d.value))
      .attr('height', y.bandwidth())
      .attr('fill', d => d.color)
      .attr('rx', 4);
    
    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .attr('color', textColor);
    
    // Y axis
    g.append('g')
      .call(d3.axisLeft(y))
      .attr('color', textColor);
    
    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', bgColor)
      .style('color', textColor)
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('border', `1px solid ${textColor}`)
      .style('pointer-events', 'none');
    
    g.selectAll('.bar')
      .on('mouseover', function(event, d) {
        tooltip.transition().style('opacity', 1);
        tooltip.html(`${d.user}: ${d.value.toLocaleString('ru-RU')} connections`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        tooltip.transition().style('opacity', 0);
      });
  }
}

// Helper: Check if element is visible and has size
function isElementRenderable(el) {
  if (!el) return false;
  
  // Check computed style - if display is none, element is not renderable
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  
  // Check if element is inside a hidden parent
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
      return false;
    }
    parent = parent.parentElement;
  }
  
  // Check size
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// Helper: Render when element becomes visible (using ResizeObserver)
function renderWhenVisible(elementId, renderCallback, maxRetries = 0) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn(`renderWhenVisible: element ${elementId} not found`);
    return;
  }
  
  // If already visible, render immediately
  if (isElementRenderable(el)) {
    renderCallback();
    return;
  }
  
  // If max retries reached, give up
  if (maxRetries >= 10) {
    console.warn(`renderWhenVisible: element ${elementId} still not visible after ${maxRetries} checks, giving up`);
    return;
  }
  
  // Use ResizeObserver to detect when element becomes visible
  const ro = new ResizeObserver(() => {
    if (isElementRenderable(el)) {
      ro.disconnect();
      renderCallback();
    }
  });
  
  // Also check parent elements
  let current = el;
  while (current && current !== document.body) {
    ro.observe(current);
    current = current.parentElement;
  }
  
  // Fallback: check after a delay (in case ResizeObserver doesn't fire)
  setTimeout(() => {
    if (isElementRenderable(el)) {
      ro.disconnect();
      renderCallback();
    } else {
      ro.disconnect();
      // Retry with incremented counter
      renderWhenVisible(elementId, renderCallback, maxRetries + 1);
    }
  }, 200);
}

function renderUserHistogram(elementId, userData, unitLabel, metric, unit) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn(`renderUserHistogram: element ${elementId} not found`);
    return;
  }
  
  // Check if element is renderable - if not, use ResizeObserver
  if (!isElementRenderable(el)) {
    console.log(`renderUserHistogram: element ${elementId} is not visible, waiting for visibility...`);
    renderWhenVisible(elementId, () => {
      renderUserHistogram(elementId, userData, unitLabel, metric, unit);
    });
    return;
  }
  
  const labels = userData.map(d => d.label);
  const values = userData.map(d => d.value);
  const colors = userData.map(d => d.color);
  
  // Destroy existing chart if exists (amCharts)
  if (metric === 'traffic' && usersTrafficChart) {
    try {
      usersTrafficChart.dispose();
      usersTrafficChart = null;
    } catch (e) {
      console.warn('Error disposing users traffic chart:', e);
    }
  }
  if (metric === 'conns' && usersConnsChart) {
    try {
      usersConnsChart.dispose();
      usersConnsChart = null;
    } catch (e) {
      console.warn('Error disposing users conns chart:', e);
    }
  }
  // Destroy ApexCharts if exists
  if (metric === 'traffic' && usersTrafficChartApex) {
    try {
      usersTrafficChartApex.destroy();
      usersTrafficChartApex = null;
    } catch (e) {
      console.warn('Error destroying users traffic ApexChart:', e);
    }
  }
  if (metric === 'conns' && usersConnsChartApex) {
    try {
      usersConnsChartApex.destroy();
      usersConnsChartApex = null;
    } catch (e) {
      console.warn('Error destroying users conns ApexChart:', e);
    }
  }
  
  am5.ready(() => {
    try {
      const elCheck = document.getElementById(elementId);
      if (!elCheck) {
        console.warn(`renderUserHistogram: element ${elementId} not found in am5.ready`);
        return;
      }
      
      // Final check before rendering - if still not visible, skip
      if (!isElementRenderable(elCheck)) {
        console.log(`renderUserHistogram: element ${elementId} still not visible, skipping render`);
        return;
      }
      
      console.log(`renderUserHistogram: creating chart for ${elementId}, size: ${rect.width}x${rect.height}`);
      
      // Create root element
      const root = am5.Root.new(elCheck);
      root.setThemes([
        am5themes_Animated.new(root)
      ]);
      
      // Create chart
      const chart = root.container.children.push(am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 20,
        paddingBottom: 0
      }));
      
      // Create axes - horizontal bar chart (categories on Y, values on X)
      const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererY.new(root, {
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          minGridDistance: 20,
          inversed: false
        })
      }));
      
      yAxis.data.setAll(labels.map((label) => ({
        category: label
      })));
      
      const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererX.new(root, {}),
        min: 0
      }));
      
      // Create series - horizontal bar chart
      const series = chart.series.push(am5xy.ColumnSeries.new(root, {
        name: metric === 'traffic' ? `Traffic (${unitLabel})` : 'Connections',
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "value",
        categoryYField: "category"
      }));
      
      // Configure columns
      const formatPattern = metric === 'traffic' ? '#.00' : '#,###';
      series.columns.template.setAll({
        tooltipText: `{categoryY}: {valueX.formatNumber('${formatPattern}')} ${unitLabel}`,
        tooltipX: 0,
        strokeOpacity: 0,
        cornerRadiusTL: 4,
        cornerRadiusTR: 4,
        cornerRadiusBL: 4,
        cornerRadiusBR: 4
      });
      
      // Dynamic fill color based on user
      series.columns.template.adapters.add("fill", (fill, target) => {
        const dataItem = target.dataItem;
        if (dataItem) {
          const idx = dataItem.get("index");
          if (idx !== undefined && colors[idx]) {
            return am5.color(colors[idx] + 'CC');
          }
        }
        return fill;
      });
      
      series.columns.template.adapters.add("stroke", (stroke, target) => {
        const dataItem = target.dataItem;
        if (dataItem) {
          const idx = dataItem.get("index");
          if (idx !== undefined && colors[idx]) {
            return am5.color(colors[idx]);
          }
        }
        return stroke;
      });
      
      // Labels on bars
      series.bullets.push(function() {
        const label = am5.Label.new(root, {
          text: "",
          fill: amColorVar("--text"),
          centerY: am5.p50,
          centerX: 0,
          fontSize: 10,
          fontWeight: "bold",
          dx: 5
        });
        label.adapters.add("text", (text, target) => {
          const dataItem = target.dataItem;
          if (dataItem) {
            const value = dataItem.get("valueX");
            if (!value) return "";
            if (metric === 'traffic') {
              return value.toFixed(2);
            } else {
              return value.toLocaleString('ru-RU');
            }
          }
          return "";
        });
        return am5.Bullet.new(root, {
          locationX: 1,
          sprite: label
        });
      });
      
      // Set data
      series.data.setAll(values.map((val, idx) => ({
        category: labels[idx],
        value: val
      })));
      
      // Add cursor
      chart.set("cursor", am5xy.XYCursor.new(root, {}));
      
      // Store chart reference
      if (metric === 'traffic') {
        usersTrafficChart = root;
      } else {
        usersConnsChart = root;
      }
      
      console.log(`renderUserHistogram: chart created successfully for ${elementId}`);
    } catch (e) {
      console.error(`Error creating users ${metric} histogram:`, e);
      if (metric === 'traffic') {
        usersTrafficChart = null;
      } else {
        usersConnsChart = null;
      }
    }
  });
}

function renderUsersDomainsChart(users, metric) {
  const el = document.getElementById('chUsersDom');
  if (!el) {
    console.warn('renderUsersDomainsChart: chUsersDom element not found');
    return;
  }
  
  if (!users || !Array.isArray(users) || users.length === 0) {
    console.warn('renderUsersDomainsChart: no users data');
    return;
  }
  
  const labels = users.map(u => u.displayName || u.userId);
  const data = users.map(u => {
    if (metric === 'traffic') {
      return Number((u.traffic7dBytes || 0) / 1000000000); // GB
    } else {
      return Number(u.conns7d || 0);
    }
  });
  const colors = users.map(u => getColorForUser(u.userId));
  
  // Destroy existing chart if exists
  if (usersDomChart) {
    try {
      usersDomChart.dispose();
    } catch (e) {
      console.warn('Error disposing users domains chart:', e);
    }
  }
  
  am5.ready(() => {
    try {
      // Повторная проверка элемента
      const elCheck = document.getElementById('chUsersDom');
      if (!elCheck || elCheck !== el) {
        console.warn('renderUsersDomainsChart: element changed');
        return;
      }
      
      const maxValue = Math.max(...data, 1);
      const unitLabel = metric === 'traffic' ? 'GB' : 'connections';
      
      // Create root element
      const root = am5.Root.new(elCheck);
      root.setThemes([
        am5themes_Animated.new(root)
      ]);
      
      // Create chart
      const chart = root.container.children.push(am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 0
      }));
      
      // Create axes
      const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          minGridDistance: 30
        })
      }));
      
      xAxis.data.setAll(labels.map((label, idx) => ({
        category: label
      })));
      
      const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {})
      }));
      
      // Create series
      const series = chart.series.push(am5xy.ColumnSeries.new(root, {
        name: metric === 'traffic' ? `Traffic (${unitLabel})` : 'Connections',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        categoryXField: "category"
      }));
      
      // Configure columns with user-specific colors
      series.columns.template.setAll({
        tooltipText: "{categoryX}: {valueY.formatNumber(metric === 'traffic' ? '#.00' : '#,###')} {unitLabel}",
        tooltipY: 0,
        strokeOpacity: 0,
        cornerRadiusTL: 8,
        cornerRadiusTR: 8,
        cornerRadiusBL: 8,
        cornerRadiusBR: 8
      });
      
      // Dynamic fill color based on user
      series.columns.template.adapters.add("fill", (fill, target) => {
        const dataItem = target.dataItem;
        if (dataItem) {
          const idx = dataItem.get("index");
          if (idx !== undefined && colors[idx]) {
            return am5.color(colors[idx] + 'CC');
          }
        }
        return fill;
      });
      
      series.columns.template.adapters.add("stroke", (stroke, target) => {
        const dataItem = target.dataItem;
        if (dataItem) {
          const idx = dataItem.get("index");
          if (idx !== undefined && colors[idx]) {
            return am5.color(colors[idx]);
          }
        }
        return stroke;
      });
      
      // Labels added via bullets for ColumnSeries
      series.bullets.push(function() {
        const label = am5.Label.new(root, {
          text: "",
          fill: amColorVar("--text"),
          centerY: 0,
          centerX: am5.p50,
          fontSize: 10,
          fontWeight: "bold",
          dy: -5
        });
        // Format text using adapter
        label.adapters.add("text", (text, target) => {
          const dataItem = target.dataItem;
          if (dataItem) {
            const value = dataItem.get("valueY");
            if (!value) return "";
            if (metric === 'traffic') {
              return value.toFixed(2);
            } else {
              return value.toLocaleString('ru-RU');
            }
          }
          return "";
        });
        return am5.Bullet.new(root, {
          locationY: 1,
          sprite: label
        });
      });
      
      // Set data
      series.data.setAll(data.map((val, idx) => ({
        category: labels[idx],
        value: val,
        unitLabel: unitLabel,
        metric: metric
      })));
      
      // Add cursor
      chart.set("cursor", am5xy.XYCursor.new(root, {}));
      
      usersDomChart = root;
    } catch (e) {
      console.error('Error creating users domains chart:', e);
      usersDomChart = null;
    }
  });
}

function renderUserCards(users, userDetails, mode, unit, miniMetric) {
  const container = $('#usersGrid');
  if (!container) return;
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = unit === 'gb' ? 'GB' : 'MB';
  
  const html = users.map(u => {
    const details = userDetails[u.userId] || {};
    const status = u.status === 'anomaly' ? 'аномалии' : 'ok';
    const statusClass = u.status === 'anomaly' ? 'bad' : 'ok';
    
    const traffic7d = ((u.traffic7dBytes || 0) / base).toFixed(2);
    const conns7d = (u.conns7d || 0).toLocaleString('ru-RU');
    
    const topTraffic = (details.topDomainsTraffic || []).slice(0, 10);
    const topConns = (details.topDomainsConns || []).slice(0, 10);
    
    return `
      <div class="card">
        <div class="card-hd">
          <div>
            <h3>${u.displayName || u.userId}</h3>
            <div class="meta">${u.userId}</div>
          </div>
          <span class="badge ${statusClass}">${status}</span>
        </div>
        <div class="card-bd">
          <div class="row" style="margin-bottom:8px;">
            <span class="badge">traffic7d: ${traffic7d} ${unitLabel}</span>
            <span class="badge">conns7d: ${conns7d}</span>
          </div>
          <div style="height:70px;margin-bottom:6px;">
            <div id="userChart_${u.userId}" style="width:100%;height:100%;"></div>
          </div>
          <div class="domains-grid">
            <div class="user-table-traffic" data-user-id="${u.userId}">
              <div class="kpi-title" style="font-size:11px;margin-bottom:6px;">Top-10 Traffic</div>
              <table class="table">
                <thead><tr><th>Domain</th><th>${unitLabel}</th><th>%</th></tr></thead>
                <tbody>
                  ${topTraffic.map(d => `
                    <tr>
                      <td>${d.domain}</td>
                      <td>${((d.trafficBytes || 0) / base).toFixed(2)}</td>
                      <td>${(d.sharePct || 0).toFixed(2)}%</td>
                    </tr>
                  `).join('') || '<tr><td colspan="3">Нет данных</td></tr>'}
                </tbody>
              </table>
            </div>
            <div class="user-table-conns" data-user-id="${u.userId}">
              <div class="kpi-title" style="font-size:11px;margin-bottom:6px;">Top-10 Conns</div>
              <table class="table">
                <thead><tr><th>Domain</th><th>#</th><th>%</th></tr></thead>
                <tbody>
                  ${(topConns && topConns.length > 0) ? topConns.map(d => {
                    const domain = d.domain || '—';
                    const conns = typeof d === 'object' ? (d.conns || 0) : 0;
                    const pct = typeof d === 'object' ? (d.sharePct || 0) : 0;
                    return `
                    <tr>
                      <td>${domain}</td>
                      <td>${conns.toLocaleString('ru-RU')}</td>
                      <td>${pct.toFixed(2)}%</td>
                    </tr>
                  `;
                  }).join('') : '<tr><td colspan="3">Нет данных</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
  
  // Apply overview metric filter - show/hide tables in user cards
  const overviewMetric = state.overviewMetric || 'traffic';
  const allTrafficTables = container.querySelectorAll('.user-table-traffic');
  const allConnsTables = container.querySelectorAll('.user-table-conns');
  
  if (overviewMetric === 'traffic') {
    // Show traffic tables, hide conns tables
    allTrafficTables.forEach(el => { if (el) el.style.display = ''; });
    allConnsTables.forEach(el => { if (el) el.style.display = 'none'; });
  } else {
    // Show conns tables, hide traffic tables
    allTrafficTables.forEach(el => { if (el) el.style.display = 'none'; });
    allConnsTables.forEach(el => { if (el) el.style.display = ''; });
  }
  
  // Render mini charts for each user - use overviewMetric to determine which trend to show
  users.forEach(u => {
    const details = userDetails[u.userId] || {};
    const trend = overviewMetric === 'traffic' 
      ? (details.trafficTrendDailyBytes || [])
      : (details.connsTrendDaily || []);
    renderUserMiniChart(u.userId, trend, mode, unit, overviewMetric);
  });
}

// Chart library wrapper for user mini charts
function renderUserMiniChart(userId, trend, mode, unit, miniMetric) {
  if (state.chartLibrary === 'apexcharts' && typeof ApexCharts !== 'undefined') {
    renderUserMiniChartApex(userId, trend, mode, unit, miniMetric);
  } else if (state.chartLibrary === 'observable') {
    renderUserMiniChartObservable(userId, trend, mode, unit, miniMetric);
  } else if (state.chartLibrary === 'highcharts' && typeof Highcharts !== 'undefined') {
    renderUserMiniChartHighcharts(userId, trend, mode, unit, miniMetric);
  } else if (state.chartLibrary === 'vegalite' && typeof vegaEmbed !== 'undefined') {
    renderUserMiniChartVegaLite(userId, trend, mode, unit, miniMetric);
  } else if (state.chartLibrary === 'recharts' && typeof d3 !== 'undefined') {
    renderUserMiniChartRecharts(userId, trend, mode, unit, miniMetric);
  } else {
    renderUserMiniChartAmCharts(userId, trend, mode, unit, miniMetric);
  }
}

// amCharts version (original)
function renderUserMiniChartAmCharts(userId, trend, mode, unit, miniMetric) {
  const el = document.getElementById(`userChart_${userId}`);
  if (!el) {
    console.warn(`Element userChart_${userId} not found`);
    return;
  }
  
  if (!trend || !Array.isArray(trend) || trend.length === 0) {
    console.warn(`No trend data for user ${userId}`);
    return;
  }
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const unitLabel = miniMetric === 'traffic' ? (unit === 'gb' ? 'GB' : 'MB') : 'connections';
  
  const labels = trend.map(t => {
    try {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      if (!dateStr) return '—';
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      console.error('Error parsing mini chart date:', t, e);
      return '—';
    }
  });
  const data = trend.map(t => {
    const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
    // For traffic, divide by base; for conns, use value as-is
    return miniMetric === 'traffic' ? (Number(val) / base) : Number(val);
  });
  const color = getColorForUser(userId);
  
  // Destroy existing chart if exists (store in a map)
  if (!window.userMiniCharts) {
    window.userMiniCharts = {};
  }
  if (window.userMiniCharts[userId]) {
    try {
      window.userMiniCharts[userId].dispose();
    } catch (e) {
      console.warn(`Error disposing mini chart for user ${userId}:`, e);
    }
  }
  
  am5.ready(() => {
    try {
      // Повторная проверка элемента
      const elCheck = document.getElementById(`userChart_${userId}`);
      if (!elCheck || elCheck !== el) {
        console.warn(`renderUserMiniChart: element changed for user ${userId}`);
        return;
      }
      
      // Create root element
      const root = am5.Root.new(elCheck);
      root.setThemes([
        am5themes_Animated.new(root)
      ]);
      
      // Create chart
      const chart = root.container.children.push(am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0
      }));
      
      // Create axes
      const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 20
        })
      }));
      xAxis.get("renderer").labels.template.setAll({
        fontSize: 8,
        fill: amColorVar("--muted")
      });
      
      xAxis.data.setAll(labels.map((label, idx) => ({
        category: label
      })));
      
      const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {})
      }));
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 8,
        fill: amColorVar("--muted")
      });
      
      // Create series with darker line and lighter fill (same color direction)
      const darkerColor = darkenColor(color, 20); // Darker for line (20% darker)
      
      const seriesName = miniMetric === 'traffic' ? `Traffic (${unitLabel})` : 'Connections';
      const lineSeries = chart.series.push(am5xy.LineSeries.new(root, {
        name: seriesName,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        categoryXField: "category",
        stroke: am5.color(darkerColor), // Darker line (same color direction, just darker)
        fill: am5.color(color) // Same color for fill, opacity will be set separately
      }));
      
      // Set tooltip format based on metric type
      lineSeries.set("tooltip", am5.Tooltip.new(root, {
        labelText: miniMetric === 'traffic' 
          ? "{categoryX}: {valueY.formatNumber('#.00')} {unitLabel}"
          : "{categoryX}: {valueY.formatNumber('#,###')} {unitLabel}"
      }));
      
      lineSeries.fills.template.setAll({
        fillOpacity: 0.3,
        visible: true
      });
      
      lineSeries.strokes.template.setAll({
        strokeWidth: 2
      });
      
      // Add bullets (points) with darker color
      lineSeries.bullets.push(() => {
        return am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 2,
            fill: am5.color(darkerColor), // Use darker color for consistency
            stroke: am5.color("#fff"),
            strokeWidth: 1
          })
        });
      });
      
      // Note: LineSeries doesn't have labels.template by default in amCharts 5
      // For mini charts, we skip labels to keep them clean and readable
      
      // Set data
      lineSeries.data.setAll(data.map((val, idx) => ({
        category: labels[idx],
        value: val,
        unitLabel: unitLabel
      })));
      
      // Store chart reference
      window.userMiniCharts[userId] = root;
    } catch (e) {
      console.error(`Error creating mini chart for user ${userId}:`, e);
      if (window.userMiniCharts) {
        window.userMiniCharts[userId] = null;
      }
    }
  });
}

// Observable Plot version - Data Journalism style
function renderUserMiniChartObservable(userId, trend, mode, unit, miniMetric) {
  // Observable Plot загружен через UMD как глобальный объект Plot
  if (typeof Plot === 'undefined' || typeof Plot.plot !== 'function') {
    console.error('Observable Plot mini-chart: Plot not available');
    console.error('typeof Plot:', typeof Plot);
    if (typeof Plot !== 'undefined') {
      console.error('Plot keys:', Object.keys(Plot).slice(0, 10));
    }
    return;
  }
  
  const el = document.getElementById(`userChart_${userId}`);
  if (!el) return;
  if (!trend || !Array.isArray(trend) || trend.length === 0) return;
  
  const gbBase = 1000000000;
  const mbBase = 1000000;
  const base = unit === 'gb' ? gbBase : mbBase;
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.2)' : 'rgba(208, 215, 222, 0.2)';
  const color = getColorForUser(userId);
  
  try {
    el.innerHTML = '';
    
    const plotData = trend.map(t => {
      const dateStr = typeof t === 'object' ? (t.date || '') : '';
      const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
      if (!dateStr) return null;
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return null;
      return {
        date: d,
        value: miniMetric === 'traffic' ? (Number(val) / base) : Number(val)
      };
    }).filter(d => d !== null && d.value !== undefined && !isNaN(d.value));
    
    if (plotData.length === 0) {
      console.warn(`renderUserMiniChartObservable: no valid data for user ${userId}`);
      return;
    }
    
    const width = Math.max(el.clientWidth || 300, 200);
    const height = Math.max(el.clientHeight || 70, 50);
    
    console.log('Observable Plot: rendering mini chart for user', userId, 'with', plotData.length, 'data points');
    
    const chart = Plot.plot({
      style: { 
        background: bgColor, 
        color: textColor, 
        fontSize: '10px', 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
      },
      width: width,
      height: height,
      marginTop: 5,
      marginRight: 5,
      marginBottom: 5,
      marginLeft: 5,
      x: { 
        type: 'time', 
        grid: true, 
        label: null
      },
      y: { 
        grid: true, 
        label: null
      },
      marks: [
        Plot.ruleY([0], { stroke: gridColor, strokeWidth: 0.5 }),
        Plot.areaY(plotData, { 
          x: 'date', 
          y: 'value', 
          fill: color, 
          fillOpacity: 0.2, 
          curve: 'natural' 
        }),
        Plot.lineY(plotData, { 
          x: 'date', 
          y: 'value', 
          stroke: color, 
          strokeWidth: 1.5, 
          curve: 'natural' 
        }),
        Plot.dot(plotData, { 
          x: 'date', 
          y: 'value', 
          fill: color, 
          r: 1.5, 
          stroke: bgColor, 
          strokeWidth: 0.5 
        })
      ]
    });
    
    if (chart) {
      el.appendChild(chart);
      console.log('Observable Plot: mini chart appended successfully for user', userId);
    } else {
      console.error('Observable Plot: mini chart is null for user', userId);
    }
  } catch (e) {
    console.error(`Error rendering Observable mini chart for user ${userId}:`, e);
  }
}

// Highcharts version
function renderUserMiniChartHighcharts(userId, trend, mode, unit, miniMetric) {
  const el = document.getElementById(`userChart_${userId}`);
  if (!el) return;
  if (!trend || !Array.isArray(trend) || trend.length === 0) return;
  if (typeof Highcharts === 'undefined') return;
  
  const gbBase = 1000000000, mbBase = 1000000, base = unit === 'gb' ? gbBase : mbBase;
  const isDark = state.theme === 'dark', textColor = isDark ? '#e6edf3' : '#24292f', bgColor = isDark ? '#161b22' : '#ffffff', gridColor = isDark ? 'rgba(48, 54, 61, 0.2)' : 'rgba(208, 215, 222, 0.2)';
  const color = getColorForUser(userId);
  
  if (!window.userMiniCharts) window.userMiniCharts = {};
  if (window.userMiniCharts[userId]) {
    try { window.userMiniCharts[userId].destroy(); } catch (e) {}
  }
  
  const data = trend.map(t => {
    const dateStr = typeof t === 'object' ? (t.date || '') : '';
    const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    return [d.getTime(), miniMetric === 'traffic' ? (Number(val) / base) : Number(val)];
  });
  
  window.userMiniCharts[userId] = Highcharts.chart(el, {
    chart: { type: 'area', backgroundColor: bgColor, height: el.clientHeight || 70, spacing: [2, 2, 2, 2] },
    title: { text: null }, credits: { enabled: false },
    xAxis: { type: 'datetime', labels: { enabled: false }, lineWidth: 0, tickLength: 0 },
    yAxis: { title: { text: null }, labels: { enabled: false }, gridLineColor: gridColor, lineWidth: 0 },
    legend: { enabled: false },
    tooltip: { enabled: false },
    plotOptions: { area: { fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, color], [1, Highcharts.color(color).setOpacity(0.1).get('rgba')]] }, lineColor: color, marker: { enabled: false }, threshold: null } },
    series: [{ data: data, name: '' }]
  });
}

// Vega-Lite version - улучшенный минималистичный дизайн
function renderUserMiniChartVegaLite(userId, trend, mode, unit, miniMetric) {
  const el = document.getElementById(`userChart_${userId}`);
  if (!el) return;
  if (!trend || !Array.isArray(trend) || trend.length === 0) return;
  if (typeof vegaEmbed === 'undefined') return;
  
  const gbBase = 1000000000, mbBase = 1000000, base = unit === 'gb' ? gbBase : mbBase;
  const isDark = state.theme === 'dark', textColor = isDark ? '#e6edf3' : '#24292f', bgColor = isDark ? '#161b22' : '#ffffff';
  const color = getColorForUser(userId);
  
  el.innerHTML = '';
  
  const data = trend.map(t => {
    const dateStr = typeof t === 'object' ? (t.date || '') : '';
    const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    return {
      date: d.toISOString().split('T')[0],
      value: miniMetric === 'traffic' ? (Number(val) / base) : Number(val)
    };
  });
  
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: { values: data },
    width: el.clientWidth || 300,
    height: el.clientHeight || 70,
    background: bgColor,
    config: {
      axis: { domain: false, ticks: false, labels: false, grid: false },
      view: { stroke: null },
      mark: { tooltip: false }
    },
    layer: [
      {
        mark: { type: 'area', color: color, opacity: 0.25, interpolate: 'monotone' }
      },
      {
        mark: { type: 'line', color: color, strokeWidth: 2, interpolate: 'monotone' }
      },
      {
        mark: { type: 'point', color: color, size: 20, opacity: 0.8 }
      }
    ],
    encoding: {
      x: { field: 'date', type: 'temporal', title: null },
      y: { field: 'value', type: 'quantitative', title: null }
    }
  };
  
  vegaEmbed(el, spec, { actions: false });
}

// Recharts version (D3.js-based) - с подписями значений, без шкалы
function renderUserMiniChartRecharts(userId, trend, mode, unit, miniMetric) {
  const el = document.getElementById(`userChart_${userId}`);
  if (!el) return;
  if (!trend || !Array.isArray(trend) || trend.length === 0) return;
  if (typeof d3 === 'undefined') return;
  
  const gbBase = 1000000000, mbBase = 1000000, base = unit === 'gb' ? gbBase : mbBase;
  const isDark = state.theme === 'dark', textColor = isDark ? '#e6edf3' : '#24292f', bgColor = isDark ? '#161b22' : '#ffffff';
  const color = getColorForUser(userId);
  
  el.innerHTML = '';
  
  const data = trend.map(t => {
    const dateStr = typeof t === 'object' ? (t.date || '') : '';
    const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    return {
      date: d,
      dateLabel: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      value: miniMetric === 'traffic' ? (Number(val) / base) : Number(val)
    };
  });
  
  const margin = { top: 5, right: 5, bottom: 5, left: 5 };
  const width = el.clientWidth - margin.left - margin.right;
  const height = el.clientHeight - margin.top - margin.bottom;
  
  const svg = d3.select(el).append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
  const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, width]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.value) * 1.1]).nice().range([height, 0]);
  
  const area = d3.area().x(d => x(d.date)).y0(height).y1(d => y(d.value)).curve(d3.curveMonotoneX);
  const line = d3.line().x(d => x(d.date)).y(d => y(d.value)).curve(d3.curveMonotoneX);
  
  g.append('path').datum(data).attr('fill', color).attr('fill-opacity', 0.3).attr('d', area);
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2).attr('d', line);
  
  // Add value labels on points (подписи значений)
  g.selectAll('.value-label').data(data).enter().append('text')
    .attr('class', 'value-label')
    .attr('x', d => x(d.date))
    .attr('y', d => y(d.value) - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '8px')
    .attr('fill', textColor)
    .attr('font-weight', 'bold')
    .text(d => miniMetric === 'traffic' ? d.value.toFixed(1) : d.value.toLocaleString('ru-RU'));
  
  // Dots
  g.selectAll('.dot').data(data).enter().append('circle')
    .attr('class', 'dot')
    .attr('cx', d => x(d.date))
    .attr('cy', d => y(d.value))
    .attr('r', 2)
    .attr('fill', color)
    .attr('stroke', bgColor)
    .attr('stroke-width', 1);
}

// ApexCharts version
function renderUserMiniChartApex(userId, trend, mode, unit, miniMetric) {
  const el = document.getElementById(`userChart_${userId}`);
  if (!el) return;
  if (!trend || !Array.isArray(trend) || trend.length === 0) return;
  if (typeof ApexCharts === 'undefined') return;
  
  const gbBase = 1000000000, mbBase = 1000000, base = unit === 'gb' ? gbBase : mbBase;
  const isDark = state.theme === 'dark', textColor = isDark ? '#e6edf3' : '#24292f', bgColor = isDark ? '#161b22' : '#ffffff';
  const color = getColorForUser(userId);
  
  if (!window.userMiniCharts) window.userMiniCharts = {};
  if (window.userMiniCharts[userId]) {
    try { window.userMiniCharts[userId].destroy(); } catch (e) {}
  }
  
  el.innerHTML = '';
  
  const labels = trend.map(t => {
    const dateStr = typeof t === 'object' ? (t.date || '') : '';
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  });
  const values = trend.map(t => {
    const val = typeof t === 'object' ? (t.value || 0) : (t || 0);
    return miniMetric === 'traffic' ? (Number(val) / base) : Number(val);
  });
  
  window.userMiniCharts[userId] = new ApexCharts(el, {
    series: [{ name: '', data: values }],
    chart: { type: 'area', height: el.clientHeight || 70, toolbar: { show: false }, zoom: { enabled: false }, sparkline: { enabled: true } },
    stroke: { curve: 'smooth', width: 2, colors: [color] },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.1, stops: [0, 100], colorStops: [{ offset: 0, color: color, opacity: 0.3 }, { offset: 100, color: color, opacity: 0.1 }] } },
    xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { show: false } },
    grid: { show: false },
    tooltip: { enabled: false },
    colors: [color]
  });
  
  window.userMiniCharts[userId].render();
}

async function updateDateSelect() {
  try {
    const res = await api('/api/usage/dates');
    const select = $('#dateSelect');
    if (!select) {
      console.warn('dateSelect element not found');
      return;
    }
    
    // Handle both {ok: true, dates: [...]} and {dates: [...]} formats
    const dates = (res.ok && res.dates) ? res.dates : (res.dates || []);
    
    if (dates && dates.length > 0) {
      // Prefer today's date if available, otherwise use saved date or first date
      const today = new Date().toISOString().split('T')[0];
      if (!state.date) {
        state.date = dates.includes(today) ? today : dates[0];
        localStorage.setItem('usage.date', state.date);
      }
      
      select.innerHTML = dates.map(d => 
        `<option value="${d}" ${d === state.date ? 'selected' : ''}>${formatDate(d)}</option>`
      ).join('');
    } else {
      select.innerHTML = '<option value="">Нет доступных дат</option>';
    }
  } catch (e) {
    console.error('Failed to load dates:', e);
    const select = $('#dateSelect');
    if (select) {
      select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

