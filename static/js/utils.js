// ==================== UTILS ====================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function fmtBytes(n) {
  n = Number(n || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return (i === 0 ? n.toFixed(0) : n.toFixed(2)) + ' ' + units[i];
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(state.lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}

function showToast(title, text) {
  $('#toastTitle').textContent = title;
  $('#toastText').textContent = text || '';
  $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 3000);
}

async function api(path, opts = {}) {
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    // If response has 'ok' field, check it
    if (data.hasOwnProperty('ok') && !data.ok && data.error) {
      throw new Error(data.error);
    }
    return data;
  } catch (e) {
    console.error('API error:', path, e);
    const msg = e.message || 'Ошибка запроса';
    if ($('#toast')) {
      showToast('❌', msg);
    }
    throw e;
  }
}

function modal(title, text, inputHtml = '', cancelText = 'Отмена', confirmText = 'Подтвердить', confirmDanger = false) {
  return new Promise(resolve => {
    $('#modalTitle').textContent = title;
    $('#modalText').innerHTML = text; // Use innerHTML to support HTML
    $('#modalInput').innerHTML = inputHtml;
    
    // Update button texts
    const cancelBtn = $('#modalCancel');
    const confirmBtn = $('#modalConfirm');
    if (cancelBtn) cancelBtn.textContent = cancelText;
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      if (confirmDanger) {
        confirmBtn.classList.add('danger');
      } else {
        confirmBtn.classList.remove('danger');
      }
    }
    
    $('#modalOverlay').classList.add('show');
    
    const cleanup = () => {
      $('#modalOverlay').classList.remove('show');
      $('#modalConfirm').onclick = null;
      $('#modalCancel').onclick = null;
    };
    
    $('#modalConfirm').onclick = () => {
      cleanup();
      const input = $('#modalInput input') || $('#modalInput textarea') || null;
      if (input) {
        resolve(input.value);
      } else {
        resolve(true);
      }
    };
    $('#modalCancel').onclick = () => {
      cleanup();
      resolve(null);
    };
  });
}

