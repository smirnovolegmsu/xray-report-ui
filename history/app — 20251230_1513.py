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
  <title>Xray dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 16px; }
    .row { display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; }
    .card { border:1px solid #e5e7eb; border-radius:12px; padding:12px; }
    .grow { flex:1 1 560px; }
    .w360 { width:360px; }
    label { font-size:12px; color:#555; display:block; margin-bottom:4px; }
    select, input { padding:8px; border:1px solid #d1d5db; border-radius:10px; min-width:220px; }
    table { border-collapse: collapse; width:100%; font-size:12px; }
    th, td { border-bottom:1px solid #eee; padding:6px 8px; text-align:left; white-space:nowrap; }
    th { position: sticky; top:0; background:#fff; }
    .muted { color:#6b7280; font-size:12px; }
    .pill { display:inline-block; padding:2px 8px; border:1px solid #e5e7eb; border-radius:999px; font-size:12px; }
  </style>
</head>
<body>
  <div class="row">
    <div>
      <label>Дата</label>
      <select id="dateSel"></select>
    </div>
    <div>
      <label>User</label>
      <select id="userSel"></select>
    </div>
    <div>
      <label>Метрика</label>
      <select id="metricSel">
        <option value="traffic">Трафик</option>
        <option value="conns">Кол-во разов (conn)</option>
      </select>
    </div>
    <div>
      <label>Единица (для трафика)</label>
      <select id="unitSel">
        <option value="GB">GB</option>
        <option value="MB" selected>MB</option>
      </select>
    </div>
    <div>
      <label>Top</label>
      <input id="topSel" type="number" value="50" min="5" max="500"/>
    </div>
    <div class="muted" id="note"></div>
  </div>

  <div class="row" style="margin-top:12px;">
    <div class="card grow">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <b id="sumTitle">По дням × user</b>
        <span class="pill" id="sumTag"></span>
      </div>
      <canvas id="chartDays"></canvas>

      <div class="muted" style="margin-top:8px;">Цифры (по дням × user):</div>
      <div style="max-height:260px; overflow:auto; margin-top:6px;">
        <table>
          <thead id="sumTblHead"></thead>
          <tbody id="sumTblBody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="row" style="margin-top:12px;">
    <div class="card grow">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <b id="topTitle">Top dst</b>
        <span class="pill" id="topTag"></span>
      </div>
      <canvas id="chartTop"></canvas>
    </div>

    <div class="card w360">
      <b>Сводка</b>
      <pre class="muted" id="sumBox" style="margin-top:8px; white-space:pre-wrap;"></pre>
    </div>
  </div>

  <div class="card" style="margin-top:12px;">
    <b>Таблица</b>
    <div class="muted" id="tblHint" style="margin:6px 0 10px 0;"></div>
    <div style="max-height:520px; overflow:auto;">
      <table>
        <thead id="tblHead"></thead>
        <tbody id="tblBody"></tbody>
      </table>
    </div>
  </div>

<script>
let chartDays=null, chartTop=null;

function bytesToGB(b){ return (b/1024/1024/1024); }
function bytesToMB(b){ return (b/1024/1024); }

function fmtNum(x){ return (Math.round(x*1000)/1000).toString(); }

async function getJSON(url){
  const r = await fetch(url);
  return await r.json();
}

function getMetric(){ return document.getElementById('metricSel').value; }
function getUnit(){ return document.getElementById('unitSel').value; }
function getDay(){ return document.getElementById('dateSel').value; }

function setQS(){
  const p = new URLSearchParams(location.search);
  p.set('date', getDay());
  p.set('user', document.getElementById('userSel').value || '');
  p.set('metric', getMetric());
  p.set('unit', getUnit());
  p.set('top', document.getElementById('topSel').value || '50');
  history.replaceState(null, '', location.pathname + '?' + p.toString());
}

async function loadDays(){
  const days = await getJSON('/api/days');
  const dateSel = document.getElementById('dateSel');
  dateSel.innerHTML = days.slice().reverse().map(d=>`<option value="${d}">${d}</option>`).join('');
  return days;
}

async function loadUsers(day, preferredUser){
  const users = await getJSON('/api/users?date=' + encodeURIComponent(day));
  const userSel = document.getElementById('userSel');
  const prev = preferredUser || userSel.value;
  userSel.innerHTML = users.map(u=>`<option value="${u}">${u}</option>`).join('');
  if (prev && users.includes(prev)) userSel.value = prev;
}

function buildSummaryTable(days, users, m, metric, unit){
  const head = '<tr><th>date</th>' + users.map(u=>`<th>${u}</th>`).join('') + '<th>total</th></tr>';
  document.getElementById('sumTblHead').innerHTML = head;

  const rows = days.map(d=>{
    let total = 0;
    const cells = users.map(u=>{
      const v = (m[u][d] || 0);
      total += v;
      if (metric === 'traffic'){
        const x = unit === 'GB' ? bytesToGB(v) : bytesToMB(v);
        return `<td>${fmtNum(x)}</td>`;
      } else {
        return `<td>${v}</td>`;
      }
    });
    const totalCell = (metric === 'traffic')
      ? `<td><b>${fmtNum(unit === 'GB' ? bytesToGB(total) : bytesToMB(total))}</b></td>`
      : `<td><b>${total}</b></td>`;
    return `<tr><td>${d}</td>${cells.join('')}${totalCell}</tr>`;
  }).join('');
  document.getElementById('sumTblBody').innerHTML = rows;
}

async function renderSummary(){
  const metric = getMetric();
  const unit = getUnit();
  const toDay = getDay();

  const pack = (metric === 'traffic')
    ? await getJSON('/api/summary?days=30&to=' + encodeURIComponent(toDay))
    : await getJSON('/api/summary_conns?days=30&to=' + encodeURIComponent(toDay));

  const days = pack.days;
  const users = pack.users;
  const data = pack.data;

  const m = {};
  for (const u of users) m[u] = {};
  for (const row of data) m[row.user][row.date] = row.value;

  let datasets, yTitle;
  if (metric === 'traffic'){
    yTitle = unit;
    datasets = users.map(u=>({
      label: u,
      data: days.map(d=>{
        const b = (m[u][d] || 0);
        return unit === 'GB' ? bytesToGB(b) : bytesToMB(b);
      }),
      stack: 's'
    }));
    document.getElementById('sumTitle').innerText = 'Трафик по дням × user (до выбранной даты)';
    document.getElementById('sumTag').innerText = 'usage_*.csv (точно, если генерится)';
  } else {
    yTitle = 'conn';
    datasets = users.map(u=>({
      label: u,
      data: days.map(d=> (m[u][d] || 0)),
      stack: 's'
    }));
    document.getElementById('sumTitle').innerText = 'Коннекты по дням × user (до выбранной даты)';
    document.getElementById('sumTag').innerText = 'conns_*.csv (из access.log)';
  }

  const ctx = document.getElementById('chartDays');
  if (chartDays) chartDays.destroy();
  chartDays = new Chart(ctx, {
    type: 'bar',
    data: { labels: days, datasets },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true, title: { display:true, text:yTitle } } },
      plugins: { legend: { position:'bottom' } }
    }
  });

  buildSummaryTable(days, users, m, metric, unit);
}

async function renderTop(){
  const day = getDay();
  const user = document.getElementById('userSel').value;
  const top = document.getElementById('topSel').value;
  const metric = getMetric();
  const unit = getUnit();

  if (!day || !user) return;

  if (metric === 'traffic'){
    const rows = await getJSON(`/api/user_day?date=${encodeURIComponent(day)}&user=${encodeURIComponent(user)}&top=${encodeURIComponent(top)}`);
    const labels = rows.map(r=>r.dst);
    const vals = rows.map(r=> unit === 'GB' ? bytesToGB(r.bytes) : bytesToMB(r.bytes));

    const sumB = rows.reduce((a,r)=>a+r.bytes,0);
    const sumU = unit === 'GB' ? bytesToGB(sumB) : bytesToMB(sumB);

    document.getElementById('sumBox').innerText =
      `${user} / ${day}\n` +
      `Top-сумма: ${fmtNum(sumU)} ${unit}\n` +
      `bytes: ${sumB}\n` +
      `строк: ${rows.length}`;

    document.getElementById('topTitle').innerText = `Top dst по трафику (${unit})`;
    document.getElementById('topTag').innerText = 'report_*.csv (оценка)';
    document.getElementById('tblHint').innerText = 'Поля: dst / GB / MB / bytes';

    document.getElementById('tblHead').innerHTML = '<tr><th>dst</th><th>GB</th><th>MB</th><th>bytes</th></tr>';
    document.getElementById('tblBody').innerHTML = rows.map(r=>`
      <tr>
        <td>${r.dst}</td>
        <td>${bytesToGB(r.bytes).toFixed(6)}</td>
        <td>${bytesToMB(r.bytes).toFixed(3)}</td>
        <td>${r.bytes}</td>
      </tr>`).join('');

    const ctx = document.getElementById('chartTop');
    if (chartTop) chartTop.destroy();
    chartTop = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: unit, data: vals }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display:false } },
        scales: { x: { title: { display:true, text:unit } } }
      }
    });

    document.getElementById('note').innerText =
      'per-domain traffic = оценка (раскидываем суточный total_bytes по conn_count).';

  } else {
    const rows = await getJSON(`/api/user_day_conns?date=${encodeURIComponent(day)}&user=${encodeURIComponent(user)}&top=${encodeURIComponent(top)}`);
    const labels = rows.map(r=>r.dst);
    const vals = rows.map(r=>r.count);
    const sumC = rows.reduce((a,r)=>a+r.count,0);

    document.getElementById('sumBox').innerText =
      `${user} / ${day}\n` +
      `Top-сумма: ${sumC} conn\n` +
      `строк: ${rows.length}`;

    document.getElementById('topTitle').innerText = 'Top dst по количеству разов (conn)';
    document.getElementById('topTag').innerText = 'conns_*.csv (из access.log)';
    document.getElementById('tblHint').innerText = 'Поля: dst / conn_count';

    document.getElementById('tblHead').innerHTML = '<tr><th>dst</th><th>conn_count</th></tr>';
    document.getElementById('tblBody').innerHTML = rows.map(r=>`
      <tr><td>${r.dst}</td><td>${r.count}</td></tr>
    `).join('');

    const ctx = document.getElementById('chartTop');
    if (chartTop) chartTop.destroy();
    chartTop = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'conn', data: vals }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display:false } },
        scales: { x: { title: { display:true, text:'conn' } } }
      }
    });

    document.getElementById('note').innerText =
      'conn_count = число соединений из access.log (это не байты).';
  }

  setQS();
}

async function boot(){
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

  document.getElementById('dateSel').addEventListener('change', async (e)=>{
    await loadUsers(e.target.value);
    await renderSummary();
    await renderTop();
  });

  document.getElementById('userSel').addEventListener('change', renderTop);

  document.getElementById('topSel').addEventListener('input', renderTop);

  document.getElementById('metricSel').addEventListener('change', async ()=>{
    await renderSummary();
    await renderTop();
  });

  document.getElementById('unitSel').addEventListener('change', async ()=>{
    if (getMetric() === 'traffic'){
      await renderSummary();
      await renderTop();
    }
  });
}
boot();
</script>
</body>
</html>"""
    return Response(html, mimetype="text/html")

if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT)
