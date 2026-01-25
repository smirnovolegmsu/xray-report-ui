# Руководство по миграции на новую структуру

## Обзор

Проект был реорганизован с новой структурой. Это руководство поможет вам мигрировать существующий код и использовать новые возможности.

## Изменения в импортах

### Старые импорты → Новые импорты

#### Конфигурация
```python
# Старое
from config import APP_PORT, SERVICE_XRAY_DEFAULT
from settings import load_settings, XRAY_CFG

# Новое
from backend.core.config.settings import (
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
from backend.utils.helpers import now_utc_iso, atomic_write_json
from backend.utils.cache import get_cached, set_cached
```

#### Xray
```python
# Старое
from xray import get_xray_clients, load_xray_config

# Новое
from backend.repositories.xray_repository import (
    get_xray_clients,
    load_xray_config,
)
```

#### События
```python
# Старое
from events import append_event, read_events

# Новое
from backend.repositories.events_repository import (
    append_event,
    read_events,
)
```

#### Пользователи
```python
# Старое
from users import add_user, delete_user

# Новое
from backend.services.user_service import (
    add_user,
    delete_user,
)
```

#### Система
```python
# Старое
from system import systemctl_restart, systemctl_is_active

# Новое
from backend.services.system_service import (
    systemctl_restart,
    systemctl_is_active,
)
```

## Использование структурированного логирования

### Старый способ
```python
import sys
print(f"Warning: Error: {e}", file=sys.stderr)
```

### Новый способ
```python
from structlog import get_logger
logger = get_logger(__name__)

logger.warning("operation_failed", operation="save_user", error=str(e))
logger.error("critical_error", error=str(e), exc_info=True)
```

## Использование кастомных исключений

### Старый способ
```python
return {"ok": False, "error": "user_not_found"}
```

### Новый способ
```python
from backend.core.errors.exceptions import UserNotFoundError

if not user:
    raise UserNotFoundError(f"User {user_id} not found")
```

## Использование журнала (дневника)

### Для критичных событий
```python
from backend.core.monitoring.journal import get_journal

journal = get_journal()
journal.log_milestone("deployment_complete", version="2.0")
journal.log_critical_event("xray_restart", reason="config_changed")
```

## Обновление API endpoints

### Старый способ
```python
from api import ok, fail
from users import add_user

@blueprint.post("/api/users/add")
def add():
    result = add_user(email)
    if result.get("ok"):
        return ok(result)
    return fail(result.get("error"))
```

### Новый способ
```python
from backend.api.common import ok, fail
from backend.services.user_service import add_user
from backend.core.errors.exceptions import UserAlreadyExistsError

@blueprint.post("/api/users/add")
def add():
    try:
        result = add_user(email)
        return ok(result)
    except UserAlreadyExistsError as e:
        return fail(str(e), code=409)
    except Exception as e:
        logger.exception("failed_to_add_user", email=email, error=str(e))
        return fail("Internal server error", code=500)
```

## Проверка миграции

После миграции проверьте:

1. **Импорты работают:**
   ```bash
   python3 -c "from backend.app import app; print('OK')"
   ```

2. **API endpoints доступны:**
   ```bash
   curl http://localhost:8787/api/ping
   ```

3. **Логирование работает:**
   Проверьте логи - должны быть структурированные JSON логи

4. **Ошибки обрабатываются:**
   Проверьте что ошибки логируются и возвращаются в правильном формате

## Обратная совместимость

Старые модули (`xray.py`, `users.py`, и др.) остаются для обратной совместимости. Вы можете постепенно мигрировать код, используя новые модули параллельно со старыми.

## Полезные ссылки

- [Development Guidelines](guides/development.md)
- [Logging Guide](guides/logging.md)
- [Error Handling Guide](guides/error-handling.md)
- [Architecture Guide](guides/architecture.md)
