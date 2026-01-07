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
        # все, кого видели когда-либо + все из config
        for d in _list_days("usage"):
            users |= set(read_usage(d).keys())
        for d in _list_days("report"):
            users |= {r["user"] for r in read_report(d)}
        for d in _list_days("conns"):
            users |= {r["user"] for r in read_conns(d)}
        return jsonify(sorted(users))

    users |= set(read_usage(day).keys())
    if not users or users == set(config_users()):
        users |= {r["user"] for r in read_report(day)}
    if not users or users == set(config_users()):
        users |= {r["user"] for r in read_conns(day)}

    return jsonify(sorted(users))

@app.get("/api/summary")
def api_summary():
    # bytes по user/day (точно), но показываем всех из config (с нулями)
    days_n = _safe_int(request.args.get("days", "30"), 30)
    to_day = (request.args.get("to") or "").strip()

    all_days = _select_days("usage", days_n, to_day)
    if not all_days:
        # если usage_* ещё не генерится — хотя бы рисуем даты (нулевые)
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
    # sum conn_count по user/day (из access.log), показываем всех из config (с нулями)
    days_n = _safe_int(request.args.get("days", "30"), 30)
    to_day = (request.args.get("to") or "").strip()

    all_days = _select_days("conns", days_n, to_day)
    if not all_days:
        all_days = _select_days("report", days_n, to_day) or _all_days()[-days_n:]

    users = set(config_users())
    for d in all_days:
        users |= {r["user"] for r in read_conns(d)}
    users = sorted(users)

    agg = defaultdict(int)  # (day,user)->count
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
    # top dst по трафику (оценка)
    day = (request.args.get("date") or "").strip()
    user = (request.args.get("user") or "").strip()
    top = _safe_int(request.args.get("top", "50"), 50)
    if not day or not user:
        return jsonify([])
    rows = [r for r in read_report(day) if r["user"] == user]
    rows.sort(key=lambda x: x["bytes"], reverse=True)
    return jsonify(rows[:top])

@app.get("/api/user_day_conns")
def api_user_day_conns():
    # top dst по conn_count
    day = (request.args.get("date") or "").strip()
    user = (request.args.get("user") or "").strip()
    top = _safe_int(request.args.get("top", "50"), 50)
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
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 0; padding: 16px; background: #f9fafb; }
    .filter-bar { display: flex; gap: 12px; flex-wrap: wrap; padding: 12px; background: #fff; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 10; align-items: flex-end; }
    label { font-size: 12px; color: #555; display: block; margin-bottom: 4px; }
    select, input { padding: 8px; border: 1px solid #d1d5db; border-radius: 10px; min-width: 220px; }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .tab-buttons { display: flex; gap: 8px; margin: 12px 0; }
    .tab-btn { padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 8px; cursor: pointer; background: #fff; }
    .tab-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 8px; }
    th, td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; white-space: nowrap; }
    th { position: sticky; top: 0; background: #fff; }
    .muted { color: #6b7280; font-size: 12px; }
    .pill { display: inline-block; padding: 2px 8px; border: 1px solid #e5e7eb; border-radius: 999px; font-size: 12px; }
    .grow { flex: 1 1 560px; }
  </style>
</head>
<body>
  <div class="filter-bar">
    <div><label>Дата</label><select id="dateSel"></select></div>
    <div><label>Пользователь</label><select id="userSel"></select></div>
    <div><label>Метрика</label><select id="metricSel"><option value="traffic">Трафик</option><option value="conns">Подключения</option></select></div>
    <div><label>Единица (трафик)</label><select id="unitSel"><option value="GB">GB</option><option value="MB" selected>MB</option></select></div>
    <div><label>Top N</label><input id="topSel" type="number" value="50" min="5" max="500"/></div>
  </div>

  <div class="summary-cards">
    <div class="card"><b>Общий трафик</b><p id="totalTraffic" class="muted">Загрузка...</p></div>
    <div class="card"><b>Топ пользователь</b><p id="topUser" class="muted">Загрузка...</p></div>
    <div class="card"><b>Активные подключения</b><p id="activeConns" class="muted">Загрузка...</p></div>
    <div class="card"><b>Аномалии</b><p id="anomalies" class="muted">Нет предупреждений</p></div>
  </div>

  <div class="tab-buttons">
    <button class="tab-btn active" data-tab="overview">Обзор по дням</button>
    <button class="tab-btn" data-tab="top">Top destinations</button>
    <button class="tab-btn" data-tab="table">Таблица деталей</button>
  </div>

  <div id="overview" class="tab-content active card grow">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <b id="sumTitle">Трафик по дням × пользователь</b>
      <span class="pill" id="sumTag"></span>
    </div>
    <canvas id="chartDays"></canvas>
  </div>

  <div id="top" class="tab-content card grow">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <b id="topTitle">Top dst</b>
      <span class="pill" id="topTag"></span>
    </div>
    <canvas id="chartTop"></canvas>
  </div>

  <div id="table" class="tab-content card grow">
    <b>Детальная таблица</b>
    <div class="muted" id="tblHint" style="margin: 6px 0 10px 0;"></div>
    <div style="max-height: 320px; overflow: auto;">
      <table>
        <thead id="tblHead"></thead>
        <tbody id="tblBody"></tbody>
      </table>
    </div>
  </div>

<script>
let chartDays = null, chartTop = null;

function bytesToGB(b) { return (b / 1024 / 1024 / 1024); }
function bytesToMB(b) { return (b / 1024 / 1024); }
function fmtNum(x) { return (Math.round(x * 1000) / 1000).toString(); }

async function getJSON(url) {
  const r = await fetch(url);
  return await r.json();
}

function getMetric() { return document.getElementById('metricSel').value; }
function getUnit() { return document.getElementById('unitSel').value; }
function getDay() { return document.getElementById('dateSel').value; }

function setQS() {
  const p = new URLSearchParams(location.search);
  p.set('date', getDay());
  p.set('user', document.getElementById('userSel').value || '');
  p.set('metric', getMetric());
  p.set('unit', getUnit());
  p.set('top', document.getElementById('topSel').value || '50');
  history.replaceState(null, '', location.pathname + '?' + p.toString());
}

async function loadDays() {
  const days = await getJSON('/api/days');
  const dateSel = document.getElementById('dateSel');
  dateSel.innerHTML = days.slice().reverse().map(d => `<option value="${d}">${d}</option>`).join('');
  return days;
}

async function loadUsers(day, preferredUser) {
  const users = await getJSON('/api/users?date=' + encodeURIComponent(day));
  const userSel = document.getElementById('userSel');
  const prev = preferredUser || userSel.value;
  userSel.innerHTML = users.map(u => `<option value="${u}">${u}</option>`).join('');
  if (prev && users.includes(prev)) userSel.value = prev;
}

async function updateSummaryCards(pack, metric, unit) {
  const data = pack.data;
  let totalValue = 0, topUser = '', maxUserValue = 0, activeConns = 0, anomalies = 'Нет предупреждений';
  const users = pack.users;

  data.forEach(row => {
    totalValue += row.value;
    if (metric === 'conns') activeConns += row.value;
    if (row.value > maxUserValue) {
      maxUserValue = row.value;
      topUser = row.user;
    }
    if (row.value > 1e9) anomalies = 'Высокий трафик у ' + row.user; // Пример аномалии >1GB
  });

  const totalU = metric === 'traffic' ? fmtNum(unit === 'GB' ? bytesToGB(totalValue) : bytesToMB(totalValue)) + ' ' + unit : totalValue + ' conn';
  document.getElementById('totalTraffic').innerText = totalU;
  document.getElementById('topUser').innerText = topUser + ' (' + fmtNum(unit === 'GB' ? bytesToGB(maxUserValue) : bytesToMB(maxUserValue)) + ' ' + unit + ')';
  document.getElementById('activeConns').innerText = activeConns + ' conn';
  document.getElementById('anomalies').innerText = anomalies;
}

async function renderSummary() {
  const metric = getMetric();
  const unit = getUnit();
  const toDay = getDay();

  const pack = (metric === 'traffic')
    ? await getJSON('/api/summary?days=30&to=' + encodeURIComponent(toDay))
    : await getJSON('/api/summary_conns?days=30&to=' + encodeURIComponent(toDay));

  await updateSummaryCards(pack, metric, unit);

  const days = pack.days;
  const users = pack.users;
  const data = pack.data;

  const m = {};
  for (const u of users) m[u] = {};
  for (const row of data) m[row.user][row.date] = row.value;

  let datasets, yTitle;
  if (metric === 'traffic') {
    yTitle = unit;
    datasets = users.map(u => ({
      label: u,
      data: days.map(d => {
        const b = (m[u][d] || 0);
        return unit === 'GB' ? bytesToGB(b) : bytesToMB(b);
      }),
      stack: 's',
      backgroundColor: getColor(u) // Функция для цветов
    }));
    document.getElementById('sumTitle').innerText = 'Трафик по дням × пользователь (до выбранной даты)';
    document.getElementById('sumTag').innerText = 'usage_*.csv';
  } else {
    yTitle = 'conn';
    datasets = users.map(u => ({
      label: u,
      data: days.map(d => (m[u][d] || 0)),
      stack: 's',
      backgroundColor: getColor(u)
    }));
    document.getElementById('sumTitle').innerText = 'Подключения по дням × пользователь (до выбранной даты)';
    document.getElementById('sumTag').innerText = 'conns_*.csv';
  }

  const ctx = document.getElementById('chartDays');
  if (chartDays) chartDays.destroy();
  chartDays = new Chart(ctx, {
    type: 'bar',
    data: { labels: days, datasets },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: yTitle } } },
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + fmtNum(ctx.raw) } } }
    }
  });
}

function getColor(user) {
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#a855f7'];
  return colors[parseInt(user.replace('user_', '')) % colors.length];
}

async function renderTop() {
  const day = getDay();
  const user = document.getElementById('userSel').value;
  const top = document.getElementById('topSel').value;
  const metric = getMetric();
  const unit = getUnit();

  if (!day || !user) return;

  let rows, labels, vals, sumU, sumB or sumC, tblHead, tblBody;
  if (metric === 'traffic') {
    rows = await getJSON(`/api/user_day?date=${encodeURIComponent(day)}&user=${encodeURIComponent(user)}&top=${encodeURIComponent(top)}`);
    labels = rows.map(r => r.dst);
    vals = rows.map(r => unit === 'GB' ? bytesToGB(r.bytes) : bytesToMB(r.bytes));
    sumB = rows.reduce((a, r) => a + r.bytes, 0);
    sumU = fmtNum(unit === 'GB' ? bytesToGB(sumB) : bytesToMB(sumB)) + ' ' + unit;

    document.getElementById('topTitle').innerText = `Top dst по трафику (${unit})`;
    document.getElementById('topTag').innerText = 'report_*.csv';
    document.getElementById('tblHint').innerText = 'dst / GB / MB / bytes';

    tblHead = '<tr><th>dst</th><th>GB</th><th>MB</th><th>bytes</th></tr>';
    tblBody = rows.map(r => `<tr><td>${r.dst}</td><td>${bytesToGB(r.bytes).toFixed(6)}</td><td>${bytesToMB(r.bytes).toFixed(3)}</td><td>${r.bytes}</td></tr>`).join('');
  } else {
    rows = await getJSON(`/api/user_day_conns?date=${encodeURIComponent(day)}&user=${encodeURIComponent(user)}&top=${encodeURIComponent(top)}`);
    labels = rows.map(r => r.dst);
    vals = rows.map(r => r.count);
    sumC = rows.reduce((a, r) => a + r.count, 0);

    document.getElementById('topTitle').innerText = 'Top dst по подключениям (conn)';
    document.getElementById('topTag').innerText = 'conns_*.csv';
    document.getElementById('tblHint').innerText = 'dst / conn_count';

    tblHead = '<tr><th>dst</th><th>conn_count</th></tr>';
    tblBody = rows.map(r => `<tr><td>${r.dst}</td><td>${r.count}</td></tr>`).join('');
  }

  document.getElementById('tblHead').innerHTML = tblHead;
  document.getElementById('tblBody').innerHTML = tblBody;

  const ctx = document.getElementById('chartTop');
  if (chartTop) chartTop.destroy();
  chartTop = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: metric === 'traffic' ? unit : 'conn', data: vals, backgroundColor: '#3b82f6' }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => fmtNum(ctx.raw) } } },
      scales: { x: { title: { display: true, text: metric === 'traffic' ? unit : 'conn' } } }
    }
  });

  setQS();
}

async function boot() {
  const qs = new URLSearchParams(location.search);

  const days = await loadDays();
  const qDate = qs.get('date');
  if (qDate && days.includes(qDate)) document.getElementById('dateSel').value = qDate;

  await loadUsers(getDay(), qs.get('user') || '');

  const qMetric = qs.get('metric');
  if (qMetric) document.getElementById('metricSel').value = qMetric;

  const qUnit = qs.get('unit');
  if (qUnit) document.getElementById('unitSel').value = qUnit;

  const qTop = qs.get('top');
  if (qTop) document.getElementById('topSel').value = qTop;

  await renderSummary();
  await renderTop();

  document.getElementById('dateSel').addEventListener('change', async (e) => {
    await loadUsers(e.target.value);
    await renderSummary();
    await renderTop();
  });

  document.getElementById('userSel').addEventListener('change', renderTop);
  document.getElementById('topSel').addEventListener('input', renderTop);
  document.getElementById('metricSel').addEventListener('change', async () => {
    await renderSummary();
    await renderTop();
  });
  document.getElementById('unitSel').addEventListener('change', async () => {
    if (getMetric() === 'traffic') {
      await renderSummary();
      await renderTop();
    }
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}
boot();
</script>
</body>
</html>"""
    return Response(html, mimetype="text/html")

if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT)