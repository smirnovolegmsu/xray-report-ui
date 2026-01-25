# Systemd Services

Конфигурационные файлы systemd для сервисов проекта.

## Сервисы

- **[xray-report-ui.service](xray-report-ui.service)** - Backend сервис (Flask/Gunicorn)
- **[xray-nextjs-ui.service](xray-nextjs-ui.service)** - Frontend сервис (Next.js)

## Установка

```bash
# Скопировать файлы в systemd
sudo cp xray-report-ui.service /etc/systemd/system/
sudo cp xray-nextjs-ui.service /etc/systemd/system/

# Перезагрузить systemd
sudo systemctl daemon-reload

# Включить автозапуск
sudo systemctl enable xray-report-ui xray-nextjs-ui

# Запустить сервисы
sudo systemctl start xray-report-ui xray-nextjs-ui
```

## Управление

```bash
# Статус
sudo systemctl status xray-report-ui
sudo systemctl status xray-nextjs-ui

# Перезапуск
sudo systemctl restart xray-report-ui
sudo systemctl restart xray-nextjs-ui

# Логи
sudo journalctl -u xray-report-ui -f
sudo journalctl -u xray-nextjs-ui -f
```

## Конфигурация

### Backend (xray-report-ui.service)
- **Порт:** 8787 (localhost)
- **Workers:** 2
- **Threads:** 2
- **Memory limit:** 512M
- **CPU limit:** 50%

### Frontend (xray-nextjs-ui.service)
- **Порт:** 3000 (публичный)
- **Memory limit:** 1G
- **CPU limit:** 50%

## Мониторинг

Логи доступны через `journalctl`:
```bash
# Все логи Backend
sudo journalctl -u xray-report-ui

# Последние 100 строк
sudo journalctl -u xray-report-ui -n 100

# В реальном времени
sudo journalctl -u xray-report-ui -f
```
