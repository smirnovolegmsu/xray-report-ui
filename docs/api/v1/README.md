# API v1.0 - Стабильные методы

## Статус

✅ **Production ready** - все методы стабильны и используются в production

## Статистика

- **Всего методов:** 28
- **Модулей:** 6 + общие
- **HTTP методов:** GET (20), POST (7), DELETE (1)

## Модули и методы

### Общие (1 метод)
- `GET /api/ping` - Health check

### Overview (3 метода)
- `GET /api/usage/dashboard` - Данные дашборда
- `GET /api/usage/dates` - Список доступных дат
- `GET /api/usage/dashboard/<date>` - Данные по конкретной дате

**Документация:** [overview.md](overview.md)

### Users (7 методов)
- `GET /api/users` - Список пользователей
- `POST /api/users/add` - Добавить пользователя
- `POST /api/users/delete` - Удалить пользователя
- `POST /api/users/kick` - Регенерировать UUID (отключить)
- `POST /api/users/update-alias` - Обновить алиас
- `GET /api/users/link` - Получить VLESS ссылку
- `GET /api/users/stats` - Статистика пользователей

**Документация:** [users.md](users.md)

### Live (3 метода)
- `GET /api/live/now` - Текущее состояние (rolling 5 minutes)
- `GET /api/live/series` - Временные ряды для графиков
- `GET /api/live/top` - Топ пользователей/метрик

**Документация:** [live.md](live.md)

### Events (2 метода)
- `GET /api/events` - Список событий с фильтрацией
- `GET /api/events/stats` - Статистика событий

**Документация:** [events.md](events.md)

### Header (4 метода)
- `GET /api/system/status` - Статус сервисов
- `GET /api/system/resources` - CPU, RAM, Disk
- `GET /api/ports/status` - Статус портов
- `POST /api/system/restart` - Перезапустить сервис

**Документация:** [header.md](header.md)

### Settings (8 методов)

#### Общие настройки (2)
- `GET /api/settings` - Получить настройки
- `POST /api/settings` - Обновить настройки

#### Xray (3)
- `GET /api/xray/config` - Конфигурация Xray
- `POST /api/xray/restart` - Перезапустить Xray
- `GET /api/xray/reality` - Reality параметры

#### Collector (3)
- `GET /api/collector/status` - Статус коллектора
- `POST /api/collector/toggle` - Включить/выключить
- `POST /api/collector/run` - Запустить вручную

#### Backups (4)
- `GET /api/backups` - Список бэкапов
- `GET /api/backups/<file>/preview` - Превью бэкапа
- `POST /api/backups/<file>/restore` - Восстановить
- `DELETE /api/backups/<file>` - Удалить бэкап

#### Tests (3)
- `GET /api/tests/run` - Запустить тесты
- `GET /api/tests/list` - Список тестов
- `GET /api/tests/status` - Статус тестового окружения

**Документация:** [settings.md](settings.md)

## Группировка по HTTP методам

### GET (20 методов)
Чтение данных: дашборды, списки, статистика, статусы

### POST (7 методов)
Изменение данных: добавление, удаление, обновление, перезапуск

### DELETE (1 метод)
Удаление: удаление бэкапов

## Использование общих компонентов

Модули используют общие компоненты через services/repositories:

- `shared/xray_repository` - работа с Xray config (Overview, Users, Settings)
- `shared/system_service` - системные операции (Header, Settings, Users)
- `events_repository.append_event()` - логирование событий (Users, Settings)
- `live_service.get_live_now()` - онлайн статус (Users)

Подробнее см. [REFERENCE.md](../REFERENCE.md)

## Документация

Каждый модуль имеет отдельный файл с примерами запросов/ответов:
- [overview.md](overview.md)
- [users.md](users.md)
- [live.md](live.md)
- [events.md](events.md)
- [header.md](header.md)
- [settings.md](settings.md)

Для детальной информации о реализации см. [REFERENCE.md](../REFERENCE.md)
