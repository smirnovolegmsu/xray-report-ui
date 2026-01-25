# API Reference - Полный справочник

## Содержание

1. [Визуализация структуры](#визуализация-структуры)
2. [Детальное описание методов](#детальное-описание-методов)
3. [Пересечения между модулями](#пересечения-между-модулями)
4. [Группировка по функциональности](#группировка-по-функциональности)

---

## Визуализация структуры

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API (28 методов v1)              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ОБЩИЕ (1 метод)                                            │
├─────────────────────────────────────────────────────────────┤
│  GET  /api/ping                    Health check             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  МОДУЛЬ: Overview (3 метода)                               │
├─────────────────────────────────────────────────────────────┤
│  GET  /api/usage/dashboard         Данные дашборда          │
│  GET  /api/usage/dates             Список дат              │
│  GET  /api/usage/dashboard/<date>  Данные по дате          │
└─────────────────────────────────────────────────────────────┘
         │
         ├─→ Использует: shared/xray_repository (список пользователей)
         └─→ Данные: CSV файлы usage (repositories/usage_repository)

┌─────────────────────────────────────────────────────────────┐
│  МОДУЛЬ: Users (7 методов)                                  │
├─────────────────────────────────────────────────────────────┤
│  GET  /api/users                   Список пользователей   │
│  POST /api/users/add                Добавить пользователя  │
│  POST /api/users/delete             Удалить пользователя     │
│  POST /api/users/kick               Регенерировать UUID    │
│  POST /api/users/update-alias       Обновить алиас          │
│  GET  /api/users/link               Получить VLESS ссылку  │
│  GET  /api/users/stats              Статистика пользователей│
└─────────────────────────────────────────────────────────────┘
         │
         ├─→ Использует: shared/xray_repository (работа с Xray config)
         ├─→ Использует: events_repository (логирование событий)
         └─→ Использует: live_service (онлайн статус)

┌─────────────────────────────────────────────────────────────┐
│  МОДУЛЬ: Live (3 метода)                                    │
├─────────────────────────────────────────────────────────────┤
│  GET  /api/live/now                 Текущее состояние       │
│  GET  /api/live/series               Временные ряды         │
│  GET  /api/live/top                  Топ пользователей      │
└─────────────────────────────────────────────────────────────┘
         │
         └─→ Данные: access.log (services/live_service)

┌─────────────────────────────────────────────────────────────┐
│  МОДУЛЬ: Events (2 метода)                                  │
├─────────────────────────────────────────────────────────────┤
│  GET  /api/events                   Список событий         │
│  GET  /api/events/stats              Статистика событий     │
└─────────────────────────────────────────────────────────────┘
         │
         └─→ Данные: events.jsonl (repositories/events_repository)

┌─────────────────────────────────────────────────────────────┐
│  МОДУЛЬ: Header (4 метода)                                  │
├─────────────────────────────────────────────────────────────┤
│  GET  /api/system/status            Статус сервисов        │
│  GET  /api/system/resources         CPU, RAM, Disk         │
│  GET  /api/ports/status             Статус портов          │
│  POST /api/system/restart            Перезапустить сервис  │
└─────────────────────────────────────────────────────────────┘
         │
         └─→ Использует: shared/system_service (системные операции)

┌─────────────────────────────────────────────────────────────┐
│  МОДУЛЬ: Settings (8 методов)                               │
├─────────────────────────────────────────────────────────────┤
│  Общие настройки (2):                                       │
│    GET  /api/settings               Получить настройки     │
│    POST /api/settings               Обновить настройки      │
│                                                              │
│  Подсервис Xray (3):                                        │
│    GET  /api/xray/config            Конфигурация Xray      │
│    POST /api/xray/restart           Перезапустить Xray     │
│    GET  /api/xray/reality           Reality параметры       │
│                                                              │
│  Подсервис Collector (3):                                   │
│    GET  /api/collector/status      Статус коллектора       │
│    POST /api/collector/toggle      Включить/выключить      │
│    POST /api/collector/run          Запустить вручную      │
│                                                              │
│  Подсервис Backups (4):                                     │
│    GET    /api/backups              Список бэкапов         │
│    GET    /api/backups/<file>/preview Превью бэкапа        │
│    POST   /api/backups/<file>/restore Восстановить         │
│    DELETE /api/backups/<file>       Удалить бэкап          │
│                                                              │
│  Подсервис Tests (3):                                       │
│    GET  /api/tests/run              Запустить тесты         │
│    GET  /api/tests/list            Список тестов          │
│    GET  /api/tests/status          Статус тестов          │
└─────────────────────────────────────────────────────────────┘
         │
         ├─→ Использует: shared/xray_repository (Xray config)
         ├─→ Использует: shared/system_service (перезапуск)
         └─→ Использует: events_repository (логирование)
```

---

## Детальное описание методов

### Общие API методы

#### `GET /api/ping`
**Модуль:** Общий (`backend/core/api.py`)  
**Что делает:** Health check - проверка работоспособности backend  
**Использует:** `backend.core.helpers.now_utc_iso()`  
**Ответ:** `{"ok": true, "message": "pong", "ts": "2025-01-20T12:00:00Z"}`  
**Используется:** Frontend для проверки связи с backend

---

### Модуль Overview (3 метода)

#### `GET /api/usage/dashboard`
**Модуль:** Overview  
**Что делает:** Получает данные дашборда (статистика использования за N дней)  
**Параметры:** `?days=7&user=email` (опционально фильтр по пользователю)  
**Использует:**
- `overview.services.dashboard_service.load_dashboard_data()` - загрузка данных
- `backend.core.xray.get_xray_clients()` - список пользователей
- `backend.core.cache` - кеширование (60 сек)
- `overview.repositories.usage_repository` - чтение CSV файлов usage

**Данные:** CSV файлы из `/var/log/xray/usage/`  
**Ответ:** Статистика трафика, подключений, топ доменов, пользователей

#### `GET /api/usage/dates`
**Модуль:** Overview  
**Что делает:** Получает список доступных дат (для которых есть данные)  
**Использует:** `overview.repositories.usage_repository.list_usage_dates()`  
**Данные:** Сканирует `/var/log/xray/usage/` и парсит даты из имен файлов  
**Ответ:** `{"dates": ["2025-01-20", "2025-01-19", ...]}`

#### `GET /api/usage/dashboard/<date_str>`
**Модуль:** Overview  
**Что делает:** Получает данные дашборда для конкретной даты  
**Параметры:** `?mode=daily|cumulative&window_days=7`  
**Использует:** `overview.services.dashboard_service.load_usage_dashboard()`  
**Данные:** CSV файлы usage за указанную дату  
**Ответ:** Данные дашборда для конкретной даты

---

### Модуль Users (7 методов)

#### `GET /api/users`
**Модуль:** Users  
**Что делает:** Получает список всех пользователей  
**Использует:** `users.services.user_service.list_users()` → `backend.core.xray.get_xray_clients()`  
**Данные:** Xray config файл (`/usr/local/etc/xray/config.json`)  
**Ответ:** `{"users": [{"email": "...", "uuid": "...", "alias": "..."}, ...]}`

#### `POST /api/users/add`
**Модуль:** Users  
**Что делает:** Добавляет нового пользователя в Xray config  
**Body:** `{"email": "user@example.com"}`  
**Использует:**
- `users.services.user_service.add_user()` - добавление пользователя
- `backend.core.xray` - работа с Xray config
- `events.repositories.events_repository.append_event()` - логирование события
- `settings.services.xray_service.set_xray_clients()` - сохранение config
- `backend.core.system.systemctl_restart()` - перезапуск Xray

**Данные:** Создает новый UUID, добавляет в Xray config, перезапускает Xray  
**Ответ:** `{"ok": true, "user": {...}, "uuid": "..."}`

#### `POST /api/users/delete`
**Модуль:** Users  
**Что делает:** Удаляет пользователя из Xray config  
**Body:** `{"email": "user@example.com"}`  
**Использует:**
- `users.services.user_service.delete_user()` - удаление пользователя
- `backend.core.xray` - работа с Xray config
- `events.repositories.events_repository.append_event()` - логирование
- `backend.core.system.systemctl_restart()` - перезапуск Xray

**Данные:** Удаляет из Xray config, перезапускает Xray  
**Ответ:** `{"ok": true, "message": "user_deleted"}`

#### `POST /api/users/kick`
**Модуль:** Users  
**Что делает:** Регенерирует UUID пользователя (отключает все его подключения)  
**Body:** `{"email": "user@example.com"}`  
**Использует:**
- `users.services.user_service.kick_user()` - регенерация UUID
- `backend.core.xray` - обновление Xray config
- `events.repositories.events_repository.append_event()` - логирование
- `backend.core.system.systemctl_restart()` - перезапуск Xray

**Данные:** Генерирует новый UUID, обновляет Xray config  
**Ответ:** `{"ok": true, "new_uuid": "..."}`

#### `POST /api/users/update-alias`
**Модуль:** Users  
**Что делает:** Обновляет алиас (имя) пользователя  
**Body:** `{"email": "user@example.com", "alias": "Имя пользователя"}`  
**Использует:**
- `users.services.user_service.update_user_alias()` - обновление алиаса
- `backend.core.xray` - обновление Xray config
- `backend.core.system.systemctl_restart()` - перезапуск Xray

**Данные:** Обновляет поле `email` в Xray config (используется как алиас)  
**Ответ:** `{"ok": true}`

#### `GET /api/users/link`
**Модуль:** Users  
**Что делает:** Генерирует VLESS ссылку для пользователя  
**Параметры:** `?uuid=xxx&email=user@example.com`  
**Использует:**
- `users.services.user_service.build_vless_link()` - генерация ссылки
- `settings.services.xray_service.get_reality_params()` - получение Reality параметров

**Данные:** Берет UUID пользователя и Reality параметры, генерирует VLESS ссылку  
**Ответ:** `{"ok": true, "link": "vless://..."}`

#### `GET /api/users/stats`
**Модуль:** Users  
**Что делает:** Получает статистику пользователей (трафик, подключения, онлайн статус)  
**Использует:**
- `dashboard_service._calculate_user_alltime_stats()` - расчет статистики (временная зависимость)
- `live.services.live_service.get_live_now()` - получение онлайн статуса

**Данные:** CSV файлы usage + live данные (access.log)  
**Ответ:** `{"stats": {"user@example.com": {"traffic": ..., "conns": ..., "isOnline": true}, ...}}`

---

### Модуль Live (3 метода)

#### `GET /api/live/now`
**Модуль:** Live  
**Что делает:** Получает текущее состояние подключений (rolling 5 minutes)  
**Использует:** `live.services.live_service.get_live_now()`  
**Данные:** access.log (парсится в реальном времени)  
**Ответ:** `{"users": [...], "total": {...}, "timestamp": "..."}`

**Особенность:** Используется модулем `users` в `/api/users/stats` для получения онлайн статуса

#### `GET /api/live/series`
**Модуль:** Live  
**Что делает:** Получает временные ряды для графиков (трафик, подключения по времени)  
**Параметры:** `?metric=traffic|conns&period=3600&granularity=60&scope=global|user`  
**Использует:** `live.services.live_service.get_live_series()`  
**Данные:** access.log (парсится за указанный период)  
**Ответ:** `{"series": [{"time": "...", "value": ...}, ...]}`

#### `GET /api/live/top`
**Модуль:** Live  
**Что делает:** Получает топ пользователей/метрик за период  
**Параметры:** `?metric=traffic|conns&period=3600&scope=global|user`  
**Использует:** `live.services.live_service.get_live_top()`  
**Данные:** access.log (парсится за указанный период)  
**Ответ:** `{"top": [{"user": "...", "value": ...}, ...]}`

---

### Модуль Events (2 метода)

#### `GET /api/events`
**Модуль:** Events  
**Что делает:** Получает список событий с фильтрацией  
**Параметры:** `?limit=100&hours=24&type=TYPE&severity=SEVERITY&service=SERVICE`  
**Использует:** `events.repositories.events_repository.read_events()`  
**Данные:** `events.jsonl` файл (JSON Lines формат)  
**Ответ:** `{"events": [...], "total": 100}`

**Особенность:** Функция `append_event()` из этого модуля используется в других модулях (users, settings) для логирования событий

#### `GET /api/events/stats`
**Модуль:** Events  
**Что делает:** Получает статистику событий (по типам, severity, сервисам)  
**Использует:** `events.repositories.events_repository.read_events()`  
**Данные:** `events.jsonl` файл  
**Ответ:** `{"stats": {"by_type": {...}, "by_severity": {...}, "by_service": {...}}}`

---

### Модуль Header (4 метода)

#### `GET /api/system/status`
**Модуль:** Header  
**Что делает:** Получает статус сервисов (UI, Xray, Next.js)  
**Использует:**
- `backend.core.system.systemctl_is_active()` - проверка статуса
- `backend.core.system.check_nextjs_status()` - проверка Next.js

**Данные:** systemctl status команд  
**Ответ:** `{"ui": {"active": true, "state": "active"}, "xray": {...}, "nextjs": {...}}`

#### `GET /api/system/resources`
**Модуль:** Header  
**Что делает:** Получает системные ресурсы (CPU, RAM, Disk)  
**Использует:** `psutil` (прямо в endpoint, без сервиса)  
**Данные:** Системные метрики через psutil  
**Ответ:** `{"cpu": {...}, "memory": {...}, "disk": {...}}`

#### `GET /api/ports/status`
**Модуль:** Header  
**Что делает:** Проверяет статус портов (3000, 8787, 443)  
**Использует:** `socket` (прямо в endpoint, без сервиса)  
**Данные:** Проверка подключения к портам  
**Ответ:** `{"ports": [{"port": 3000, "status": "running"}, ...]}`

#### `POST /api/system/restart`
**Модуль:** Header  
**Что делает:** Перезапускает сервис (UI, Xray, Next.js)  
**Body:** `{"target": "ui|xray|nextjs"}`  
**Использует:** `backend.core.system.systemctl_restart()`  
**Данные:** systemctl restart команда  
**Ответ:** `{"ok": true, "message": "restarted", "service": "xray"}`

---

### Модуль Settings (8 методов)

#### Общие настройки

##### `GET /api/settings`
**Модуль:** Settings  
**Что делает:** Получает все настройки системы  
**Использует:** `backend.core.config.load_settings()`  
**Данные:** `settings.json` файл  
**Ответ:** `{"settings": {"ui": {...}, "xray": {...}, "collector": {...}}}`

##### `POST /api/settings`
**Модуль:** Settings  
**Что делает:** Обновляет настройки системы  
**Body:** `{"ui": {...}, "xray": {...}, "collector": {...}}`  
**Использует:** `backend.core.config.save_settings()`  
**Данные:** Сохраняет в `settings.json` файл  
**Ответ:** `{"settings": {...}}`

#### Подсервис Xray

##### `GET /api/xray/config`
**Модуль:** Settings → Xray  
**Что делает:** Получает конфигурацию Xray  
**Использует:** `backend.core.xray.load_xray_config()`  
**Данные:** Xray config файл (`/usr/local/etc/xray/config.json`)  
**Ответ:** `{"config": {...}}`

##### `POST /api/xray/restart`
**Модуль:** Settings → Xray  
**Что делает:** Перезапускает Xray сервис  
**Использует:** `backend.core.system.systemctl_restart()`  
**Данные:** systemctl restart команда  
**Ответ:** `{"ok": true, "message": "restarted"}`

##### `GET /api/xray/reality`
**Модуль:** Settings → Xray  
**Что делает:** Получает Reality параметры (для генерации VLESS ссылок)  
**Использует:** `settings.services.xray_service.get_reality_params()`  
**Данные:** Xray config (извлекает Reality параметры из inbound)  
**Ответ:** `{"ok": true, "port": 443, "pbk": "...", "sni": "...", ...}`

#### Подсервис Collector

##### `GET /api/collector/status`
**Модуль:** Settings → Collector  
**Что делает:** Получает статус коллектора статистики  
**Использует:** `settings.services.collector_service.get_collector_status()`  
**Данные:** Проверяет cron задачу и последнюю дату сбора  
**Ответ:** `{"status": {"enabled": true, "lag_days": 0, "newest_date": "2025-01-20"}}`

##### `POST /api/collector/toggle`
**Модуль:** Settings → Collector  
**Что делает:** Включает/выключает коллектор (добавляет/удаляет cron задачу)  
**Body:** `{"enabled": true, "script": "xray_daily_usage.sh"}`  
**Использует:**
- `settings.services.collector_service.toggle_collector()` - управление cron
- `events.repositories.events_repository.append_event()` - логирование

**Данные:** Управляет cron задачей  
**Ответ:** `{"ok": true, "enabled": true}`

##### `POST /api/collector/run`
**Модуль:** Settings → Collector  
**Что делает:** Запускает сбор статистики вручную  
**Body:** `{"include_today": false}`  
**Использует:**
- `settings.services.collector_service.run_collector()` - запуск скрипта
- `events.repositories.events_repository.append_event()` - логирование

**Данные:** Запускает скрипт `/usr/local/bin/xray_daily_usage.sh`  
**Ответ:** `{"ok": true, "message": "collector_run"}`

#### Подсервис Backups

##### `GET /api/backups`
**Модуль:** Settings → Backups  
**Что делает:** Получает список всех бэкапов  
**Использует:** `settings.services.backup_service.list_backups()`  
**Данные:** Сканирует папку `/opt/xray-report-ui/data/backups/`  
**Ответ:** `{"backups": [{"name": "...", "size": ..., "mtime": "..."}, ...]}`

##### `GET /api/backups/<filename>/preview`
**Модуль:** Settings → Backups  
**Что делает:** Получает превью бэкапа (сколько пользователей, портов и т.д.)  
**Использует:** `settings.services.backup_service.get_backup_preview()`  
**Данные:** Читает бэкап файл, парсит JSON  
**Ответ:** `{"preview": {"users_count": 10, "ports": [443], "protocols": ["vless"]}}`

##### `POST /api/backups/<filename>/restore`
**Модуль:** Settings → Backups  
**Что делает:** Восстанавливает конфигурацию из бэкапа  
**Body:** `{"confirm": true, "restart_xray": true}`  
**Использует:**
- `settings.services.backup_service.restore_backup()` - восстановление
- `backend.core.xray.save_xray_config()` - сохранение config
- `backend.core.system.systemctl_restart()` - перезапуск Xray

**Данные:** Восстанавливает Xray config из бэкапа  
**Ответ:** `{"ok": true, "restored": true}`

##### `DELETE /api/backups/<filename>`
**Модуль:** Settings → Backups  
**Что делает:** Удаляет файл бэкапа  
**Использует:** Прямое удаление файла (без сервиса)  
**Данные:** Удаляет файл из `/opt/xray-report-ui/data/backups/`  
**Ответ:** `{"ok": true, "message": "backup_deleted"}`

#### Подсервис Tests

##### `GET /api/tests/run`
**Модуль:** Settings → Tests  
**Что делает:** Запускает pytest тесты и возвращает результаты  
**Параметры:** `?path=test_file.py&verbose=true`  
**Использует:** `subprocess.run()` для запуска pytest  
**Данные:** Запускает `pytest` в папке `backend/tests/`  
**Ответ:** `{"success": true, "summary": {"passed": 10, "failed": 0}, "tests": [...]}`

##### `GET /api/tests/list`
**Модуль:** Settings → Tests  
**Что делает:** Получает список доступных тестовых файлов  
**Использует:** `glob.glob()` для поиска `test_*.py` файлов  
**Данные:** Сканирует папку `backend/tests/`  
**Ответ:** `{"test_files": [{"name": "test_users.py", "path": "test_users.py"}, ...]}`

##### `GET /api/tests/status`
**Модуль:** Settings → Tests  
**Что делает:** Проверяет статус тестового окружения (есть ли pytest, есть ли тесты)  
**Использует:** Проверка импорта pytest и наличия файлов  
**Данные:** Проверка окружения  
**Ответ:** `{"pytest_available": true, "tests_directory_exists": true, "test_files_count": 7}`

---

## Пересечения между модулями

### ❌ API endpoints НЕ пересекаются

**Каждый endpoint привязан к одному модулю:**
- `/api/users/*` → только модуль Users
- `/api/live/*` → только модуль Live
- `/api/events/*` → только модуль Events
- и т.д.

**НО функции из модулей используются в других модулях:**

### Использование общих компонентов

#### 1. `shared/xray_repository` используется в:
- ✅ Модуль Overview: `/api/usage/dashboard` (список пользователей)
- ✅ Модуль Users: все endpoints (работа с пользователями)
- ✅ Модуль Settings: `/api/xray/config` (работа с Xray config)

#### 2. `shared/system_service` используется в:
- ✅ Модуль Header: `/api/system/status`, `/api/system/restart` (системные операции)
- ✅ Модуль Settings: `/api/xray/restart` (перезапуск Xray)
- ✅ Модуль Users: `/api/users/add`, `/api/users/delete`, `/api/users/kick` (перезапуск Xray)

#### 3. `events_repository.append_event()` используется в:
- ✅ Модуль Events: `/api/events` (свой модуль)
- ✅ Модуль Users: `/api/users/add`, `/api/users/delete`, `/api/users/kick` (логирование событий)
- ✅ Модуль Settings: `/api/collector/toggle`, `/api/collector/run` (логирование событий)

#### 4. `live_service.get_live_now()` используется в:
- ✅ Модуль Live: `/api/live/now` (свой модуль)
- ✅ Модуль Users: `/api/users/stats` (получение онлайн статуса)

### Детальная таблица пересечений

| Функция/Компонент | Используется в модулях | Тип использования |
|-------------------|------------------------|-------------------|
| `api/common.ok()` | Все модули | Общая функция ответа |
| `api/common.fail()` | Все модули | Общая функция ошибки |
| `api/common.validate_email()` | Users | Валидация email |
| `api/common.validate_uuid()` | Users | Валидация UUID |
| `api/common.validate_filename()` | Backups | Валидация имени файла |
| `backend.core.xray.get_xray_clients()` | Overview, Users | Получение списка пользователей |
| `backend.core.xray.load_xray_config()` | Settings (Xray) | Загрузка Xray config |
| `backend.core.xray.save_xray_config()` | Users, Settings (Backups) | Сохранение Xray config |
| `backend.core.system.systemctl_restart()` | Header, Settings (Xray), Users, Settings (Backups) | Перезапуск сервисов |
| `backend.core.system.systemctl_is_active()` | Header | Проверка статуса сервисов |
| `events_repository.append_event()` | Users (add/delete/kick), Settings (collector) | Логирование событий |
| `live_service.get_live_now()` | Live (свой модуль), Users (stats) | Получение онлайн статуса |

### Анализ: Правильно ли это?

#### ✅ Правильно:

1. **API endpoints изолированы** - каждый endpoint привязан к одному модулю
2. **Общие компоненты в `backend/core/`** - правильно вынесены для переиспользования
3. **Функции из модулей используются через services/repositories** - это нормальная архитектура

#### ⚠️ Потенциальные улучшения:

1. **`users/stats` использует `live_service.get_live_now()`** - это нормально, но можно было бы сделать через API endpoint `/api/live/now` (но это добавит HTTP overhead)

2. **`users/stats` использует старый `dashboard_service`** - временная зависимость, нужно рефакторить

3. **`events_repository.append_event()` используется напрямую** - можно было бы через API endpoint, но это добавит overhead

### Вывод

**Структура правильная:**
- ✅ Каждый API endpoint привязан к одному модулю
- ✅ Модули изолированы по endpoints
- ✅ Общие компоненты используются через services/repositories (это правильно)
- ✅ Нет прямых вызовов endpoints между модулями

**Пересечения есть, но они правильные:**
- Общие утилиты (`backend/core/api`)
- Общие репозитории (`backend/core/xray`)
- Общие сервисы (`backend/core/system`)
- Функции из модулей используются в других модулях (но не endpoints)

Это нормальная архитектура: модули изолированы по API, но используют общие компоненты для работы с данными.

---

## Группировка по функциональности

### Чтение данных (GET):
- **Overview:** дашборд, даты, данные по дате
- **Users:** список, ссылка, статистика
- **Live:** текущее состояние, временные ряды, топ
- **Events:** список событий, статистика
- **Header:** статусы, ресурсы, порты
- **Settings:** настройки, конфиги, статусы

### Изменение данных (POST):
- **Users:** добавить, удалить, обновить, отключить
- **Settings:** обновить настройки, перезапустить, включить/выключить, восстановить

### Удаление данных (DELETE):
- **Settings:** удалить бэкап

---

## Связи между модулями

```
Overview ──┐
           ├──→ backend/core/xray (список пользователей)
Users ─────┤
           │
Settings ──┘

Header ────┐
           ├──→ backend/core/system (системные операции)
Settings ──┘

Events ────┐
           ├──→ events_repository (append_event - логирование)
Users ─────┤
Settings ──┘

Users ─────→ live_service (онлайн статус в /api/users/stats)
```

---

## Итоговая схема использования

```
Модуль Overview:
  /api/usage/dashboard → использует backend/core/xray
  /api/usage/dates → свой модуль
  /api/usage/dashboard/<date> → свой модуль

Модуль Users:
  /api/users → использует backend/core/xray
  /api/users/add → использует backend/core/xray + events_repository + system_service
  /api/users/delete → использует backend/core/xray + events_repository + system_service
  /api/users/kick → использует backend/core/xray + events_repository + system_service
  /api/users/update-alias → использует backend/core/xray + system_service
  /api/users/link → использует settings/xray_service
  /api/users/stats → использует live_service.get_live_now() + dashboard_service

Модуль Live:
  /api/live/now → свой модуль (НО используется в users/stats)
  /api/live/series → свой модуль
  /api/live/top → свой модуль

Модуль Events:
  /api/events → свой модуль
  /api/events/stats → свой модуль
  append_event() → используется в users и settings модулях

Модуль Header:
  /api/system/status → использует backend/core/system
  /api/system/resources → свой модуль (psutil)
  /api/ports/status → свой модуль (socket)
  /api/system/restart → использует backend/core/system

Модуль Settings:
  /api/settings → свой модуль (backend/core/config)
  /api/xray/config → использует backend/core/xray
  /api/xray/restart → использует backend/core/system
  /api/xray/reality → использует settings/xray_service
  /api/collector/* → использует events_repository (логирование)
  /api/backups/* → использует backend/core/xray + system_service
  /api/tests/* → свой модуль (subprocess)
```
