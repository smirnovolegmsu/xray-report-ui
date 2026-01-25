# Анализ несоответствий Frontend ↔ Backend

**Дата:** 2025-01-27  
**Статус:** 🔍 Обнаружены проблемы

---

## Критические несоответствия

### 1. ❌ Dashboard endpoint не совпадает

**Backend:**
- `GET /api/usage/dashboard` ✅

**Frontend:**
- `API_ENDPOINTS.DASHBOARD = '/dashboard'` ❌ (неправильно!)
- Используется в `dashboardApi.getDashboard()`

**Проблема:** Frontend вызывает `/api/dashboard`, но backend отвечает на `/api/usage/dashboard`

---

### 2. ❌ Usage Dashboard endpoint не совпадает

**Backend:**
- `GET /api/usage/dashboard/<date_str>` ✅ (path parameter)

**Frontend:**
- `API_ENDPOINTS.USAGE_DASHBOARD = '/usage/dashboard'` 
- Используется как query parameter: `?date=...` ❌

**Проблема:** Backend ожидает date в path (`/api/usage/dashboard/2025-01-27`), frontend отправляет в query (`/api/usage/dashboard?date=2025-01-27`)

---

### 3. ❌ Users endpoints - несоответствие параметров

**Backend ожидает:**
- `POST /api/users/add` - `{email: string}` ✅
- `POST /api/users/delete` - `{email: string}` ✅
- `POST /api/users/kick` - `{email: string}` ✅
- `POST /api/users/update-alias` - `{email: string, alias: string}` ✅
- `GET /api/users/link` - query: `uuid` и `email` (оба обязательны!) ⚠️

**Frontend отправляет:**
- `usersApi.addUser(email)` ✅
- `usersApi.deleteUser(email)` ✅
- `usersApi.kickUser(email)` ✅
- `usersApi.updateUserAlias(email, alias)` ✅
- `usersApi.getUserLink(uuid)` - только uuid, нет email! ❌

**Проблема:** `/api/users/link` требует оба параметра (uuid и email), но frontend отправляет только uuid

---

### 4. ❌ Backups endpoints - много несуществующих

**Backend имеет:**
- `GET /api/backups` ✅
- `GET /api/backups/<filename>/preview` ✅
- `POST /api/backups/<filename>/restore` ✅
- `DELETE /api/backups/<filename>` ✅

**Frontend пытается использовать:**
- `BACKUPS_PREVIEW = '/backups/preview'` ❌ (нет filename в path)
- `BACKUPS_DETAIL = '/backups/detail'` ❌ (не существует)
- `BACKUPS_VIEW = '/backups/view'` ❌ (не существует)
- `BACKUPS_DOWNLOAD = '/backups/download'` ❌ (не существует)
- `BACKUPS_CREATE = '/backups/create'` ❌ (не существует)
- `BACKUPS_RESTORE = '/backups/restore'` ❌ (нет filename в path)
- `BACKUPS_DELETE = '/backups/delete'` ❌ (использует POST вместо DELETE)

**Проблема:** Frontend определяет endpoints, которых нет в backend, или с неправильными путями

---

### 5. ❌ Collector endpoints

**Backend имеет:**
- `GET /api/collector/status` ✅
- `POST /api/collector/toggle` ✅
- `POST /api/collector/run` ✅

**Frontend пытается использовать:**
- `COLLECTOR_UPDATE_SCHEDULE = '/collector/update-schedule'` ❌ (не существует)

---

### 6. ❌ System endpoints

**Backend имеет:**
- `GET /api/system/status` ✅
- `GET /api/system/resources` ✅
- `POST /api/system/restart` ✅ (query: `target`)

**Frontend пытается использовать:**
- `SYSTEM_JOURNAL = '/system/journal'` ❌ (не существует)
- `VERSION = '/version'` ❌ (не существует)

**Проблема:** Frontend вызывает несуществующие endpoints

---

### 7. ❌ Tests endpoints - несоответствие методов

**Backend имеет:**
- `GET /api/tests/run` ✅ (GET, не POST!)
- `GET /api/tests/list` ✅
- `GET /api/tests/status` ✅
- `GET /api/tests/history` ✅
- `GET /api/tests/history/stats` ✅

**Frontend:**
- Использует правильно ✅

---

## Сводная таблица endpoints

| Endpoint | Backend | Frontend | Статус |
|----------|---------|----------|--------|
| `/api/ping` | ✅ GET | ✅ GET | ✅ OK |
| `/api/dashboard` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/usage/dashboard` | ✅ GET | ❌ | ❌ Frontend использует `/dashboard` |
| `/api/usage/dates` | ✅ GET | ✅ GET | ✅ OK |
| `/api/usage/dashboard/<date>` | ✅ GET | ❌ | ❌ Frontend использует query вместо path |
| `/api/users` | ✅ GET | ✅ GET | ✅ OK |
| `/api/users/add` | ✅ POST | ✅ POST | ✅ OK |
| `/api/users/delete` | ✅ POST | ✅ POST | ✅ OK |
| `/api/users/kick` | ✅ POST | ✅ POST | ✅ OK |
| `/api/users/update-alias` | ✅ POST | ✅ POST | ✅ OK |
| `/api/users/link` | ✅ GET (uuid+email) | ❌ GET (uuid) | ❌ Не хватает email |
| `/api/users/stats` | ✅ GET | ✅ GET | ✅ OK |
| `/api/live/now` | ✅ GET | ✅ GET | ✅ OK |
| `/api/live/series` | ✅ GET | ✅ GET | ✅ OK |
| `/api/live/top` | ✅ GET | ✅ GET | ✅ OK |
| `/api/events` | ✅ GET | ✅ GET | ✅ OK |
| `/api/events/stats` | ✅ GET | ✅ GET | ✅ OK |
| `/api/system/status` | ✅ GET | ✅ GET | ✅ OK |
| `/api/system/resources` | ✅ GET | ✅ GET | ✅ OK |
| `/api/system/restart` | ✅ POST | ✅ POST | ✅ OK |
| `/api/ports/status` | ✅ GET | ✅ GET | ✅ OK |
| `/api/settings` | ✅ GET/POST | ✅ GET/POST | ✅ OK |
| `/api/xray/config` | ✅ GET | ✅ GET | ✅ OK |
| `/api/xray/restart` | ✅ POST | ✅ POST | ✅ OK |
| `/api/xray/reality` | ✅ GET | ❌ | ⚠️ Не используется |
| `/api/collector/status` | ✅ GET | ✅ GET | ✅ OK |
| `/api/collector/toggle` | ✅ POST | ✅ POST | ✅ OK |
| `/api/collector/run` | ✅ POST | ✅ POST | ✅ OK |
| `/api/backups` | ✅ GET | ✅ GET | ✅ OK |
| `/api/backups/<filename>/preview` | ✅ GET | ❌ | ❌ Неправильный путь |
| `/api/backups/<filename>/restore` | ✅ POST | ❌ | ❌ Неправильный путь |
| `/api/backups/<filename>` | ✅ DELETE | ❌ | ❌ Использует POST |
| `/api/tests/run` | ✅ GET | ✅ GET | ✅ OK |
| `/api/tests/list` | ✅ GET | ✅ GET | ✅ OK |
| `/api/tests/status` | ✅ GET | ✅ GET | ✅ OK |
| `/api/tests/history` | ✅ GET | ✅ GET | ✅ OK |
| `/api/tests/history/stats` | ✅ GET | ✅ GET | ✅ OK |
| `/api/version` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/system/journal` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/backups/preview` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/backups/detail` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/backups/view` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/backups/download` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/backups/create` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/backups/restore` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/backups/delete` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |
| `/api/collector/update-schedule` | ❌ | ✅ | ❌ НЕ СУЩЕСТВУЕТ |

---

## План исправлений

### Приоритет 1 (Критично - ломает функционал)

1. **Исправить dashboard endpoint**
   - Изменить `API_ENDPOINTS.DASHBOARD` на `/usage/dashboard`
   - Или создать endpoint `/api/dashboard` в backend

2. **Исправить usage dashboard с датой**
   - Изменить frontend на path parameter: `/api/usage/dashboard/${date}`
   - Или изменить backend на query parameter

3. **Исправить users/link endpoint**
   - Добавить email в запрос frontend
   - Или изменить backend, чтобы email был опциональным

### Приоритет 2 (Важно - неиспользуемые endpoints)

4. **Удалить несуществующие endpoints из констант**
   - `/api/version`
   - `/api/system/journal`
   - `/api/backups/preview`, `/detail`, `/view`, `/download`, `/create`, `/restore`, `/delete`
   - `/api/collector/update-schedule`

5. **Исправить backups endpoints**
   - Использовать правильные пути с filename в path
   - Использовать DELETE для удаления

### Приоритет 3 (Улучшения)

6. **Добавить недостающие endpoints в backend** (если нужны)
   - `/api/xray/reality` - используется?
   - `/api/version` - если нужен
   - `/api/system/journal` - если нужен

7. **Создать единый источник правды**
   - OpenAPI/Swagger спецификация
   - Или общий файл с endpoints

---

## Рекомендации

1. **Немедленно исправить критические несоответствия** (dashboard, users/link)
2. **Удалить несуществующие endpoints из констант**
3. **Исправить backups endpoints** - использовать правильные пути
4. **Добавить валидацию** - проверять существование endpoints перед использованием
5. **Создать документацию** - список всех доступных endpoints с примерами
