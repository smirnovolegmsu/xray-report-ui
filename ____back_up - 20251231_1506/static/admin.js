/* Admin + Updates + Events */
(function(){
  const $ = (id)=>document.getElementById(id);

  async function api(path, opts={}){
    const r = await fetch(path, {headers:{'Content-Type':'application/json'}, ...opts});
    const j = await r.json().catch(()=>({ok:false,msg:'bad json'}));
    if(!r.ok) throw new Error(j.msg || ('HTTP '+r.status));
    return j;
  }

  function showModal(title, text){
    return new Promise((resolve)=>{
      $('modalTitle').textContent = title;
      $('modalText').textContent = text;
      $('modal').classList.remove('hidden');

      const off = ()=>{
        $('modalYes').onclick = null;
        $('modalNo').onclick = null;
      };
      $('modalNo').onclick = ()=>{ off(); $('modal').classList.add('hidden'); resolve(false); };
      $('modalYes').onclick = ()=>{ off(); $('modal').classList.add('hidden'); resolve(true); };
    });
  }

  async function copyText(s){
    try{ await navigator.clipboard.writeText(s); return true; }catch(e){ return false; }
  }

  function buildTable(el, cols, rows){
    let h = '<thead><tr>' + cols.map(c=>`<th>${c.t}</th>`).join('') + '</tr></thead>';
    h += '<tbody>';
    for(const r of rows){
      h += '<tr>' + cols.map(c=>`<td>${r[c.k] ?? ''}</td>`).join('') + '</tr>';
    }
    h += '</tbody>';
    el.innerHTML = h;
  }

  function esc(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  async function loadClients(){
    const j = await api('/api/admin/clients');
    const rows = (j||[]).map(c=>{
      const link = c.share_link ? c.share_link : (c.share_link_error ? `ERR: ${c.share_link_error}` : '');
      const copyBtn = c.share_link ? `<button class="btn" data-act="copy" data-email="${esc(c.email)}">Copy</button>` : '';
      const kickBtn = `<button class="btn danger" data-act="kick" data-email="${esc(c.email)}">Kick</button>`;
      const delBtn  = `<button class="btn danger" data-act="del" data-email="${esc(c.email)}">Delete</button>`;
      return {
        email: esc(c.email),
        alias: esc(c.alias||''),
        link: `<span class="muted">${esc(link).slice(0,64)}${link.length>64?'…':''}</span>`,
        actions: `<div class="row" style="gap:6px">${copyBtn}${kickBtn}${delBtn}</div>`,
        _link: link,
      };
    });

    buildTable($('tblClients'), [
      {k:'email', t:'email'},
      {k:'alias', t:'alias'},
      {k:'link', t:'share link'},
      {k:'actions', t:'actions'},
    ], rows);

    $('tblClients').onclick = async (e)=>{
      const btn = e.target.closest('button');
      if(!btn) return;
      const act = btn.dataset.act;
      const email = btn.dataset.email;
      if(act==='copy'){
        const row = rows.find(r=>r.email===email);
        if(!row) return;
        const ok = await copyText(row._link);
        btn.textContent = ok ? 'Скопировано' : 'Не вышло';
        setTimeout(()=>btn.textContent='Copy', 900);
      }
      if(act==='kick'){
        const ok = await showModal(
          'Kick пользователя',
          `Пользователь "${email}" будет отключен от VPN (UUID будет заменён).\nОн сможет подключиться повторно, но ему понадобится новая ссылка.\n\nПодтвердить?`
        );
        if(!ok) return;
        const res = await api(`/api/admin/reset_uuid/${encodeURIComponent(email)}`, {method:'POST', body:'{}'});
        if(res.share_link){
          await copyText(res.share_link);
          alert('Готово. Новая ссылка скопирована в буфер.');
        }else{
          alert('Готово. Но ссылку не смог собрать: '+(res.share_link_error||'unknown'));
        }
        await loadClients();
      }
      if(act==='del'){
        const ok = await showModal(
          'Удалить пользователя',
          `Вот прям точно-точно удалить "${email}" из Xray?\nЭто действие необратимо.\n\nПодтвердить?`
        );
        if(!ok) return;
        await api(`/api/admin/clients/${encodeURIComponent(email)}`, {method:'DELETE'});
        await loadClients();
      }
    };
  }

  async function saveHost(){
    const host = $('inPublicHost').value.trim();
    if(!host) return alert('public_host пустой');
    await api('/api/admin/public_host', {method:'POST', body: JSON.stringify({host})});
    alert('Сохранено');
  }

  async function importLink(){
    const link = $('inImportLink').value.trim();
    if(!link) return alert('ссылка пустая');
    const res = await api('/api/admin/import_link', {method:'POST', body: JSON.stringify({link})});
    alert(res.msg || 'ok');
  }

  async function addClient(){
    const email = $('inNewEmail').value.trim();
    const alias = $('inNewAlias').value.trim();
    if(!email) return alert('email пустой');
    const res = await api('/api/admin/clients', {method:'POST', body: JSON.stringify({email, alias})});
    if(res.share_link){
      await copyText(res.share_link);
      alert('Создано. Ссылка скопирована.');
    }else{
      alert('Создано. Но ссылку не смог собрать: ' + (res.share_link_error || res.msg || 'unknown'));
    }
    $('inNewEmail').value=''; $('inNewAlias').value='';
    await loadClients();
  }

  async function pkgInfo(){
    const res = await api('/api/sys/packages');
    $('pkgOut').textContent = JSON.stringify(res, null, 2);
  }
  async function installCryptography(){
    const ok = await showModal('Установка cryptography', 'Поставить/обновить пакет cryptography?\nЭто нужно для вычисления pbk на сервере.\n\nПодтвердить?');
    if(!ok) return;
    const res = await api('/api/sys/pip_install', {method:'POST', body: JSON.stringify({pkg:'cryptography'})});
    $('pkgOut').textContent = JSON.stringify(res, null, 2);
    if(res.ok) alert('Готово: cryptography установлен/обновлён.');
  }

  // Updates
  function renderBackups(list){
    const box = $('backups');
    box.innerHTML = '';
    (list||[]).forEach(b=>{
      const div = document.createElement('div');
      div.className = 'brow';
      div.innerHTML = `<div class="id">${b.id}</div><div class="meta">${(b.files||[]).length} files</div><div class="spacer"></div><button class="btn danger" data-id="${b.id}">Rollback</button>`;
      div.querySelector('button').onclick = async ()=>{
        const ok = await showModal('Rollback', `Откатить изменения к backup "${b.id}"?\nUI будет перезапущен.`);
        if(!ok) return;
        const res = await api('/api/updates/rollback', {method:'POST', body: JSON.stringify({backup_id:b.id})});
        $('updOut').textContent = JSON.stringify(res, null, 2);
        await loadBackups();
      };
      box.appendChild(div);
    });
  }

  async function validateManifest(){
    const manifest = $('manifest').value;
    const res = await api('/api/updates/manifest/validate', {method:'POST', body: JSON.stringify({manifest})});
    $('updOut').textContent = JSON.stringify(res, null, 2);
  }

  async function applyManifest(){
    const manifest = $('manifest').value;
    if(!manifest.trim()) return alert('manifest пустой');
    const ok = await showModal('Применить обновление', 'Сделать backup, записать файлы, перезапустить UI.\n\nПодтвердить?');
    if(!ok) return;
    const res = await api('/api/updates/manifest/apply', {method:'POST', body: JSON.stringify({manifest})});
    $('updOut').textContent = JSON.stringify(res, null, 2);
    await loadBackups();
  }

  async function loadBackups(){
    const res = await api('/api/updates/backups');
    renderBackups(res.backups || []);
  }

  // Events
  async function loadEvents(){
    const res = await api('/api/events?lines=200');
    $('eventsOut').textContent = (res.lines||[]).join('\n');
  }

  function wire(){
    $('btnReloadClients').onclick = ()=>loadClients().catch(e=>alert(e.message));
    $('btnSaveHost').onclick = ()=>saveHost().catch(e=>alert(e.message));
    $('btnImportLink').onclick = ()=>importLink().catch(e=>alert(e.message));
    $('btnAddClient').onclick = ()=>addClient().catch(e=>alert(e.message));

    $('btnPkgInfo').onclick = ()=>pkgInfo().catch(e=>alert(e.message));
    $('btnInstallCrypto').onclick = ()=>installCryptography().catch(e=>alert(e.message));

    $('btnValidate').onclick = ()=>validateManifest().catch(e=>alert(e.message));
    $('btnApply').onclick = ()=>applyManifest().catch(e=>alert(e.message));
    $('btnLoadBackups').onclick = ()=>loadBackups().catch(e=>alert(e.message));

    $('btnEvents').onclick = ()=>loadEvents().catch(e=>alert(e.message));
  }

  wire();

  window.Admin = { loadClients, loadBackups, loadEvents };
})(); 
