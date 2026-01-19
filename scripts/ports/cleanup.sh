#!/bin/bash
# Скрипт для закрытия неиспользуемых высоких портов (временные порты отладки)

# Если передан аргумент --kill-cursor, закрываем и порты Cursor Server
KILL_CURSOR=false
if [ "$1" == "--kill-cursor" ]; then
    KILL_CURSOR=true
    echo "⚠️  ВНИМАНИЕ: Режим закрытия портов Cursor Server включен!"
    echo "   Это остановит работу Cursor через SSH!"
    echo ""
fi

# Если передан аргумент --dry-run, только показываем что будет закрыто
DRY_RUN=false
if [ "$1" == "--dry-run" ] || [ "$2" == "--dry-run" ]; then
    DRY_RUN=true
    echo "🔍 РЕЖИМ ПРОСМОТРА: изменения не будут применены"
    echo ""
fi

echo "=== Проверка и закрытие неиспользуемых портов ==="
echo ""

# Список портов для проверки (высокие порты отладки)
DEBUG_PORTS=(34507 35209 35389 38137 39157 39563 39767 40405 45413 45923 46195 46485 49010 54446 54462 54466 54636 54638 54646)

# Также проверяем известные неиспользуемые порты
UNUSED_PORTS=(5000 9090 9100 7242)

# Порты Cursor Server (слушают только на localhost, но можно закрыть если не нужен Cursor)
# Автоматически находим все высокие порты Cursor Server
CURSOR_PORTS=($(ss -tulpn | grep LISTEN | grep "127.0.0.1:" | awk '{print $5}' | sed 's/.*://' | awk '$1 > 30000 && $1 < 60000' | sort -n | uniq))

ALL_PORTS=("${DEBUG_PORTS[@]}" "${UNUSED_PORTS[@]}")

CLOSED_COUNT=0
OPEN_COUNT=0

echo "Проверка портов..."
echo ""

for port in "${ALL_PORTS[@]}"; do
    # Проверяем, слушает ли порт
    if ss -tulpn | grep -q ":$port "; then
        echo "⚠️  Порт $port: ОТКРЫТ"
        
        # Получаем PID процесса
        PID=$(ss -tulpn | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1)
        
        if [ -n "$PID" ]; then
            PROCESS=$(ps -p "$PID" -o comm= 2>/dev/null)
            echo "   Процесс: $PROCESS (PID: $PID)"
            
            # Закрываем только если это не критичные процессы
            if [[ "$PROCESS" != "xray" && "$PROCESS" != "nginx" && "$PROCESS" != "sshd" && "$PROCESS" != "python"* && "$PROCESS" != "node"* ]]; then
                if [ "$DRY_RUN" = true ]; then
                    echo "   🔍 [DRY-RUN] Будет закрыт порт $port (PID: $PID, процесс: $PROCESS)"
                else
                    echo "   🔴 Закрываем порт $port..."
                    kill "$PID" 2>/dev/null
                    sleep 1
                    if ! ss -tulpn | grep -q ":$port "; then
                        echo "   ✅ Порт $port закрыт"
                        CLOSED_COUNT=$((CLOSED_COUNT + 1))
                    else
                        echo "   ❌ Не удалось закрыть порт $port"
                    fi
                fi
            else
                echo "   ⚠️  Пропускаем (критичный процесс: $PROCESS)"
            fi
        fi
        OPEN_COUNT=$((OPEN_COUNT + 1))
    else
        echo "✅ Порт $port: закрыт"
    fi
done

echo ""
echo "=== Проверка портов Cursor Server ==="
CURSOR_OPEN=0
CURSOR_CLOSED=0
for port in "${CURSOR_PORTS[@]}"; do
    if ss -tulpn | grep -q ":$port "; then
        PID=$(ss -tulpn | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1)
        PROCESS=$(ps -p "$PID" -o comm= 2>/dev/null)
        echo "⚠️  Порт $port: открыт (Cursor Server - $PROCESS, PID: $PID)"
        
        if [ "$KILL_CURSOR" = true ]; then
            if [ "$DRY_RUN" = true ]; then
                echo "   🔍 [DRY-RUN] Будет закрыт порт $port (Cursor Server, PID: $PID)"
            else
                echo "   🔴 Закрываем порт $port (Cursor Server)..."
                kill "$PID" 2>/dev/null
                sleep 1
                if ! ss -tulpn | grep -q ":$port "; then
                    echo "   ✅ Порт $port закрыт"
                    CURSOR_CLOSED=$((CURSOR_CLOSED + 1))
                else
                    echo "   ❌ Не удалось закрыть порт $port"
                fi
            fi
        else
            echo "   ⚠️  ВНИМАНИЕ: Закрытие этого порта остановит работу Cursor через SSH!"
            echo "   💡 Используйте: $0 --kill-cursor для закрытия портов Cursor Server"
        fi
        CURSOR_OPEN=$((CURSOR_OPEN + 1))
    else
        echo "✅ Порт $port: закрыт"
    fi
done

echo ""
echo "=== Результат ==="
echo "Открытых неиспользуемых портов: $OPEN_COUNT"
echo "Закрыто неиспользуемых портов: $CLOSED_COUNT"
echo "Открытых портов Cursor Server: $CURSOR_OPEN"
if [ "$KILL_CURSOR" = true ]; then
    echo "Закрыто портов Cursor Server: $CURSOR_CLOSED"
fi
echo ""

# Показываем все открытые порты
echo "=== Все открытые высокие порты на сервере ==="
ss -tulpn | grep LISTEN | awk '{print $5}' | sed 's/.*://' | sort -n | uniq | while read port; do
    if [ "$port" -gt 30000 ] && [ "$port" -lt 60000 ]; then
        PROCESS=$(ss -tulpn | grep ":$port " | grep -oP 'users:\(\(.*?\)' | head -1)
        echo "  ⚠️  Порт $port - $PROCESS"
    fi
done

echo ""
echo "=== Критичные порты (не трогаем) ==="
ss -tulpn | grep LISTEN | awk '{print $5}' | sed 's/.*://' | sort -n | uniq | while read port; do
    if [ "$port" -lt 10000 ]; then
        PROCESS=$(ss -tulpn | grep ":$port " | grep -oP 'users:\(\(.*?\)' | head -1)
        echo "  $port - $PROCESS"
    fi
done
