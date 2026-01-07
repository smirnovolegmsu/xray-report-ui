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
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 0 auto; padding: 16px; background: #f9fafb; max-width: 2240px; }
    .filter-bar { display: flex; gap: 12px; flex-wrap: wrap; padding: 12px; background: #fff; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 10; align-items: flex-end; }
    label { font-size: 12px; color: #555; display: block; margin-bottom: 4px; }
    select, input { padding: 8px; border: 1px solid #d1d5db; border-radius: 10px; min-width: 220px; }
    .user-filter { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .user-filter label { display: inline-flex; align-items: center; font-size: 14px; }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .user-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 16px; margin-top: 16px; }
    .user-card { padding: 12px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
    .user-card h3 { margin-top: 0; }
    .chart-container { margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 8px; }
    th, td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; white-space: nowrap; }
    .muted { color: #6b7280; font-size: 12px; }
    .pill { display: inline-block; padding: 2px 8px; border: 1px solid #e5e7eb; border-radius: 999px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="filter-bar">
    <div><label>Дата (для топов)</label><select id="dateSel"></select></div>
    <div><label>Метрика</label><select id="metricSel"><option value="traffic">Трафик</option><option value="conns">Подключения</option></select></div>
    <div><label>Единица (трафик)</label><select id="unitSel"><option value="GB">GB</option><option value="MB" selected>MB</option></select></div>
    <div><label>Top N (для топов)</label><input id="topSel" type="number" value="10" min="5" max="50"/></div>
    <div class="user-filter" id="userFilter"><label>Пользователи:</label></div>
  </div>

  <div class="summary-cards">
    <div class="card"><b>Общий трафик (7 дней)</b><p id="totalTraffic" class="muted">Загрузка...</p></div>
    <div class="card"><b>Топ пользователь</b><p id="topUser" class="muted">Загрузка...</p></div>
    <div class="card"><b>Общие подключения</b><p id="activeConns" class="muted">Загрузка...</p></div>
    <div class="card"><b>Аномалии</b><p id="anomalies" class="muted">Нет предупреждений</p></div>
  </div>

  <div id="userSections" class="user-grid"></div>

<script>
Chart.register(ChartDataLabels);

let charts = {}; // To store per-user charts for destroy

function bytesToGB(b) { return (b / 1024 / 1024 / 1024); }
function bytesToMB(b) { return (b / 1024 / 1024); }
function fmtNum(x) { return (Math.round(x * 100) / 100).toString(); } // Reduced precision for labels

async function getJSON(url) {
  const r = await fetch(url);
  return await r.json();
}

function getMetric() { return document.getElementById('metricSel').value; }
function getUnit() { return document.getElementById('unitSel').value; }
function getDay() { return document.getElementById('dateSel').value; }
function getTop() { return document.getElementById('topSel').value; }

async function loadDays() {
  const days = await getJSON('/api/days');
  const dateSel = document.getElementById('dateSel');
  dateSel.innerHTML = days.slice().reverse().map(d => `<option value="${d}">${d}</option>`).join('');
  return days;
}

async function loadUsers(preferred = []) {
  const day = getDay();
  const users = await getJSON('/api/users?date=' + encodeURIComponent(day));
  const userFilter = document.getElementById('userFilter');
  users.forEach(u => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = u;
    checkbox.checked = preferred.length === 0 || preferred.includes(u);
    checkbox.addEventListener('change', renderUserSections);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(u));
    userFilter.appendChild(label);
  });
  return users;
}

function getSelectedUsers() {
  return Array.from(document.querySelectorAll('#userFilter input:checked')).map(cb => cb.value);
}

async function updateSummaryCards(trafficPack, connsPack, unit) {
  let totalTraffic = 0, maxTraffic = 0, topUserTraffic = '', totalConns = 0, anomalies = 'Нет предупреждений';

  trafficPack.data.forEach(row => {
    totalTraffic += row.value;
    if (row.value > maxTraffic) {
      maxTraffic = row.value;
      topUserTraffic = row.user;
    }
    if (row.value > 1e9) anomalies = `Высокий трафик у ${row.user} (>1GB)`;
  });

  connsPack.data.forEach(row => totalConns += row.value);

  const totalU = fmtNum(unit === 'GB' ? bytesToGB(totalTraffic) : bytesToMB(totalTraffic)) + ' ' + unit;
  document.getElementById('totalTraffic').innerText = totalU;
  document.getElementById('topUser').innerText = `${topUserTraffic} (${fmtNum(unit === 'GB' ? bytesToGB(maxTraffic) : bytesToMB(maxTraffic))} ${unit})`;
  document.getElementById('activeConns').innerText = totalConns + ' conn';
  document.getElementById('anomalies').innerText = anomalies;
}

async function fetchSummaryData() {
  const toDay = getDay();
  const trafficPack = await getJSON('/api/summary?days=7&to=' + encodeURIComponent(toDay));
  const connsPack = await getJSON('/api/summary_conns?days=7&to=' + encodeURIComponent(toDay));
  return { trafficPack, connsPack };
}

async function renderUserSections() {
  const selectedUsers = getSelectedUsers();
  const unit = getUnit();
  const day = getDay();
  const top = getTop();
  const { trafficPack, connsPack } = await fetchSummaryData();
  await updateSummaryCards(trafficPack, connsPack, unit);

  const days = trafficPack.days; // Assume same for conns
  const trafficM = {}, connsM = {};
  trafficPack.users.forEach(u => trafficM[u] = {});
  connsPack.users.forEach(u => connsM[u] = {});
  trafficPack.data.forEach(row => trafficM[row.user][row.date] = row.value);
  connsPack.data.forEach(row => connsM[row.user][row.date] = row.value);

  const container = document.getElementById('userSections');
  container.innerHTML = '';
  Object.keys(charts).forEach(id => { if (charts[id]) charts[id].destroy(); });
  charts = {};

  for (const user of selectedUsers) {
    const userCard = document.createElement('div');
    userCard.className = 'user-card';
    userCard.innerHTML = `<h3>${user}</h3>`;

    // Traffic chart
    const trafficContainer = document.createElement('div');
    trafficContainer.className = 'chart-container';
    trafficContainer.innerHTML = '<b>Трафик по дням (7 дней)</b>';
    const trafficCanvas = document.createElement('canvas');
    trafficContainer.appendChild(trafficCanvas);
    userCard.appendChild(trafficContainer);

    const trafficData = days.map(d => unit === 'GB' ? bytesToGB(trafficM[user][d] || 0) : bytesToMB(trafficM[user][d] || 0));
    charts[`${user}-traffic`] = new Chart(trafficCanvas, {
      type: 'bar',
      data: { labels: days, datasets: [{ label: 'Трафик', data: trafficData, backgroundColor: getColor(user) }] },
      options: {
        responsive: true,
        scales: { y: { title: { display: true, text: unit } } },
        plugins: { legend: { display: false }, datalabels: { color: 'white', font: { weight: 'bold' }, formatter: fmtNum, anchor: 'end', align: 'top' } }
      }
    });

    // Conns chart
    const connsContainer = document.createElement('div');
    connsContainer.className = 'chart-container';
    connsContainer.innerHTML = '<b>Подключения по дням (7 дней)</b>';
    const connsCanvas = document.createElement('canvas');
    connsContainer.appendChild(connsCanvas);
    userCard.appendChild(connsContainer);

    const connsData = days.map(d => connsM[user][d] || 0);
    charts[`${user}-conns`] = new Chart(connsCanvas, {
      type: 'bar',
      data: { labels: days, datasets: [{ label: 'Подключения', data: connsData, backgroundColor: getColor(user) }] },
      options: {
        responsive: true,
        scales: { y: { title: { display: true, text: 'conn' } } },
        plugins: { legend: { display: false }, datalabels: { color: 'white', font: { weight: 'bold' }, formatter: fmtNum, anchor: 'end', align: 'top' } }
      }
    });

    // Top traffic table
    const topTrafficRows = await getJSON(`/api/user_day?date=${encodeURIComponent(day)}&user=${encodeURIComponent(user)}&top=10`);
    const topTrafficTable = document.createElement('table');
    topTrafficTable.innerHTML = '<b>Топ-10 по трафику</b><thead><tr><th>dst</th><th>GB</th><th>MB</th><th>bytes</th></tr></thead><tbody>' +
      topTrafficRows.map(r => `<tr><td>${r.dst}</td><td>${bytesToGB(r.bytes).toFixed(6)}</td><td>${bytesToMB(r.bytes).toFixed(3)}</td><td>${r.bytes}</td></tr>`).join('') + '</tbody>';
    userCard.appendChild(topTrafficTable);

    // Top conns table
    const topConnsRows = await getJSON(`/api/user_day_conns?date=${encodeURIComponent(day)}&user=${encodeURIComponent(user)}&top=10`);
    const topConnsTable = document.createElement('table');
    topConnsTable.innerHTML = '<b>Топ-10 по подключениям</b><thead><tr><th>dst</th><th>count</th></tr></thead><tbody>' +
      topConnsRows.map(r => `<tr><td>${r.dst}</td><td>${r.count}</td></tr>`).join('') + '</tbody>';
    userCard.appendChild(topConnsTable);

    container.appendChild(userCard);
  }
}

function getColor(user) {
  const colors = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#a855f7'];
  return colors[parseInt(user.replace('user_', '')) % colors.length - 1];
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
  document.getElementById('metricSel').addEventListener('change', renderUserSections);
  document.getElementById('unitSel').addEventListener('change', renderUserSections);
  document.getElementById('topSel').addEventListener('input', renderUserSections);
}
boot();
</script>
</body>
</html>"""
    return Response(html, mimetype="text/html")

if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT)