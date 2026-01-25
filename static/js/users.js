// ==================== USERS ====================
async function loadUsers() {
  try {
    // Load users first (required)
    const usersRes = await api('/api/users');
    state.users = usersRes.users || [];
    
    // Try to load stats (optional - if fails, just show users without stats)
    let statsMap = {};
    try {
      const statsRes = await api('/api/users/stats');
      if (statsRes && statsRes.users) {
        statsRes.users.forEach(s => {
          statsMap[s.email] = s;
        });
      }
    } catch (statsError) {
      console.warn('Failed to load user stats, continuing without stats:', statsError);
      // Continue without stats - users will be shown with default values
    }
    
    renderUsers(state.users, statsMap);
  } catch (e) {
    console.error('Users load error:', e);
    showToast('❌', 'Ошибка загрузки пользователей: ' + (e.message || 'неизвестная ошибка'));
    // Show empty table on error
    const tbody = $('#usersTable tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">Ошибка загрузки данных</td></tr>';
    }
  }
}

function renderUsers(users, statsMap = {}) {
  console.log('renderUsers: called with', users ? users.length : 0, 'users');
  const tbody = $('#usersTable tbody');
  console.log('renderUsers: tbody element:', tbody);
  if (!tbody) {
    console.error('renderUsers: usersTable tbody not found!');
    const table = document.getElementById('usersTable');
    console.log('renderUsers: usersTable element:', table);
    if (table) {
      const tbody2 = table.querySelector('tbody');
      console.log('renderUsers: tbody from querySelector:', tbody2);
    }
    return;
  }
  if (!users || users.length === 0) {
    console.log('renderUsers: no users, showing empty message');
    tbody.innerHTML = '<tr><td colspan="7" class="muted">Нет пользователей</td></tr>';
    return;
  }
  console.log('renderUsers: rendering', users.length, 'users into table');
  
  const rowsHtml = users.map(u => {
    const stats = statsMap[u.email] || {};
    const alias = stats.alias || u.alias || '';
    const displayName = alias || u.email;
    const daysUsed = stats.daysUsed || 0;
    const totalTraffic = stats.totalTrafficBytes || 0;
    const top3Domains = stats.top3Domains || [];
    const isOnline = stats.isOnline || false;
    
    // Format top 3 domains - compact format with right-aligned traffic
    let top3Html = '—';
    if (top3Domains.length > 0) {
      // Calculate max width for alignment
      const maxWidth = Math.max(...top3Domains.map(d => {
        const gb = (d.trafficBytes / 1000000000).toFixed(1);
        return (gb + ' GB').length;
      }));
      
      top3Html = top3Domains.map(d => {
        const trafficGB = (d.trafficBytes / 1000000000).toFixed(1);
        const trafficText = trafficGB + ' GB';
        const paddedTraffic = trafficText.padStart(maxWidth, ' ');
        return `<div style="font-size: 13px; line-height: 1.3; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(d.domain)}</div>
          <div style="font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--muted); font-size: 12px; text-align: right; margin-left: 12px; flex-shrink: 0;">${trafficText}</div>
        </div>`;
      }).join('');
    }
    
    // Days used - hide if 0
    const daysUsedHtml = daysUsed > 0 ? daysUsed.toString() : '—';
    
    // Status indicator - special case for never activated users
    let statusHtml;
    if (daysUsed === 0) {
      statusHtml = '<span style="color: var(--muted);">⚪ Не активирован</span>';
    } else if (isOnline) {
      statusHtml = '<span style="color: var(--ok);">🟢 Онлайн</span>';
    } else {
      statusHtml = '<span style="color: var(--muted);">⚪ Офлайн</span>';
    }
    
    const safeEmail = escapeAttr(u.email);
    const safeAlias = escapeAttr(alias);
    return `
    <tr>
      <td style="font-size: 12px;">
        <span class="user-name" data-email="${safeEmail}" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
          <strong>${escapeHtml(displayName)}</strong>
          <span style="opacity: 0.5; font-size: 10px; cursor: pointer;" onclick="event.stopPropagation(); editUserAlias('${safeEmail}', '${safeAlias}')" title="Редактировать alias">✏️</span>
        </span>
      </td>
      <td class="mono" style="font-size: 10px; max-width: 200px; word-break: break-all;">${escapeHtml(u.uuid)}</td>
      <td style="font-size: 11px; max-width: 180px; min-width: 150px;">${top3Html}</td>
      <td style="text-align: center; font-size: 12px; font-weight: 500;">${daysUsedHtml}</td>
      <td style="font-size: 12px; font-family: ui-monospace, Menlo, Consolas, monospace;">${fmtBytes(totalTraffic)}</td>
      <td style="font-size: 11px;">${statusHtml}</td>
      <td>
        <div class="flex gap-4" style="flex-wrap: nowrap;">
          <button class="btn" onclick="copyUserLink('${safeEmail}')" title="Скопировать VLESS ссылку" style="padding: 4px 8px; font-size: 11px;">🔗</button>
          <button class="btn" onclick="kickUser('${safeEmail}')" title="Отключить пользователя" style="padding: 4px 8px; font-size: 11px;">🔄</button>
          <button class="btn danger" onclick="deleteUser('${safeEmail}')" title="Удалить пользователя" style="padding: 4px 8px; font-size: 11px;">🗑️</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
  
  console.log('renderUsers: Generated HTML length:', rowsHtml.length, 'characters');
  console.log('renderUsers: First 200 chars of HTML:', rowsHtml.substring(0, 200));
  
  // Check if tbody still exists and is accessible
  const tbodyCheck = document.getElementById('usersTable')?.querySelector('tbody');
  if (!tbodyCheck || tbodyCheck !== tbody) {
    console.error('renderUsers: tbody disappeared or changed! Original:', tbody, 'Current:', tbodyCheck);
    // Try to find it again
    const table = document.getElementById('usersTable');
    if (table) {
      const newTbody = table.querySelector('tbody');
      if (newTbody) {
        console.log('renderUsers: Found tbody again, using it');
        newTbody.innerHTML = rowsHtml;
      } else {
        console.error('renderUsers: Cannot find tbody in table!');
        return;
      }
    } else {
      console.error('renderUsers: Cannot find usersTable!');
      return;
    }
  } else {
    tbody.innerHTML = rowsHtml;
  }
  
  // Verify insertion
  const finalTbody = document.getElementById('usersTable')?.querySelector('tbody');
  console.log('renderUsers: HTML inserted into tbody');
  console.log('renderUsers: tbody.innerHTML length after insert:', finalTbody ? finalTbody.innerHTML.length : 0);
  console.log('renderUsers: tbody.children.length after insert:', finalTbody ? finalTbody.children.length : 0);
  
  // Check visibility
  const usersPane = document.querySelector('[data-pane="users"]');
  if (usersPane) {
    const paneStyle = window.getComputedStyle(usersPane);
    console.log('renderUsers: Users pane - display:', paneStyle.display, 'visibility:', paneStyle.visibility, 'opacity:', paneStyle.opacity);
    const paneRect = usersPane.getBoundingClientRect();
    console.log('renderUsers: Users pane bounds:', paneRect.width, 'x', paneRect.height, 'visible:', paneRect.width > 0 && paneRect.height > 0);
  }
  
  const table = document.getElementById('usersTable');
  if (table) {
    const tableStyle = window.getComputedStyle(table);
    console.log('renderUsers: Table - display:', tableStyle.display, 'visibility:', tableStyle.visibility);
    const tableRect = table.getBoundingClientRect();
    console.log('renderUsers: Table bounds:', tableRect.width, 'x', tableRect.height);
  }
  
  const tableWrap = table?.closest('.table-wrap');
  if (tableWrap) {
    const wrapStyle = window.getComputedStyle(tableWrap);
    console.log('renderUsers: table-wrap - display:', wrapStyle.display, 'visibility:', wrapStyle.visibility);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  // Escape for use in HTML attributes (handles quotes and special chars)
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function addUser() {
  const email = await modal(t('addUser'), 'Введите имя пользователя (email):', '<input type="text" id="newUserEmail" placeholder="user_12" style="width:100%;">');
  if (!email) return;
  
  try {
    await api('/api/users/add', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    showToast('✅', t('userAdded'));
    loadUsers();
    loadDashboard();
  } catch (e) {}
}

async function copyUserLink(email) {
  try {
    const res = await api(`/api/users/link?email=${encodeURIComponent(email)}`);
    if (res.ok && res.link) {
      // Copy to clipboard
      await navigator.clipboard.writeText(res.link);
      showToast('✅', 'Ссылка скопирована в буфер обмена');
    } else {
      showToast('❌', res.error || 'Ошибка получения ссылки');
    }
  } catch (e) {
    console.error('Copy link error:', e);
    showToast('❌', 'Ошибка копирования ссылки');
  }
}

async function deleteUser(email) {
  const confirmed = await modal(
    '⚠️ ВНИМАНИЕ: Необратимое действие',
    `Вы уверены, что хотите удалить пользователя "${email}"?<br><br><strong style="color: var(--bad);">Это действие нельзя отменить.</strong><br>UUID будет удалён из конфигурации безвозвратно.`,
    '',
    'Отмена',
    'Удалить навсегда'
  );
  if (!confirmed) return;
  
  try {
    const res = await api('/api/users/delete', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (res.ok) {
      showToast('✅', 'Пользователь удалён');
      loadUsers();
      loadDashboard();
    } else {
      showToast('❌', res.error || 'Ошибка удаления');
    }
  } catch (e) {
    console.error('Delete user error:', e);
    showToast('❌', 'Ошибка удаления пользователя');
  }
}

async function kickUser(email) {
  const confirmed = await modal(
    'Отключить пользователя',
    `Вы уверены, что хотите отключить пользователя "${email}"?<br><br>Текущие подключения будут разорваны, но пользователь сможет подключиться снова по той же ссылке (UUID будет изменён, но ссылка останется валидной).`,
    '',
    'Отмена',
    'Кикнуть'
  );
  if (!confirmed) return;
  
  try {
    const res = await api('/api/users/kick', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (res.ok) {
      showToast('✅', 'Пользователь отключён');
      loadUsers();
    } else {
      showToast('❌', res.error || 'Ошибка отключения');
    }
  } catch (e) {
    console.error('Kick user error:', e);
    showToast('❌', 'Ошибка отключения пользователя');
  }
}

async function editUserAlias(email, currentAlias) {
  const alias = await modal(
    'Редактировать Alias',
    `Введите alias для пользователя "${email}":`,
    `<input type="text" id="userAliasInput" placeholder="Введите alias (или оставьте пустым)" value="${escapeHtml(currentAlias)}" style="width:100%;">`,
    'Отмена',
    'Сохранить',
    false
  );
  
  if (alias === null) return; // Cancelled
  
  const aliasInput = document.getElementById('userAliasInput');
  const newAlias = aliasInput ? aliasInput.value.trim() : '';
  
  try {
    const res = await api('/api/users/update-alias', {
      method: 'POST',
      body: JSON.stringify({ email, alias: newAlias })
    });
    if (res.ok) {
      showToast('✅', 'Alias обновлён');
      loadUsers();
    } else {
      showToast('❌', res.error || 'Ошибка обновления alias');
    }
  } catch (e) {
    console.error('Update alias error:', e);
    showToast('❌', 'Ошибка обновления alias');
  }
}

// Legacy function - redirect to copyUserLink
async function getLink(email) {
  return copyUserLink(email);
}

