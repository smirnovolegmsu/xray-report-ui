# Функциональные модули

**Дата:** 2026-01-25

---

## Обзор модулей

### Overview
Главная страница / Дашборд — агрегация статистики, графики трафика, топ доменов, статистика пользователей

### Users
Управление пользователями — CRUD операции, генерация VLESS ссылок, статистика

### Live
Онлайн мониторинг — текущие подключения, временные ряды, топ пользователей

### Events
События системы — логирование событий, фильтрация и поиск, статистика

### Header
Верхняя панель — CPU, RAM, Disk, статусы сервисов, порты

### Settings
Настройки системы — общие настройки, Xray управление, Collector, Backups, Ports, System, Tests

---

## Детальное описание

### Overview модуль

**Backend:** `backend/features/overview/`  
**Frontend:** `frontend/app/page.tsx`, `frontend/components/features/overview/`

**API:** `/api/usage/dashboard`, `/api/usage/dates`, `/api/usage/dashboard/<date>`

**Компоненты:** `metrics-cards.tsx`, `traffic-chart.tsx`, `top-domains.tsx`, `user-stats-cards.tsx`

---

### Users модуль

**Backend:** `backend/features/users/`  
**Frontend:** `frontend/app/users/page.tsx`, `frontend/components/features/users/`

**API:** `/api/users/*` (7 методов: список, добавление, удаление, kick, update-alias, link, stats)

**Компоненты:** `users-table.tsx`, `add-user-dialog.tsx`, `user-details-sheet.tsx`

---

### Live модуль

**Backend:** `backend/features/live/`  
**Frontend:** `frontend/app/live/page.tsx`, `frontend/components/features/live/`

**API:** `/api/live/now`, `/api/live/series`, `/api/live/top`

**Компоненты:** `live-now.tsx`, `live-charts.tsx`

---

### Events модуль

**Backend:** `backend/features/events/`  
**Frontend:** `frontend/app/events/page.tsx`, `frontend/components/features/events/`

**API:** `/api/events`, `/api/events/stats`

**Компоненты:** `events-table.tsx`, `events-timeline.tsx`, `events-stats-sidebar.tsx`

---

### Header модуль

**Backend:** `backend/features/header/`  
**Frontend:** `frontend/components/layout/header.tsx`

**API:** `/api/system/status`, `/api/system/resources`, `/api/ports/status`, `/api/system/restart`

**Компоненты:** `status-badges.tsx`, `system-resources.tsx`

---

### Settings модуль

**Backend:** `backend/features/settings/`  
**Frontend:** `frontend/app/settings/`, `frontend/components/features/settings/`

**Подсервисы:**
- **Xray** — управление конфигурацией, перезапуск, Reality параметры
- **Collector** — управление сборщиком статистики, включение/выключение, ручной запуск
- **Backups** — список, создание, восстановление, удаление
- **Ports** — мониторинг портов, статус
- **System** — системная информация, ресурсы
- **Tests** — запуск тестов, список, статус

**API:** `/api/settings`, `/api/xray/*`, `/api/collector/*`, `/api/backups/*`, `/api/tests/*`

---

## Структура модуля

**Backend:**
```
backend/features/<module>/
├── api/v1/endpoints.py    # API endpoints
├── services/              # Бизнес-логика
└── repositories/          # Работа с данными
```

**Frontend:**
```
frontend/features/<module>/
├── components/            # Компоненты модуля
├── hooks/                 # Custom hooks
└── types.ts               # TypeScript типы
```

---

## Взаимодействие модулей

**Общие компоненты:**
- **Xray Repository** — используется в Overview, Users, Settings
- **System Service** — используется в Header, Settings, Users
- **Events Repository** — используется во всех модулях для логирования
- **Live Service** — используется в Users для онлайн статуса

---

## Добавление нового модуля

См. [Development Guide](development-guide.md#добавление-нового-модуля)

---

## Связанные документы

- [API Reference](api-reference.md) — детальная документация API
- [Development Guide](development-guide.md) — руководство по разработке
