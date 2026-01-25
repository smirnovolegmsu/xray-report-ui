#!/bin/bash
# Улучшенный скрипт проверки и автоматического перезапуска сервисов
# Проверяет статус, порты, ресурсы и дисковое пространство

LOG_FILE="/var/log/xray-services-check.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')
ALERT_THRESHOLD_DISK=85  # Процент заполнения диска для алерта
ALERT_THRESHOLD_MEM=90   # Процент использования памяти для алерта

log_message() {
    echo "[$DATE] $1" >> "$LOG_FILE"
}

check_disk_space() {
    local usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$usage" -ge "$ALERT_THRESHOLD_DISK" ]; then
        log_message "WARNING: Disk usage is ${usage}% (threshold: ${ALERT_THRESHOLD_DISK}%)"
        
        # Очистка старых бэкапов (оставляем 50 последних)
        if [ -d "/opt/xray-report-ui/data/backups" ]; then
            local backup_count=$(ls -1 /opt/xray-report-ui/data/backups/*.json 2>/dev/null | wc -l)
            if [ "$backup_count" -gt 50 ]; then
                ls -t /opt/xray-report-ui/data/backups/*.json 2>/dev/null | tail -n +51 | xargs rm -f 2>/dev/null
                log_message "INFO: Cleaned old backups (kept 50 latest)"
            fi
        fi
        
        # Очистка логов journalctl если больше 500MB
        local journal_size_mb=$(journalctl --disk-usage 2>/dev/null | grep -oP '\d+\.\d+G' | head -1 | sed 's/G//' | awk '{print int($1 * 1024)}')
        if [ -n "$journal_size_mb" ] && [ "$journal_size_mb" -gt 500 ] 2>/dev/null; then
            journalctl --vacuum-size=500M >/dev/null 2>&1
            log_message "INFO: Cleaned journalctl logs (limited to 500MB)"
        fi
    fi
}

check_memory() {
    local mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ -n "$mem_usage" ] && [ "$mem_usage" -ge "$ALERT_THRESHOLD_MEM" ] 2>/dev/null; then
        log_message "WARNING: Memory usage is ${mem_usage}% (threshold: ${ALERT_THRESHOLD_MEM}%)"
    fi
}

check_service() {
    local service_name=$1
    local port=$2
    
    # Проверяем статус сервиса
    if ! systemctl is-active --quiet "$service_name"; then
        log_message "WARNING: Service $service_name is not running. Restarting..."
        systemctl restart "$service_name"
        sleep 3
        
        if systemctl is-active --quiet "$service_name"; then
            log_message "SUCCESS: Service $service_name restarted successfully"
        else
            log_message "ERROR: Failed to restart service $service_name"
            return 1
        fi
    fi
    
    # Проверяем доступность порта (если указан)
    if [ -n "$port" ]; then
        if ! timeout 3 bash -c "echo > /dev/tcp/127.0.0.1/$port" 2>/dev/null; then
            log_message "WARNING: Port $port is not accessible for service $service_name. Restarting..."
            systemctl restart "$service_name"
            sleep 3
            
            # Проверяем снова после перезапуска
            if ! timeout 3 bash -c "echo > /dev/tcp/127.0.0.1/$port" 2>/dev/null; then
                log_message "ERROR: Port $port still not accessible after restart for $service_name"
                return 1
            else
                log_message "SUCCESS: Port $port is now accessible for $service_name"
            fi
        fi
    fi
    
    # Проверяем использование памяти сервисом
    local pid=$(systemctl show "$service_name" -p MainPID --value)
    if [ -n "$pid" ] && [ "$pid" != "0" ]; then
        local mem_kb=$(ps -p "$pid" -o rss= 2>/dev/null | awk '{print $1}')
        if [ -n "$mem_kb" ]; then
            local mem_mb=$((mem_kb / 1024))
            log_message "INFO: Service $service_name using ${mem_mb}MB memory (PID: $pid)"
        fi
    fi
    
    return 0
}

# Проверка дискового пространства
check_disk_space

# Проверка памяти
check_memory

# Проверяем сервисы
check_service "xray-report-ui" "8787"
check_service "xray-nextjs-ui" "3000"

log_message "Health check completed"
