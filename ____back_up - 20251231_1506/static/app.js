/* Dashboard + общие утилиты */
Chart.register(ChartDataLabels);

const $ = (id)=>document.getElementById(id);

const state = {
  tab: 'dash',
  to: '',
  days: 14,
  mode: 'global', // global | users
  dash: null,
  charts: {},
};

function bytesToGB(b){ return (b||0)/1024/1024/1024; }

function fmtNum(x, digits=2){
  if(!isFinite(x)) return '0';
  const s = x.toLocaleString('ru-RU', {maximumFractionDigits:digits});
  return s;
}
function fmtGB(b){ return `${fmtNum(bytesToGB(b), 2)} GB`; }

function pctDelta(cur, prev){
  prev = prev||0; cur = cur||0;
  if(prev === 0 && cur === 0) return null;
  if(prev === 0) return 100; // from 0 -> some
  return (cur - prev) / prev * 100;
}
function fmtPct(v){
  if(v === null || v === undefined || !isFinite(v)) return '—';
  const av = Math.abs(v);
  const digits = av < 10 ? 1 : 0;
  return v.toLocaleString('ru-RU', {maximumFractionDigits:digits, minimumFractionDigits:digits}) + '%';
}
function clsDelta(v){
  if(v === null || v === undefined) return '';
  // оставляем "текущую логику": рост нагрузки = bad, падение = good
  return v > 0 ? 'bad' : 'good';
}

function palette(i){
  const hue = (i * 47) % 360;
  return `hsl(${hue} 70% 60%)`;
}
function userColor(user){
  const users = Object.keys(state.dash?.users || {}).sort();
  const idx = users.indexOf(user);
  return palette(Math.max(0, idx));
}

async function api(path, opts={}){
  const r = await fetch(path, {
    headers: {'Content-Type':'application/json'},
    ...opts,
  });
  const j = await r.json().catch(()=>({ok:false,msg:'bad json'}));
  if(!r.ok) throw new Error(j.msg || ('HTTP '+r.status));
  return j;
}

async function loadDays(){
  const j = await api('/api/days');
  const sel = $('dateSel');
  sel.innerHTML = '';
  (j.days || []).slice().reverse().forEach(d=>{
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    sel.appendChild(o);
  });
  state.to = sel.value || '';
}

function setTab(tab){
  state.tab = tab;
  document.querySelectorAll('.navbtn').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.tab').forEach(s=>s.classList.add('hidden'));
  $('tab-'+tab).classList.remove('hidden');
  $('hTitle').textContent = tab==='dash'?'Дашборд':(tab==='admin'?'Управление':(tab==='updates'?'Обновления':'События'));
}

function buildTable(el, cols, rows){
  let h = '<thead><tr>' + cols.map(c=>`<th class="${c.cls||''}">${c.t}</th>`).join('') + '</tr></thead>';
  h += '<tbody>';
  for(const r of rows){
    h += '<tr>' + cols.map(c=>`<td class="${c.cls||''}">${r[c.k] ?? ''}</td>`).join('') + '</tr>';
  }
  h += '</tbody>';
  el.innerHTML = h;
}

function renderKpiTables(dash){
  const users = Object.keys(dash.users||{}).sort();

  const rowsT = users.map(u=>{
    const x = dash.users[u];
    const prev = x.sum_prev7_traffic_bytes || 0;
    const cur = x.sum7_traffic_bytes || 0;
    const d = pctDelta(cur, prev);
    return {
      user: x.alias ? `${x.alias} (${u})` : u,
      prev: fmtGB(prev),
      cur: fmtGB(cur),
      delta: `<span class="${clsDelta(d)}">${d===null?'—':fmtPct(d)}</span>`,
      _cur: cur,
    };
  }).sort((a,b)=>b._cur-a._cur).slice(0, 12);

  const rowsC = users.map(u=>{
    const x = dash.users[u];
    const prev = x.sum_prev7_conns || 0;
    const cur = x.sum7_conns || 0;
    const d = pctDelta(cur, prev);
    return {
      user: x.alias ? `${x.alias} (${u})` : u,
      prev: fmtNum(prev,0),
      cur: fmtNum(cur,0),
      delta: `<span class="${clsDelta(d)}">${d===null?'—':fmtPct(d)}</span>`,
      _cur: cur,
    };
  }).sort((a,b)=>b._cur-a._cur).slice(0, 12);

  buildTable($('tblTraffic'), [
    {k:'user', t:'Пользователь'},
    {k:'prev', t:'Прошлый 7d'},
    {k:'cur', t:'Текущий 7d'},
    {k:'delta', t:'Δ %'},
  ], rowsT);

  buildTable($('tblConns'), [
    {k:'user', t:'Пользователь'},
    {k:'prev', t:'Прошлый 7d'},
    {k:'cur', t:'Текущий 7d'},
    {k:'delta', t:'Δ %'},
  ], rowsC);
}

function renderTopTables(dash){
  const toRows = (arr, fmtV)=> (arr||[]).map((x,i)=>({n:i+1, dst:x.dst, v: fmtV(x.v)}));

  buildTable($('tblTopTraffic'), [
    {k:'n', t:'#'},
    {k:'dst', t:'Домен'},
    {k:'v', t:'Трафик'},
  ], toRows(dash.global.top_domains_traffic, (b)=>fmtGB(b)));

  buildTable($('tblTopConns'), [
    {k:'n', t:'#'},
    {k:'dst', t:'Домен'},
    {k:'v', t:'Соединения'},
  ], toRows(dash.global.top_domains_conns, (n)=>fmtNum(n,0)));
}

function destroyChart(id){
  const ch = state.charts[id];
  if(ch){ ch.destroy(); delete state.charts[id]; }
}

function renderTrendsChart(dash){
  destroyChart('chTrends');

  const labels = dash.meta.last7;
  const gDaily = dash.global.daily_traffic_bytes.map(bytesToGB);
  const gCum = dash.global.cumulative_traffic_bytes.slice(-dash.meta.keys_all.length).slice(-7).map(bytesToGB);

  const users = Object.keys(dash.users||{}).sort();
  let sel = users[0] || null;
  let max = -1;
  for(const u of users){
    const v = dash.users[u].sum7_traffic_bytes || 0;
    if(v>max){ max=v; sel=u; }
  }
  const uDaily = sel ? dash.users[sel].daily_traffic_bytes.map(bytesToGB) : [];
  const uCum = sel ? (()=> {
    let a=0; return dash.users[sel].daily_traffic_bytes.map(b=>{a+=b; return bytesToGB(a);});
  })() : [];

  const ds = [];
  ds.push({
    label: 'Global daily (GB)',
    data: gDaily,
    borderWidth: 2,
    tension: .3,
    pointRadius: 3,
  });
  ds.push({
    label: 'Global cumulative (GB)',
    data: gCum,
    borderWidth: 2,
    tension: .3,
    pointRadius: 3,
    borderDash: [6,4],
  });

  if(state.mode === 'users' && sel){
    ds.push({
      label: `${sel} daily (GB)`,
      data: uDaily,
      borderWidth: 2,
      tension: .3,
      pointRadius: 3,
      borderColor: userColor(sel),
    });
    ds.push({
      label: `${sel} cumulative (GB)`,
      data: uCum,
      borderWidth: 2,
      tension: .3,
      pointRadius: 3,
      borderDash: [6,4],
      borderColor: userColor(sel),
    });
  }

  state.charts.chTrends = new Chart($('chTrends'), {
    type: 'line',
    data: {labels, datasets: ds},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {labels: {color:'rgba(255,255,255,.75)'}},
        datalabels: {
          color: 'rgba(255,255,255,.8)',
          formatter: (v)=> (v===null||v===undefined)?'':fmtNum(v, v<10?1:0),
          align: (ctx)=> (ctx.datasetIndex%2===0 ? 'top' : 'bottom'),
          anchor: 'end',
          offset: (ctx)=> (ctx.datasetIndex%2===0 ? 8 : 10),
          clamp: true,
        },
        tooltip: {enabled:true},
      },
      scales: {
        x: {ticks:{color:'rgba(255,255,255,.6)'}},
        y: {ticks:{color:'rgba(255,255,255,.6)'}},
      }
    }
  });
}

function renderAnomalies(dash){
  const users = Object.keys(dash.users||{}).filter(u=>dash.users[u].anomaly);
  $('anBadge').textContent = users.length ? `${users.length}` : '0';

  $('anList').innerHTML = users.length
    ? users.slice(0, 24).map(u=>`<span class="chip">${dash.users[u].alias ? dash.users[u].alias+' ('+u+')' : u}</span>`).join('')
    : '<span class="muted">Нет</span>';

  const lines = users.map(u=>{
    const x = dash.users[u];
    const pairs = dash.meta.last7.map((d,i)=>`${d}: ${fmtGB(x.daily_traffic_bytes[i]||0)}`).join('\n');
    return `${x.alias?x.alias+' ('+u+')':u}\n${pairs}`;
  });
  $('anTip').textContent = users.length ? lines.join('\n\n') : 'Аномалий нет.';
}

async function refresh(){
  const to = state.to || $('dateSel').value;
  const days = parseInt($('daysSel').value,10) || 14;
  state.days = days; state.to = to;

  const dash = await api(`/api/dashboard?to=${encodeURIComponent(to)}&days=${days}`);
  state.dash = dash;

  renderKpiTables(dash);
  renderTrendsChart(dash);
  renderAnomalies(dash);
  renderTopTables(dash);
}

function wire(){
  document.querySelectorAll('.navbtn').forEach(b=>{
    b.addEventListener('click', ()=>{
      setTab(b.dataset.tab);
      if(b.dataset.tab==='admin') window.Admin?.loadClients?.();
      if(b.dataset.tab==='updates') window.Admin?.loadBackups?.();
      if(b.dataset.tab==='events') window.Admin?.loadEvents?.();
    });
  });

  $('btnRefresh').addEventListener('click', ()=>refresh());

  $('dateSel').addEventListener('change', ()=>refresh());
  $('daysSel').addEventListener('change', ()=>refresh());

  $('modeGlobal').addEventListener('click', ()=>{
    state.mode='global';
    $('modeGlobal').classList.add('active');
    $('modeUsers').classList.remove('active');
    if(state.dash) renderTrendsChart(state.dash);
  });
  $('modeUsers').addEventListener('click', ()=>{
    state.mode='users';
    $('modeUsers').classList.add('active');
    $('modeGlobal').classList.remove('active');
    if(state.dash) renderTrendsChart(state.dash);
  });

  $('anInfo').addEventListener('mouseenter', ()=> $('anTip').classList.add('show'));
  $('anInfo').addEventListener('mouseleave', ()=> $('anTip').classList.remove('show'));
  $('anInfo').addEventListener('click', ()=> $('anTip').classList.toggle('show'));
}

(async function init(){
  wire();
  await loadDays();
  await refresh();
})();
