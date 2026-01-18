// ==================== USERS MODULE (FIXED) ====================

// Загрузка пользователей
async function loadUsersList() {
  console.log('[Users] Loading users list...');
  try {
    // Загружаем список пользователей
    const usersRes = await fetch('/api/users');
    const usersData = await usersRes.json();
    
    if (!usersData.ok) {
      throw new Error(usersData.error || 'Failed to load users');
    }
    
    console.log('[Users] Loaded', usersData.users.length, 'users');
    
    // Загружаем статистику
    let statsMap = {};
    try {
      const statsRes = await fetch('/api/users/stats');
      const statsData = await statsRes.json();
      
      if (statsData.ok && statsData.users) {
        statsData.users.forEach(s => {
          statsMap[s.email] = s;
        });
        console.log('[Users] Loaded stats for', Object.keys(statsMap).length, 'users');
      }
    } catch (statsError) {
      console.warn('[Users] Failed to load stats:', statsError);
    }
    
    // Рендерим таблицу
    renderUsersTable(usersData.users, statsMap);
    
  } catch (e) {
    console.error('[Users] Load error:', e);
    showToast('❌', 'Ошибка загрузки: ' + e.message);
    
    // Показываем ошибку в таблице
    const tbody = document.querySelector('#usersTable tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--bad);">❌ ' + e.message + '</td></tr>';
    }
  }
}

// Рендеринг таблицы пользователей
function renderUsersTable(users, statsMap) {
  const tbody = document.querySelector('#usersTable tbody');
  if (!tbody) {
    console.error('[Users] Table tbody not found!');
    return;
  }
  
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);">Нет пользователей</td></tr>';
    return;
  }
  
  console.log('[Users] Rendering', users.length, 'users');
  
  const rows = users.map(user => {
    const stats = statsMap[user.email] || {};
    const alias = user.alias || user.email;
    const traffic = formatBytes(stats.totalTrafficBytes || 0);
    const daysUsed = stats.daysUsed || 0;
    const isOnline = stats.isOnline ? '🟢 Online' : '⚪ Offline';
    
    // Топ-3 домена
    const top3 = (stats.top3Domains || []).slice(0, 3).map(d => d.domain).join(', ') || '—';
    
    return `
      <tr>
        <td><strong>${escapeHtml(alias)}</strong><br><small style="color:var(--muted);">${escapeHtml(user.email)}</small></td>
        <td><code style="font-size:10px;">${escapeHtml(user.uuid)}</code></td>
        <td style="font-size:12px;">${escapeHtml(top3)}</td>
        <td style="text-align:center;">${daysUsed}</td>
        <td><strong>${traffic}</strong></td>
        <td>${isOnline}</td>
        <td>
          <button class="btn" onclick="getUserLink('${escapeHtml(user.email)}')">🔗</button>
          <button class="btn" onclick="kickUser('${escapeHtml(user.email)}')">🚫</button>
          <button class="btn danger" onclick="deleteUser('${escapeHtml(user.email)}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
  
  tbody.innerHTML = rows;
  console.log('[Users] Rendered', users.length, 'rows');
}

// Добавление пользователя
async function addUserDialog() {
  const email = prompt('Введите email (имя) пользователя:');
  if (!email || !email.trim()) return;
  
  const alias = prompt('Введите alias (отображаемое имя) (опционально):') || '';
  
  try {
    const res = await fetch('/api/users/add', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email.trim(), alias: alias.trim()})
    });
    
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to add user');
    }
    
    showToast('✅', 'Пользователь добавлен');
    loadUsersList(); // Перезагрузить список
    
  } catch (e) {
    console.error('[Users] Add error:', e);
    showToast('❌', 'Ошибка: ' + e.message);
  }
}

// Удаление пользователя
async function deleteUser(email) {
  if (!confirm(`Удалить пользователя ${email}?`)) return;
  
  try {
    const res = await fetch('/api/users/delete', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email})
    });
    
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to delete user');
    }
    
    showToast('✅', 'Пользователь удален');
    loadUsersList();
    
  } catch (e) {
    console.error('[Users] Delete error:', e);
    showToast('❌', 'Ошибка: ' + e.message);
  }
}

// Кик пользователя (смена UUID)
async function kickUser(email) {
  if (!confirm(`Сменить UUID для ${email}? Все подключения будут разорваны.`)) return;
  
  try {
    const res = await fetch('/api/users/kick', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email})
    });
    
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to kick user');
    }
    
    showToast('✅', 'UUID сменен');
    loadUsersList();
    
  } catch (e) {
    console.error('[Users] Kick error:', e);
    showToast('❌', 'Ошибка: ' + e.message);
  }
}

// Получение ссылки для пользователя
async function getUserLink(email) {
  try {
    const res = await fetch(`/api/users/link?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Failed to get link');
    }
    
    // Копируем в буфер обмена
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(data.link);
      showToast('✅', 'Ссылка скопирована');
    } else {
      // Fallback для старых браузеров
      prompt('Ссылка для пользователя:', data.link);
    }
    
  } catch (e) {
    console.error('[Users] Get link error:', e);
    showToast('❌', 'Ошибка: ' + e.message);
  }
}

// Вспомогательные функции
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Инициализация при загрузке модуля
console.log('[Users] Module loaded');
