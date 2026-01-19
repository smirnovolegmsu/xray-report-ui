#!/bin/bash
# Правильный подсчет портов - разделение LISTEN и ESTABLISHED

echo "=========================================="
echo "  ПРАВИЛЬНЫЙ ПОДСЧЕТ ПОРТОВ"
echo "=========================================="
echo ""

# Порты в состоянии LISTEN (слушающие порты сервера)
LISTEN_PORTS=$( (ss -tlnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$'; ss -ulnp | awk '{print $4}' | sed 's/.*://' | grep -E '^[0-9]+$') | sort -n | uniq)
LISTEN_COUNT=$(echo "$LISTEN_PORTS" | wc -l)

# Порты в состоянии ESTABLISHED (активные соединения клиентов)
ESTAB_PORTS=$(ss -tunp | grep ESTAB | awk '{print $5}' | sed 's/.*://' | grep -E '^[0-9]+$' | sort -n | uniq)
ESTAB_COUNT=$(echo "$ESTAB_PORTS" | wc -l)

# Все уникальные порты (LISTEN + ESTABLISHED)
ALL_PORTS=$( (echo "$LISTEN_PORTS"; echo "$ESTAB_PORTS") | sort -n | uniq)
ALL_COUNT=$(echo "$ALL_PORTS" | wc -l)

echo "📊 СЛУШАЮЩИЕ ПОРТЫ (LISTEN) - это порты СЕРВЕРА:"
echo "   Количество: $LISTEN_COUNT"
echo "   Порты: $(echo "$LISTEN_PORTS" | tr '\n' ' ')"
echo ""

echo "📊 АКТИВНЫЕ СОЕДИНЕНИЯ (ESTABLISHED) - это порты КЛИЕНТОВ:"
echo "   Количество: $ESTAB_COUNT"
echo "   (Это временные порты клиентов, которые подключаются к серверу)"
echo ""

echo "📊 ВСЕГО УНИКАЛЬНЫХ ПОРТОВ (LISTEN + ESTABLISHED):"
echo "   Количество: $ALL_COUNT"
echo ""

echo "=========================================="
echo "  ВАЖНО: В ЧЕМ РАЗНИЦА?"
echo "=========================================="
echo ""
echo "✅ LISTEN порты - это порты СЕРВЕРА, которые слушают подключения"
echo "   Их нужно контролировать и оптимизировать"
echo ""
echo "⚠️  ESTABLISHED порты - это временные порты КЛИЕНТОВ"
echo "   Они появляются автоматически при подключении клиентов"
echo "   Их НЕ нужно закрывать - они закрываются сами при разрыве соединения"
echo ""

echo "=========================================="
echo "  ДЕТАЛЬНЫЙ АНАЛИЗ LISTEN ПОРТОВ"
echo "=========================================="
echo ""

for port in $LISTEN_PORTS; do
    TCP_INFO=$(ss -tlnp | grep ":$port ")
    UDP_INFO=$(ss -ulnp | grep ":$port ")
    
    if [ -n "$TCP_INFO" ]; then
        PROTO="TCP"
        PORT_INFO="$TCP_INFO"
    elif [ -n "$UDP_INFO" ]; then
        PROTO="UDP"
        PORT_INFO="$UDP_INFO"
    else
        continue
    fi
    
    PID=$(echo "$PORT_INFO" | grep -oP 'pid=\K[0-9]+' | head -1)
    PROCESS=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
    PROCESS_PATH=$(ps -p "$PID" -o cmd= 2>/dev/null || echo "")
    HOST=$(echo "$PORT_INFO" | awk '{print $4}' | sed 's/:.*//' | head -1)
    
    PORT_TYPE=""
    PORT_DESC=""
    
    # Сначала проверяем по процессу (для Xray UDP и Cursor)
    if [[ "$PROCESS" == "xray" ]] && [[ "$PROTO" == "UDP" ]]; then
        PORT_TYPE="🔐 Xray UDP"
        PORT_DESC="VPN трафик (UDP)"
    elif [[ "$PROCESS_PATH" == *"cursor-server"* ]] || [[ "$PROCESS_PATH" == *".cursor-server"* ]]; then
        PORT_TYPE="💻 Cursor"
        PORT_DESC="Cursor Server"
    else
        # Затем проверяем по номеру порта
        case $port in
            22)
                PORT_TYPE="🔐 SSH"
                PORT_DESC="Удаленный доступ"
                ;;
            53)
                PORT_TYPE="🔐 DNS"
                PORT_DESC="Разрешение доменных имен"
                ;;
            80)
                PORT_TYPE="🌐 HTTP"
                PORT_DESC="Веб-сервер"
                ;;
            123)
                PORT_TYPE="🕐 NTP"
                PORT_DESC="Синхронизация времени"
                ;;
            443)
                PORT_TYPE="🔐 Xray VPN"
                PORT_DESC="VPN сервер (TCP)"
                ;;
            1194)
                PORT_TYPE="🔐 OpenVPN"
                PORT_DESC="VPN сервер OpenVPN"
                ;;
            3000)
                PORT_TYPE="🌐 Next.js"
                PORT_DESC="Веб-интерфейс"
                ;;
            8787)
                PORT_TYPE="🔧 Flask API"
                PORT_DESC="Backend API"
                ;;
            10085)
                PORT_TYPE="🔧 Xray API"
                PORT_DESC="Внутренний API Xray"
                ;;
            *)
                PORT_TYPE="❓ Неизвестный"
                PORT_DESC="Требует проверки"
                ;;
        esac
    fi
    
    printf "%-6s %-4s %-15s %-20s %s\n" "$port" "$PROTO" "$PORT_TYPE" "$PROCESS" "$PORT_DESC"
done

echo ""
echo "=========================================="
echo "  РЕКОМЕНДАЦИИ"
echo "=========================================="
echo ""
echo "✅ КРИТИЧНЫЕ порты (не закрывать):"
echo "   - 22, 53, 80, 123, 443, 3000, 8787, 10085"
echo "   - Все UDP порты Xray (для VPN трафика)"
echo ""
echo "⚠️  ОПЦИОНАЛЬНЫЕ порты (можно закрыть):"
echo "   - 1194 (OpenVPN) - если не используете"
echo "   - 37011, 40783, 46705 (Cursor Server) - если не используете Cursor"
echo ""
echo "ℹ️  ESTABLISHED порты ($ESTAB_COUNT штук) - это НОРМАЛЬНО!"
echo "   Это временные порты клиентов, они закрываются автоматически"
echo ""
