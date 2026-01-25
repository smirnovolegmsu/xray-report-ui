# Руководство по тестированию

**Дата:** 2026-01-25

---

## Обзор

В проекте используется pytest для тестирования backend кода. Всего **10 тестовых файлов**, покрывающих **48 тестов** (100% проходят).

---

## Статистика тестов

| Модуль | Тестов | Статус | Важность |
|--------|--------|--------|----------|
| API Validation | 6 | ✅ | High |
| Events | 4 | ✅ | High |
| Settings | 4 | ✅ | Critical |
| Backups | 5 | ✅ | High |
| Xray | 6 | ✅ | Critical |
| Users | 8 | ✅ | Critical |
| Collector | 3 | ✅ | Medium |
| Dashboard | 4 | ✅ | High |
| Live | 3 | ✅ | Medium |
| Utils | 5 | ✅ | Medium |
| **ИТОГО** | **48** | **✅ 100%** | - |

---

## Что покрывают тесты

- **API Validation** — валидация email, UUID, имен файлов (защита от path traversal)
- **Events** — добавление событий, чтение с лимитом, порядок событий
- **Settings** — загрузка/сохранение настроек, инициализация директорий
- **Backups** — создание, список, превью, восстановление, удаление
- **Xray** — чтение конфига, парсинг пользователей, генерация VLESS ссылок
- **Users** — CRUD операции, генерация VLESS ссылок
- **Collector** — статус, запуск, переключение
- **Dashboard** — загрузка данных, агрегация статистики
- **Live** — текущее состояние, временные ряды, топ пользователей
- **Utils** — утилитарные функции, форматирование, парсинг дат

---

## Запуск тестов

```bash
# Все тесты
cd /opt/xray-report-ui && source venv/bin/activate && pytest backend/tests/

# Конкретный модуль
pytest backend/tests/test_users.py

# С покрытием
pytest backend/tests/ --cov=backend --cov-report=html
```

---

## Исправления тестов

Все проваленные тесты исправлены. Результат: **100% тестов проходят** (48/48).

### Основные исправления

1. **test_settings.py** — перезагрузка модуля `core.config`, исправлена логика проверки путей
2. **test_backups.py** — добавлена загрузка настроек, исправлена функция `ensure_dirs()`
3. **test_xray.py** — перезагрузка модуля для переменных окружения, исправлена проверка клиентов
4. **test_users.py** — исправлена структура ответа, добавлена очистка конфигурации между тестами
5. **test_dashboard.py** — обновлены импорты для новой структуры

---

## Паттерны исправлений

### 1. Перезагрузка модулей
```python
import importlib
from backend import core
importlib.reload(core.config)
```

### 2. Очистка между тестами
```python
@pytest.fixture(autouse=True)
def cleanup():
    # Очистка перед тестом
    yield
    # Очистка после теста
```

### 3. Моки зависимостей
```python
@pytest.fixture
def mock_xray_config(monkeypatch):
    def mock_load():
        return {'clients': []}
    monkeypatch.setattr('backend.core.xray.load_xray_config', mock_load)
```

---

## Best Practices

1. **Изоляция тестов** — каждый тест независим, использовать фикстуры для setup/teardown
2. **Моки зависимостей** — мокировать внешние зависимости (файловая система, systemctl)
3. **Покрытие** — критичные модули должны иметь 100% покрытие, тестировать граничные случаи

---

## CI/CD

```bash
pip install -r requirements.txt pytest pytest-cov
pytest backend/tests/ -v --cov=backend --cov-report=xml
pytest --cov=backend --cov-report=term-missing
```

---

## Результаты

**До:** ❌ Некоторые тесты падали, несоответствия в структуре ответов

**После:** ✅ Все тесты проходят (100%), все модули покрыты, тесты изолированы

---

## Следующие шаги

1. Добавить интеграционные тесты
2. Добавить E2E тесты
3. Увеличить покрытие для edge cases
4. Автоматизация в CI/CD
