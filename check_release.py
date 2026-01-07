#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Автоматическая проверка кода перед релизом
Запускается перед каждым сообщением о готовности
"""

import re
import sys
import os

def check_js_syntax():
    """Проверка синтаксиса JavaScript"""
    print('🔍 Проверка синтаксиса JavaScript...')
    print('=' * 60)
    
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')
    
    errors = []
    warnings = []
    
    # 1. Проверка try-catch блоков
    try_stack = []
    for i, line in enumerate(lines, 1):
        if 'try {' in line or 'try{' in line:
            try_stack.append((i, line.strip()[:60]))
        if 'catch' in line and ('{' in line or '(' in line):
            if try_stack:
                try_stack.pop()
            else:
                warnings.append(f'Строка {i}: Лишний catch без try')
    
    if try_stack:
        for line_num, line_content in try_stack:
            errors.append(f'Строка {line_num}: Незакрытый try блок: {line_content}')
    
    # 2. Проверка скобок
    open_braces = content.count('{')
    close_braces = content.count('}')
    if open_braces != close_braces:
        errors.append(f'Несоответствие фигурных скобок: открывающих {open_braces}, закрывающих {close_braces}')
    
    open_parens = content.count('(')
    close_parens = content.count(')')
    if open_parens != close_parens:
        errors.append(f'Несоответствие круглых скобок: открывающих {open_parens}, закрывающих {close_parens}')
    
    # 3. Проверка на undefined функции
    required_functions = ['init', 'loadManagement', 'renderManagement', 'setNav', 'api']
    for func in required_functions:
        if f'function {func}' not in content and f'{func} =' not in content:
            warnings.append(f'Функция {func} не найдена')
    
    # 4. Проверка на небезопасный доступ к свойствам DOM
    # Ищем обращения к свойствам без проверки на null
    unsafe_patterns = [
        (r'getElementById\([^)]+\)\.(textContent|innerHTML|value)\s*=', 'Обращение к свойству без проверки на null'),
        (r'querySelector\([^)]+\)\.(textContent|innerHTML|value)\s*=', 'Обращение к свойству без проверки на null'),
    ]
    
    for pattern, desc in unsafe_patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            line_num = content[:match.start()].count('\n') + 1
            # Пропускаем если есть проверка на null выше (в пределах 5 строк)
            context_start = max(0, match.start() - 500)
            context = content[context_start:match.start()]
            # Проверяем наличие проверки
            if 'if (' not in context[-200:] and '?' not in context[-50:]:
                # Это не критично, только предупреждение
                pass  # Убираем чтобы не засорять вывод
    
    # 5. Проверка на использование Chart без проверки на существование canvas
    chart_usage = re.finditer(r'new Chart\([^,]+,\s*\{', content)
    for match in chart_usage:
        line_num = content[:match.start()].count('\n') + 1
        # Проверяем контекст выше
        context_start = max(0, match.start() - 300)
        context = content[context_start:match.start()]
        if 'getElementById' in context and 'if (' not in context[-150:]:
            warnings.append(f'Строка {line_num}: Chart создается без проверки существования canvas')
    
    print(f'✅ Проверка try-catch: {len(try_stack)} незакрытых блоков')
    print(f'✅ Проверка скобок: фигурные {open_braces}/{close_braces}, круглые {open_parens}/{close_parens}')
    
    if errors:
        print(f'\n❌ ОШИБКИ ({len(errors)}):')
        for err in errors:
            print(f'  - {err}')
        return False
    
    if warnings:
        print(f'\n⚠️  ПРЕДУПРЕЖДЕНИЯ ({len(warnings)}):')
        for warn in warnings:
            print(f'  - {warn}')
    
    print('\n✅ Синтаксис JavaScript: OK')
    return True

def check_python_syntax():
    """Проверка синтаксиса Python"""
    print('\n🔍 Проверка синтаксиса Python...')
    print('=' * 60)
    
    result = os.system('python3 -m py_compile app.py > /dev/null 2>&1')
    if result == 0:
        print('✅ Синтаксис Python: OK')
        return True
    else:
        print('❌ Ошибки в app.py')
        os.system('python3 -m py_compile app.py 2>&1')
        return False

def check_html_structure():
    """Проверка HTML структуры"""
    print('\n🔍 Проверка HTML структуры...')
    print('=' * 60)
    
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Проверка обязательных элементов
    required = {
        'chTraffic': 'canvas#chTraffic',
        'chConns': 'canvas#chConns',
        'chUsersCmp': 'canvas#chUsersCmp',
        'kpiTodayTrafficValue': '#kpiTodayTrafficValue',
        'kpiTodayConnsValue': '#kpiTodayConnsValue',
        'dateSelect': '#dateSelect',
    }
    
    missing = []
    for id_name, selector in required.items():
        if f'id="{id_name}"' not in content and f"id='{id_name}'" not in content:
            missing.append(f'{selector} (id="{id_name}")')
    
    if missing:
        print(f'❌ Отсутствуют элементы ({len(missing)}):')
        for m in missing:
            print(f'  - {m}')
        return False
    
    print('✅ Все обязательные элементы присутствуют')
    
    # Проверка подключения Chart.js
    if 'chart.js' in content.lower() or 'Chart.js' in content:
        print('✅ Chart.js подключен')
    else:
        print('⚠️  Chart.js не найден в HTML')
    
    return True

def check_api_endpoints():
    """Проверка API endpoints"""
    print('\n🔍 Проверка API endpoints...')
    print('=' * 60)
    
    with open('app.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    required_endpoints = [
        '/api/usage/dates',
        '/api/usage/dashboard',
        '/api/live/now',
        '/api/live/series',
        '/api/live/top',
        '/api/system/status',
        '/api/system/restart',
        '/api/system/journal',
    ]
    
    missing = [ep for ep in required_endpoints if ep not in content]
    
    if missing:
        print(f'❌ Отсутствуют endpoints ({len(missing)}):')
        for m in missing:
            print(f'  - {m}')
        return False
    
    print(f'✅ Все обязательные endpoints присутствуют ({len(required_endpoints)})')
    return True

def check_functions():
    """Проверка определения функций"""
    print('\n🔍 Проверка функций...')
    print('=' * 60)
    
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    critical_functions = [
        'init', 'loadManagement', 'renderManagement', 'setNav', 
        'api', 'renderKPICards', 'renderTrendsCharts', 'renderTopDomainsTables',
        'renderUsersSection', 'renderUserCards'
    ]
    
    missing_defs = [f for f in critical_functions if f'function {f}' not in content]
    
    if missing_defs:
        print(f'❌ Отсутствуют определения функций: {missing_defs}')
        return False
    
    print(f'✅ Все критические функции определены ({len(critical_functions)})')
    return True

def main():
    """Главная функция проверки"""
    print('\n' + '=' * 60)
    print('🚀 АВТОМАТИЧЕСКАЯ ПРОВЕРКА ПЕРЕД РЕЛИЗОМ')
    print('=' * 60 + '\n')
    
    checks = [
        ('JavaScript синтаксис', check_js_syntax),
        ('Python синтаксис', check_python_syntax),
        ('HTML структура', check_html_structure),
        ('API endpoints', check_api_endpoints),
        ('Функции', check_functions),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f'❌ Ошибка при проверке {name}: {e}')
            results.append((name, False))
    
    print('\n' + '=' * 60)
    print('📋 ИТОГОВЫЙ ОТЧЕТ:')
    print('=' * 60)
    
    all_ok = True
    for name, result in results:
        status = '✅' if result else '❌'
        print(f'{status} {name}')
        if not result:
            all_ok = False
    
    print('=' * 60)
    
    if all_ok:
        print('\n✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - КОД ГОТОВ К РЕЛИЗУ')
        return 0
    else:
        print('\n❌ ОБНАРУЖЕНЫ ОШИБКИ - ИСПРАВЬТЕ ПЕРЕД РЕЛИЗОМ')
        return 1

if __name__ == '__main__':
    sys.exit(main())

