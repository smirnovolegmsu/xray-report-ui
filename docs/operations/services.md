# 🔧 Документация по сервисам

## 📊 Текущий статус

### Production сервисы (через systemd):
- **Frontend (Next.js)**: `http://localhost:3000` или `http://YOUR_SERVER_IP:3000`
- **Backend (Flask)**: `http://localhost:8787` (только localhost)

### Dev сервер (если запущен вручную):
- **Dev Frontend**: `http://localhost:3001`

---

## ✅ Что настроено:

1. **Автозапуск при загрузке системы** - сервисы включены (`enabled`)
2. **Автоматический перезапуск** - при падении сервисы перезапускаются через 10 секунд
3. **Мониторинг здоровья** - скрипт проверяет сервисы каждые 5 минут
4. **Логирование** - все логи сохраняются в `/var/log/`

---

## 🔧 Управление сервисами:

```bash
# Проверка статуса
systemctl status xray-nextjs-ui xray-report-ui

# Перезапуск
systemctl restart xray-nextjs-ui xray-report-ui

# Остановка
systemctl stop xray-nextjs-ui xray-report-ui

# Запуск
systemctl start xray-nextjs-ui xray-report-ui

# Просмотр логов
journalctl -u xray-nextjs-ui -f
journalctl -u xray-report-ui -f

# Проверка логов мониторинга
tail -f /var/log/xray-services-check.log
```

---

## 🚨 Если сервис не работает:

1. Проверьте статус: `systemctl status xray-nextjs-ui`
2. Перезапустите: `systemctl restart xray-nextjs-ui`
3. Проверьте логи: `journalctl -u xray-nextjs-ui -n 50`
4. Скрипт мониторинга автоматически перезапустит сервисы при проблемах

---

## 📝 Важно:

- **Production сервер работает на порту 3000** (через systemd)
- **Dev сервер работает на порту 3001** (если запущен вручную)
- Используйте порт **3000** для production окружения
- Сервисы автоматически перезапускаются при падении

---

## 🔍 Автоматическая проверка сервисов

Скрипт `scripts/services/check.sh` автоматически проверяет и перезапускает сервисы при проблемах.

### Настройка автоматической проверки (cron):

```bash
# Добавить в crontab для проверки каждые 5 минут
*/5 * * * * /opt/xray-report-ui/scripts/services/check.sh
```

### Ручной запуск проверки:

```bash
./scripts/services/check.sh
```

---

## 📋 Конфигурация сервисов

### xray-report-ui.service (Backend)
```ini
[Unit]
Description=Xray Report UI Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xray-report-ui
ExecStart=/opt/xray-report-ui/venv/bin/python /opt/xray-report-ui/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### xray-nextjs-ui.service (Frontend)
```ini
[Unit]
Description=Xray Report UI (Next.js)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xray-report-ui/frontend
Environment="PORT=3000"
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## 🔄 Обновление сервисов

### После изменений в коде:

```bash
# 1. Обновить код (git pull или изменения)
cd /opt/xray-report-ui

# 2. Обновить зависимости (если нужно)
# Backend
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install

# 3. Пересобрать frontend (если нужно)
npm run build

# 4. Перезапустить сервисы
systemctl restart xray-nextjs-ui xray-report-ui
```

---

## 📊 Мониторинг

### Проверка использования ресурсов:

```bash
# CPU и память
systemctl status xray-nextjs-ui
systemctl status xray-report-ui

# Детальная информация
ps aux | grep -E "(next-server|python.*app.py)"
```

### Логи:

```bash
# Последние 50 строк логов
journalctl -u xray-nextjs-ui -n 50
journalctl -u xray-report-ui -n 50

# Логи в реальном времени
journalctl -u xray-nextjs-ui -f
journalctl -u xray-report-ui -f

# Логи за последний час
journalctl -u xray-nextjs-ui --since "1 hour ago"
```

---

## ✅ Чеклист при проблемах

- [ ] Проверить статус сервисов: `systemctl status xray-nextjs-ui xray-report-ui`
- [ ] Проверить логи: `journalctl -u xray-nextjs-ui -n 50`
- [ ] Проверить порты: `ss -tulpn | grep -E "(3000|8787)"`
- [ ] Проверить доступность: `curl http://localhost:3000` и `curl http://localhost:8787/api/health`
- [ ] Перезапустить сервисы: `systemctl restart xray-nextjs-ui xray-report-ui`
- [ ] Проверить права доступа к файлам
- [ ] Проверить зависимости (Python и Node.js)
