# Руководство по разработке

**Дата:** 2026-01-25  
**Объединено из:** project-structure.md, migration.md, architecture.md

---

## 📋 Содержание

1. [Структура проекта](#структура-проекта)
2. [Архитектура системы](#архитектура-системы)
3. [Миграция на новую структуру](#миграция-на-новую-структуру)

---

# Структура проекта

## Обзор проекта

**Xray Report UI** — это веб-панель управления VPN сервером на базе Xray-core. Проект состоит из двух основных компонентов:
- **Backend (Flask API)** — Python сервер на порту 8787
- **Frontend (Next.js)** — React приложение на порту 3000

---

## 📁 Структура корневой директории

### 🔧 Основные Python файлы (Backend)

#### `app.py`
**Назначение:** Главный файл Flask приложения, точка входа для Backend сервера.

**Что делает:**
- Инициализирует Flask приложение
- Регистрирует все API Blueprints (маршруты)
- Запускает фоновые потоки для:
  - Обновления live buffer (каждую минуту)
  - Проверки здоровья сервисов (каждые 60 секунд)
- Обрабатывает ошибки и логирует их как события
- Управляет жизненным циклом приложения (startup/shutdown)

**Важно:** При запуске в production используется Gunicorn, который вызывает этот файл.

---

#### Backend модули (`backend/core/`)

- **`api.py`** - Общие API утилиты (ok/fail, валидация)
- **`cache.py`** - Кэширование данных
- **`config.py`** - Конфигурация приложения
- **`errors.py`** - Обработка ошибок
- **`helpers.py`** - Вспомогательные функции
- **`logging.py`** - Настройка логирования
- **`system.py`** - Системные функции
- **`xray.py`** - Работа с Xray конфигурацией

---

#### Backend features (`backend/features/`)

**Структура модуля:**
```
backend/features/<module>/
├── api/v1/endpoints.py    # API endpoints
├── services/              # Бизнес-логика
└── repositories/          # Работа с данными
```

**Модули:**
- `overview/` - Дашборд и статистика
- `users/` - Управление пользователями
- `live/` - Онлайн мониторинг
- `events/` - События системы
- `header/` - Системные ресурсы
- `settings/` - Настройки системы

---

### 📂 Frontend структура (`frontend/`)

#### `frontend/app/` — Next.js App Router страницы
- `app/page.tsx` — главная страница (Dashboard/Overview)
- `app/layout.tsx` — корневой layout
- `app/users/page.tsx` — страница управления пользователями
- `app/live/page.tsx` — страница live мониторинга
- `app/events/page.tsx` — страница событий
- `app/settings/` — страницы настроек

#### `frontend/components/` — React компоненты

**`components/layout/`** — компоненты макета:
- `main-layout.tsx` — основной layout с sidebar и header
- `sidebar.tsx` — боковое меню навигации
- `header.tsx` — верхний заголовок

**`components/features/`** — функциональные компоненты:
- `overview/` — компоненты главной страницы
- `users/` — компоненты управления пользователями
- `live/` — компоненты live мониторинга
- `events/` — компоненты событий
- `settings/` — компоненты настроек

#### `frontend/lib/` — Утилиты и константы
- `api/` — API клиенты
- `constants/` — Константы (API endpoints, UI)
- `hooks/` — Custom hooks

---

## 🔄 Поток данных в системе

```
Пользователь (браузер)
    ↓
Frontend (Next.js, порт 3000)
    ↓ /api/*
Backend (Flask API, порт 8787)
    ↓
Модули (xray.py, users.py, events.py, etc.)
    ↓
Файловая система:
    - /usr/local/etc/xray/config.json (конфиг Xray)
    - /var/log/xray/access.log (access log)
    - /var/log/xray/usage/*.csv (статистика)
    - /opt/xray-report-ui/data/* (данные приложения)
    ↓
Xray-core (VPN сервер)
```

---

# Архитектура системы

## Принципы организации

### 1. Три основные части проекта

```
Frontend (что видит пользователь) = frontend/ (Next.js)
Backend (логика на сервере)        = app.py + backend/ (Flask)
Данные (не в Git)                  = data/ + venv/
```

---

## Слои архитектуры

### Backend слои:

1. **API Layer** (`backend/features/*/api/v1/endpoints.py`)
   - HTTP обработка запросов
   - Валидация входных данных
   - Формирование ответов

2. **Service Layer** (`backend/features/*/services/`)
   - Бизнес-логика
   - Обработка данных
   - Координация между репозиториями

3. **Repository Layer** (`backend/features/*/repositories/`)
   - Работа с данными
   - Чтение/запись файлов
   - Парсинг CSV/JSON

4. **Core Layer** (`backend/core/`)
   - Общие утилиты
   - Кэширование
   - Системные операции

---

### Frontend слои:

1. **Pages Layer** (`frontend/app/`)
   - Страницы Next.js
   - Маршрутизация

2. **Components Layer** (`frontend/components/`)
   - Переиспользуемые компоненты
   - UI компоненты

3. **Features Layer** (`frontend/features/`)
   - Feature-модули (изолированные)
   - Бизнес-компоненты

4. **API Layer** (`frontend/lib/api/`)
   - API клиенты
   - Типизация запросов/ответов

---

## Взаимодействие компонентов

### Frontend → Backend

```
React Component
    ↓
API Client (frontend/lib/api/*.ts)
    ↓
HTTP Request (/api/*)
    ↓
Next.js Rewrite (proxy)
    ↓
Flask Endpoint (backend/features/*/api/v1/endpoints.py)
    ↓
Service (backend/features/*/services/)
    ↓
Repository (backend/features/*/repositories/)
    ↓
File System / Xray Config
```

---

# Миграция на новую структуру

## Обзор

Проект был реорганизован с новой структурой. Это руководство поможет вам мигрировать существующий код и использовать новые возможности.

---

## Изменения в импортах

### Старые импорты → Новые импорты

#### Конфигурация
```python
# Старое
from config import APP_PORT, SERVICE_XRAY_DEFAULT
from settings import load_settings, XRAY_CFG

# Новое
from backend.core.config import (
    APP_PORT,
    SERVICE_XRAY_DEFAULT,
    load_settings,
    XRAY_CFG,
)
```

#### Утилиты
```python
# Старое
from utils import now_utc_iso, atomic_write_json
from cache import get_cached, set_cached

# Новое
from backend.core.helpers import now_utc_iso, atomic_write_json
from backend.core.cache import get_cached, set_cached
```

#### Xray
```python
# Старое
from xray import get_xray_clients, load_xray_config

# Новое
from backend.core.xray import (
    get_xray_clients,
    load_xray_config,
)
```

---

## Структура модуля

### Backend модуль:

```
backend/features/<module>/
├── __init__.py
├── api/
│   ├── __init__.py
│   └── v1/
│       ├── __init__.py
│       └── endpoints.py    # API endpoints
├── services/
│   └── <module>_service.py # Бизнес-логика
└── repositories/
    └── <module>_repository.py # Работа с данными
```

### Frontend модуль:

```
frontend/features/<module>/
├── components/             # Компоненты модуля
├── hooks/                  # Custom hooks
└── types.ts               # TypeScript типы
```

---

## Добавление нового модуля

### 1. Backend модуль

1. Создать структуру:
```bash
mkdir -p backend/features/newmodule/{api/v1,services,repositories}
```

2. Создать endpoints:
```python
# backend/features/newmodule/api/v1/endpoints.py
from flask import Blueprint
from backend.core.api import ok, fail

bp = Blueprint('newmodule', __name__, url_prefix='/api/newmodule')

@bp.get('/list')
def get_list():
    return ok({'items': []})
```

3. Зарегистрировать в `app.py`:
```python
from backend.features.newmodule.api.v1.endpoints import bp as newmodule_bp
app.register_blueprint(newmodule_bp)
```

---

### 2. Frontend модуль

1. Создать структуру:
```bash
mkdir -p frontend/features/newmodule/{components,hooks}
```

2. Создать API клиент:
```typescript
// frontend/lib/api/newmodule.ts
import { apiClient } from './client';

export const newmoduleApi = {
  getList: () => apiClient.get('/newmodule/list'),
};
```

3. Создать компоненты:
```typescript
// frontend/features/newmodule/components/newmodule-list.tsx
'use client';
import { newmoduleApi } from '@/lib/api/newmodule';

export function NewModuleList() {
  // ...
}
```

---

## Best Practices

### Backend:

1. **Разделение ответственности:**
   - Endpoints только маршрутизация и валидация
   - Services содержат бизнес-логику
   - Repositories работают с данными

2. **Использование общих модулей:**
   - `backend.core.api` для ответов
   - `backend.core.cache` для кэширования
   - `backend.core.helpers` для утилит

3. **Обработка ошибок:**
   - Использовать кастомные исключения из `backend.core.errors`
   - Логировать через `backend.core.logging`

### Frontend:

1. **Компоненты:**
   - Разделять на UI компоненты и бизнес-компоненты
   - Использовать TypeScript для типизации
   - Избегать hydration errors (проверять `typeof window`)

2. **API клиенты:**
   - Централизованные в `frontend/lib/api/`
   - Типизированные запросы/ответы
   - Обработка ошибок

3. **State Management:**
   - SWR для server state
   - Zustand для client state
   - Избегать prop drilling

---

## Тестирование

### Backend тесты:

```python
# backend/tests/test_newmodule.py
import pytest
from backend.features.newmodule.services.newmodule_service import get_items

def test_get_items():
    result = get_items()
    assert result is not None
```

### Frontend тесты:

```typescript
// frontend/__tests__/newmodule.test.tsx
import { render } from '@testing-library/react';
import { NewModuleList } from '@/features/newmodule/components/newmodule-list';

test('renders list', () => {
  const { getByText } = render(<NewModuleList />);
  // ...
});
```

---

## Отладка

### Backend:

```bash
# Логи
journalctl -u xray-report-ui -f

# Запуск вручную
cd /opt/xray-report-ui
source venv/bin/activate
python app.py
```

### Frontend:

```bash
# Dev режим
cd frontend
npm run dev

# Production build
npm run build
npm start
```

---

## Полезные ссылки

- [API Reference](api-reference.md) - Документация API
- [Features](features.md) - Документация модулей
- [Troubleshooting](troubleshooting.md) - Решение проблем
