# Документация функциональных модулей

**Дата:** 2026-01-25  
**Объединено из:** features/README.md, settings/README.md

---

## 📋 Содержание

1. [Обзор модулей](#обзор-модулей)
2. [Детальное описание](#детальное-описание)

---

# Обзор модулей

## Основные модули

### Overview
Главная страница / Дашборд
- Агрегация статистики использования
- Графики трафика
- Топ доменов
- Статистика пользователей

### Users
Управление пользователями
- CRUD операции
- Генерация VLESS ссылок
- Статистика пользователей

### Live
Онлайн мониторинг
- Текущие подключения
- Временные ряды
- Топ пользователей

### Events
События системы
- Логирование событий
- Фильтрация и поиск
- Статистика событий

### Header
Верхняя панель
- CPU, RAM, Disk
- Статусы сервисов
- Порты

### Settings
Настройки системы
- Общие настройки
- Xray управление
- Collector управление
- Backups управление
- Ports мониторинг
- System информация
- Tests управление

---

# Детальное описание

## Overview модуль

**Backend:** `backend/features/overview/`  
**Frontend:** `frontend/app/page.tsx`, `frontend/components/features/overview/`

**API endpoints:**
- `GET /api/usage/dashboard`
- `GET /api/usage/dates`
- `GET /api/usage/dashboard/<date>`

**Компоненты:**
- `metrics-cards.tsx` - карточки метрик
- `traffic-chart.tsx` - график трафика
- `top-domains.tsx` - топ доменов
- `user-stats-cards.tsx` - статистика пользователей

---

## Users модуль

**Backend:** `backend/features/users/`  
**Frontend:** `frontend/app/users/page.tsx`, `frontend/components/features/users/`

**API endpoints:**
- `GET /api/users`
- `POST /api/users/add`
- `POST /api/users/delete`
- `POST /api/users/kick`
- `POST /api/users/update-alias`
- `GET /api/users/link`
- `GET /api/users/stats`

**Компоненты:**
- `users-table.tsx` - таблица пользователей
- `add-user-dialog.tsx` - диалог добавления
- `user-details-sheet.tsx` - детали пользователя

---

## Live модуль

**Backend:** `backend/features/live/`  
**Frontend:** `frontend/app/live/page.tsx`, `frontend/components/features/live/`

**API endpoints:**
- `GET /api/live/now`
- `GET /api/live/series`
- `GET /api/live/top`

**Компоненты:**
- `live-now.tsx` - текущие подключения
- `live-charts.tsx` - графики активности

---

## Events модуль

**Backend:** `backend/features/events/`  
**Frontend:** `frontend/app/events/page.tsx`, `frontend/components/features/events/`

**API endpoints:**
- `GET /api/events`
- `GET /api/events/stats`

**Компоненты:**
- `events-table.tsx` - таблица событий
- `events-timeline.tsx` - временная линия
- `events-stats-sidebar.tsx` - статистика

---

## Header модуль

**Backend:** `backend/features/header/`  
**Frontend:** `frontend/components/layout/header.tsx`

**API endpoints:**
- `GET /api/system/status`
- `GET /api/system/resources`
- `GET /api/ports/status`
- `POST /api/system/restart`

**Компоненты:**
- `status-badges.tsx` - статусы сервисов
- `system-resources.tsx` - системные ресурсы

---

## Settings модуль

**Backend:** `backend/features/settings/`  
**Frontend:** `frontend/app/settings/`, `frontend/components/features/settings/`

### Подсервисы:

#### Xray
- Управление конфигурацией Xray
- Перезапуск Xray
- Reality параметры

#### Collector
- Управление сборщиком статистики
- Включение/выключение
- Ручной запуск

#### Backups
- Список бэкапов
- Создание бэкапов
- Восстановление
- Удаление

#### Ports
- Мониторинг портов
- Статус портов

#### System
- Системная информация
- Ресурсы системы

#### Tests
- Запуск тестов
- Список тестов
- Статус тестов

**API endpoints:**
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/xray/*`
- `GET /api/collector/*`
- `GET /api/backups/*`
- `GET /api/tests/*`

---

## Структура модуля

### Backend структура:
```
backend/features/<module>/
├── api/v1/endpoints.py    # API endpoints
├── services/              # Бизнес-логика
└── repositories/          # Работа с данными
```

### Frontend структура:
```
frontend/features/<module>/
├── components/            # Компоненты модуля
├── hooks/                 # Custom hooks
└── types.ts               # TypeScript типы
```

---

## Взаимодействие модулей

### Общие компоненты:

- **Xray Repository** - используется в Overview, Users, Settings
- **System Service** - используется в Header, Settings, Users
- **Events Repository** - используется во всех модулях для логирования
- **Live Service** - используется в Users для онлайн статуса

---

## Добавление нового модуля

См. [Development Guide](development-guide.md#добавление-нового-модуля)

---

## Связанные документы

- [API Reference](api-reference.md) - детальная документация API
- [Development Guide](development-guide.md) - руководство по разработке
