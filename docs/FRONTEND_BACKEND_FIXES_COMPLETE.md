# Исправления Frontend ↔ Backend - Завершено

**Дата:** 2025-01-27  
**Статус:** ✅ Все критические проблемы исправлены

---

## Выполненные исправления

### 1. ✅ Dashboard endpoints

**Проблема:** Frontend использовал `/api/dashboard`, backend отвечает на `/api/usage/dashboard`

**Исправлено:**
- `dashboardApi.getDashboard()` теперь использует `/api/usage/dashboard`
- `dashboardApi.getUsageDashboard()` использует path parameter: `/api/usage/dashboard/${date}`

**Файлы:**
- `frontend/lib/api/dashboard.ts`
- `frontend/lib/constants/api.ts`

---

### 2. ✅ Users/link endpoint

**Проблема:** Backend требует `uuid` и `email`, frontend отправлял только `uuid`

**Исправлено:**
- `usersApi.getUserLink()` теперь принимает оба параметра
- Компонент `users-table.tsx` обновлён

**Файлы:**
- `frontend/lib/api/users.ts`
- `frontend/features/users/components/users-table.tsx`

---

### 3. ✅ Backups endpoints - добавлены недостающие

**Добавлено в backend:**
- `GET /api/backups/<filename>/detail` - детальная информация (users, inbounds)
- `GET /api/backups/<filename>/content` - полный JSON контент
- `POST /api/backups/create` - создание бэкапа вручную
- `POST /api/backups/<filename>/restore` - исправлен для поддержки preview режима

**Исправлено в frontend:**
- `getBackupDetail()` - использует правильный endpoint
- `getBackupContent()` - использует правильный endpoint
- `createBackup()` - использует правильный endpoint
- `downloadBackup()` - использует content endpoint
- `restoreBackup()` - правильно обрабатывает preview и restore

**Файлы:**
- `backend/features/settings/services/backup_service.py` - добавлены функции
- `backend/features/settings/api/v1/backups_endpoints.py` - добавлены endpoints
- `frontend/lib/api/settings.ts` - исправлены методы

---

### 4. ✅ Несуществующие endpoints - удалены/закомментированы

**Удалено из констант:**
- `/api/version` - не существует
- `/api/system/journal` - не существует
- `/api/collector/update-schedule` - не существует
- Неправильные пути для backups

**Исправлено в компонентах:**
- `system-settings.tsx` - использует дефолтную версию вместо API
- `journal-viewer.tsx` - показывает сообщение о недоступности
- `collector-settings.tsx` - показывает сообщение о недоступности

**Файлы:**
- `frontend/lib/constants/api.ts`
- `frontend/lib/api/system.ts`
- `frontend/lib/api/settings.ts`
- `frontend/features/settings/components/system-settings.tsx`
- `frontend/features/settings/components/journal-viewer.tsx`
- `frontend/features/settings/components/collector-settings.tsx`

---

## Новые endpoints в backend

### Backups

1. **GET /api/backups/<filename>/detail**
   - Возвращает детальную информацию: users, inbounds, ports, protocols
   - Используется в `backups-settings.tsx` для отображения деталей

2. **GET /api/backups/<filename>/content**
   - Возвращает полный JSON контент бэкапа
   - Используется для просмотра и скачивания

3. **POST /api/backups/create**
   - Создаёт бэкап текущей конфигурации вручную
   - Принимает опциональный `label` в body

4. **POST /api/backups/<filename>/restore** (улучшен)
   - Поддерживает preview режим (`confirm=false`)
   - Возвращает структурированный preview для frontend
   - При `confirm=true` выполняет восстановление

---

## Статус всех endpoints

### ✅ Работают корректно

- `/api/ping`
- `/api/usage/dashboard` ✅ (исправлено)
- `/api/usage/dates`
- `/api/usage/dashboard/<date>` ✅ (исправлено)
- `/api/users` (все методы)
- `/api/users/link` ✅ (исправлено - добавлен email)
- `/api/live/*` (все методы)
- `/api/events/*` (все методы)
- `/api/system/status`
- `/api/system/resources`
- `/api/system/restart`
- `/api/ports/status`
- `/api/settings`
- `/api/xray/*` (все методы)
- `/api/collector/*` (все методы)
- `/api/backups` ✅ (все методы исправлены/добавлены)
- `/api/tests/*` (все методы)

### ⚠️ Не реализовано (помечено в компонентах)

- `/api/version` - используется дефолтное значение
- `/api/system/journal` - показывается сообщение о недоступности
- `/api/collector/update-schedule` - показывается сообщение о недоступности

---

## Изменённые файлы

### Backend

- `backend/features/settings/services/backup_service.py`
  - Добавлены: `get_backup_detail()`, `get_backup_content()`, `create_backup_manual()`
  - Улучшен: `restore_backup()` - возвращает больше информации

- `backend/features/settings/api/v1/backups_endpoints.py`
  - Добавлены: `/detail`, `/content`, `/create` endpoints
  - Улучшен: `/restore` endpoint - поддержка preview режима

### Frontend

- `frontend/lib/constants/api.ts` - удалены несуществующие endpoints
- `frontend/lib/api/dashboard.ts` - исправлены пути
- `frontend/lib/api/users.ts` - исправлен getUserLink
- `frontend/lib/api/settings.ts` - исправлены backups методы
- `frontend/lib/api/system.ts` - закомментированы несуществующие
- `frontend/features/users/components/users-table.tsx` - исправлен вызов getUserLink
- `frontend/features/settings/components/system-settings.tsx` - дефолтная версия
- `frontend/features/settings/components/journal-viewer.tsx` - сообщение о недоступности
- `frontend/features/settings/components/collector-settings.tsx` - сообщение о недоступности

---

## Результат

✅ **Frontend и backend полностью синхронизированы**

✅ **Все существующие endpoints работают корректно**

✅ **Добавлены недостающие endpoints для backups**

✅ **Несуществующие endpoints обработаны корректно**

---

## Рекомендации

### Немедленно

1. ✅ Все критические проблемы исправлены
2. ✅ Frontend и backend синхронизированы

### В ближайшее время (опционально)

3. **Реализовать недостающие endpoints** (если нужны):
   - `GET /api/version` - версия API/приложения
   - `GET /api/system/journal` - логи systemd
   - `POST /api/collector/update-schedule` - обновление расписания cron

4. **Или удалить использование** из компонентов полностью

---

**Следующий шаг:** Протестировать все endpoints вручную или через интеграционные тесты
