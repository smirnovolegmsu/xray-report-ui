#!/bin/bash
# Скрипт для закрытия всех портов, кроме разрешенных

echo "=========================================="
echo "  ЗАКРЫТИЕ НЕРАЗРЕШЕННЫХ ПОРТОВ"
echo "=========================================="
echo ""

# Список разрешенных портов
ALLOWED_PORTS=(22 53 80 123 443 1194 3000 8787 10085 37011 40783 46705 39989 49909 52120 52656 59801 60681)

# Получаем все открытые порты
ALL_PORTS=$( (ss -tlnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$'; ss -ulnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$') | sort -n | uniq)

CLOSED_COUNT=0
KEPT_COUNT=0

echo "📋 Разрешенные порты: ${ALLOWED_PORTS[*]}"
echo ""
echo "🔍 Проверка открытых портов..."
echo ""

for port in $ALL_PORTS; do
    # Проверяем, разрешен ли порт
    ALLOWED=false
    for allowed_port in "${ALLOWED_PORTS[@]}"; do
        if [ "$port" == "$allowed_port" ]; then
            ALLOWED=true
            break
        fi
    done
    
    if [ "$ALLOWED" = true ]; then
        echo "✅ Порт $port: РАЗРЕШЕН - оставляем открытым"
        KEPT_COUNT=$((KEPT_COUNT + 1))
    else
        # Получаем информацию о порте
        TCP_INFO=$(ss -tlnp | grep ":$port ")
        UDP_INFO=$(ss -ulnp | grep ":$port ")
        
        if [ -n "$TCP_INFO" ]; then
            PORT_INFO="$TCP_INFO"
            PROTO="TCP"
        elif [ -n "$UDP_INFO" ]; then
            PORT_INFO="$UDP_INFO"
            PROTO="UDP"
        else
            continue
        fi
        
        PID=$(echo "$PORT_INFO" | grep -oP 'pid=\K[0-9]+' | head -1)
        PROCESS=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
        
        echo "🔴 Порт $port ($PROTO): НЕРАЗРЕШЕН - закрываем"
        echo "   Процесс: $PROCESS (PID: $PID)"
        
        # Закрываем порт через kill процесса (если это не критичный процесс)
        if [[ "$PROCESS" != "xray" && "$PROCESS" != "nginx" && "$PROCESS" != "sshd" && "$PROCESS" != "systemd-resolve" && "$PROCESS" != "ntpd" && "$PROCESS" != "python"* && "$PROCESS" != "next-server"* ]]; then
            echo "   ⚠️  Закрываем процесс $PROCESS (PID: $PID)..."
            kill "$PID" 2>/dev/null
            sleep 1
            
            # Проверяем, закрылся ли порт
            if ! ss -tulpn | grep -q ":$port "; then
                echo "   ✅ Порт $port закрыт"
                CLOSED_COUNT=$((CLOSED_COUNT + 1))
            else
                echo "   ❌ Не удалось закрыть порт $port (возможно, процесс перезапустился)"
            fi
        else
            echo "   ⚠️  Пропускаем (критичный процесс: $PROCESS)"
            echo "   💡 Этот порт управляется системным сервисом"
        fi
        echo ""
    fi
done

echo "=========================================="
echo "  РЕЗУЛЬТАТ"
echo "=========================================="
echo ""
echo "✅ Оставлено открытых портов: $KEPT_COUNT"
echo "🔴 Закрыто портов: $CLOSED_COUNT"
echo ""

# Показываем текущее состояние
echo "📊 Текущие открытые порты:"
(ss -tlnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$'; ss -ulnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$') | sort -n | uniq | while read port; do
    echo "  - $port"
done

echo ""
echo "=========================================="
echo "  РАЗРЫВ АКТИВНЫХ СОЕДИНЕНИЙ"
echo "=========================================="
echo ""

# Разрываем активные соединения на неразрешенных портах
ESTAB_CONNECTIONS=$(ss -tunp | grep ESTAB | awk '{print $5}' | sed 's/.*://' | grep -E '^[0-9]+$' | sort -n | uniq)

BROKEN_COUNT=0
for port in $ESTAB_CONNECTIONS; do
    ALLOWED=false
    for allowed_port in "${ALLOWED_PORTS[@]}"; do
        if [ "$port" == "$allowed_port" ]; then
            ALLOWED=true
            break
        fi
    done
    
    if [ "$ALLOWED" = false ]; then
        # Находим соединения на этом порту
        CONNECTIONS=$(ss -tunp | grep ESTAB | grep ":$port ")
        if [ -n "$CONNECTIONS" ]; then
            echo "🔴 Разрываем соединения на порту $port..."
            # Получаем PID процессов с этими соединениями
            PIDS=$(echo "$CONNECTIONS" | grep -oP 'pid=\K[0-9]+' | sort -u)
            for pid in $PIDS; do
                PROCESS=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
                echo "   Закрываем соединения процесса $PROCESS (PID: $pid)"
                # Используем tcpkill или просто закрываем соединение через kill -HUP
                kill -HUP "$pid" 2>/dev/null || true
            done
            BROKEN_COUNT=$((BROKEN_COUNT + 1))
        fi
    fi
done

echo ""
echo "✅ Разорвано соединений: $BROKEN_COUNT"
echo ""
echo "⚠️  ВНИМАНИЕ: Активные соединения клиентов обычно закрываются автоматически."
echo "   Если нужно принудительно закрыть все соединения, используйте:"
echo "   sudo killall -HUP xray"
echo ""
