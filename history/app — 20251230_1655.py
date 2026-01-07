from flask import Flask, request, jsonify, Response
import os, glob, csv, json
from functools import lru_cache
from collections import defaultdict

APP_HOST = "127.0.0.1"
APP_PORT = 8090

DATA_DIR = "/var/log/xray/usage"
XRAY_CFG = "/usr/local/etc/xray/config.json"

app = Flask(__name__)

def _list_days(prefix: str):
    files = glob.glob(os.path.join(DATA_DIR, f"{prefix}_*.csv"))
    days = []
    for p in files:
        base = os.path.basename(p)
        day = base.replace(prefix + "_", "").replace(".csv", "")
        if len(day) == 10 and day[4] == "-" and day[7] == "-":
            days.append(day)
    return sorted(set(days))

def _all_days():
    return sorted(set(_list_days("report")) | set(_list_days("conns")) | set(_list_days("usage")))

def _select_days(prefix: str, n: int, to_day: str = ""):
    days = _list_days(prefix)
    if to_day:
        days = [d for d in days if d <= to_day]
    return days[-n:]

def _safe_int(x, default=0):
    if x is None:
        return default
    try:
        return int(x)
    except Exception:
        try:
            return int(float(str(x).strip() or "0"))
        except Exception:
            return default

@lru_cache(maxsize=1)
def config_users():
    try:
        cfg = json.load(open(XRAY_CFG))
        vless = next((i for i in cfg.get("inbounds", []) if i.get("protocol") == "vless"), None)
        clients = (vless or {}).get("settings", {}).get("clients", []) or []
        users = {c.get("email") for c in clients if isinstance(c, dict) and c.get("email")}
        return sorted(users)
    except Exception:
        return []

@lru_cache(maxsize=256)
def read_usage(day: str):
    path = os.path.join(DATA_DIR, f"usage_{day}.csv")
    totals = {}
    if not os.path.exists(path):
        return totals
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            user = (row.get("user") or "").strip()
            tb = row.get("total_bytes")
            if user:
                totals[user] = _safe_int(tb, 0)
    return totals

@lru_cache(maxsize=256)
def read_report(day: str):
    path = os.path.join(DATA_DIR, f"report_{day}.csv")
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            user = (row.get("user") or "").strip()
            dst = (row.get("dst") or "").strip()
            b = _safe_int(row.get("traffic_bytes"), 0)
            if user and dst:
                rows.append({"user": user, "dst": dst, "bytes": b})
    return rows

@lru_cache(maxsize=256)
def read_conns(day: str):
    path = os.path.join(DATA_DIR, f"conns_{day}.csv")
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            user = (row.get("user") or "").strip()
            dst = (row.get("dst") or "").strip()
            c = _safe_int(row.get("conn_count"), 0)
            if user and dst:
                rows.append({"user": user, "dst": dst, "count": c})
    return rows

@app.get("/api/days")
def api_days():
    return jsonify(_all_days())

@app.get("/api/users")
def api_users():
    day = (request.args.get("date") or "").strip()
    users = set(config_users())

    if not day:
        for d in _list_days("usage"):
            users |= set(read_usage(d).keys())
        for d in _list_days("report"):
            users |= {r["user"] for r in read_report(d)}
        for d in _list_days("conns"):
            users |= {r["user"] for r in read_conns(d)}
        return jsonify(sorted(users))

    users |= set(read_usage(day).keys())
    users |= {r["user"] for r in read_report(day)}
    users |= {r["user"] for r in read_conns(day)}
    return jsonify(sorted(users))

@app.get("/api/summary")
def api_summary():
    days_n = _safe_int(request.args.get("days", "7"), 7)
    to_day = (request.args.get("to") or "").strip()

    all_days = _select_days("usage", days_n, to_day)
    if not all_days:
        all_days = _select_days("report", days_n, to_day) or _all_days()[-days_n:]

    users = set(config_users())
    for d in all_days:
        users |= set(read_usage(d).keys())
    users = sorted(users)

    data = []
    for d in all_days:
        totals = read_usage(d)
        for u in users:
            data.append({"date": d, "user": u, "value": int(totals.get(u, 0) or 0)})

    return jsonify({"metric": "traffic_bytes", "days": all_days, "users": users, "data": data})

@app.get("/api/summary_conns")
def api_summary_conns():
    days_n = _safe_int(request.args.get("days", "7"), 7)
    to_day = (request.args.get("to") or "").strip()

    all_days = _select_days("conns", days_n, to_day)
    if not all_days:
        all_days = _select_days("report", days_n, to_day) or _all_days()[-days_n:]

    users = set(config_users())
    for d in all_days:
        users |= {r["user"] for r in read_conns(d)}
    users = sorted(users)

    agg = defaultdict(int)
    for d in all_days:
        for r in read_conns(d):
            agg[(d, r["user"])] += int(r["count"])

    data = []
    for d in all_days:
        for u in users:
            data.append({"date": d, "user": u, "value": int(agg.get((d, u), 0))})

    return jsonify({"metric": "conn_count", "days": all_days, "users": users, "data": data})

@app.get("/api/user_day")
def api_user_day():
    day = (request.args.get("date") or "").strip()
    user = (request.args.get("user") or "").strip()
    top = _safe_int(request.args.get("top", "10"), 10)
    if not day or not user:
        return jsonify([])
    rows = [r for r in read_report(day) if r["user"] == user]
    rows.sort(key=lambda x: x["bytes"], reverse=True)
    return jsonify(rows[:top])

@app.get("/api/user_day_conns")
def api_user_day_conns():
    day = (request.args.get("date") or "").strip()
    user = (request.args.get("user") or "").strip()
    top = _safe_int(request.args.get("top", "10"), 10)
    if not day or not user:
        return jsonify([])
    rows = [r for r in read_conns(day) if r["user"] == user]
    rows.sort(key=lambda x: x["count"], reverse=True)
    return jsonify(rows[:top])

@app.get("/")
def index():
    html = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Xray Дашборд</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
  <style>
    body { font-family: system-ui; margin: 0 auto; padding: 16px; background: #f9fafb; max-width: 2240px; }
    .filter-bar { display: flex; gap: 12px; flex-wrap: wrap; padding: 12px; background: #fff; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 10; align-items: flex-end; }
    label { font-size: 12px; color: #555; display: block; margin-bottom: 4px; }
    select, input { padding: 8px; border: 1px solid #d1d5db; border-radius: 10px; min-width: 220px; }
    .user-buttons { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .user-btn { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 8px; cursor: pointer; background: #fff; }
    .user-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, auto); gap: 12px; margin: 16px 0; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .user-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 16px; margin-top: 16px; }
    .user-card { padding: 12px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
    .user-card h3 { margin-top: 0; }
    .chart-container { margin-bottom: 16px; width: 480px; height: 300px; }
    .placeholder { display: flex; align-items: center; justify-content: center; border: 1px solid #eee; background: #f9fafb; color: #6b7280; font-size: 14px; width: 100%; height: 100%; }
    .tables-row { display: flex; gap: 16px; }
    .table-block { width: 330px; height: 180px; }
    .table-container { overflow: auto; border: 1px solid #eee; border-radius: 8px; height: 150px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; cursor: pointer; }
    th, td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; white-space: nowrap; }
    th.sort-asc::after { content: ' ↑'; } th.sort-desc::after { content: ' ↓'; }
    .bottom-grid { display: grid; grid-template-rows: repeat(2, auto); grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 32px; }
    .bottom-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .bottom-card b { font-size: 16px; font-weight: bold; color: black; display: block; margin-bottom: 8px; }
    .muted { color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="filter-bar">
    <div><label>Дата (для топов)</label><select id="dateSel"></select></div>
    <div><label>Период для гистограмм</label><select id="periodSel"><option value="7">7 дней</option><option value="14">14 дней</option><option value="30">30 дней</option></select></div>
    <div><label>Метрика</label><select id="metricSel"><option value="traffic">Трафик</option><option value="conns">Подключения</option></select></div>
    <div><label>Единица (трафик)</label><select id="unitSel"><option value="GB">GB</option><option value="MB" selected>MB</option></select></div>
    <div><label>Top N</label><input id="topSel" type="number" value="10" min="5" max="50"/></div>
    <div><label><input type="checkbox" id="showHistos" checked> Показывать гистограммы по пользователям</label></div>
    <div><label><input type="checkbox" id="showTops" checked> Показывать топы</label></div>
    <div class="user-buttons" id="userButtons"><button class="user-btn active" id="selectAll">Все</button></div>
  </div>

  <div class="summary-cards">
    <div class="card"><b>Общий трафик</b><p id="totalTraffic" class="muted">Загрузка...</p></div>
    <div class="card"><b>Топ пользователь</b><p id="topUser" class="muted">Загрузка...</p></div>
    <div class="card"><b>Общие подключения</b><p id="activeConns" class="muted">Загрузка...</p></div>
    <div class="card"><b>Средний трафик на пользователя</b><p id="avgTraffic" class="muted">Загрузка...</p></div>
    <div class="card"><b>Среднее подключений на пользователя</b><p id="avgConns" class="muted">Загрузка...</p></div>
    <div class="card"><b>Аномалии</b><p id="anomalies" class="muted">Нет предупреждений</p></div>
  </div>

  <div id="userSections" class="user-grid"></div>

  <div id="bottomGraphs" class="bottom-grid"></div>

<script>
Chart.register(ChartDataLabels);

let charts = {}, bottomCharts = {};

function bytesToGB(b) { return (b / 1024 / 1024 / 1024); }
function bytesToMB(b) { return (b / 1024 / 1024); }
function fmtNum(x) { return (Math.round(x * 100) / 100).toString(); }

async function getJSON(url) {
  const r = await fetch(url);
  return await r.json();
}

function getPeriod() { return document.getElementById('periodSel').value; }
function getDay() { return document.getElementById('dateSel').value; }
function getTop() { return document.getElementById('topSel').value; }
function showHistos() { return document.getElementById('showHistos').checked; }
function showTops() { return document.getElementById('showTops').checked; }
function getUnit() { return document.getElementById('unitSel').value; }

async function loadDays() {
  const days = await getJSON('/api/days');
  const dateSel = document.getElementById('dateSel');
  dateSel.innerHTML = days.slice().reverse().map(d => `<option value="${d}">${d}</option>`).join('');
  return days;
}

async function loadUsers() {
  const day = getDay();
  let users = await getJSON('/api/users?date=' + encodeURIComponent(day));
  users.sort();
  const buttons = document.getElementById('userButtons');
  users.forEach(u => {
    const btn = document.createElement('button');
    btn.className = 'user-btn active';
    btn.dataset.user = u;
    btn.innerText = u;
    btn.addEventListener('click', toggleUserBtn);
    buttons.appendChild(btn);
  });
  document.getElementById('selectAll').addEventListener('click', toggleAllUsers);
  document.getElementById('selectAll').classList.add('active');
}

function toggleUserBtn(e) {
  e.target.classList.toggle('active');
  renderUserSections();
}

function toggleAllUsers(e) {
  const active = e.target.classList.contains('active');
  e.target.classList.toggle('active');
  document.querySelectorAll('.user-btn:not(#selectAll)').forEach(btn => btn.classList.toggle('active', !active));
  renderUserSections();
}

function getSelectedUsers() {
  return Array.from(document.querySelectorAll('.user-btn.active:not(#selectAll)')).map(btn => btn.dataset.user);
}

async function updateSummaryCards(trafficPack, connsPack, unit, days_n) {
  let totalTraffic = 0, maxTraffic = 0, topUserTraffic = '', totalConns = 0, userSums = {}, anomalies = [];
  const usersCount = trafficPack.users.length;

  trafficPack.data.forEach(row => {
    totalTraffic += row.value;
    userSums[row.user] = (userSums[row.user] || 0) + row.value;
    if (row.value > maxTraffic) {
      maxTraffic = row.value;
      topUserTraffic = row.user;
    }
  });
  Object.entries(userSums).forEach(([u, sum]) => { if (sum > 1e9) anomalies.push(u); });

  connsPack.data.forEach(row => totalConns += row.value);

  const totalU = fmtNum(unit === 'GB' ? bytesToGB(totalTraffic) : bytesToMB(totalTraffic)) + ' ' + unit;
  const avgTraffic = fmtNum((unit === 'GB' ? bytesToGB(totalTraffic) : bytesToMB(totalTraffic)) / usersCount / days_n) + ' ' + unit + '/день';
  const avgConns = fmtNum(totalConns / usersCount / days_n) + ' /день';

  document.getElementById('totalTraffic').innerText = totalU;
  document.getElementById('topUser').innerText = `${topUserTraffic} (${fmtNum(unit === 'GB' ? bytesToGB(maxTraffic) : bytesToMB(maxTraffic)) } ${unit})`;
  document.getElementById('activeConns').innerText = totalConns + ' conn';
  document.getElementById('avgTraffic').innerText = avgTraffic;
  document.getElementById('avgConns').innerText = avgConns;
  document.getElementById('anomalies').innerText = anomalies.length ? `Высокий трафик: ${anomalies.join(', ')}` : 'Нет аномалий';
}

async function fetchSummaryData() {
  const toDay = getDay();
  const days = getPeriod();
  const trafficPack = await getJSON('/api/summary?days=' + days + '&to=' + encodeURIComponent(toDay));
  const connsPack = await getJSON('/api/summary_conns?days=' + days + '&to=' + encodeURIComponent(toDay));
  return { trafficPack, connsPack, days_n: parseInt(days) };
}

function getGradientColor(value, max) {
  const ratio = value / max;
  const r = Math.round(0 + 255 * ratio);
  const g = Math.round(255 - 255 * ratio);
  return `rgb(${r}, ${g}, 0)`;
}

async function renderUserSections() {
  const selectedUsers = getSelectedUsers();
  const day = getDay();
  const top = getTop();
  const unit = getUnit();
  const { trafficPack, connsPack, days_n } = await fetchSummaryData();
  await updateSummaryCards(trafficPack, connsPack, unit, days_n);
  await renderBottomGraphs(trafficPack, connsPack);

  const days = trafficPack.days;
  const trafficM = {}, connsM = {}, userTrafficTotals = {}, userConnsTotals = {};
  trafficPack.users.forEach(u => trafficM[u] = {});
  connsPack.users.forEach(u => connsM[u] = {});
  trafficPack.data.forEach(row => trafficM[row.user][row.date] = row.value);
  connsPack.data.forEach(row => connsM[row.user][row.date] = row.value);

  const container = document.getElementById('userSections');
  container.innerHTML = '';
  Object.keys(charts).forEach(id => { if (charts[id]) charts[id].destroy(); });
  charts = {};

  if (!selectedUsers.length) return;

  for (const user of selectedUsers) {
    const userCard = document.createElement('div');
    userCard.className = 'user-card';
    userCard.innerHTML = `<h3>${user}</h3>`;

    if (showHistos()) {
      // Traffic histo
      const trafficContainer = document.createElement('div');
      trafficContainer.className = 'chart-container';
      trafficContainer.innerHTML = '<b>Трафик по дням (' + days.length + ' дней)</b>';
      const trafficData = days.map(d => unit === 'GB' ? bytesToGB(trafficM[user][d] || 0) : bytesToMB(trafficM[user][d] || 0));
      if (trafficData.some(v => v > 0)) {
        const trafficCanvas = document.createElement('canvas');
        trafficContainer.appendChild(trafficCanvas);
        const trafficMax = Math.max(...trafficData);
        const trafficColors = trafficData.map(v => getGradientColor(v, trafficMax));
        charts[`${user}-traffic`] = new Chart(trafficCanvas, {
          type: 'bar',
          data: { labels: days, datasets: [{ label: 'Трафик', data: trafficData, backgroundColor: trafficColors }] },
          options: {
            responsive: true,
            scales: { y: { title: { display: true, text: unit } } },
            plugins: { legend: { display: false }, datalabels: { color: 'white', font: { weight: 'bold' }, formatter: (v, ctx) => v > 0 && v > 0.1 * trafficMax ? fmtNum(v) : null, anchor: 'end', align: 'top' } }
          }
        });
      } else {
        trafficContainer.innerHTML += '<div class="placeholder" style="width: 480px; height: 300px;">Нет данных за последние ' + days.length + ' дней</div>';
      }
      userCard.appendChild(trafficContainer);

      // Conns histo
      const connsContainer = document.createElement('div');
      connsContainer.className = 'chart-container';
      connsContainer.innerHTML = '<b>Подключения по дням (' + days.length + ' дней)</b>';
      const connsData = days.map(d => connsM[user][d] || 0);
      if (connsData.some(v => v > 0)) {
        const connsCanvas = document.createElement('canvas');
        connsContainer.appendChild(connsCanvas);
        const connsMax = Math.max(...connsData);
        const connsColors = connsData.map(v => getGradientColor(v, connsMax));
        charts[`${user}-conns`] = new Chart(connsCanvas, {
          type: 'bar',
          data: { labels: days, datasets: [{ label: 'Подключения', data: connsData, backgroundColor: connsColors }] },
          options: {
            responsive: true,
            scales: { y: { title: { display: true, text: 'conn' } } },
            plugins: { legend: { display: false }, datalabels: { color: 'white', font: { weight: 'bold' }, formatter: (v, ctx) => v > 0 && v > 0.1 * connsMax ? fmtNum(v) : null, anchor: 'end', align: 'top' } }
          }
        });
      } else {
        connsContainer.innerHTML += '<div class="placeholder" style="width: 480px; height: 300px;">Нет данных за последние ' + days.length + ' дней</div>';
      }
      userCard.appendChild(connsContainer);
    }

    if (showTops()) {
      // Aggregate tops
      const trafficAgg = defaultdict(int);
      const connsAgg = defaultdict(int);
      for (const d of days) {
        const trafficRows = await getJSON('/api/user_day?date=' + encodeURIComponent(d) + '&user=' + encodeURIComponent(user) + '&top=1000');
        trafficRows.forEach(r => trafficAgg[r.dst] += r.bytes);
        const connsRows = await getJSON('/api/user_day_conns?date=' + encodeURIComponent(d) + '&user=' + encodeURIComponent(user) + '&top=1000');
        connsRows.forEach(r => connsAgg[r.dst] += r.count);
      }
      const trafficTop = Object.entries(trafficAgg).sort((a, b) => b[1] - a[1]).slice(0, top);
      const connsTop = Object.entries(connsAgg).sort((a, b) => b[1] - a[1]).slice(0, top);
      const userTotalBytes = trafficTop.reduce((a, [_, bytes]) => a + bytes, 0);
      const userTotalCount = connsTop.reduce((a, [_, count]) => a + count, 0);

      const tablesRow = document.createElement('div');
      tablesRow.className = 'tables-row';

      // Top traffic
      const trafficTableBlock = document.createElement('div');
      trafficTableBlock.className = 'table-block';
      trafficTableBlock.innerHTML = '<b>ТОП-10 доменов по трафику за ' + days.length + ' дней</b>';
      if (trafficTop.length) {
        const tblHtml = '<thead><tr><th>Domain</th><th>GB</th><th>MB</th><th>bytes</th><th>%</th></tr></thead><tbody>' + trafficTop.map(([dst, bytes]) => {
          const pct = userTotalBytes > 0 ? ((bytes / userTotalBytes) * 100).toFixed(2) : 0;
          return `<tr><td>${dst}</td><td>${bytesToGB(bytes).toFixed(6)}</td><td>${bytesToMB(bytes).toFixed(3)}</td><td>${bytes}</td><td>${pct}%</td></tr>`;
        }).join('') + '</tbody>';
        const trafficTable = createSortableTable(tblHtml);
        const trafficContainer = document.createElement('div');
        trafficContainer.className = 'table-container';
        trafficContainer.appendChild(trafficTable);
        trafficTableBlock.appendChild(trafficContainer);
      } else {
        trafficTableBlock.innerHTML += '<div class="placeholder">Нет данных за последние ' + days.length + ' дней</div>';
      }
      tablesRow.appendChild(trafficTableBlock);

      // Top conns
      const connsTableBlock = document.createElement('div');
      connsTableBlock.className = 'table-block';
      connsTableBlock.innerHTML = '<b>ТОП-10 доменов по количеству подключений за ' + days.length + ' дней</b>';
      if (connsTop.length) {
        const tblHtml = '<thead><tr><th>Domain</th><th>count</th><th>%</th></tr></thead><tbody>' + connsTop.map(([dst, count]) => {
          const pct = userTotalCount > 0 ? ((count / userTotalCount) * 100).toFixed(2) : 0;
          return `<tr><td>${dst}</td><td>${count}</td><td>${pct}%</td></tr>`;
        }).join('') + '</tbody>';
        const connsTable = createSortableTable(tblHtml);
        const connsContainer = document.createElement('div');
        connsContainer.className = 'table-container';
        connsContainer.appendChild(connsTable);
        connsTableBlock.appendChild(connsContainer);
      } else {
        connsTableBlock.innerHTML += '<div class="placeholder">Нет данных за последние ' + days.length + ' дней</div>';
      }
      tablesRow.appendChild(connsTableBlock);

      userCard.appendChild(tablesRow);
    }

    container.appendChild(userCard);
  }
}

function createSortableTable(html) {
  const table = document.createElement('table');
  table.innerHTML = html;
  table.querySelectorAll('th').forEach((th, col) => {
    th.addEventListener('click', () => sortTable(table, col));
  });
  return table;
}

function sortTable(table, col) {
  const tbody = table.tbody;
  const rows = Array.from(tbody.rows);
  const asc = !table.querySelector(`th:nth-child(${col+1}).sort-asc`);
  rows.sort((a, b) => {
    let va = parseFloat(a.cells[col].innerText) || a.cells[col].innerText;
    let vb = parseFloat(b.cells[col].innerText) || b.cells[col].innerText;
    return asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  tbody.innerHTML = '';
  rows.forEach(row => tbody.appendChild(row));
  table.querySelectorAll('th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
  table.querySelector(`th:nth-child(${col+1})`).classList.add(asc ? 'sort-asc' : 'sort-desc');
}

async function renderBottomGraphs(trafficPack, connsPack) {
  const days = trafficPack.days;
  const dailyTraffic = days.map(d => trafficPack.data.filter(r => r.date === d).reduce((s, r) => s + r.value, 0));
  const cumTraffic = dailyTraffic.map((_, i) => dailyTraffic.slice(0, i+1).reduce((a, b) => a + b, 0));
  const dailyConns = days.map(d => connsPack.data.filter(r => r.date === d).reduce((s, r) => s + r.value, 0));
  const cumConns = dailyConns.map((_, i) => dailyConns.slice(0, i+1).reduce((a, b) => a + b, 0));

  const container = document.getElementById('bottomGraphs');
  container.innerHTML = '';

  // Cum traffic
  const cumTrafficCard = document.createElement('div');
  cumTrafficCard.className = 'bottom-card';
  cumTrafficCard.innerHTML = '<b>Общий кумулятивный трафик за ' + days.length + ' дней (GB)</b><canvas id="cumTrafficChart"></canvas>';
  container.appendChild(cumTrafficCard);
  bottomCharts['cumTraffic'] = new Chart(document.getElementById('cumTrafficChart'), {
    type: 'line',
    data: { labels: days, datasets: [{ data: cumTraffic.map(b => bytesToGB(b)), borderColor: '#3b82f6', borderWidth: 4, fill: false }] },
    options: { responsive: true, plugins: { legend: { display: false }, datalabels: { color: '#3b82f6', font: { weight: 'bold' }, formatter: fmtNum } } }
  });

  // Cum conns
  const cumConnsCard = document.createElement('div');
  cumConnsCard.className = 'bottom-card';
  cumConnsCard.innerHTML = '<b>Общее кумулятивное количество подключений за ' + days.length + ' дней</b><canvas id="cumConnsChart"></canvas>';
  container.appendChild(cumConnsCard);
  bottomCharts['cumConns'] = new Chart(document.getElementById('cumConnsChart'), {
    type: 'line',
    data: { labels: days, datasets: [{ data: cumConns, borderColor: '#10b981', borderWidth: 4, fill: false }] },
    options: { responsive: true, plugins: { legend: { display: false }, datalabels: { color: '#10b981', font: { weight: 'bold' }, formatter: fmtNum } } }
  });

  // Daily traffic
  const dailyTrafficCard = document.createElement('div');
  dailyTrafficCard.className = 'bottom-card';
  dailyTrafficCard.innerHTML = '<b>Ежедневный трафик за ' + days.length + ' дней (GB)</b><canvas id="dailyTrafficChart"></canvas>';
  container.appendChild(dailyTrafficCard);
  bottomCharts['dailyTraffic'] = new Chart(document.getElementById('dailyTrafficChart'), {
    type: 'bar',
    data: { labels: days, datasets: [{ data: dailyTraffic.map(b => bytesToGB(b)), backgroundColor: '#3b82f6' }] },
    options: { responsive: true, plugins: { legend: { display: false }, datalabels: { color: 'white', font: { weight: 'bold' }, formatter: fmtNum } } }
  });

  // Daily conns
  const dailyConnsCard = document.createElement('div');
  dailyConnsCard.className = 'bottom-card';
  dailyConnsCard.innerHTML = '<b>Ежедневные подключения за ' + days.length + ' дней</b><canvas id="dailyConnsChart"></canvas>';
  container.appendChild(dailyConnsCard);
  bottomCharts['dailyConns'] = new Chart(document.getElementById('dailyConnsChart'), {
    type: 'bar',
    data: { labels: days, datasets: [{ data: dailyConns, backgroundColor: '#10b981' }] },
    options: { responsive: true, plugins: { legend: { display: false }, datalabels: { color: 'white', font: { weight: 'bold' }, formatter: fmtNum } } }
  });
}

async function boot() {
  const qs = new URLSearchParams(location.search);

  const days = await loadDays();
  const qDate = qs.get('date');
  if (qDate && days.includes(qDate)) document.getElementById('dateSel').value = qDate;

  await loadUsers();

  const qMetric = qs.get('metric');
  if (qMetric) document.getElementById('metricSel').value = qMetric;

  const qUnit = qs.get('unit');
  if (qUnit) document.getElementById('unitSel').value = qUnit;

  const qTop = qs.get('top');
  if (qTop) document.getElementById('topSel').value = qTop;

  await renderUserSections();

  document.getElementById('dateSel').addEventListener('change', renderUserSections);
  document.getElementById('periodSel').addEventListener('change', renderUserSections);
  document.getElementById('metricSel').addEventListener('change', renderUserSections);
  document.getElementById('unitSel').addEventListener('change', renderUserSections);
  document.getElementById('topSel').addEventListener('input', renderUserSections);
  document.getElementById('showHistos').addEventListener('change', renderUserSections);
  document.getElementById('showTops').addEventListener('change', renderUserSections);
}
boot();
</script>
</body>
</html>"""
    return Response(html, mimetype="text/html")

if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT)