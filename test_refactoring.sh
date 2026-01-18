#!/bin/bash
# Быстрая проверка рефакторинга

echo "🧪 Тестирование рефакторинга xray-report-ui..."
echo ""

# Проверка структуры файлов
echo "📁 Проверка структуры файлов..."
if [ -f "/opt/xray-report-ui/templates/index.html" ]; then
    echo "  ✅ templates/index.html существует"
else
    echo "  ❌ templates/index.html НЕ НАЙДЕН"
fi

if [ -f "/opt/xray-report-ui/static/css/styles.css" ]; then
    echo "  ✅ static/css/styles.css существует"
else
    echo "  ❌ static/css/styles.css НЕ НАЙДЕН"
fi

JS_FILES=(i18n utils theme state management online users events settings collector system init)
for file in "${JS_FILES[@]}"; do
    if [ -f "/opt/xray-report-ui/static/js/${file}.js" ]; then
        echo "  ✅ static/js/${file}.js существует"
    else
        echo "  ❌ static/js/${file}.js НЕ НАЙДЕН"
    fi
done

echo ""
echo "🐍 Проверка Python модулей..."
if [ -f "/opt/xray-report-ui/config.py" ]; then
    echo "  ✅ config.py существует"
else
    echo "  ❌ config.py НЕ НАЙДЕН"
fi

PY_MODULES=(utils/file_ops utils/date_utils utils/system core/events core/backup core/settings)
for module in "${PY_MODULES[@]}"; do
    if [ -f "/opt/xray-report-ui/${module}.py" ]; then
        echo "  ✅ ${module}.py существует"
    else
        echo "  ❌ ${module}.py НЕ НАЙДЕН"
    fi
done

echo ""
echo "📊 Размеры файлов:"
echo "  HTML (старый): $(du -h /opt/xray-report-ui/index.html.backup 2>/dev/null | cut -f1 || echo 'нет')"
echo "  HTML (новый):  $(du -h /opt/xray-report-ui/templates/index.html 2>/dev/null | cut -f1 || echo 'нет')"
echo "  CSS:           $(du -h /opt/xray-report-ui/static/css/styles.css 2>/dev/null | cut -f1 || echo 'нет')"
echo "  JS (всего):    $(du -sh /opt/xray-report-ui/static/js/ 2>/dev/null | cut -f1 || echo 'нет')"

echo ""
echo "📚 Документация:"
if [ -f "/opt/xray-report-ui/REFACTORING_SUMMARY.md" ]; then
    echo "  ✅ REFACTORING_SUMMARY.md"
fi
if [ -f "/opt/xray-report-ui/NEXT_STEPS.md" ]; then
    echo "  ✅ NEXT_STEPS.md"
fi
if [ -f "/opt/xray-report-ui/REFACTORING_REPORT.md" ]; then
    echo "  ✅ REFACTORING_REPORT.md"
fi

echo ""
echo "🌐 Проверка синтаксиса Python..."
python3 -m py_compile /opt/xray-report-ui/config.py 2>/dev/null && echo "  ✅ config.py - OK" || echo "  ❌ config.py - ОШИБКА"
python3 -m py_compile /opt/xray-report-ui/utils/file_ops.py 2>/dev/null && echo "  ✅ utils/file_ops.py - OK" || echo "  ❌ utils/file_ops.py - ОШИБКА"
python3 -m py_compile /opt/xray-report-ui/core/events.py 2>/dev/null && echo "  ✅ core/events.py - OK" || echo "  ❌ core/events.py - ОШИБКА"

echo ""
echo "✅ Проверка завершена!"
echo ""
echo "💡 Для полной проверки:"
echo "   1. Перезапустить приложение: systemctl restart xray-report-ui"
echo "   2. Открыть в браузере: http://IP:8787"
echo "   3. Проверить что все вкладки работают"
echo "   4. Проверить в DevTools что статические файлы загружаются"
echo ""
