#!/bin/bash
# Финальный скрипт для закрытия всех портов, кроме разрешенных

ALLOWED_PORTS="22 53 80 123 443 1194 3000 8787 10085 37011 40783 46705 39989 49909 52120 52656 59801 60681"

echo "=========================================="
echo "  ЗАКРЫТИЕ НЕРАЗРЕШЕННЫХ ПОРТОВ"
echo "=========================================="
echo ""
echo "Разрешенные порты: $ALLOWED_PORTS"
echo ""

# Сначала убедимся, что Xray запущен
if ! systemctl is-active --quiet xray; then
    echo "⚠️  Xray не запущен, запускаем..."
    systemctl start xray
    sleep 2
fi

CLOSED=0

# Получаем все LISTEN порты и закрываем неразрешенные
ss -tulpn | grep LISTEN | while read line; do
    port=$(echo "$line" | awk '{print $5}' | sed 's/.*://' | sed 's/\[//g' | sed 's/\]//g')
    
    if [[ "$port" =~ ^[0-9]+$ ]]; then
        if ! echo "$ALLOWED_PORTS" | grep -qw "$port"; then
            PID=$(echo "$line" | grep -oP 'pid=\K[0-9]+' | head -1)
            PROCESS=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
            
            echo "🔴 Закрываем порт $port (процесс: $PROCESS, PID: $PID)"
            
            # Закрываем только если это не критичные системные процессы
            if [[ "$PROCESS" != "xray" && "$PROCESS" != "nginx" && "$PROCESS" != "sshd" && "$PROCESS" != "systemd-resolve" && "$PROCESS" != "ntpd" && "$PROCESS" != "python"* && "$PROCESS" != "next-server"* && "$PROCESS" != "openvpn" ]]; then
                kill "$PID" 2>/dev/null
                sleep 0.5
                if ! ss -tulpn | grep -q ":$port "; then
                    echo "   ✅ Порт $port закрыт"
                    CLOSED=$((CLOSED + 1))
                else
                    echo "   ⚠️  Порт $port все еще открыт (возможно, процесс перезапустился)"
                fi
            else
                echo "   ⚠️  Пропущен (критичный процесс: $PROCESS)"
            fi
        fi
    fi
done

echo ""
echo "=========================================="
echo "  РАЗРЫВ АКТИВНЫХ СОЕДИНЕНИЙ"
echo "=========================================="
echo ""

# Разрываем активные соединения на неразрешенных портах
ss -tunp | grep ESTAB | awk '{print $5}' | sed 's/.*://' | grep -E '^[0-9]+$' | sort -u | while read port; do
    if ! echo "$ALLOWED_PORTS" | grep -qw "$port"; then
        # Находим PID процессов с соединениями на этом порту
        ss -tunp | grep ESTAB | grep ":$port " | grep -oP 'pid=\K[0-9]+' | sort -u | while read pid; do
            PROCESS=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            if [[ "$PROCESS" == "xray" ]]; then
                echo "⚠️  Разрываем соединения Xray на порту $port (PID: $pid)"
                kill -HUP "$pid" 2>/dev/null
            fi
        done
    fi
done

echo ""
echo "=========================================="
echo "  РЕЗУЛЬТАТ"
echo "=========================================="
echo ""

sleep 2

echo "📊 Текущие открытые LISTEN порты:"
CURRENT_PORTS=$( (ss -tlnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$'; ss -ulnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$') | sort -n | uniq)

for port in $CURRENT_PORTS; do
    if echo "$ALLOWED_PORTS" | grep -qw "$port"; then
        echo "  ✅ $port - разрешен"
    else
        echo "  ⚠️  $port - НЕ в списке разрешенных!"
    fi
done

echo ""
echo "✅ Готово! Закрыто портов: $CLOSED"
echo ""
