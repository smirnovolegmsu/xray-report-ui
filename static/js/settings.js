// ==================== SETTINGS ====================

// Helper for escaping JS strings in onclick attributes
function escapeJsStringSettings(text) {
  if (text == null) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e');
}

async function loadSettings() {
  try {
    // Ensure settings subpane is visible
    const settingsSubpane = document.querySelector('[data-system-subpane="settings"]');
    if (settingsSubpane && !settingsSubpane.classList.contains('active')) {
      // If not visible, make it visible first
      settingsSubpane.classList.add('active');
      settingsSubpane.style.display = 'block';
    }
    
    const data = await api('/api/settings');
    state.settings = data.settings;
    
    const serverHost = $('#setServerHost');
    const pbk = $('#setPbk');
    const usageDir = $('#setUsageDir');
    
    if (serverHost) serverHost.value = state.settings.xray?.server_host || '';
    if (pbk) pbk.value = state.settings.xray?.reality_pbk || '';
    if (usageDir) usageDir.value = state.settings.collector?.usage_dir || '/var/log/xray/usage';
    
    // Also reload Xray config to show current Reality parameters
    await loadXrayConfig();
    
    // Collector status (read-only, no auto-toggle)
    try {
      const collector = await api('/api/collector/status');
      if (collector && collector.ok !== false) {
        const cron = collector.cron || {};
        let cronHtml = '';
        if (cron.found) {
          let jobsHtml = '';
          if (cron.all_jobs && cron.all_jobs.length > 1) {
            // Show all jobs with stats and edit capability
            jobsHtml = cron.all_jobs.map((job, idx) => {
              const stats = job.stats || {};
              const scheduleParts = (job.schedule || '').split(' ');
              const scheduleDesc = scheduleParts.length === 5 ? 
                `Каждую ${scheduleParts[0]} минуту ${scheduleParts[1]} часа` : job.schedule;
              
              const status = job.status || {};
              const statusColor = status.active ? 'var(--ok)' : 'var(--warn)';
              const statusText = status.active ? '🟢 Активна' : '⚪ Неактивна';
              
              return `
              <div style="padding: 8px; background: var(--panel); border-radius: 6px; border: 1px solid var(--line);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                  <div style="flex-grow: 1;">
                    <div style="font-weight: 600; font-size: 11px; margin-bottom: 2px;">
                      ${job.script ? `<code style="font-size: 10px; background: var(--panel2); padding: 2px 5px; border-radius: 3px;">${escapeHtml(job.script)}</code>` : 'Cron задача'}
                    </div>
                    <div style="font-size: 10px; color: var(--muted); line-height: 1.2;">
                      ${job.description || 'Скрипт сборщика статистики'}
                    </div>
                  </div>
                  <div style="font-size: 10px; color: ${statusColor}; white-space: nowrap; margin-left: 8px;">
                    ${statusText}
                  </div>
                </div>
                
                <div style="margin-bottom: 6px; padding: 4px; background: var(--panel2); border-radius: 3px;">
                  <div style="font-size: 9px; color: var(--muted); margin-bottom: 2px;">Расписание:</div>
                  <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                    <code style="font-size: 10px; font-family: ui-monospace; background: var(--bg); padding: 2px 5px; border-radius: 3px;">${escapeHtml(job.schedule || '—')}</code>
                    <button class="btn" style="padding: 2px 6px; font-size: 9px; line-height: 1.2;" onclick="editCronSchedule('${escapeJsStringSettings(job.script || '')}', '${escapeJsStringSettings(job.schedule || '')}')">✏️</button>
                  </div>
                </div>
                
                <div style="margin-bottom: 4px; font-size: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                  <span><span style="color: var(--muted);">Запусков:</span> <strong>${stats.runs_count || 0}</strong></span>
                  ${stats.errors_count > 0 ? `<span style="color: var(--warn);">Ошибок: <strong>${stats.errors_count}</strong></span>` : ''}
                  ${stats.files_count !== undefined ? `<span style="color: var(--muted);">Файлов: <strong>${stats.files_count}</strong></span>` : ''}
                </div>
                
                ${stats.last_run ? `
                <div style="font-size: 9px; color: var(--muted); margin-bottom: 3px;">
                  Последний запуск: <strong style="color: var(--text);">${escapeHtml(stats.last_run)}</strong>
                </div>
                ` : ''}
                
                ${stats.last_error ? `
                <div style="margin-top: 3px; padding: 4px; background: rgba(255, 100, 100, 0.1); border-radius: 3px; font-size: 9px; color: var(--warn); line-height: 1.2;">
                  <strong>Ошибка:</strong> ${escapeHtml(stats.last_error.substring(0, 80))}${stats.last_error.length > 80 ? '...' : ''}
                </div>
                ` : ''}
                
                ${stats.created_files && stats.created_files.length > 0 ? `
                <div style="margin-top: 4px;">
                  <div style="font-size: 9px; color: var(--muted); margin-bottom: 2px;">Файлы (${stats.created_files.length}):</div>
                  <div style="font-size: 8px; font-family: ui-monospace; color: var(--muted); max-height: 40px; overflow-y: auto; line-height: 1.3;">
                    ${stats.created_files.slice(0, 3).map(f => `<div>${escapeHtml(f)}</div>`).join('')}
                    ${stats.created_files.length > 3 ? `<div style="color: var(--muted);">... +${stats.created_files.length - 3}</div>` : ''}
                  </div>
                </div>
                ` : ''}
              </div>
            `;
            }).join('');
          } else {
            // Show single job
            jobsHtml = `
              <div style="margin-top: 4px; padding: 6px; background: var(--panel); border-radius: 4px;">
                <div><strong>Расписание:</strong> <code>${escapeHtml(cron.schedule || '—')}</code></div>
                ${cron.command ? `<div style="margin-top: 4px; word-break: break-all;"><strong>Команда:</strong> <code style="font-size: 11px;">${escapeHtml(cron.command)}</code></div>` : ''}
              </div>
            `;
          }
          
          cronHtml = `
            <div style="margin-top: 8px;">
              <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">
                📅 Cron задача${cron.jobs_count > 1 ? 'и (' + cron.jobs_count + ')' : ''} • Файл: <code style="font-size: 11px;">${escapeHtml(cron.file || '—')}</code>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; padding-right: 4px;">
                ${jobsHtml}
              </div>
            </div>
          `;
        } else {
          cronHtml = `
            <div class="form-row" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line);">
              <div style="color: var(--warn);">
                ⚠️ Cron задача не найдена. Проверьте /etc/cron.daily/xray-usage или crontab -l
              </div>
            </div>
          `;
        }
        
        let disabledInfo = '';
        if (!collector.enabled) {
          const activeCount = collector.active_jobs_count || 0;
          const totalCount = collector.total_jobs_count || 0;
          let howToFix = '';
          
          if (totalCount === 0) {
            howToFix = 'Создайте cron файл /etc/cron.d/xray-usage с задачами сборщика.';
          } else if (activeCount === 0 && totalCount > 0) {
            howToFix = 'Убедитесь, что сервис cron запущен (systemctl status cron) и задачи не закомментированы в cron файле.';
          } else {
            howToFix = 'Проверьте статус cron сервиса и убедитесь, что задачи активны.';
          }
          
          disabledInfo = `
            <div style="margin-bottom: 8px; padding: 8px; background: rgba(255, 200, 0, 0.1); border-radius: 4px; border-left: 3px solid var(--warn);">
              <div style="font-size: 11px; font-weight: 600; margin-bottom: 4px; color: var(--warn);">
                ⚠️ Сборщик неактивен
              </div>
              <div style="font-size: 10px; color: var(--muted); margin-bottom: 4px;">
                <strong>Причина:</strong> ${escapeHtml(collector.disabled_reason || 'Неизвестная причина')}
              </div>
              <div style="font-size: 10px; color: var(--muted); margin-bottom: 4px;">
                <strong>Статус задач:</strong> ${activeCount} из ${totalCount} активны
              </div>
              <div style="font-size: 10px; color: var(--muted);">
                <strong>Как исправить:</strong> ${escapeHtml(howToFix)}
              </div>
            </div>
          `;
        }
        
        $('#collectorStatus').innerHTML = `
          <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line);">
            <div style="font-size: 12px;"><span style="color: var(--muted);">Статус:</span> <strong>${collector.enabled ? '✅ Включен' : '❌ Выключен'}</strong></div>
            <div style="font-size: 12px;"><span style="color: var(--muted);">Файлов:</span> <strong>${collector.files_count || 0}</strong></div>
            <div style="font-size: 12px;"><span style="color: var(--muted);">Последний файл:</span> <strong>${collector.newest_file || '—'}</strong></div>
            <div style="font-size: 12px;"><span style="color: var(--muted);">Лаг:</span> <strong class="${collector.lag_days > 1 ? 'text-warn' : ''}">${collector.lag_days ?? '—'} дней</strong></div>
          </div>
          ${disabledInfo}
          ${cronHtml}
        `;
      } else {
        $('#collectorStatus').innerHTML = '<div class="muted">Не удалось загрузить статус сборщика</div>';
      }
    } catch (e) {
      $('#collectorStatus').innerHTML = '<div class="muted">Ошибка загрузки статуса сборщика</div>';
    }
  } catch (e) {
    console.error('Settings load error:', e);
  }
}

async function editCronSchedule(scriptName, currentSchedule) {
  // Parse current schedule
  const parts = (currentSchedule || '0 0 * * *').split(' ');
  const [minute, hour, day, month, weekday] = parts.length === 5 ? parts : ['0', '0', '*', '*', '*'];
  
  // Show modal with schedule editor
  const scheduleHtml = `
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-size: 12px;">Формат cron (5 полей):</label>
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px;">
        <div>
          <input type="text" id="cronMinute" value="${escapeHtml(minute)}" placeholder="минута" style="width: 100%; padding: 6px; font-family: ui-monospace; font-size: 12px;" />
          <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">Минута (0-59)</div>
        </div>
        <div>
          <input type="text" id="cronHour" value="${escapeHtml(hour)}" placeholder="час" style="width: 100%; padding: 6px; font-family: ui-monospace; font-size: 12px;" />
          <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">Час (0-23)</div>
        </div>
        <div>
          <input type="text" id="cronDay" value="${escapeHtml(day)}" placeholder="день" style="width: 100%; padding: 6px; font-family: ui-monospace; font-size: 12px;" />
          <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">День (1-31)</div>
        </div>
        <div>
          <input type="text" id="cronMonth" value="${escapeHtml(month)}" placeholder="месяц" style="width: 100%; padding: 6px; font-family: ui-monospace; font-size: 12px;" />
          <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">Месяц (1-12)</div>
        </div>
        <div>
          <input type="text" id="cronWeekday" value="${escapeHtml(weekday)}" placeholder="день недели" style="width: 100%; padding: 6px; font-family: ui-monospace; font-size: 12px;" />
          <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">День недели (0-7)</div>
        </div>
      </div>
      <div style="margin-top: 8px; padding: 8px; background: var(--panel2); border-radius: 4px; font-size: 11px;">
        <strong>Примеры:</strong><br/>
        • Каждый час: <code>0 * * * *</code><br/>
        • Каждые 12 часов: <code>0 */12 * * *</code><br/>
        • Ежедневно в 00:05: <code>5 0 * * *</code><br/>
        • Используйте <code>*</code> для "любое значение"
      </div>
    </div>
  `;
  
  const result = await modal('Изменить расписание cron', scheduleHtml, ['Сохранить', 'Отмена']);
  if (result === 'Сохранить') {
    const newSchedule = [
      $('#cronMinute').value.trim(),
      $('#cronHour').value.trim(),
      $('#cronDay').value.trim(),
      $('#cronMonth').value.trim(),
      $('#cronWeekday').value.trim()
    ].join(' ');
    
    if (newSchedule.split(' ').length !== 5) {
      toast('Ошибка: неверный формат расписания', 'error');
      return;
    }
    
    try {
      const res = await api('/api/collector/update-schedule', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          script: scriptName,
          schedule: newSchedule
        })
      });
      
      if (res.ok !== false) {
        toast('Расписание обновлено. Изменения вступят в силу после перезагрузки cron.', 'success');
        loadSettings(); // Reload to show updated schedule
      } else {
        toast('Ошибка: ' + (res.error || 'не удалось обновить расписание'), 'error');
      }
    } catch (e) {
      toast('Ошибка при обновлении расписания: ' + e.message, 'error');
    }
  }
}

async function saveSettings() {
  try {
    const settings = {
      xray: {
        server_host: $('#setServerHost').value.trim(),
        reality_pbk: $('#setPbk').value.trim(),
      },
      collector: {
        usage_dir: $('#setUsageDir').value.trim(),
      }
    };
    
    await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    
    showToast('✅', t('settingsSaved'));
  } catch (e) {}
}

