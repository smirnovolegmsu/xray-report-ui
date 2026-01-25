# Руководство по разработке

**Дата:** 2026-01-25

---

## Структура проекта

**Xray Report UI** — веб-панель управления VPN сервером на базе Xray-core.

**Компоненты:**
- **Backend (Flask API)** — Python сервер на порту 8787
- **Frontend (Next.js)** — React приложение на порту 3000

---

## Структура директорий

### Backend

**`app.py`** — главный Flask файл, точка входа:
- Инициализирует Flask приложение
- Регистрирует все API Blueprints
- Запускает фоновые потоки (live buffer, health checks)
- Обрабатывает ошибки

**`backend/core/`** — общие модули:
- `api.py` — API утилиты (ok/fail, валидация)
- `cache.py` — кэширование данных
- `config.py` — конфигурация
- `errors.py` — обработка ошибок
- `helpers.py` — вспомогательные функции
- `logging.py` — логирование
- `system.py` — системные функции
- `xray.py` — работа с Xray конфигурацией

**`backend/features/<module>/`** — функциональные модули:
```
├── api/v1/endpoints.py    # API endpoints
├── services/              # Бизнес-логика
└── repositories/          # Работа с данными
```

**Модули:** `overview/`, `users/`, `live/`, `events/`, `header/`, `settings/`

### Frontend

**`frontend/app/`** — Next.js App Router страницы:
- `page.tsx` — главная страница
- `users/page.tsx`, `live/page.tsx`, `events/page.tsx`
- `settings/` — страницы настроек

**`frontend/components/`** — React компоненты:
- `layout/` — макет (sidebar, header)
- `features/` — функциональные компоненты по модулям

**`frontend/lib/`** — утилиты:
- `api/` — API клиенты
- `constants/` — константы
- `hooks/` — custom hooks

---

## Архитектура

### Поток данных

```
Пользователь → Frontend (Next.js:3000) → /api/* → Backend (Flask:8787) 
→ Модули → Файловая система → Xray-core
```

### Слои Backend

1. **API Layer** — HTTP обработка, валидация, формирование ответов
2. **Service Layer** — бизнес-логика, обработка данных
3. **Repository Layer** — работа с данными, чтение/запись файлов
4. **Core Layer** — общие утилиты, кэширование, системные операции

### Слои Frontend

1. **Pages Layer** — страницы Next.js, маршрутизация
2. **Components Layer** — переиспользуемые компоненты, UI компоненты
3. **Features Layer** — feature-модули (изолированные)
4. **API Layer** — API клиенты, типизация

---

## Миграция на новую структуру

### Изменения в импортах

**Конфигурация:**
```python
# Старое: from config import APP_PORT
# Новое: from backend.core.config import APP_PORT
```

**Утилиты:**
```python
# Старое: from utils import now_utc_iso
# Новое: from backend.core.helpers import now_utc_iso
```

**Xray:**
```python
# Старое: from xray import get_xray_clients
# Новое: from backend.core.xray import get_xray_clients
```

---

## Добавление нового модуля

### Backend модуль

1. Создать структуру: `mkdir -p backend/features/newmodule/{api/v1,services,repositories}`
2. Создать endpoints в `api/v1/endpoints.py`
3. Зарегистрировать в `app.py`: `app.register_blueprint(newmodule_bp)`

### Frontend модуль

1. Создать структуру: `mkdir -p frontend/features/newmodule/{components,hooks}`
2. Создать API клиент в `lib/api/newmodule.ts`
3. Создать компоненты в `features/newmodule/components/`

---

## Best Practices

### Backend
- Endpoints только маршрутизация и валидация
- Services содержат бизнес-логику
- Repositories работают с данными
- Использовать `backend.core.*` для общих модулей
- Обработка ошибок через `backend.core.errors`

### Frontend
- Разделять UI компоненты и бизнес-компоненты
- Использовать TypeScript для типизации
- Избегать hydration errors (проверять `typeof window`)
- Централизованные API клиенты в `lib/api/`
- SWR для server state, Zustand для client state

---

## Тестирование

**Backend:**
```python
# backend/tests/test_newmodule.py
import pytest
from backend.features.newmodule.services.newmodule_service import get_items

def test_get_items():
    result = get_items()
    assert result is not None
```

**Frontend:**
```typescript
// frontend/__tests__/newmodule.test.tsx
import { render } from '@testing-library/react';
import { NewModuleList } from '@/features/newmodule/components/newmodule-list';

test('renders list', () => {
  const { getByText } = render(<NewModuleList />);
});
```

---

## Отладка

**Backend:**
```bash
journalctl -u xray-report-ui -f
cd /opt/xray-report-ui && source venv/bin/activate && python app.py
```

**Frontend:**
```bash
cd frontend && npm run dev  # Dev режим
cd frontend && npm run build && npm start  # Production
```

---

## Полезные ссылки

- [API Reference](api-reference.md) - Документация API
- [Features](features.md) - Документация модулей
- [Troubleshooting](troubleshooting.md) - Решение проблем
