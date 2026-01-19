#!/bin/bash
# Простой скрипт для закрытия неразрешенных портов

ALLOWED_PORTS="22 53 80 123 443 1194 3000 8787 10085 37011 40783 46705 39989 49909 52120 52656 59801 60681"

echo "Закрытие портов, не входящих в разрешенный список..."
echo "Разрешенные порты: $ALLOWED_PORTS"
echo ""

# Получаем все LISTEN порты
ss -tulpn | grep LISTEN | while read line; do
    port=$(echo "$line" | awk '{print $5}' | sed 's/.*://' | sed 's/\[//g' | sed 's/\]//g')
    
    # Проверяем, является ли это числом и разрешен ли порт
    if [[ "$port" =~ ^[0-9]+$ ]]; then
        if ! echo "$ALLOWED_PORTS" | grep -qw "$port"; then
            PID=$(echo "$line" | grep -oP 'pid=\K[0-9]+' | head -1)
            PROCESS=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
            
            echo "Закрываем порт $port (процесс: $PROCESS, PID: $PID)"
            
            # Закрываем только если это не критичные процессы
            if [[ "$PROCESS" != "xray" && "$PROCESS" != "nginx" && "$PROCESS" != "sshd" && "$PROCESS" != "systemd-resolve" && "$PROCESS" != "ntpd" && "$PROCESS" != "python"* && "$PROCESS" != "next-server"* && "$PROCESS" != "openvpn" ]]; then
                kill "$PID" 2>/dev/null && echo "  ✅ Закрыт" || echo "  ❌ Ошибка"
            else
                echo "  ⚠️  Пропущен (критичный процесс)"
            fi
        fi
    fi
done

echo ""
echo "Готово!"
