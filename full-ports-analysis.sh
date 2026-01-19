#!/bin/bash
# Полный анализ всех портов на сервере

echo "=========================================="
echo "  ПОЛНЫЙ АНАЛИЗ ВСЕХ ПОРТОВ"
echo "=========================================="
echo ""

# Получаем все уникальные порты (TCP + UDP)
ALL_PORTS=$( (ss -tlnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$'; ss -ulnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$') | sort -n | uniq)

echo "📊 ВСЕ ОТКРЫТЫЕ ПОРТЫ (TCP + UDP):"
echo ""

CRITICAL_COUNT=0
CURSOR_COUNT=0
SYSTEM_COUNT=0
VPN_COUNT=0
UNKNOWN_COUNT=0

for port in $ALL_PORTS; do
    # Проверяем TCP
    TCP_INFO=$(ss -tlnp | grep ":$port ")
    UDP_INFO=$(ss -ulnp | grep ":$port ")
    
    PORT_INFO="$TCP_INFO"
    PROTO="TCP"
    if [ -z "$TCP_INFO" ] && [ -n "$UDP_INFO" ]; then
        PORT_INFO="$UDP_INFO"
        PROTO="UDP"
    fi
    
    PID=$(echo "$PORT_INFO" | grep -oP 'pid=\K[0-9]+' | head -1)
    PROCESS=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
    PROCESS_PATH=$(ps -p "$PID" -o cmd= 2>/dev/null || echo "")
    HOST=$(echo "$PORT_INFO" | awk '{print $4}' | sed 's/:.*//' | head -1)
    
    PORT_TYPE=""
    PORT_DESC=""
    RECOMMENDATION=""
    CATEGORY=""
    
    case $port in
        22)
            PORT_TYPE="🔐 КРИТИЧНЫЙ"
            PORT_DESC="SSH - удаленный доступ к серверу"
            RECOMMENDATION="ОСТАВИТЬ - необходим для управления сервером"
            CATEGORY="critical"
            CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
            ;;
        53)
            PORT_TYPE="🔐 СИСТЕМНЫЙ"
            PORT_DESC="DNS (systemd-resolved) - разрешение доменных имен"
            RECOMMENDATION="ОСТАВИТЬ - системный сервис"
            CATEGORY="system"
            SYSTEM_COUNT=$((SYSTEM_COUNT + 1))
            ;;
        80)
            PORT_TYPE="🌐 КРИТИЧНЫЙ"
            PORT_DESC="HTTP (nginx) - веб-сервер"
            RECOMMENDATION="ОСТАВИТЬ - необходим для веб-доступа"
            CATEGORY="critical"
            CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
            ;;
        123)
            PORT_TYPE="🕐 СИСТЕМНЫЙ"
            PORT_DESC="NTP (Network Time Protocol) - синхронизация времени"
            RECOMMENDATION="ОСТАВИТЬ - системный сервис для синхронизации времени"
            CATEGORY="system"
            SYSTEM_COUNT=$((SYSTEM_COUNT + 1))
            ;;
        443)
            PORT_TYPE="🔐 КРИТИЧНЫЙ"
            PORT_DESC="Xray VPN - VPN сервер для клиентов (VLESS + Reality)"
            RECOMMENDATION="ОСТАВИТЬ - основной VPN порт"
            CATEGORY="critical"
            CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
            ;;
        1194)
            PORT_TYPE="🔐 VPN"
            PORT_DESC="OpenVPN - дополнительный VPN сервер"
            RECOMMENDATION="ПРОВЕРИТЬ - если не используете OpenVPN, можно закрыть"
            CATEGORY="vpn"
            VPN_COUNT=$((VPN_COUNT + 1))
            ;;
        3000)
            PORT_TYPE="🌐 КРИТИЧНЫЙ"
            PORT_DESC="Next.js Frontend - веб-интерфейс панели управления"
            RECOMMENDATION="ОСТАВИТЬ - основной UI"
            CATEGORY="critical"
            CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
            ;;
        8787)
            PORT_TYPE="🔧 КРИТИЧНЫЙ"
            PORT_DESC="Flask Backend API - REST API для управления"
            RECOMMENDATION="ОСТАВИТЬ - необходим для работы приложения"
            CATEGORY="critical"
            CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
            ;;
        10085)
            PORT_TYPE="🔧 КРИТИЧНЫЙ"
            PORT_DESC="Xray API - внутренний API для управления Xray (localhost)"
            RECOMMENDATION="ОСТАВИТЬ - необходим для управления Xray"
            CATEGORY="critical"
            CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
            ;;
        42725|51473)
            PORT_TYPE="🔐 XRAY UDP"
            PORT_DESC="Xray UDP порт - используется для VPN трафика"
            RECOMMENDATION="ОСТАВИТЬ - необходим для работы Xray VPN"
            CATEGORY="critical"
            CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
            ;;
        *)
            # Проверяем, является ли это портом Cursor Server
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
                CATEGORY="cursor"
                CURSOR_COUNT=$((CURSOR_COUNT + 1))
            else
                PORT_TYPE="❓ НЕИЗВЕСТНЫЙ"
                PORT_DESC="Неизвестный порт - процесс: $PROCESS"
                if [[ "$HOST" == "127.0.0.1" ]] || [[ "$HOST" == "::1" ]]; then
                    RECOMMENDATION="ПРОВЕРИТЬ - слушает только localhost, относительно безопасен"
                else
                    RECOMMENDATION="⚠️  ВНИМАНИЕ - доступен извне! Проверить немедленно!"
                fi
                CATEGORY="unknown"
                UNKNOWN_COUNT=$((UNKNOWN_COUNT + 1))
            fi
            ;;
    esac
    
    # Выводим информацию о порте
    printf "%-6s %-8s %-20s %-20s\n" "$port" "$PROTO" "$PORT_TYPE" "$PROCESS"
    printf "%-6s %-8s %-20s %-20s\n" "" "" "" "$PORT_DESC"
    printf "%-6s %-8s %-20s %-20s\n" "" "" "" "   Хост: $HOST"
    printf "%-6s %-8s %-20s %-20s\n" "" "" "" "   Рекомендация: $RECOMMENDATION"
    echo ""
done

echo "=========================================="
echo "  СВОДКА ПО КАТЕГОРИЯМ"
echo "=========================================="
echo ""
echo "🔐 Критичные порты: $CRITICAL_COUNT"
echo "🔐 Системные порты: $SYSTEM_COUNT"
echo "🔐 VPN порты: $VPN_COUNT"
echo "💻 Порты Cursor Server: $CURSOR_COUNT"
echo "❓ Неизвестные порты: $UNKNOWN_COUNT"
echo ""
TOTAL=$(echo "$ALL_PORTS" | wc -l)
echo "Всего уникальных портов: $TOTAL"
echo ""

# Проверяем OpenVPN
if [ -n "$(ss -ulnp | grep ':1194 ')" ]; then
    echo "=========================================="
    echo "  ⚠️  ОБНАРУЖЕН OPENVPN"
    echo "=========================================="
    echo ""
    echo "Порт 1194 используется OpenVPN."
    echo "Если вы не используете OpenVPN, его можно отключить:"
    echo "  sudo systemctl stop openvpn"
    echo "  sudo systemctl disable openvpn"
    echo ""
fi

# Проверяем Xray UDP порты
XRAY_UDP=$(ss -ulnp | grep 'xray' | grep -oP ':\K[0-9]+' | sort -n | uniq)
if [ -n "$XRAY_UDP" ]; then
    echo "=========================================="
    echo "  XRAY UDP ПОРТЫ"
    echo "=========================================="
    echo ""
    echo "Xray использует следующие UDP порты:"
    for port in $XRAY_UDP; do
        echo "  - $port (UDP)"
    done
    echo ""
    echo "Эти порты необходимы для работы Xray VPN."
    echo "Они используются для UDP трафика VPN клиентов."
    echo ""
fi

echo "=========================================="
echo "  РЕКОМЕНДАЦИИ ПО ОПТИМИЗАЦИИ"
echo "=========================================="
echo ""

if [ "$VPN_COUNT" -gt 0 ]; then
    echo "⚠️  Обнаружен OpenVPN на порту 1194:"
    echo "   - Если не используете OpenVPN, можно отключить"
    echo "   - Команда: sudo systemctl stop openvpn && sudo systemctl disable openvpn"
    echo ""
fi

if [ "$CURSOR_COUNT" -gt 0 ]; then
    echo "💻 Порты Cursor Server ($CURSOR_COUNT штук):"
    echo "   - Эти порты слушают только на localhost (127.0.0.1)"
    echo "   - Они безопасны и не доступны извне"
    echo "   - Если вы не используете Cursor через SSH, их можно закрыть:"
    echo "     ./cleanup-ports.sh --kill-cursor"
    echo ""
fi

if [ "$UNKNOWN_COUNT" -gt 0 ]; then
    echo "❓ Неизвестные порты ($UNKNOWN_COUNT штук):"
    echo "   - Рекомендуется проверить каждый порт вручную"
    echo "   - Используйте: lsof -i :PORT для детальной информации"
    echo ""
fi

echo "✅ Критичные и системные порты должны оставаться открытыми"
echo ""
