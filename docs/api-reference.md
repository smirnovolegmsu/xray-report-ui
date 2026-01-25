# API Reference

**Дата:** 2026-01-25

---

## Обзор

- **Всего методов:** 28 (v1)
- **Модулей:** 6 + общие
- **HTTP методов:** GET (20), POST (7), DELETE (1)
- **Статус:** ✅ Production ready

---

## Модули и методы

### Общие (1)
- `GET /api/ping` — Health check

### Overview (3)
- `GET /api/usage/dashboard` — Данные дашборда (`?days=7&user=`)
- `GET /api/usage/dates` — Список доступных дат
- `GET /api/usage/dashboard/<date>` — Данные по конкретной дате

### Users (7)
- `GET /api/users` — Список пользователей
- `POST /api/users/add` — Добавить (`{"email": "..."}`)
- `POST /api/users/delete` — Удалить (`{"email": "..."}`)
- `POST /api/users/kick` — Регенерировать UUID (`{"email": "..."}`)
- `POST /api/users/update-alias` — Обновить алиас (`{"email": "...", "alias": "..."}`)
- `GET /api/users/link` — VLESS ссылка (`?uuid=...&email=...`)
- `GET /api/users/stats` — Статистика пользователей

### Live (3)
- `GET /api/live/now` — Текущее состояние (rolling 5 minutes)
- `GET /api/live/series` — Временные ряды (`?metric=traffic|conns&period=3600&granularity=60`)
- `GET /api/live/top` — Топ пользователей (`?metric=traffic|conns&period=3600&limit=10`)

### Events (2)
- `GET /api/events` — Список событий (`?limit=100&hours=24&type=TYPE&severity=SEVERITY`)
- `GET /api/events/stats` — Статистика событий

### Header (4)
- `GET /api/system/status` — Статус сервисов
- `GET /api/system/resources` — CPU, RAM, Disk
- `GET /api/ports/status` — Статус портов
- `POST /api/system/restart` — Перезапустить сервис (`{"target": "ui|xray|nextjs"}`)

### Settings (15)
**Общие:**
- `GET /api/settings` — Получить настройки
- `POST /api/settings` — Обновить настройки

**Xray:**
- `GET /api/xray/config` — Конфигурация Xray
- `POST /api/xray/restart` — Перезапустить Xray
- `GET /api/xray/reality` — Reality параметры

**Collector:**
- `GET /api/collector/status` — Статус коллектора
- `POST /api/collector/toggle` — Включить/выключить (`{"enabled": true}`)
- `POST /api/collector/run` — Запустить вручную (`{"include_today": false}`)

**Backups:**
- `GET /api/backups` — Список бэкапов
- `GET /api/backups/<file>/preview` — Превью бэкапа
- `POST /api/backups/<file>/restore` — Восстановить (`{"preview": false}`)
- `DELETE /api/backups/<file>` — Удалить бэкап

**Tests:**
- `GET /api/tests/run` — Запустить тесты
- `GET /api/tests/list` — Список тестов
- `GET /api/tests/status` — Статус тестов

---

## Формат ответов

**Успешный ответ:**
```json
{"ok": true, "data": {...}}
```

**Ошибка:**
```json
{"ok": false, "error": "Error message", "code": 400}
```

---

## Использование общих компонентов

Модули используют общие компоненты:
- `shared/xray_repository` — работа с Xray config (Overview, Users, Settings)
- `shared/system_service` — системные операции (Header, Settings, Users)
- `events_repository.append_event()` — логирование событий (все модули)
- `live_service.get_live_now()` — онлайн статус (Users)

---

## Аутентификация

**Текущий статус:** Нет аутентификации (все endpoints публичные)

**Планы:** Добавить JWT или API keys для защиты критичных endpoints

---

## Версионирование

**Текущая версия:** v1 (стабильная)

**v2 API:** В разработке (заглушки возвращают 501)

---

## Дополнительная информация

- [Development Guide](development-guide.md) — архитектура и структура
- [Features](features.md) — документация модулей
