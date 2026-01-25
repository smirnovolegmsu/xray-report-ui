# Синхронизация Frontend ↔ Backend - Завершено

**Дата:** 2025-01-27  
**Статус:** ✅ Критические проблемы исправлены

---

## Исправленные проблемы

### 1. ✅ Dashboard endpoint

**Было:**
- Frontend: `GET /api/dashboard` ❌
- Backend: `GET /api/usage/dashboard` ✅

**Исправлено:**
- Frontend теперь использует `/api/usage/dashboard`
- `dashboardApi.getDashboard()` исправлен

**Файлы:**
- `frontend/lib/api/dashboard.ts`
- `frontend/lib/constants/api.ts`

---

### 2. ✅ Usage Dashboard с датой

**Было:**
- Frontend: `GET /api/usage/dashboard?date=...` (query) ❌
- Backend: `GET /api/usage/dashboard/<date>` (path) ✅

**Исправлено:**
- Frontend теперь использует path parameter: `/api/usage/dashboard/${date}`
- `dashboardApi.getUsageDashboard()` исправлен

**Файлы:**
- `frontend/lib/api/dashboard.ts`

---

### 3. ✅ Users/link endpoint

**Было:**
- Frontend отправлял только `uuid` ❌
- Backend требует `uuid` и `email` ✅

**Исправлено:**
- `usersApi.getUserLink()` теперь принимает оба параметра
- Компонент `users-table.tsx` обновлён для передачи email

**Файлы:**
- `frontend/lib/api/users.ts`
- `frontend/features/users/components/users-table.tsx`

---

### 4. ✅ Backups endpoints

**Исправлено:**
- `getBackupPreview()` - использует правильный путь: `/api/backups/<filename>/preview`
- `restoreBackup()` - использует правильный путь: `/api/backups/<filename>/restore`
- `deleteBackup()` - использует DELETE метод: `DELETE /api/backups/<filename>`

**Не реализовано в backend (помечено как TODO):**
- `getBackupDetail()` - использует preview как fallback
- `getBackupContent()` - не реализовано
- `downloadBackup()` - не реализовано
- `createBackup()` - не реализовано

**Файлы:**
- `frontend/lib/api/settings.ts`
- `frontend/lib/constants/api.ts`

---

### 5. ✅ Удалены несуществующие endpoints из констант

**Удалено/закомментировано:**
- `/api/version` - не существует
- `/api/system/journal` - не существует
- `/api/collector/update-schedule` - не существует
- Неправильные пути для backups (preview, detail, view, download, create, restore, delete)

**Файлы:**
- `frontend/lib/constants/api.ts`
- `frontend/lib/api/system.ts`
- `frontend/lib/api/settings.ts`

---

## Статус endpoints

### ✅ Работают корректно

- `/api/ping`
- `/api/usage/dashboard`
- `/api/usage/dates`
- `/api/usage/dashboard/<date>`
- `/api/users` (все методы)
- `/api/live/*` (все методы)
- `/api/events/*` (все методы)
- `/api/system/status`
- `/api/system/resources`
- `/api/system/restart`
- `/api/ports/status`
- `/api/settings`
- `/api/xray/config`
- `/api/xray/restart`
- `/api/xray/reality`
- `/api/collector/status`
- `/api/collector/toggle`
- `/api/collector/run`
- `/api/backups` (list)
- `/api/backups/<filename>/preview`
- `/api/backups/<filename>/restore`
- `/api/backups/<filename>` (DELETE)
- `/api/tests/*` (все методы)

### ⚠️ Не реализовано в backend (помечено как TODO)

- `getBackupDetail()` - используется preview
- `getBackupContent()` - не работает
- `downloadBackup()` - не работает
- `createBackup()` - не работает
- `getVersion()` - закомментировано
- `getJournal()` - закомментировано
- `updateCronSchedule()` - закомментировано

---

## Рекомендации

### Немедленно

1. ✅ Критические несоответствия исправлены
2. ✅ Frontend и backend синхронизированы для существующих endpoints

### В ближайшее время

3. **Реализовать недостающие endpoints в backend** (если нужны):
   - `POST /api/backups` - создание бэкапа
   - `GET /api/backups/<filename>/content` - полный контент
   - `GET /api/backups/<filename>/download` - скачивание файла
   - `GET /api/version` - версия API
   - `GET /api/system/journal` - логи systemd

4. **Или удалить использование** из frontend компонентов:
   - `backups-settings.tsx` - удалить вызовы несуществующих методов
   - `system-settings.tsx` - удалить вызов getVersion
   - `journal-viewer.tsx` - удалить или реализовать endpoint
   - `collector-settings.tsx` - удалить вызов updateCronSchedule

---

## Изменённые файлы

### Frontend

- `frontend/lib/constants/api.ts` - обновлены константы
- `frontend/lib/api/dashboard.ts` - исправлены endpoints
- `frontend/lib/api/users.ts` - исправлен getUserLink
- `frontend/lib/api/settings.ts` - исправлены backups endpoints
- `frontend/lib/api/system.ts` - закомментированы несуществующие
- `frontend/features/users/components/users-table.tsx` - исправлен вызов getUserLink

---

## Результат

✅ **Frontend и backend синхронизированы** для всех существующих endpoints

✅ **Критические несоответствия исправлены** - dashboard, users/link, backups

⚠️ **Несуществующие endpoints помечены** - можно реализовать или удалить использование

---

**Следующий шаг:** Реализовать недостающие endpoints в backend или удалить их использование из frontend
