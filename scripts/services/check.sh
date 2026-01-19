#!/bin/bash
# Скрипт проверки и автоматического перезапуска сервисов

LOG_FILE="/var/log/xray-services-check.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

check_service() {
    local service_name=$1
    local port=$2
    
    # Проверяем статус сервиса
    if ! systemctl is-active --quiet "$service_name"; then
        echo "[$DATE] WARNING: Service $service_name is not running. Restarting..." >> "$LOG_FILE"
        systemctl restart "$service_name"
        sleep 2
        
        if systemctl is-active --quiet "$service_name"; then
            echo "[$DATE] SUCCESS: Service $service_name restarted successfully" >> "$LOG_FILE"
        else
            echo "[$DATE] ERROR: Failed to restart service $service_name" >> "$LOG_FILE"
            return 1
        fi
    fi
    
    # Проверяем доступность порта (если указан)
    if [ -n "$port" ]; then
        if ! timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/$port" 2>/dev/null; then
            echo "[$DATE] WARNING: Port $port is not accessible for service $service_name. Restarting..." >> "$LOG_FILE"
            systemctl restart "$service_name"
            sleep 2
        fi
    fi
    
    return 0
}

# Проверяем сервисы
check_service "xray-report-ui" "8787"
check_service "xray-nextjs-ui" "3000"

echo "[$DATE] Health check completed" >> "$LOG_FILE"
