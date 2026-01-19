#!/bin/bash
# Health check скрипт с таймаутами для проверки доступности сервисов

TIMEOUT=5
RETRIES=3

check_health() {
    local url=$1
    local service_name=$2
    
    for i in $(seq 1 $RETRIES); do
        if timeout $TIMEOUT curl -sf "$url" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    
    echo "ERROR: Health check failed for $service_name after $RETRIES attempts"
    return 1
}

# Проверка Backend
check_health "http://localhost:8787/api/ping" "xray-report-ui"

# Проверка Frontend
check_health "http://localhost:3000" "xray-nextjs-ui"

exit 0
