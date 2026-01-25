# Settings Feature - Подсервисы

Settings модуль состоит из нескольких подсервисов. Общий обзор см. в [settings.md](../settings.md).

## Подсервисы

- **[Xray](xray.md)** - Управление конфигурацией и сервисом Xray
- **[Collector](collector.md)** - Управление сборщиком статистики
- **[Backups](backups.md)** - Управление бэкапами конфигурации
- **[Ports](ports.md)** - Мониторинг портов
- **[System](system.md)** - Системная информация и ресурсы
- **[Tests](tests.md)** - Запуск и управление тестами

## Общая информация

Все подсервисы используют общий API endpoint `/api/settings` для общих настроек и имеют свои специфичные endpoints:
- `/api/xray/*` - Xray подсервис
- `/api/collector/*` - Collector подсервис
- `/api/backups/*` - Backups подсервис
- `/api/tests/*` - Tests подсервис

Ports и System используют endpoints из Header модуля:
- `/api/ports/*` - Ports
- `/api/system/*` - System
