# Xray Report UI

Веб-панель управления VPN сервером на базе Xray-core.

## Архитектура

Проект состоит из двух компонентов:

1. **Backend (Flask API)** — Python сервер, обрабатывающий запросы к Xray
2. **Frontend (Next.js)** — React приложение с современным UI

```
┌─────────────────────────────────────────────────────────────┐
│                        Пользователь                          │
│                     http://SERVER:3000                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│                       PORT: 3000                             │
│              Сервис: xray-nextjs-ui.service                  │
│                                                              │
│   - Все страницы UI (Overview, Users, Online, Events, etc)  │
│   - Проксирует /api/* запросы на Backend                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ /api/*
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Flask Backend                            │
│                       PORT: 8787                             │
│              Сервис: xray-report-ui.service                  │
│                                                              │
│   - REST API для всех операций                               │
│   - Управление пользователями Xray                           │
│   - Сбор статистики и логов                                  │
│   - Интеграция с systemd                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Xray-core                               │
│               Конфиг: /usr/local/etc/xray/config.json        │
│                   Сервис: xray.service                       │
│                                                              │
│   - VPN сервер (VLESS + Reality)                             │
│   - Управление клиентами                                     │
└─────────────────────────────────────────────────────────────┘
```

## Порты

| Порт | Сервис | Описание | Доступ |
|------|--------|----------|--------|
| **3000** | `xray-nextjs-ui` | Next.js Frontend (основной UI) | Публичный |
| **8787** | `xray-report-ui` | Flask Backend API | Только localhost |
| **443** | `xray` | Xray VLESS+Reality VPN | Публичный |

### Детали портов

#### PORT 3000 — Next.js Frontend
- **Файл сервиса:** `/etc/systemd/system/xray-nextjs-ui.service`
- **Назначение:** Основной веб-интерфейс панели управления
- **URL:** `http://YOUR_SERVER_IP:3000`
- **Проксирование:** Все запросы `/api/*` проксируются на порт 8787

#### PORT 8787 — Flask Backend
- **Файл сервиса:** `/etc/systemd/system/xray-report-ui.service`
- **Назначение:** REST API для управления Xray
- **URL:** `http://127.0.0.1:8787` (только localhost)
- **Эндпоинты:** `/api/users`, `/api/settings`, `/api/dashboard`, etc.

#### PORT 443 — Xray VPN
- **Файл сервиса:** `/etc/systemd/system/xray.service`
- **Конфиг:** `/usr/local/etc/xray/config.json`
- **Назначение:** VPN сервер для клиентов

## Установка

### Требования
- Ubuntu 20.04+ / Debian 11+
- Python 3.8+
- Node.js 18+
- Xray-core

### Быстрый старт

```bash
# 1. Клонирование
git clone https://github.com/YOUR_USERNAME/xray-report-ui.git
cd xray-report-ui

# 2. Backend
python3 -m venv venv
source venv/bin/activate
pip install flask python-dateutil

# 3. Frontend
cd frontend
npm install
npm run build
cd ..

# 4. Systemd сервисы
sudo cp /etc/systemd/system/xray-report-ui.service.example /etc/systemd/system/xray-report-ui.service
sudo cp /etc/systemd/system/xray-nextjs-ui.service.example /etc/systemd/system/xray-nextjs-ui.service
sudo systemctl daemon-reload
sudo systemctl enable --now xray-report-ui xray-nextjs-ui
```

## Systemd сервисы

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

## Управление сервисами

```bash
# Статус
sudo systemctl status xray-report-ui xray-nextjs-ui

# Перезапуск
sudo systemctl restart xray-report-ui xray-nextjs-ui

# Логи
sudo journalctl -u xray-report-ui -f
sudo journalctl -u xray-nextjs-ui -f
```

## Структура проекта

```
/opt/xray-report-ui/
├── app.py                 # Flask Backend (основной файл)
├── venv/                  # Python virtual environment
├── data/                  # Данные приложения (не в Git)
│   ├── settings.json      # Настройки UI
│   ├── events.log         # Лог событий
│   └── backups/           # Бэкапы конфигов
├── frontend/              # Next.js Frontend
│   ├── app/               # Next.js App Router страницы
│   ├── components/        # React компоненты
│   ├── lib/               # Утилиты и API клиент
│   ├── types/             # TypeScript типы
│   └── .next/             # Build output (не в Git)
└── README.md              # Этот файл
```

## API Endpoints

### Users
- `GET /api/users` — список пользователей
- `POST /api/users/add` — добавить пользователя
- `POST /api/users/delete` — удалить пользователя
- `GET /api/users/stats` — статистика пользователей
- `GET /api/users/link?uuid=...` — получить VLESS ссылку

### Dashboard
- `GET /api/dashboard` — данные дашборда
- `GET /api/usage/dashboard` — статистика использования

### Live Monitoring
- `GET /api/live/now` — текущие подключения
- `GET /api/live/series` — временные ряды

### System
- `GET /api/system/status` — статус системы
- `POST /api/system/restart` — перезапуск сервисов
- `GET /api/ports/status` — статус портов

### Settings
- `GET /api/settings` — получить настройки
- `POST /api/settings` — сохранить настройки

## Лицензия

MIT
