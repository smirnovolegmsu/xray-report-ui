cp /opt/xray-report-ui/app.py /opt/xray-report-ui/app.py.bak.$(date +%F_%H%M)

cat > /opt/xray-report-ui/app.py <<'PY'
#!/usr/bin/env python3
import csv
import glob
import json
import os
import re
from collections import defaultdict
from flask import Flask, jsonify, request, Response

APP_HOST = "127.0.0.1"
APP_PORT = 8090

USAGE_DIR = "/var/log/xray/usage"
XRAY_CFG = "/usr/local/etc/xray/config.json"

app = Flask(__name__)

_date_re = re.compile(r"_(\d{4}-\d{2}-\d{2})\.csv$")

def _safe_int(x, default=0):
    try:
        return int(x)
    except Exception:
        return default

def _list_days_any():
    days = set()
    for pref in ("usage", "report", "conns", "domains"):
        for fp in glob.glob(os.path.join(USAGE_DIR, f"{pref}_*.csv")):
            m = _date_re.search(fp)
            if m:
                days.add(m.group(1))
    return sorted(days)

def _csv_path(prefix, day):
    return os.path.join(USAGE_DIR, f"{prefix}_{day}.csv")

def _config_users():
    try:
        cfg = json.load(open(XRAY_CFG, encoding="utf-8"))
        vless = None
        for i in cfg.get("inbounds", []):
            if i.get("protocol") == "vless":
                vless = i
                break
        if not vless:
            return []
        clients = (vless.get("settings") or {}).get("clients") or []
        out = []
        for c in clients:
            if isinstance(c, dict) and c.get("email"):
                out.append(str(c["email"]).strip())

        def key(u):
            m = re.match(r"^user_(\d+)$", u)
            return (0, int(m.group(1))) if m else (1, u)
        return sorted(set(out), key=key)
    except Exception:
        return []

def read_usage(day):
    out = {}
    fp = _csv_path("usage", day)
    if not os.path.exists(fp):
        return out
    with open(fp, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            u = (row.get("user") or "").strip()
            tb = _safe_int(row.get("total_bytes"), 0)
            if u:
                out[u] = tb
    return out

def read_report(day):
    rows = []
    fp = _csv_path("report", day)
    if not os.path.exists(fp):
        return rows
    with open(fp, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            user = (row.get("user") or "").strip()
            dst = (row.get("dst") or "").strip()
            b = _safe_int(row.get("traffic_bytes"), 0)
            if user and dst:
                rows.append({"user": user, "dst": dst, "bytes": b})
    return rows

def read_conns(day):
    rows = []
    fp = _csv_path("conns", day)
    if not os.path.exists(fp):
        return rows
    with open(fp, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            user = (row.get("user") or "").strip()
            dst = (row.get("dst") or "").strip()
            c = _safe_int(row.get("conn_count"), 0)
            if user and dst:
                rows.append({"user": user, "dst": dst, "count": c})
    return rows

def users_for_day(day=None):
    users = set(_config_users())
    if not day:
        for d in _list_days_any():
            users |= set(read_usage(d).keys())
            users |= set(r["user"] for r in read_report(d))
            users |= set(r["user"] for r in read_conns(d))
        return sorted(users)
    users |= set(read_usage(day).keys())
    users |= set(r["user"] for r in read_report(day))
    users |= set(r["user"] for r in read_conns(day))
    return sorted(users)

def day_user_totals(day, metric):
    users = users_for_day(day)
    out = {u: 0 for u in users}
    if metric == "traffic":
        u = read_usage(day)
        if u:
            for k, v in u.items():
                out[k] = v
            return out
        for r in read_report(day):
            out[r["user"]] = out.get(r["user"], 0) + int(r["bytes"])
        return out
    for r in read_conns(day):
        out[r["user"]] = out.get(r["user"], 0) + int(r["count"])
    return out

def day_dst_totals(day, metric, user=None):
    agg = defaultdict(int)
    if metric == "traffic":
        for r in read_report(day):
            if user and user != "ALL" and r["user"] != user:
                continue
            agg[r["dst"]] += int(r["bytes"])
    else:
        for r in read_conns(day):
            if user and user != "ALL" and r["user"] != user:
                continue
            agg[r["dst"]] += int(r["count"])
    out = [{"dst": k, "value": v} for k, v in agg.items()]
    out.sort(key=lambda x: x["value"], reverse=True)
    return out

@app.get("/api/days")
def api_days():
    return jsonify(_list_days_any()[::-1])

@app.get("/api/users")
def api_users():
    day = (request.args.get("date") or "").strip()
    users = users_for_day(day if day else None)
    return jsonify(["ALL"] + [u for u in users if u != "ALL"])

@app.get("/api/day_users")
def api_day_users():
    day = (request.args.get("date") or "").strip()
    metric = (request.args.get("metric") or "traffic").strip().lower()
    if metric not in ("traffic", "conns"):
        metric = "traffic"
    if not day:
        return jsonify([])
    totals = day_user_totals(day, metric)
    rows = [{"user": u, "value": int(totals.get(u, 0) or 0)} for u in sorted(totals.keys())]
    rows.sort(key=lambda x: x["value"], reverse=True)
    return jsonify(rows)

@app.get("/api/series")
def api_series():
    user = (request.args.get("user") or "ALL").strip()
    metric = (request.args.get("metric") or "traffic").strip().lower()
    days_n = _safe_int(request.args.get("days"), 30)
    if days_n <= 0:
        days_n = 30
    if metric not in ("traffic", "conns"):
        metric = "traffic"

    days = _list_days_any()
    days = days[-days_n:]
    out = []
    for d in days:
        totals = day_user_totals(d, metric)
        if user == "ALL":
            v = sum(int(x or 0) for x in totals.values())
        else:
            v = int(totals.get(user, 0) or 0)
        out.append({"date": d, "value": v})
    return jsonify(out)

@app.get("/api/day_top")
def api_day_top():
    day = (request.args.get("date") or "").strip()
    user = (request.args.get("user") or "ALL").strip()
    metric = (request.args.get("metric") or "traffic").strip().lower()
    topn = _safe_int(request.args.get("top"), 30)
    if metric not in ("traffic", "conns"):
        metric = "traffic"
    if not day:
        return jsonify([])
    rows = day_dst_totals(day, metric, user=user)
    return jsonify(rows[:max(1, min(topn, 200))])

# legacy endpoints (на всякий)
@app.get("/api/user_day")
def api_user_day():
    day = (request.args.get("date") or "").strip()
    user = (request.args.get("user") or "").strip()
    topn = _safe_int(request.args.get("top"), 50)
    if not day or not user:
        return jsonify([])
    rows = day_dst_totals(day, "traffic", user=user)
    return jsonify([{"dst": r["dst"], "bytes": int(r["value"])} for r in rows[:max(1, min(topn, 200))]])

@app.get("/api/user_day_conns")
def api_user_day_conns():
    day = (request.args.get("date") or "").strip()
    user = (request.args.get("user") or "").strip()
    topn = _safe_int(request.args.get("top"), 50)
    if not day or not user:
        return jsonify([])
    rows = day_dst_totals(day, "conns", user=user)
    return jsonify([{"dst": r["dst"], "count": int(r["value"])} for r in rows[:max(1, min(topn, 200))]])

@app.get("/")
def index():
    html = r"""<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Xray Usage Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#0b1220;--card:#101a33;--card2:#0f1830;--txt:#e7ecff;--muted:#a7b3de;--line:#25345f;--accent:#6aa3ff;}
*{box-sizing:border-box}
body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--txt);height:100vh;overflow:hidden}
.wrap{height:100vh;display:flex;flex-direction:column}
.topbar{padding:10px 12px;border-bottom:1px solid var(--line);background:linear-gradient(180deg, rgba(16,26,51,.95), rgba(11,18,32,.95));position:sticky;top:0;z-index:5}
.toprow{display:flex;gap:10px;align-items:end;flex-wrap:wrap}
.ctrl{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);min-width:160px}
.ctrl select{background:var(--card2);color:var(--txt);border:1px solid var(--line);border-radius:10px;padding:8px 10px;outline:none}
.btn{background:var(--accent);color:#071025;border:0;border-radius:12px;padding:9px 12px;font-weight:700;cursor:pointer}
.btn.secondary{background:transparent;color:var(--txt);border:1px solid var(--line)}
.kpis{margin-top:10px;display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:64px}
.kpi .label{font-size:12px;color:var(--muted)}
.kpi .value{font-size:20px;font-weight:800;line-height:1.1}
.kpi .sub{font-size:12px;color:var(--muted);text-align:right}
.main{flex:1;padding:10px 12px 12px;display:grid;grid-template-columns:1fr 1.3fr;grid-template-rows:290px 1fr;gap:10px;min-height:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px 12px;min-height:0;display:flex;flex-direction:column}
.card h3{margin:0 0 8px 0;font-size:14px;color:var(--muted);font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:8px}
.hint{font-size:11px;color:var(--muted)}
.canvasbox{flex:1;min-height:0}
.canvasbox canvas{width:100%!important;height:100%!important}
.tablewrap{display:grid;grid-template-rows:auto 1fr;gap:8px;min-height:0}
.scroll{overflow:auto;border:1px solid rgba(37,52,95,.6);border-radius:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{position:sticky;top:0;background:rgba(16,26,51,.95);border-bottom:1px solid var(--line);text-align:left;padding:8px 6px;color:var(--muted);font-weight:700}
tbody td{border-bottom:1px dashed rgba(37,52,95,.7);padding:7px 6px;vertical-align:top}
tbody tr:hover{background:rgba(255,255,255,.03)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
.right{text-align:right;white-space:nowrap}
.badge{padding:2px 8px;border:1px solid rgba(37,52,95,.8);border-radius:999px;color:var(--muted);font-size:11px}
.footnote{padding:8px 12px;font-size:11px;color:var(--muted);border-top:1px solid var(--line)}
@media (max-width:1100px){body{overflow:auto}.wrap{height:auto}.main{grid-template-columns:1fr;grid-template-rows:280px 280px 420px 420px;overflow:visible}}
</style></head>
<body><div class="wrap">
<div class="topbar">
  <div class="toprow">
    <div class="ctrl"><div>Дата</div><select id="dateSel"></select></div>
    <div class="ctrl"><div>User</div><select id="userSel"></select></div>
    <div class="ctrl"><div>Метрика</div>
      <select id="metricSel"><option value="traffic">Трафик</option><option value="conns">Соединения</option></select>
    </div>
    <div class="ctrl"><div>Ед. изм.</div>
      <select id="unitSel"><option value="GB">GB</option><option value="MB">MB</option><option value="B">bytes</option></select>
    </div>
    <div class="ctrl" style="min-width:120px;"><div>Top</div>
      <select id="topSel"><option>10</option><option>25</option><option selected>50</option><option>100</option></select>
    </div>
    <button class="btn" id="refreshBtn">Обновить</button>
    <button class="btn secondary" id="copyLinkBtn">Скопировать ссылку</button>
    <span class="badge" id="statusBadge">—</span>
  </div>
  <div class="kpis">
    <div class="kpi"><div><div class="label">Трафик за день</div><div class="value" id="kpiTraffic">—</div></div><div class="sub" id="kpiTrafficSub">—</div></div>
    <div class="kpi"><div><div class="label">Соединения за день</div><div class="value" id="kpiConns">—</div></div><div class="sub" id="kpiConnsSub">—</div></div>
    <div class="kpi"><div><div class="label">Топ-назначение</div><div class="value" id="kpiTopDst">—</div></div><div class="sub" id="kpiTopDstSub">—</div></div>
  </div>
</div>

<div class="main">
  <div class="card">
    <h3><span>Топ пользователей за выбранную дату</span><span class="hint" id="usersHint">—</span></h3>
    <div class="canvasbox"><canvas id="chartUsers"></canvas></div>
  </div>

  <div class="card">
    <h3><span>Топ назначений (domain / ip)</span><span class="hint" id="topHint">—</span></h3>
    <div class="canvasbox"><canvas id="chartTop"></canvas></div>
  </div>

  <div class="card">
    <h3><span>Тренд за последние 30 дней</span><span class="hint" id="trendHint">—</span></h3>
    <div class="canvasbox"><canvas id="chartTrend"></canvas></div>
  </div>

  <div class="card tablewrap">
    <h3><span>Таблица: назначения</span><span class="hint" id="tblHint">—</span></h3>
    <div class="scroll">
      <table>
        <thead><tr><th style="width:55%;">dst</th><th class="right">value</th><th class="right">share</th><th class="right">raw</th></tr></thead>
        <tbody id="tblBody"></tbody>
      </table>
    </div>
  </div>
</div>

<div class="footnote" id="note">
  traffic per-dst — оценка (распределяем суточный total_bytes по conn_count из access.log). conns — фактическое число соединений из access.log.
</div>
</div>

<script>
let chartUsers=null, chartTop=null, chartTrend=null;
const valueLabelPlugin={id:'valueLabelPlugin',afterDatasetsDraw(chart,args,opts){
  if(chart.config.type!=='bar')return;const{ctx}=chart;const meta=chart.getDatasetMeta(0);if(!meta||!meta.data)return;
  ctx.save();ctx.font='12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';ctx.fillStyle='#e7ecff';
  meta.data.forEach((bar,i)=>{const val=chart.data.datasets[0].data[i];const label=(opts&&opts.formatter)?opts.formatter(val):String(val);
    ctx.fillText(label,bar.x+6,bar.y+4);});ctx.restore();
}};
function qs(id){return document.getElementById(id)}
function getMetric(){return qs('metricSel').value}
function getUnit(){return qs('unitSel').value}
function unitEnabled(){qs('unitSel').disabled=(getMetric()==='conns')}
function bytesToUnit(bytes){const u=getUnit();if(u==='B')return bytes;if(u==='MB')return bytes/(1024*1024);return bytes/(1024*1024*1024)}
function fmtTraffic(bytes){const u=getUnit();if(u==='B')return (bytes).toLocaleString('ru-RU')+' B';if(u==='MB')return bytesToUnit(bytes).toFixed(2)+' MB';return bytesToUnit(bytes).toFixed(3)+' GB'}
function fmtNumber(n){return (n||0).toLocaleString('ru-RU')}
async function getJSON(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
async function loadDays(){const days=await getJSON('/api/days');const sel=qs('dateSel');sel.innerHTML=days.map(d=>`<option value="${d}">${d}</option>`).join('');if(days.length)sel.value=days[0]}
async function loadUsers(){const day=qs('dateSel').value;const users=await getJSON('/api/users?date='+encodeURIComponent(day));const sel=qs('userSel');const cur=sel.value||'ALL';
  sel.innerHTML=users.map(u=>`<option value="${u}">${u}</option>`).join('');sel.value=users.includes(cur)?cur:'ALL'}
function makeBar(canvasId,labels,values,xTitle,formatter){
  const ctx=qs(canvasId);
  return new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:xTitle,data:values}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},valueLabelPlugin:{formatter}},
      scales:{x:{title:{display:true,text:xTitle},ticks:{color:'#a7b3de'},grid:{color:'rgba(37,52,95,.4)'}},
              y:{ticks:{color:'#a7b3de'},grid:{display:false}}}},plugins:[valueLabelPlugin]})
}
function makeLine(canvasId,labels,values,yTitle,formatter){
  const ctx=qs(canvasId);
  return new Chart(ctx,{type:'line',data:{labels,datasets:[{label:yTitle,data:values,tension:0.25,pointRadius:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>formatter?formatter(c.raw):String(c.raw)}}},
      scales:{x:{ticks:{color:'#a7b3de',maxRotation:0,autoSkip:true},grid:{color:'rgba(37,52,95,.3)'}},
              y:{ticks:{color:'#a7b3de'},grid:{color:'rgba(37,52,95,.4)'},title:{display:true,text:yTitle}}}}})
}
async function renderAll(){
  unitEnabled();
  const day=qs('dateSel').value, user=qs('userSel').value, metric=getMetric(), topn=qs('topSel').value;
  qs('statusBadge').innerText=user+' / '+day;
  const [trafficUsers,connsUsers]=await Promise.all([
    getJSON('/api/day_users?date='+encodeURIComponent(day)+'&metric=traffic'),
    getJSON('/api/day_users?date='+encodeURIComponent(day)+'&metric=conns')
  ]);
  const trafficMap=new Map(trafficUsers.map(r=>[r.user,r.value]));
  const connsMap=new Map(connsUsers.map(r=>[r.user,r.value]));
  const trafficVal=(user==='ALL')?trafficUsers.reduce((a,r)=>a+r.value,0):(trafficMap.get(user)||0);
  const connsVal=(user==='ALL')?connsUsers.reduce((a,r)=>a+r.value,0):(connsMap.get(user)||0);
  qs('kpiTraffic').innerText=fmtTraffic(trafficVal); qs('kpiTrafficSub').innerText=(user==='ALL'?'все пользователи':user);
  qs('kpiConns').innerText=fmtNumber(connsVal); qs('kpiConnsSub').innerText=(user==='ALL'?'все пользователи':user);

  const topRows=await getJSON('/api/day_top?date='+encodeURIComponent(day)+'&user='+encodeURIComponent(user)+'&metric='+encodeURIComponent(metric)+'&top='+encodeURIComponent(topn));
  const totalMetric=(metric==='traffic')?trafficVal:connsVal;
  if(topRows.length){
    const t=topRows[0], share=totalMetric?(t.value/totalMetric*100):0;
    qs('kpiTopDst').innerText=t.dst;
    qs('kpiTopDstSub').innerText=(metric==='traffic'?fmtTraffic(t.value):fmtNumber(t.value))+' • '+share.toFixed(1)+'%';
  }else{qs('kpiTopDst').innerText='—';qs('kpiTopDstSub').innerText='нет данных'}

  const dayUsers=(metric==='traffic')?trafficUsers:connsUsers;
  const topUsers=dayUsers.slice(0,12);
  const uLabels=topUsers.map(r=>r.user);
  const uVals=topUsers.map(r=>metric==='traffic'?bytesToUnit(r.value):r.value);
  const uX=metric==='traffic'?('Трафик, '+getUnit()):'conn';
  const uFmt=(v)=>metric==='traffic'?(Number(v).toFixed(getUnit()==='GB'?3:2)+' '+getUnit()):fmtNumber(v);
  qs('usersHint').innerText=(metric==='traffic'?'unit='+getUnit():'conn_count');
  if(chartUsers)chartUsers.destroy(); chartUsers=makeBar('chartUsers',uLabels,uVals,uX,uFmt);

  const dLabels=topRows.map(r=>r.dst).slice(0,18);
  const dVals=topRows.map(r=>metric==='traffic'?bytesToUnit(r.value):r.value).slice(0,18);
  const dX=metric==='traffic'?('Трафик, '+getUnit()):'conn';
  const dFmt=(v)=>metric==='traffic'?(Number(v).toFixed(getUnit()==='GB'?3:2)+' '+getUnit()):fmtNumber(v);
  qs('topHint').innerText=(user==='ALL'?'сумма по всем user':user);
  if(chartTop)chartTop.destroy(); chartTop=makeBar('chartTop',dLabels,dVals,dX,dFmt);

  const series=await getJSON('/api/series?user='+encodeURIComponent(user)+'&metric='+encodeURIComponent(metric)+'&days=30');
  const sLabels=series.map(r=>r.date);
  const sValsRaw=series.map(r=>r.value);
  const sVals=(metric==='traffic')?sValsRaw.map(v=>bytesToUnit(v)):sValsRaw;
  const sTitle=metric==='traffic'?('Трафик, '+getUnit()):'conn';
  const sFmt=(v)=>metric==='traffic'?(Number(v).toFixed(getUnit()==='GB'?3:2)+' '+getUnit()):fmtNumber(v);
  qs('trendHint').innerText=(user==='ALL'?'все пользователи':user)+' • '+(metric==='traffic'?'traffic':'conns');
  if(chartTrend)chartTrend.destroy(); chartTrend=makeLine('chartTrend',sLabels,sVals,sTitle,sFmt);

  const tb=qs('tblBody');
  const rows=topRows.slice(0,200);
  tb.innerHTML=rows.map(r=>{
    const raw=r.value;
    const pretty=(metric==='traffic')?bytesToUnit(raw):raw;
    const prettyTxt=(metric==='traffic')?(Number(pretty).toFixed(getUnit()==='GB'?6:2)+' '+getUnit()):fmtNumber(pretty);
    const share=totalMetric?(raw/totalMetric*100):0;
    const rawTxt=(metric==='traffic')?(raw.toLocaleString('ru-RU')+' B'):fmtNumber(raw);
    return `<tr><td class="mono">${r.dst}</td><td class="right mono">${prettyTxt}</td><td class="right mono">${share.toFixed(2)}%</td><td class="right mono">${rawTxt}</td></tr>`;
  }).join('') || `<tr><td colspan="4" class="hint" style="padding:12px;">Нет данных для выбранных фильтров.</td></tr>`;
  qs('tblHint').innerText=rows.length?('строк: '+rows.length):'—';
}
async function boot(){
  await loadDays(); await loadUsers(); await renderAll();
  qs('dateSel').addEventListener('change', async()=>{await loadUsers(); await renderAll()});
  qs('userSel').addEventListener('change', renderAll);
  qs('metricSel').addEventListener('change', renderAll);
  qs('unitSel').addEventListener('change', renderAll);
  qs('topSel').addEventListener('change', renderAll);
  qs('refreshBtn').addEventListener('click', renderAll);
  qs('copyLinkBtn').addEventListener('click', async ()=>{
    const url=new URL(window.location.href);
    url.searchParams.set('date',qs('dateSel').value);
    url.searchParams.set('user',qs('userSel').value);
    url.searchParams.set('metric',qs('metricSel').value);
    url.searchParams.set('unit',qs('unitSel').value);
    url.searchParams.set('top',qs('topSel').value);
    await navigator.clipboard.writeText(url.toString());
    qs('statusBadge').innerText='скопировано ✅';
    setTimeout(()=>{qs('statusBadge').innerText=qs('userSel').value+' / '+qs('dateSel').value},900);
  });
}
boot().catch(e=>{console.error(e); qs('note').innerText='Ошибка загрузки: '+e});
</script></body></html>"""
    return Response(html, mimetype="text/html")

if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT)
PY

systemctl restart xray-report-ui
systemctl status xray-report-ui --no-pager -l | head -n 20
