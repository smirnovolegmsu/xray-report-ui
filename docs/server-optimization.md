# Оптимизация для слабого сервера (3.8GB RAM, 2-3 CPU)

## Целевые показатели

- **CPU**: ≤30% при типичной нагрузке
- **RAM**: ≤50% (≤1.9GB) при типичной нагрузке
- **Отклик API**: <500ms для большинства эндпоинтов

---

## 1. Systemd сервисы с лимитами ресурсов

### Backend (Flask/Gunicorn)

**Файл:** `/etc/systemd/system/xray-report-ui.service`

```ini
[Unit]
Description=Xray Report UI Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xray-report-ui

# РЕКОМЕНДУЕТСЯ: Gunicorn вместо Flask dev server
ExecStart=/opt/xray-report-ui/venv/bin/gunicorn \
    --workers 2 \
    --threads 2 \
    --timeout 60 \
    --bind 127.0.0.1:8787 \
    --access-logfile - \
    --error-logfile - \
    --preload \
    app:app

# Альтернатива (текущий вариант - менее эффективно):
# ExecStart=/opt/xray-report-ui/venv/bin/python /opt/xray-report-ui/app.py

Restart=always
RestartSec=10

# === РЕСУРСНЫЕ ЛИМИТЫ ===
MemoryMax=512M
MemoryHigh=400M
CPUQuota=50%
# Ограничение дескрипторов файлов
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
```

### Frontend (Next.js)

**Файл:** `/etc/systemd/system/xray-nextjs-ui.service`

```ini
[Unit]
Description=Xray Report UI (Next.js)
After=network.target xray-report-ui.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xray-report-ui/frontend

# Environment
Environment="PORT=3000"
Environment="NODE_ENV=production"
Environment="NODE_OPTIONS=--max-old-space-size=512"

# Используем standalone build
ExecStart=/usr/bin/node /opt/xray-report-ui/frontend/.next/standalone/server.js

Restart=always
RestartSec=10

# === РЕСУРСНЫЕ ЛИМИТЫ ===
MemoryMax=768M
MemoryHigh=600M
CPUQuota=80%
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
```

---

## 2. Установка Gunicorn

```bash
cd /opt/xray-report-ui
source venv/bin/activate
pip install gunicorn
```

---

## 3. Применение изменений

```bash
# 1. Остановить сервисы
sudo systemctl stop xray-nextjs-ui xray-report-ui

# 2. Пересобрать frontend (один раз)
cd /opt/xray-report-ui/frontend
npm ci
npm run build

# 3. Перезагрузить конфигурацию systemd
sudo systemctl daemon-reload

# 4. Запустить сервисы
sudo systemctl start xray-report-ui
sudo systemctl start xray-nextjs-ui

# 5. Проверить статус
sudo systemctl status xray-report-ui xray-nextjs-ui
```

---

## 4. Мониторинг ресурсов

### Проверка потребления памяти

```bash
# Общая память системы
free -h

# Память по сервисам
systemctl status xray-report-ui | grep Memory
systemctl status xray-nextjs-ui | grep Memory

# Детальная статистика
systemd-cgtop -d 2
```

### Проверка CPU

```bash
# Топ процессов
htop

# CPU по сервисам
pidstat -C "python|node" 1
```

---

## 5. Оценка потребления после оптимизации

| Компонент | RAM (idle) | RAM (load) | CPU (idle) | CPU (load) |
|-----------|------------|------------|------------|------------|
| **Backend (Gunicorn)** | ~80MB | ~200-300MB | <1% | 5-15% |
| **Frontend (Node.js)** | ~150MB | ~300-400MB | <1% | 10-20% |
| **Xray** | ~30MB | ~50-100MB | <1% | 5-10% |
| **Система** | ~400MB | ~500MB | 2-5% | 5-10% |
| **ИТОГО** | ~660MB | ~1.2GB | <5% | 25-55% |

**Доступно RAM:** 3.8GB - 1.2GB = **2.6GB запас**

---

## 6. Дополнительные оптимизации (опционально)

### Swap (если RAM всё ещё не хватает)

```bash
# Создать swap 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Добавить в /etc/fstab
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Настроить swappiness (меньше = реже использовать swap)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Отключить ненужные сервисы

```bash
# Проверить запущенные сервисы
systemctl list-units --type=service --state=running

# Отключить ненужные (примеры)
sudo systemctl disable --now snapd
sudo systemctl disable --now unattended-upgrades
```

---

## 7. Troubleshooting

### Сервис убивается OOM Killer

```bash
# Проверить логи
dmesg | grep -i "out of memory"
journalctl -u xray-report-ui | grep -i "kill"

# Решение: увеличить MemoryMax или добавить swap
```

### Медленные ответы API

```bash
# Проверить время ответа
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8787/api/dashboard

# Содержимое curl-format.txt:
#     time_namelookup:  %{time_namelookup}s\n
#     time_connect:  %{time_connect}s\n
#     time_starttransfer:  %{time_starttransfer}s\n
#     time_total:  %{time_total}s\n
```

### Высокий CPU

```bash
# Найти причину
perf top -p $(pgrep -f gunicorn | head -1)

# Обычные причины:
# 1. CSV parsing - увеличить CACHE_TTL
# 2. health_checker - уже оптимизирован (60 сек)
```
