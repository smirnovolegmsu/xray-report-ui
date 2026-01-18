// ==================== ONLINE ====================
let onlinePollInterval = null;
let onlineLoading = false;

/**
 * Запускает polling для online данных (только если вкладка online активна)
 */
function startOnlinePolling() {
  // Очистить предыдущий интервал если есть
  if (onlinePollInterval) {
    clearInterval(onlinePollInterval);
    onlinePollInterval = null;
  }
  
  // Проверить что мы на вкладке online
  const paneOnline = document.querySelector('[data-pane="online"]');
  if (!paneOnline || !paneOnline.classList.contains('active')) {
    return; // Не на вкладке online - не запускаем
  }
  
  // Проверить что не на паузе
  if (state.livePaused) {
    return;
  }
  
  // Загрузить сразу
  loadOnline();
  
  // Запустить интервал
  onlinePollInterval = setInterval(() => {
    // Повторная проверка что мы всё ещё на вкладке online
    const paneCheck = document.querySelector('[data-pane="online"]');
    if (!paneCheck || !paneCheck.classList.contains('active') || state.livePaused) {
      stopOnlinePolling();
      return;
    }
    loadOnline();
  }, 5000);
}

/**
 * Останавливает polling для online данных
 */
function stopOnlinePolling() {
  if (onlinePollInterval) {
    clearInterval(onlinePollInterval);
    onlinePollInterval = null;
  }
}

async function loadOnline() {
  if (state.livePaused) return;
  
  // Проверка что мы на вкладке online
  const paneOnline = document.querySelector('[data-pane="online"]');
  if (!paneOnline || !paneOnline.classList.contains('active')) {
    return; // Не на вкладке online - не загружаем
  }
  
  // Защита от параллельных вызовов
  if (onlineLoading) {
    return;
  }
  
  onlineLoading = true;
  
  try {
    // Load "now"
    const nowRes = await api('/api/live/now');
    if (nowRes.ok) {
      renderOnlineNow(nowRes.now, nowRes.meta);
    }
    
    // Load series for both charts
    const [connsRes, trafficRes] = await Promise.all([
      api(`/api/live/series?metric=conns&period=${state.livePeriod}&gran=${state.liveGran}&scope=${state.liveScope}`),
      api(`/api/live/series?metric=traffic&period=${state.livePeriod}&gran=${state.liveGran}&scope=${state.liveScope}`)
    ]);
    
    if (connsRes.ok && connsRes.series) {
      renderOnlineChart('conns', connsRes.series, connsRes.meta);
    }
    if (trafficRes.ok && trafficRes.series) {
      renderOnlineChart('traffic', trafficRes.series, trafficRes.meta);
    }
    
    // Load top users for today with online status
    const today = new Date().toISOString().split('T')[0];
    const topRes = await api(`/api/usage/dashboard?date=${today}&mode=daily&windowDays=1`);
    if (topRes.ok) {
      // Get online users from now data
      const onlineUsersList = nowRes?.now?.onlineUsers || [];
      renderOnlineTop(topRes, onlineUsersList);
    }
  } catch (e) {
    console.error('Online load error:', e);
  } finally {
    onlineLoading = false;
  }
}

function renderOnlineNow(now, meta) {
  if (!now || !meta) return;
  const el1 = $('#onlineUsersValue');
  const el2 = $('#onlineConnsValue');
  const el3 = $('#onlineTrafficValue');
  const el4 = $('#onlineTrafficNote');
  const el5 = $('#onlineSource');
  // Use onlineUsersCount if available, otherwise onlineUsers (for backward compatibility)
  const onlineCount = now.onlineUsersCount !== undefined ? now.onlineUsersCount : (Array.isArray(now.onlineUsers) ? now.onlineUsers.length : (now.onlineUsers || 0));
  if (el1) el1.textContent = onlineCount.toLocaleString('ru-RU');
  if (el2) el2.textContent = (now.conns || 0).toLocaleString('ru-RU');
  if (el3) {
    if (now.trafficAvailable) {
      el3.textContent = fmtBytes(now.trafficBytes || 0);
      if (el4) el4.style.display = 'none';
    } else {
      el3.textContent = '—';
      if (el4) el4.style.display = 'block';
    }
  }
  if (el5) el5.textContent = meta.source || '—';
}

let onlineConnsChart = null;
let onlineTrafficChart = null;
let onlineChartInitializing = { conns: false, traffic: false };
// ApexCharts instances
let onlineConnsChartApex = null;
let onlineTrafficChartApex = null;

// Chart library wrapper for online charts
function renderOnlineChart(metric, series, meta) {
  if (state.chartLibrary === 'apexcharts' && typeof ApexCharts !== 'undefined') {
    renderOnlineChartApex(metric, series, meta);
  } else if (state.chartLibrary === 'observable') {
    renderOnlineChartObservable(metric, series, meta);
  } else if (state.chartLibrary === 'highcharts' && typeof Highcharts !== 'undefined') {
    renderOnlineChartHighcharts(metric, series, meta);
  } else if (state.chartLibrary === 'vegalite' && typeof vegaEmbed !== 'undefined') {
    renderOnlineChartVegaLite(metric, series, meta);
  } else if (state.chartLibrary === 'recharts' && typeof d3 !== 'undefined') {
    renderOnlineChartRecharts(metric, series, meta);
  } else {
    renderOnlineChartAmCharts(metric, series, meta);
  }
}

// amCharts version (original)
function renderOnlineChartAmCharts(metric, series, meta) {
  const chartId = metric === 'traffic' ? 'chOnlineTraffic' : 'chOnlineConns';
  const chartVar = metric === 'traffic' ? 'onlineTrafficChart' : 'onlineConnsChart';
  
  // Проверка элемента и защита от множественных вызовов
  const el = document.getElementById(chartId);
  if (!el) {
    return; // Тихий выход, без warn
  }
  
  // Проверка что элемент готов для рендеринга
  if (!isRenderable(el)) {
    return; // Тихий выход, без warn
  }
  
  if (!series || !Array.isArray(series) || series.length === 0) {
    console.warn(`renderOnlineChartAmCharts(${metric}): no data`);
    return;
  }
  
  // Защита от параллельных инициализаций
  if (onlineChartInitializing[metric]) {
    console.warn(`renderOnlineChartAmCharts(${metric}): already initializing, skipping`);
    return;
  }
  
  // Destroy ApexCharts if exists
  const apexChartVar = metric === 'traffic' ? 'onlineTrafficChartApex' : 'onlineConnsChartApex';
  if (window[apexChartVar]) {
    try {
      window[apexChartVar].destroy();
      window[apexChartVar] = null;
    } catch (e) {
      console.warn(`Error destroying ${metric} ApexChart:`, e);
    }
  }
  
  const labels = series.map(s => {
    const d = new Date(s.ts);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  });
  const data = series.map(s => s.value || 0);
  
  const unit = meta.unit === 'bytes' ? 'bytes' : 'count';
  const label = metric === 'traffic' ? 'Traffic' : 'Connections';
  const color = metric === 'traffic' ? '#58a6ff' : '#4caf50';
  
  // Destroy existing chart if exists (перед am5.ready)
  if (window[chartVar]) {
    try {
      window[chartVar].dispose();
      window[chartVar] = null;
    } catch (e) {
      console.warn(`Error disposing ${metric} chart:`, e);
      window[chartVar] = null;
    }
  }
  
  onlineChartInitializing[metric] = true;
  
  am5.ready(() => {
    try {
      // Повторная проверка элемента (на случай если он был удалён)
      const elCheck = document.getElementById(chartId);
      if (!elCheck || elCheck !== el) {
        console.warn(`renderOnlineChart(${metric}): element changed or removed`);
        onlineChartInitializing[metric] = false;
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
      
      // Create axes
      const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(root, {
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
      // Convert hex color to rgba
      const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      
      const lineSeries = chart.series.push(am5xy.LineSeries.new(root, {
        name: label,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        categoryXField: "category",
        stroke: am5.color(color),
        fill: am5.color(hexToRgba(color, 0.3))
      }));
      
      lineSeries.fills.template.setAll({
        fillOpacity: 0.3,
        visible: true
      });
      
      lineSeries.strokes.template.setAll({
        strokeWidth: 3
      });
      
      lineSeries.bullets.push(() => {
        return am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 4,
            fill: am5.color(color),
            stroke: am5.color("#fff"),
            strokeWidth: 2
          })
        });
      });
      
      // Set data
      lineSeries.data.setAll(data.map((val, idx) => ({
        category: labels[idx],
        value: val,
        unit: unit,
        label: label
      })));
      
      // Add cursor
      chart.set("cursor", am5xy.XYCursor.new(root, {}));
      
      window[chartVar] = root;
      onlineChartInitializing[metric] = false;
    } catch (e) {
      console.error(`Error creating ${metric} chart:`, e);
      window[chartVar] = null;
      onlineChartInitializing[metric] = false;
    }
  });
}

// ApexCharts version for online charts (alternative - красивые линейные графики)
function renderOnlineChartApex(metric, series, meta) {
  const chartId = metric === 'traffic' ? 'chOnlineTraffic' : 'chOnlineConns';
  const chartVar = metric === 'traffic' ? 'onlineTrafficChartApex' : 'onlineConnsChartApex';
  
  const el = document.getElementById(chartId);
  if (!el) return;
  
  if (!series || !Array.isArray(series) || series.length === 0) {
    console.warn(`renderOnlineChartApex(${metric}): no data`);
    return;
  }
  
  // Destroy existing ApexCharts
  if (window[chartVar]) {
    try {
      window[chartVar].destroy();
    } catch (e) {
      console.warn(`Error destroying ${metric} ApexChart:`, e);
    }
    window[chartVar] = null;
  }
  
  const labels = series.map(s => {
    const d = new Date(s.ts);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  });
  const data = series.map(s => s.value || 0);
  
  const unit = meta.unit === 'bytes' ? 'bytes' : 'count';
  const label = metric === 'traffic' ? 'Traffic' : 'Connections';
  const color = metric === 'traffic' ? '#58a6ff' : '#3fb950';
  
  // Get theme colors
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.5)' : 'rgba(208, 215, 222, 0.5)';
  
  el.innerHTML = ''; // Clear for ApexCharts
  
  const chartConfig = {
    series: [{
      name: label,
      data: data
    }],
    chart: {
      type: 'line',
      height: '100%',
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
      zoom: { enabled: false }
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      colors: [color]
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: isDark ? 'dark' : 'light',
        type: 'vertical',
        shadeIntensity: 0.5,
        gradientToColors: [color],
        inverseColors: false,
        opacityFrom: 0.3,
        opacityTo: 0.05,
        stops: [0, 100]
      }
    },
    markers: {
      size: 4,
      colors: [color],
      strokeColors: '#fff',
      strokeWidth: 2,
      hover: { size: 6 }
    },
    xaxis: {
      categories: labels,
      labels: { style: { colors: textColor, fontSize: '11px' } },
      axisBorder: { color: gridColor },
      axisTicks: { color: gridColor }
    },
    yaxis: {
      labels: { style: { colors: textColor } },
      title: { text: label, style: { color: textColor } }
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val) => {
          if (metric === 'traffic') {
            return `${(val / 1000000000).toFixed(2)} GB`;
          } else {
            return `${val.toLocaleString('ru-RU')} connections`;
          }
        }
      }
    },
    colors: [color]
  };
  
  window[chartVar] = new ApexCharts(el, chartConfig);
  window[chartVar].render();
}

// Observable Plot version
// Observable Plot version - Data Journalism / Bloomberg style (минимализм, типографика)
function renderOnlineChartObservable(metric, series, meta) {
  if (typeof Plot === 'undefined' || typeof Plot.plot !== 'function') {
    console.error('Observable Plot: Plot is not available');
    return;
  }
  
  const chartId = metric === 'traffic' ? 'chOnlineTraffic' : 'chOnlineConns';
  const el = document.getElementById(chartId);
  if (!el) return;
  
  if (!series || !Array.isArray(series) || series.length === 0) {
    console.warn(`renderOnlineChartObservable(${metric}): no data`);
    return;
  }
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)';
  const color = metric === 'traffic' ? '#58a6ff' : '#3fb950';
  
  try {
    el.innerHTML = '';
    
    const plotData = series.map(s => {
      const ts = s.ts;
      if (!ts) return null;
      const d = new Date(ts);
      if (isNaN(d.getTime())) return null;
      return {
        time: d,
        value: metric === 'traffic' ? (s.value || 0) / 1000000000 : (s.value || 0)
      };
    }).filter(d => d !== null && d.value !== undefined && !isNaN(d.value));
    
    if (plotData.length === 0) {
      console.warn(`renderOnlineChartObservable(${metric}): no valid data after filtering`);
      return;
    }
    
    const width = Math.max(el.clientWidth || 600, 300);
    const height = Math.max(el.clientHeight || 300, 200);
    
    console.log('Observable Plot: rendering online chart with', plotData.length, 'data points');
    
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
      marginLeft: 60,
      x: { 
        type: 'time', 
        grid: true, 
        label: null
      },
      y: { 
        grid: true, 
        label: metric === 'traffic' ? 'Traffic (GB)' : 'Connections'
      },
      marks: [
        Plot.ruleY([0], { stroke: gridColor, strokeWidth: 1 }),
        Plot.areaY(plotData, { 
          x: 'time', 
          y: 'value', 
          fill: color, 
          fillOpacity: 0.15,
          curve: 'natural'
        }),
        Plot.lineY(plotData, { 
          x: 'time', 
          y: 'value', 
          stroke: color, 
          strokeWidth: 2,
          curve: 'natural'
        }),
        Plot.dot(plotData, { 
          x: 'time', 
          y: 'value', 
          fill: color,
          r: 2.5,
          stroke: bgColor,
          strokeWidth: 1
        })
      ]
    });
    
    if (chart) {
      el.appendChild(chart);
      console.log('Observable Plot: online chart appended successfully');
    } else {
      console.error('Observable Plot: online chart is null');
    }
  } catch (e) {
    console.error(`Error rendering Observable online chart (${metric}):`, e);
  }
}

// Highcharts version - корпоративный премиум стиль
function renderOnlineChartHighcharts(metric, series, meta) {
  const chartId = metric === 'traffic' ? 'chOnlineTraffic' : 'chOnlineConns';
  const chartVar = metric === 'traffic' ? 'onlineTrafficChartHighcharts' : 'onlineConnsChartHighcharts';
  const el = document.getElementById(chartId);
  if (!el) return;
  
  if (!series || !Array.isArray(series) || series.length === 0) {
    console.warn(`renderOnlineChartHighcharts(${metric}): no data`);
    return;
  }
  
  if (typeof Highcharts === 'undefined') {
    console.warn('Highcharts not available');
    return;
  }
  
  // Destroy existing chart
  if (window[chartVar]) {
    window[chartVar].destroy();
    window[chartVar] = null;
  }
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const gridColor = isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)';
  const color = metric === 'traffic' ? '#58a6ff' : '#3fb950';
  
  const data = series.map(s => [new Date(s.ts).getTime(), s.value || 0]);
  
  window[chartVar] = Highcharts.chart(el, {
    chart: {
      type: 'area',
      backgroundColor: bgColor,
      height: el.clientHeight || 300
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
      title: { text: metric === 'traffic' ? 'Traffic (GB)' : 'Connections', style: { color: textColor } },
      labels: { style: { color: textColor } },
      gridLineColor: gridColor
    },
    legend: { enabled: false },
    tooltip: {
      backgroundColor: bgColor,
      borderColor: textColor,
      style: { color: textColor },
      formatter: function() {
        const val = metric === 'traffic' 
          ? `${(this.y / 1000000000).toFixed(2)} GB`
          : `${this.y.toLocaleString('ru-RU')} connections`;
        return `<b>${Highcharts.dateFormat('%H:%M', this.x)}</b><br/>${val}`;
      }
    },
    plotOptions: {
      area: {
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, color],
            [1, Highcharts.color(color).setOpacity(0.1).get('rgba')]
          ]
        },
        lineColor: color,
        marker: { radius: 3, fillColor: color }
      }
    },
    series: [{
      name: metric === 'traffic' ? 'Traffic' : 'Connections',
      data: data
    }]
  });
}

// Vega-Lite version - чистый BI-минимализм
function renderOnlineChartVegaLite(metric, series, meta) {
  const chartId = metric === 'traffic' ? 'chOnlineTraffic' : 'chOnlineConns';
  const el = document.getElementById(chartId);
  if (!el) return;
  
  if (!series || !Array.isArray(series) || series.length === 0) {
    console.warn(`renderOnlineChartVegaLite(${metric}): no data`);
    return;
  }
  
  if (typeof vegaEmbed === 'undefined') {
    console.warn('Vega-Lite not available');
    return;
  }
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const color = metric === 'traffic' ? '#58a6ff' : '#3fb950';
  
  el.innerHTML = '';
  
  const data = series.map(s => ({
    time: new Date(s.ts).toISOString(),
    value: metric === 'traffic' ? (s.value || 0) / 1000000000 : (s.value || 0)
  }));
  
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: { values: data },
    width: el.clientWidth || 600,
    height: el.clientHeight || 300,
    background: bgColor,
    config: {
      axis: { labelColor: textColor, titleColor: textColor, gridColor: isDark ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)' },
      text: { color: textColor }
    },
    layer: [
      {
        mark: { type: 'area', color: color, opacity: 0.3 }
      },
      {
        mark: { type: 'line', color: color, strokeWidth: 2 }
      }
    ],
    encoding: {
      x: { field: 'time', type: 'temporal', title: null },
      y: { field: 'value', type: 'quantitative', title: metric === 'traffic' ? 'Traffic (GB)' : 'Connections' }
    }
  };
  
  vegaEmbed(el, spec, { actions: false });
}

// Recharts version (D3.js-based, стиль Recharts)
function renderOnlineChartRecharts(metric, series, meta) {
  const chartId = metric === 'traffic' ? 'chOnlineTraffic' : 'chOnlineConns';
  const el = document.getElementById(chartId);
  if (!el) return;
  
  if (!series || !Array.isArray(series) || series.length === 0) {
    console.warn(`renderOnlineChartRecharts(${metric}): no data`);
    return;
  }
  
  if (typeof d3 === 'undefined') {
    console.warn('D3.js not available');
    return;
  }
  
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#e6edf3' : '#24292f';
  const bgColor = isDark ? '#161b22' : '#ffffff';
  const gridColor = isDark ? '#303639' : '#d0d7de';
  const color = metric === 'traffic' ? '#58a6ff' : '#3fb950';
  
  el.innerHTML = '';
  
  const data = series.map(s => ({
    time: new Date(s.ts),
    timeLabel: new Date(s.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    value: s.value || 0
  }));
  
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const width = el.clientWidth - margin.left - margin.right;
  const height = (el.clientHeight || 300) - margin.top - margin.bottom;
  
  const svg = d3.select(el)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);
  
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.time))
    .range([0, width]);
  
  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value) * 1.1])
    .nice()
    .range([height, 0]);
  
  // Area
  const area = d3.area()
    .x(d => x(d.time))
    .y0(height)
    .y1(d => y(d.value))
    .curve(d3.curveMonotoneX);
  
  // Line
  const line = d3.line()
    .x(d => x(d.time))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX);
  
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
  
  // Area
  g.append('path')
    .datum(data)
    .attr('fill', color)
    .attr('fill-opacity', 0.3)
    .attr('d', area);
  
  // Line
  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 2)
    .attr('d', line);
  
  // X axis
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.timeFormat('%H:%M')))
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
  
  // Dots
  g.selectAll('.dot')
    .data(data)
    .enter().append('circle')
    .attr('class', 'dot')
    .attr('cx', d => x(d.time))
    .attr('cy', d => y(d.value))
    .attr('r', 3)
    .attr('fill', color)
    .on('mouseover', function(event, d) {
      tooltip.transition().style('opacity', 1);
      const val = metric === 'traffic' 
        ? `${(d.value / 1000000000).toFixed(2)} GB`
        : `${d.value.toLocaleString('ru-RU')} connections`;
      tooltip.html(`${d.timeLabel}: ${val}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', function() {
      tooltip.transition().style('opacity', 0);
    });
}

function renderOnlineTop(dashboardData, onlineUsers) {
  if (!dashboardData || !dashboardData.users) {
    $('#tblOnlineTop tbody').innerHTML = '<tr><td colspan="4">Нет данных</td></tr>';
    return;
  }
  
  const users = dashboardData.users || [];
  const onlineUsersSet = new Set(onlineUsers || []);
  const userDetails = dashboardData.userDetails || {};
  
  // Build user list with today's data
  // users is an array of objects with userId, displayName, traffic7dBytes, conns7d, etc.
  // For today's data, we need to get from userDetails which has daily data
  const userList = users.map(userData => {
    const userId = userData.userId;
    const details = userDetails[userId] || {};
    
    // Get today's data from trends (last day in the array)
    const trafficTrend = details.trafficDailyBytes || [];
    const connsTrend = details.connsDaily || [];
    const userTodayTraffic = trafficTrend.length > 0 ? trafficTrend[trafficTrend.length - 1] : 0;
    const userTodayConns = connsTrend.length > 0 ? connsTrend[connsTrend.length - 1] : 0;
    
    const isOnline = onlineUsersSet.has(userId);
    
    return {
      userId: userId,
      displayName: userData.displayName || userId,
      traffic: userTodayTraffic,
      conns: userTodayConns,
      isOnline
    };
  }).filter(u => u.traffic > 0 || u.conns > 0 || u.isOnline) // Show only users with activity or online
    .sort((a, b) => {
      // Sort: online first, then by traffic
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return (b.traffic || 0) - (a.traffic || 0);
    });
  
  const html = userList.length > 0 ? userList.map(r => `
    <tr>
      <td>${r.displayName || r.userId}</td>
      <td>${r.isOnline ? '<span style="color: var(--ok);">🟢 Онлайн</span>' : '<span style="color: var(--muted);">⚪ Офлайн</span>'}</td>
      <td>${fmtBytes(r.traffic || 0)}</td>
      <td>${(r.conns || 0).toLocaleString('ru-RU')}</td>
    </tr>
  `).join('') : '<tr><td colspan="4">Нет данных</td></tr>';
  
  $('#tblOnlineTop tbody').innerHTML = html;
}

