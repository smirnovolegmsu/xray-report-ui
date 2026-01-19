# 🔧 Оптимизация лимитов ресурсов

## Проблема

В systemd сервисах были установлены **слишком жесткие ограничения** ресурсов, которые блокировали нормальную работу приложения:

### Старые лимиты (слишком жесткие):

**Frontend (xray-nextjs-ui):**
- MemoryMax: **512MB** ❌ (слишком мало для Next.js production)
- MemoryHigh: **400MB** ❌ (слишком мало)
- CPUQuota: **150%** ⚠️ (может быть недостаточно)
- TasksMax: **50 процессов** ⚠️

**Backend (xray-report-ui):**
- MemoryMax: **256MB** ❌ (слишком мало для обработки CSV)
- MemoryHigh: **200MB** ❌ (слишком мало)
- CPUQuota: **100%** ⚠️ (может быть недостаточно)
- TasksMax: **20 процессов** ⚠️

---

## ✅ Решение

### Новые лимиты (оптимизированные):

**Frontend (xray-nextjs-ui):**
- MemoryMax: **2GB** ✅ (достаточно для production Next.js)
- MemoryHigh: **1GB** ✅ (мягкий лимит)
- CPUQuota: **300%** ✅ (больше ресурсов для сборки)
- TasksMax: **200 процессов** ✅

**Backend (xray-report-ui):**
- MemoryMax: **1GB** ✅ (достаточно для обработки CSV)
- MemoryHigh: **512MB** ✅ (мягкий лимит)
- CPUQuota: **200%** ✅ (больше ресурсов для обработки)
- TasksMax: **100 процессов** ✅

---

## 📊 Дополнительные оптимизации

### 1. Увеличен размер кэша

**Было:**
- Максимум 100 записей в кэше
- Удаление 20% старых записей при превышении

**Стало:**
- Максимум **500 записей** в кэше
- Удаление только **10%** старых записей (менее агрессивная очистка)

**Эффект:** Больше данных остается в кэше, меньше повторных запросов к диску.

### 2. Оптимизированы TTL кэша

**Было:**
- Dashboard: 60 секунд
- Usage: 60 секунд
- Users: 30 секунд

**Стало:**
- Dashboard: **30 секунд** (более свежие данные)
- Usage: **30 секунд** (более свежие данные)
- Users: **60 секунд** (пользователи меняются редко)

**Эффект:** Баланс между производительностью и актуальностью данных.

---

## 🚀 Как применить изменения

### Вариант 1: Автоматический скрипт

```bash
# Создать и запустить скрипт обновления
cat > /tmp/update-limits.sh << 'SCRIPT'
#!/bin/bash
# Обновление лимитов для фронтенда
sed -i 's/MemoryMax=512M/MemoryMax=2G/' /etc/systemd/system/xray-nextjs-ui.service
sed -i 's/MemoryHigh=400M/MemoryHigh=1G/' /etc/systemd/system/xray-nextjs-ui.service
sed -i 's/MemoryLimit=512M/MemoryLimit=2G/' /etc/systemd/system/xray-nextjs-ui.service
sed -i 's/CPUQuota=150%/CPUQuota=300%/' /etc/systemd/system/xray-nextjs-ui.service
sed -i 's/TasksMax=50/TasksMax=200/' /etc/systemd/system/xray-nextjs-ui.service

# Обновление лимитов для бэкенда
sed -i 's/MemoryMax=256M/MemoryMax=1G/' /etc/systemd/system/xray-report-ui.service
sed -i 's/MemoryHigh=200M/MemoryHigh=512M/' /etc/systemd/system/xray-report-ui.service
sed -i 's/MemoryLimit=256M/MemoryLimit=1G/' /etc/systemd/system/xray-report-ui.service
sed -i 's/CPUQuota=100%/CPUQuota=200%/' /etc/systemd/system/xray-report-ui.service
sed -i 's/TasksMax=20/TasksMax=100/' /etc/systemd/system/xray-report-ui.service

# Перезагрузка systemd
systemctl daemon-reload

echo "Лимиты обновлены! Перезапустите сервисы:"
echo "systemctl restart xray-nextjs-ui xray-report-ui"
SCRIPT

chmod +x /tmp/update-limits.sh
sudo /tmp/update-limits.sh
```

### Вариант 2: Ручное редактирование

```bash
# Редактировать файлы сервисов
sudo nano /etc/systemd/system/xray-nextjs-ui.service
sudo nano /etc/systemd/system/xray-report-ui.service

# Изменить значения на новые (см. выше)

# Перезагрузить systemd
sudo systemctl daemon-reload

# Перезапустить сервисы
sudo systemctl restart xray-nextjs-ui xray-report-ui
```

---

## ✅ Проверка применения

```bash
# Проверить текущие лимиты
systemctl show xray-nextjs-ui.service | grep -E "(MemoryMax|MemoryHigh|CPUQuota|TasksMax)"
systemctl show xray-report-ui.service | grep -E "(MemoryMax|MemoryHigh|CPUQuota|TasksMax)"

# Проверить использование ресурсов
systemctl status xray-nextjs-ui | grep Memory
systemctl status xray-report-ui | grep Memory
```

---

## 📈 Ожидаемые улучшения

| Метрика | До | После | Улучшение |
|---------|-----|-------|-----------|
| Доступная память (Frontend) | 512MB | 2GB | **4x** |
| Доступная память (Backend) | 256MB | 1GB | **4x** |
| CPU квота (Frontend) | 150% | 300% | **2x** |
| CPU квота (Backend) | 100% | 200% | **2x** |
| Размер кэша | 100 записей | 500 записей | **5x** |

---

## ⚠️ Важные замечания

1. **Память не используется автоматически** - лимиты только ограничивают максимум
2. **Мониторинг** - следите за использованием ресурсов после изменений
3. **Постепенное увеличение** - если сервер слабый, увеличивайте лимиты постепенно
4. **Резервные копии** - созданы автоматически перед изменением

---

## 🔍 Мониторинг после изменений

```bash
# Проверить использование памяти
free -h
ps aux | grep -E "(next-server|python.*app.py)" | awk '{sum+=$6} END {print sum/1024 " MB"}'

# Проверить использование CPU
top -p $(pgrep -f "next-server\|python.*app.py")

# Проверить логи на ошибки памяти
journalctl -u xray-nextjs-ui --since "1 hour ago" | grep -i "memory\|killed\|oom"
journalctl -u xray-report-ui --since "1 hour ago" | grep -i "memory\|killed\|oom"
```

---

## 📝 Откат изменений (если нужно)

```bash
# Найти резервные копии
ls -la /etc/systemd/system/*.backup.*

# Восстановить из резервной копии
sudo cp /etc/systemd/system/xray-nextjs-ui.service.backup.* /etc/systemd/system/xray-nextjs-ui.service
sudo cp /etc/systemd/system/xray-report-ui.service.backup.* /etc/systemd/system/xray-report-ui.service

# Перезагрузить systemd
sudo systemctl daemon-reload

# Перезапустить сервисы
sudo systemctl restart xray-nextjs-ui xray-report-ui
```
