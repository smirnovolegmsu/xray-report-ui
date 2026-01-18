// ==================== EVENTS ====================
async function loadEvents() {
  try {
    const filter = $('#eventsFilter').value.trim();
    const url = filter ? `/api/events?text=${encodeURIComponent(filter)}` : '/api/events';
    const data = await api(url);
    renderEvents(data.events || []);
  } catch (e) {
    console.error('Events load error:', e);
  }
}

function renderEvents(events) {
  const tbody = $('#eventsTable tbody');
  
  function interpretEvent(e) {
    const type = e.type || 'UNKNOWN';
    const action = e.action || '';
    const severity = e.severity || 'INFO';
    
    let interpretation = '';
    let icon = '📋';
    
    if (type === 'USER') {
      if (action.includes('add')) {
        interpretation = `Добавлен пользователь: ${e.email || e.userId || '—'}`;
        icon = '➕';
      } else if (action.includes('delete')) {
        interpretation = `Удалён пользователь: ${e.email || e.userId || '—'}`;
        icon = '🗑️';
      } else if (action.includes('kick')) {
        interpretation = `Пользователь отключён (UUID изменён): ${e.email || e.userId || '—'}`;
        icon = '🔄';
      } else {
        interpretation = `Действие с пользователем: ${action}`;
      }
    } else if (type === 'SYSTEM') {
      if (action.includes('restart')) {
        interpretation = `Перезапуск сервиса: ${e.target || '—'}`;
        icon = '⚡';
      } else {
        interpretation = `Системное действие: ${action}`;
      }
    } else if (type === 'SETTINGS') {
      interpretation = `Изменены настройки: ${action}`;
      icon = '⚙️';
    } else if (type === 'XRAY') {
      interpretation = `Действие с Xray: ${action}`;
      icon = '🔧';
    } else {
      interpretation = `${type}: ${action}`;
    }
    
    return { interpretation, icon, severity };
  }
  
  tbody.innerHTML = events.slice(0, 100).map(e => {
    const { interpretation, icon, severity } = interpretEvent(e);
    const severityClass = severity === 'ERROR' ? 'bad' : severity === 'WARN' ? 'warn' : 'ok';
    
    return `
      <tr>
        <td class="mono" style="font-size:11px;">${fmtDate(e.ts)}</td>
        <td><span class="badge ${severityClass}">${e.type || '—'}</span></td>
        <td>${icon} ${interpretation}</td>
        <td class="muted" style="font-size:11px;">${e.action || '—'}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="4" class="muted">Нет событий</td></tr>';
}

