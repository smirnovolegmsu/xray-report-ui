# API Reference - Полный справочник

**Дата:** 2026-01-25  
**Объединено из:** REFERENCE.md, README.md, v1/README.md

---

## 📋 Содержание

1. [Обзор API](#обзор-api)
2. [Детальное описание методов](#детальное-описание-методов)
3. [Группировка по модулям](#группировка-по-модулям)

---

# Обзор API

## Статистика

- **Всего методов:** 28 (v1)
- **Модулей:** 6 + общие
- **HTTP методов:** GET (20), POST (7), DELETE (1)
- **Статус:** ✅ Production ready

---

## Модули

### Общие (1 метод)
- `GET /api/ping` - Health check

### Overview (3 метода)
- `GET /api/usage/dashboard` - Данные дашборда
- `GET /api/usage/dates` - Список доступных дат
- `GET /api/usage/dashboard/<date>` - Данные по конкретной дате

### Users (7 методов)
- `GET /api/users` - Список пользователей
- `POST /api/users/add` - Добавить пользователя
- `POST /api/users/delete` - Удалить пользователя
- `POST /api/users/kick` - Регенерировать UUID
- `POST /api/users/update-alias` - Обновить алиас
- `GET /api/users/link` - Получить VLESS ссылку
- `GET /api/users/stats` - Статистика пользователей

### Live (3 метода)
- `GET /api/live/now` - Текущее состояние
- `GET /api/live/series` - Временные ряды
- `GET /api/live/top` - Топ пользователей

### Events (2 метода)
- `GET /api/events` - Список событий
- `GET /api/events/stats` - Статистика событий

### Header (4 метода)
- `GET /api/system/status` - Статус сервисов
- `GET /api/system/resources` - CPU, RAM, Disk
- `GET /api/ports/status` - Статус портов
- `POST /api/system/restart` - Перезапустить сервис

### Settings (8 методов)
- `GET /api/settings` - Получить настройки
- `POST /api/settings` - Обновить настройки
- `GET /api/xray/config` - Конфигурация Xray
- `POST /api/xray/restart` - Перезапустить Xray
- `GET /api/xray/reality` - Reality параметры
- `GET /api/collector/status` - Статус коллектора
- `POST /api/collector/toggle` - Включить/выключить
- `POST /api/collector/run` - Запустить вручную
- `GET /api/backups` - Список бэкапов
- `GET /api/backups/<file>/preview` - Превью бэкапа
- `POST /api/backups/<file>/restore` - Восстановить
- `DELETE /api/backups/<file>` - Удалить бэкап
- `GET /api/tests/run` - Запустить тесты
- `GET /api/tests/list` - Список тестов
- `GET /api/tests/status` - Статус тестов

---

# Детальное описание методов

## Общие методы

### `GET /api/ping`
**Назначение:** Health check  
**Ответ:** `{"ok": true, "message": "pong", "ts": "..."}`

---

## Overview модуль

### `GET /api/usage/dashboard`
**Параметры:** `?days=7&user=`  
**Ответ:** Dashboard data с агрегацией статистики

### `GET /api/usage/dates`
**Ответ:** `{"dates": ["2025-01-20", ...]}`

### `GET /api/usage/dashboard/<date>`
**Ответ:** Dashboard data для конкретной даты

---

## Users модуль

### `GET /api/users`
**Ответ:** `{"users": [{"email": "...", "uuid": "...", ...}, ...]}`

### `POST /api/users/add`
**Body:** `{"email": "user@example.com"}`  
**Ответ:** `{"ok": true, "user": {"uuid": "...", ...}}`

### `POST /api/users/delete`
**Body:** `{"email": "user@example.com"}`  
**Ответ:** `{"ok": true}`

### `POST /api/users/kick`
**Body:** `{"email": "user@example.com"}`  
**Ответ:** `{"ok": true, "new_uuid": "..."}`

### `POST /api/users/update-alias`
**Body:** `{"email": "user@example.com", "alias": "Имя"}`  
**Ответ:** `{"ok": true}`

### `GET /api/users/link`
**Параметры:** `?uuid=xxx&email=user@example.com`  
**Ответ:** `{"ok": true, "link": "vless://..."}`

### `GET /api/users/stats`
**Ответ:** `{"stats": {"user@example.com": {"traffic": ..., "conns": ..., "isOnline": true}, ...}}`

---

## Live модуль

### `GET /api/live/now`
**Ответ:** `{"users": [...], "total": {...}, "timestamp": "..."}`

### `GET /api/live/series`
**Параметры:** `?metric=traffic|conns&period=3600&granularity=60`  
**Ответ:** `{"series": [{"time": "...", "value": ...}, ...]}`

### `GET /api/live/top`
**Параметры:** `?metric=traffic|conns&period=3600&limit=10`  
**Ответ:** `{"top": [{"user": "...", "value": ...}, ...]}`

---

## Events модуль

### `GET /api/events`
**Параметры:** `?limit=100&hours=24&type=TYPE&severity=SEVERITY`  
**Ответ:** `{"events": [...], "total": 100}`

### `GET /api/events/stats`
**Ответ:** `{"stats": {"by_type": {...}, "by_severity": {...}, "by_service": {...}}}`

---

## Header модуль

### `GET /api/system/status`
**Ответ:** `{"ui": {"active": true, "state": "active"}, "xray": {...}, "nextjs": {...}}`

### `GET /api/system/resources`
**Ответ:** `{"cpu": {...}, "memory": {...}, "disk": {...}}`

### `GET /api/ports/status`
**Ответ:** `{"ports": [{"port": 3000, "status": "running"}, ...]}`

### `POST /api/system/restart`
**Body:** `{"target": "ui|xray|nextjs"}`  
**Ответ:** `{"ok": true, "message": "restarted", "service": "xray"}`

---

## Settings модуль

### `GET /api/settings`
**Ответ:** `{"settings": {"ui": {...}, "xray": {...}, "collector": {...}}}`

### `POST /api/settings`
**Body:** `{"ui": {...}, "xray": {...}, "collector": {...}}`  
**Ответ:** `{"ok": true}`

### `GET /api/xray/config`
**Ответ:** `{"config": {...}}`

### `POST /api/xray/restart`
**Ответ:** `{"ok": true, "message": "restarted"}`

### `GET /api/xray/reality`
**Ответ:** `{"ok": true, "port": 443, "pbk": "...", "sni": "...", ...}`

### `GET /api/collector/status`
**Ответ:** `{"status": {"enabled": true, "lag_days": 0, "newest_date": "2025-01-20"}}`

### `POST /api/collector/toggle`
**Body:** `{"enabled": true, "script": "xray_daily_usage.sh"}`  
**Ответ:** `{"ok": true, "enabled": true}`

### `POST /api/collector/run`
**Body:** `{"include_today": false}`  
**Ответ:** `{"ok": true}`

### `GET /api/backups`
**Ответ:** `{"backups": [{"filename": "...", "size": ..., "created": "..."}, ...]}`

### `GET /api/backups/<file>/preview`
**Ответ:** `{"preview": {"users": [...], "inbounds": [...]}}`

### `POST /api/backups/<file>/restore`
**Body:** `{"preview": false}`  
**Ответ:** `{"ok": true, "restored_from": "..."}`

### `DELETE /api/backups/<file>`
**Ответ:** `{"ok": true}`

### `GET /api/tests/run`
**Ответ:** `{"ok": true, "results": {...}}`

### `GET /api/tests/list`
**Ответ:** `{"tests": [{"name": "...", "status": "..."}, ...]}`

### `GET /api/tests/status`
**Ответ:** `{"status": "ready", "last_run": "..."}`

---

# Группировка по модулям

## Использование общих компонентов

Модули используют общие компоненты через services/repositories:

- `shared/xray_repository` - работа с Xray config (Overview, Users, Settings)
- `shared/system_service` - системные операции (Header, Settings, Users)
- `events_repository.append_event()` - логирование событий (Users, Settings)
- `live_service.get_live_now()` - онлайн статус (Users)

---

## Формат ответов

### Успешный ответ:
```json
{
  "ok": true,
  "data": {...}
}
```

### Ошибка:
```json
{
  "ok": false,
  "error": "Error message",
  "code": 400
}
```

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

Для детального понимания реализации см.:
- [Development Guide](development-guide.md) - архитектура и структура
- [Features](features.md) - документация модулей
