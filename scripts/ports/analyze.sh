#!/bin/bash
# Скрипт для анализа всех открытых портов на сервере

echo "=========================================="
echo "  АНАЛИЗ ОТКРЫТЫХ ПОРТОВ НА СЕРВЕРЕ"
echo "=========================================="
echo ""

# Получаем все открытые порты
ALL_PORTS=$(ss -tulpn | grep LISTEN | awk '{print $5}' | sed 's/.*://' | sort -n | uniq)

echo "📊 ОТКРЫТЫЕ ПОРТЫ:"
echo ""

# Категории портов
CRITICAL_PORTS=()
CURSOR_PORTS=()
UNKNOWN_PORTS=()

for port in $ALL_PORTS; do
    # Получаем информацию о процессе
    PORT_INFO=$(ss -tulpn | grep ":$port ")
    PID=$(echo "$PORT_INFO" | grep -oP 'pid=\K[0-9]+' | head -1)
    PROCESS=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
    HOST=$(echo "$PORT_INFO" | awk '{print $4}' | sed 's/:.*//')
    
    # Определяем тип порта
    PORT_TYPE=""
    PORT_DESC=""
    RECOMMENDATION=""
    
    case $port in
        22)
            PORT_TYPE="🔐 КРИТИЧНЫЙ"
            PORT_DESC="SSH - удаленный доступ к серверу"
            RECOMMENDATION="ОСТАВИТЬ - необходим для управления сервером"
            CRITICAL_PORTS+=($port)
            ;;
        53)
            PORT_TYPE="🔐 СИСТЕМНЫЙ"
            PORT_DESC="DNS (systemd-resolved) - разрешение доменных имен"
            RECOMMENDATION="ОСТАВИТЬ - системный сервис"
            CRITICAL_PORTS+=($port)
            ;;
        80)
            PORT_TYPE="🌐 КРИТИЧНЫЙ"
            PORT_DESC="HTTP (nginx) - веб-сервер"
            RECOMMENDATION="ОСТАВИТЬ - необходим для веб-доступа"
            CRITICAL_PORTS+=($port)
            ;;
        443)
            PORT_TYPE="🔐 КРИТИЧНЫЙ"
            PORT_DESC="Xray VPN - VPN сервер для клиентов"
            RECOMMENDATION="ОСТАВИТЬ - основной VPN порт"
            CRITICAL_PORTS+=($port)
            ;;
        3000)
            PORT_TYPE="🌐 КРИТИЧНЫЙ"
            PORT_DESC="Next.js Frontend - веб-интерфейс панели управления"
            RECOMMENDATION="ОСТАВИТЬ - основной UI"
            CRITICAL_PORTS+=($port)
            ;;
        8787)
            PORT_TYPE="🔧 КРИТИЧНЫЙ"
            PORT_DESC="Flask Backend API - REST API для управления"
            RECOMMENDATION="ОСТАВИТЬ - необходим для работы приложения"
            CRITICAL_PORTS+=($port)
            ;;
        10085)
            PORT_TYPE="🔧 КРИТИЧНЫЙ"
            PORT_DESC="Xray API - внутренний API для управления Xray (localhost)"
            RECOMMENDATION="ОСТАВИТЬ - необходим для управления Xray"
            CRITICAL_PORTS+=($port)
            ;;
        *)
            # Проверяем, является ли это портом Cursor Server
            # Cursor Server процессы обычно содержат "cursor-server" в пути
            PROCESS_PATH=$(ps -p "$PID" -o cmd= 2>/dev/null || echo "")
            if [[ "$PROCESS_PATH" == *"cursor-server"* ]] || [[ "$PROCESS_PATH" == *".cursor-server"* ]] || ([[ "$HOST" == "127.0.0.1" ]] && [[ "$port" -gt 30000 ]] && [[ "$port" -lt 60000 ]]); then
                PORT_TYPE="💻 CURSOR SERVER"
                if [[ "$PROCESS_PATH" == *"server-main"* ]]; then
                    PORT_DESC="Cursor Server Main - основной сервер для работы Cursor через SSH (localhost)"
                elif [[ "$PROCESS_PATH" == *"extensionHost"* ]]; then
                    PORT_DESC="Cursor Extension Host - хост расширений Cursor (localhost)"
                elif [[ "$PROCESS_PATH" == *"multiplex-server"* ]]; then
                    PORT_DESC="Cursor Multiplex Server - мультиплексный сервер Cursor (localhost)"
                else
                    PORT_DESC="Cursor Server - для работы Cursor через SSH (localhost)"
                fi
                RECOMMENDATION="ОСТАВИТЬ (если используете Cursor) или ЗАКРЫТЬ (если не нужен)"
                CURSOR_PORTS+=($port)
            else
                PORT_TYPE="❓ НЕИЗВЕСТНЫЙ"
                PORT_DESC="Неизвестный порт - процесс: $PROCESS"
                if [[ "$HOST" == "127.0.0.1" ]]; then
                    RECOMMENDATION="ПРОВЕРИТЬ - слушает только localhost, относительно безопасен"
                else
                    RECOMMENDATION="⚠️  ВНИМАНИЕ - доступен извне! Проверить немедленно!"
                fi
                UNKNOWN_PORTS+=($port)
            fi
            ;;
    esac
    
    # Выводим информацию о порте
    printf "%-6s %-20s %-15s %-30s\n" "$port" "$PORT_TYPE" "$PROCESS" "$PORT_DESC"
    printf "%-6s %-20s %-15s %-30s\n" "" "" "" "   Хост: $HOST"
    printf "%-6s %-20s %-15s %-30s\n" "" "" "" "   Рекомендация: $RECOMMENDATION"
    echo ""
done

echo "=========================================="
echo "  СВОДКА"
echo "=========================================="
echo ""
echo "🔐 Критичные порты (${#CRITICAL_PORTS[@]}): ${CRITICAL_PORTS[*]}"
echo "💻 Порты Cursor Server (${#CURSOR_PORTS[@]}): ${CURSOR_PORTS[*]}"
echo "❓ Неизвестные порты (${#UNKNOWN_PORTS[@]}): ${UNKNOWN_PORTS[*]}"
echo ""
echo "Всего открытых портов: $(echo "$ALL_PORTS" | wc -l)"
echo ""

# Проверяем firewall правила
echo "=========================================="
echo "  ПРАВИЛА FIREWALL (UFW)"
echo "=========================================="
echo ""
if command -v ufw &> /dev/null; then
    sudo ufw status numbered 2>/dev/null | head -20
else
    echo "UFW не установлен или недоступен"
fi
echo ""

# Рекомендации
echo "=========================================="
echo "  РЕКОМЕНДАЦИИ ПО ОПТИМИЗАЦИИ"
echo "=========================================="
echo ""

if [ ${#CURSOR_PORTS[@]} -gt 0 ]; then
    echo "⚠️  Порты Cursor Server (${CURSOR_PORTS[*]}):"
    echo "   - Эти порты слушают только на localhost (127.0.0.1)"
    echo "   - Они безопасны и не доступны извне"
    echo "   - Если вы не используете Cursor через SSH, их можно закрыть:"
    echo "     ./scripts/ports/cleanup.sh --kill-cursor"
    echo ""
fi

if [ ${#UNKNOWN_PORTS[@]} -gt 0 ]; then
    echo "⚠️  Неизвестные порты (${UNKNOWN_PORTS[*]}):"
    echo "   - Рекомендуется проверить каждый порт вручную"
    echo "   - Используйте: lsof -i :PORT для детальной информации"
    echo ""
fi

echo "✅ Критичные порты должны оставаться открытыми"
echo ""
