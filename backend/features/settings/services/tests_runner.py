#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test runner - единая функция для запуска всех тестов с подробным выводом
"""
import os
import subprocess
import sys
from typing import Any, Dict, List, Optional
from datetime import datetime

from backend.features.settings.services.tests_logger import (
    save_test_result,
    parse_test_path
)


# Описание тестовых файлов и что они покрывают
TEST_DESCRIPTIONS = {
    "test_api_validation.py": {
        "module": "API Validation",
        "description": "Тесты валидации входных данных API",
        "covers": [
            "Валидация email адресов (валидные и невалидные форматы)",
            "Валидация UUID (формат UUID v4)",
            "Валидация имен файлов (защита от path traversal)"
        ],
        "importance": "high",
        "category": "validation"
    },
    "test_events.py": {
        "module": "Events",
        "description": "Тесты работы с событиями системы",
        "covers": [
            "Добавление событий (append_event)",
            "Автоматическое добавление timestamp",
            "Чтение событий с лимитом",
            "Порядок событий (новые первыми)"
        ],
        "importance": "high",
        "category": "events"
    },
    "test_settings.py": {
        "module": "Settings",
        "description": "Тесты управления настройками системы",
        "covers": [
            "Загрузка настроек по умолчанию",
            "Сохранение и загрузка настроек",
            "Пути из переменных окружения",
            "Слияние настроек с дефолтными"
        ],
        "importance": "critical",
        "category": "config"
    },
    "test_utils.py": {
        "module": "Utils",
        "description": "Тесты утилитарных функций",
        "covers": [
            "Генерация UTC ISO timestamp",
            "Атомарная запись текстовых файлов",
            "Атомарная запись JSON файлов",
            "Чтение JSON с дефолтными значениями",
            "API response helpers (ok, fail)"
        ],
        "importance": "high",
        "category": "utils"
    },
    "test_backups.py": {
        "module": "Backups",
        "description": "Тесты системы резервного копирования",
        "covers": [
            "Создание бэкапов файлов",
            "Список бэкапов",
            "Превью бэкапа",
            "Восстановление из бэкапа (preview и confirmed)"
        ],
        "importance": "critical",
        "category": "backups"
    },
    "test_xray.py": {
        "module": "Xray Config",
        "description": "Тесты работы с конфигурацией Xray",
        "covers": [
            "Загрузка конфигурации Xray",
            "Сохранение конфигурации",
            "Получение списка клиентов",
            "Установка клиентов",
            "Поиск VLESS inbound",
            "Получение Reality параметров"
        ],
        "importance": "critical",
        "category": "xray"
    },
    "test_users.py": {
        "module": "Users",
        "description": "Тесты управления пользователями",
        "covers": [
            "Добавление пользователя",
            "Добавление дубликата (должно вернуть ошибку)",
            "Удаление пользователя",
            "Удаление несуществующего пользователя",
            "Kick пользователя (регенерация UUID)",
            "Обновление алиаса пользователя",
            "Список пользователей",
            "Построение VLESS ссылок"
        ],
        "importance": "critical",
        "category": "users"
    },
    "test_live.py": {
        "module": "Live Service",
        "description": "Тесты live мониторинга",
        "covers": [
            "Получение текущих онлайн пользователей (get_live_now)",
            "Получение временных рядов (get_live_series)",
            "Получение топ пользователей (get_live_top)",
            "Обновление live buffer",
            "Загрузка buffer из дампа",
            "Парсинг access.log (с файлом и без)"
        ],
        "importance": "medium",
        "category": "live"
    },
    "test_collector.py": {
        "module": "Collector",
        "description": "Тесты коллектора статистики",
        "covers": [
            "Статус коллектора (без cron и с cron)",
            "Поиск cron задач",
            "Переключение коллектора (включить/выключить)",
            "Ручной запуск коллектора"
        ],
        "importance": "medium",
        "category": "collector"
    },
    "test_dashboard.py": {
        "module": "Dashboard",
        "description": "Тесты дашборда",
        "covers": [
            "Загрузка данных дашборда",
            "Загрузка usage дашборда",
            "Загрузка usage данных"
        ],
        "importance": "medium",
        "category": "dashboard"
    }
}


def run_pytest_tests(test_path: Optional[str] = None, verbose: bool = False) -> Dict[str, Any]:
    """
    Запустить pytest тесты
    
    Args:
        test_path: Путь к тесту или директории (None = все тесты)
        verbose: Подробный вывод
    
    Returns:
        Словарь с результатами выполнения
    """
    cmd = [sys.executable, "-m", "pytest"]
    
    if test_path:
        # Если передан только имя файла, добавляем путь
        if not test_path.startswith("tests/"):
            test_path = f"tests/{test_path}"

        # Security: prevent path traversal attacks
        backend_dir = "/opt/xray-report-ui/backend"
        full_path = os.path.join(backend_dir, test_path)
        real_backend_dir = os.path.realpath(backend_dir)
        real_full_path = os.path.realpath(full_path)

        if not real_full_path.startswith(real_backend_dir + os.sep):
            return {
                "ok": False,
                "success": False,
                "error": "Access denied: path traversal attempt",
                "return_code": 1,
                "summary": {"passed": 0, "failed": 0, "errors": 0, "total": 0},
                "tests": []
            }

        if not os.path.exists(real_full_path):
            return {
                "ok": False,
                "success": False,
                "error": f"Test path not found: {test_path}",
                "return_code": 1,
                "summary": {"passed": 0, "failed": 0, "errors": 0, "total": 0},
                "tests": []
            }
        cmd.append(test_path)
    else:
        cmd.append("tests/")
    
    if verbose:
        cmd.append("-v")
    else:
        cmd.append("--tb=short")
    
    try:
        env = os.environ.copy()
        env["PYTHONPATH"] = "/opt/xray-report-ui"
        
        result = subprocess.run(
            cmd,
            cwd="/opt/xray-report-ui/backend",
            capture_output=True,
            text=True,
            timeout=300,
            env=env
        )
        
        # Парсим вывод pytest
        output_lines = result.stdout.split("\n")
        tests = []
        summary = {"passed": 0, "failed": 0, "errors": 0, "total": 0}
        
        for line in output_lines:
            if "PASSED" in line:
                summary["passed"] += 1
                summary["total"] += 1
                # Извлекаем имя теста
                if "::" in line:
                    test_name = line.split("::")[-1].split()[0] if "::" in line else line.split()[-2]
                    tests.append({"name": test_name, "status": "passed"})
            elif "FAILED" in line:
                summary["failed"] += 1
                summary["total"] += 1
                if "::" in line:
                    test_name = line.split("::")[-1].split()[0] if "::" in line else line.split()[-2]
                    tests.append({"name": test_name, "status": "failed"})
            elif "ERROR" in line:
                summary["errors"] += 1
                summary["total"] += 1
                if "::" in line:
                    test_name = line.split("::")[-1].split()[0] if "::" in line else line.split()[-2]
                    tests.append({"name": test_name, "status": "error"})
        
        # Ищем итоговую строку
        for line in reversed(output_lines):
            if "passed" in line.lower() and ("failed" in line.lower() or "error" in line.lower()):
                # Парсим итоговую строку типа "28 passed, 5 failed in 0.52s"
                import re
                match = re.search(r'(\d+)\s+passed', line)
                if match:
                    summary["passed"] = int(match.group(1))
                match = re.search(r'(\d+)\s+failed', line)
                if match:
                    summary["failed"] = int(match.group(1))
                match = re.search(r'(\d+)\s+error', line)
                if match:
                    summary["errors"] = int(match.group(1))
                summary["total"] = summary["passed"] + summary["failed"] + summary["errors"]
                break
        
        return {
            "ok": True,
            "success": result.returncode == 0,
            "return_code": result.returncode,
            "summary": summary,
            "tests": tests,
            "output": result.stdout,
            "error_output": result.stderr,
            "test_path": test_path
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "success": False,
            "error": "timeout",
            "return_code": -1,
            "summary": {"passed": 0, "failed": 0, "errors": 0, "total": 0},
            "tests": []
        }
    except Exception as e:
        return {
            "ok": False,
            "success": False,
            "error": str(e),
            "return_code": -1,
            "summary": {"passed": 0, "failed": 0, "errors": 0, "total": 0},
            "tests": []
        }


def run_all_tests(verbose: bool = False) -> Dict[str, Any]:
    """
    Запустить все тесты подряд с подробным выводом
    
    Args:
        verbose: Подробный вывод
    
    Returns:
        Словарь с результатами всех тестов
    """
    test_files = [
        "test_api_validation.py",
        "test_events.py",
        "test_settings.py",
        "test_utils.py",
        "test_backups.py",
        "test_xray.py",
        "test_users.py",
        "test_live.py",
        "test_collector.py",
        "test_dashboard.py",
    ]
    
    results = {
        "started_at": datetime.utcnow().isoformat() + "Z",
        "test_files": [],
        "summary": {
            "total_files": len(test_files),
            "passed_files": 0,
            "failed_files": 0,
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "error_tests": 0
        },
        "details": []
    }
    
    print("=" * 80)
    print("ЗАПУСК ВСЕХ ТЕСТОВ")
    print("=" * 80)
    print()
    
    for test_file in test_files:
        test_info = TEST_DESCRIPTIONS.get(test_file, {})
        module_name = test_info.get("module", test_file.replace("test_", "").replace(".py", ""))
        description = test_info.get("description", "Тесты модуля")
        
        print(f"[{test_file}]")
        print(f"  Модуль: {module_name}")
        print(f"  Описание: {description}")
        print(f"  Запуск...", end=" ", flush=True)
        
        # Запускаем тест
        result = run_pytest_tests(test_file, verbose=verbose)
        
        # Сохраняем результат в историю
        parsed = parse_test_path(test_file)
        save_test_result(
            test_path=test_file,
            test_module=parsed.get("test_module"),
            result=result,
            summary=result.get("summary", {}),
            tests=result.get("tests", []),
            error=result.get("error")
        )
        
        # Формируем вывод
        summary = result.get("summary", {})
        passed = summary.get("passed", 0)
        failed = summary.get("failed", 0)
        errors = summary.get("errors", 0)
        total = summary.get("total", 0)
        
        if result.get("success"):
            status = "✓ ПРОЙДЕНО"
            results["summary"]["passed_files"] += 1
        else:
            status = "✗ ПРОВАЛЕНО"
            results["summary"]["failed_files"] += 1
        
        print(status)
        print(f"  Результат: {passed} пройдено, {failed} провалено, {errors} ошибок (всего {total})")
        
        # Комментарий к результату
        comment = _generate_comment(test_file, result, test_info)
        if comment:
            print(f"  Комментарий: {comment}")
        
        # Детали проваленных тестов
        if failed > 0 or errors > 0:
            failed_tests = [t for t in result.get("tests", []) if t.get("status") in ["failed", "error"]]
            if failed_tests:
                print(f"  Проваленные тесты:")
                for test in failed_tests[:5]:  # Показываем первые 5
                    print(f"    - {test.get('name')}")
                if len(failed_tests) > 5:
                    print(f"    ... и еще {len(failed_tests) - 5}")
        
        print()
        
        # Сохраняем детали
        results["test_files"].append({
            "file": test_file,
            "module": module_name,
            "success": result.get("success", False),
            "summary": summary,
            "comment": comment
        })
        
        results["summary"]["total_tests"] += total
        results["summary"]["passed_tests"] += passed
        results["summary"]["failed_tests"] += failed
        results["summary"]["error_tests"] += errors
        
        results["details"].append({
            "file": test_file,
            "result": result
        })
    
    # Итоговая статистика
    results["finished_at"] = datetime.utcnow().isoformat() + "Z"
    results["success"] = results["summary"]["failed_files"] == 0
    
    print("=" * 80)
    print("ИТОГОВАЯ СТАТИСТИКА")
    print("=" * 80)
    print(f"Файлов тестов: {results['summary']['total_files']}")
    print(f"  ✓ Успешно: {results['summary']['passed_files']}")
    print(f"  ✗ Провалено: {results['summary']['failed_files']}")
    print()
    print(f"Всего тестов: {results['summary']['total_tests']}")
    print(f"  ✓ Пройдено: {results['summary']['passed_tests']}")
    print(f"  ✗ Провалено: {results['summary']['failed_tests']}")
    print(f"  ⚠ Ошибок: {results['summary']['error_tests']}")
    print()
    
    success_rate = (results['summary']['passed_tests'] / results['summary']['total_tests'] * 100) if results['summary']['total_tests'] > 0 else 0
    print(f"Успешность: {success_rate:.1f}%")
    print()
    
    if results['summary']['failed_files'] > 0:
        print("ПРОВАЛЕННЫЕ МОДУЛИ:")
        for test_file_info in results["test_files"]:
            if not test_file_info["success"]:
                print(f"  ✗ {test_file_info['file']} - {test_file_info['module']}")
                print(f"    {test_file_info['comment']}")
        print()
    
    print("=" * 80)
    
    # Сохраняем общий результат в историю
    save_test_result(
        test_path=None,
        test_module="all_tests",
        result=results,
        summary={
            "passed": results['summary']['passed_tests'],
            "failed": results['summary']['failed_tests'],
            "errors": results['summary']['error_tests'],
            "total": results['summary']['total_tests']
        },
        tests=[],
        error=None
    )
    
    return results


def _generate_comment(test_file: str, result: Dict[str, Any], test_info: Dict[str, Any]) -> str:
    """
    Генерирует комментарий к результатам теста
    
    Args:
        test_file: Имя файла теста
        result: Результат выполнения
        test_info: Информация о тесте
    
    Returns:
        Комментарий
    """
    summary = result.get("summary", {})
    passed = summary.get("passed", 0)
    failed = summary.get("failed", 0)
    errors = summary.get("errors", 0)
    total = summary.get("total", 0)
    
    if result.get("success"):
        if passed == total:
            return "Все тесты пройдены успешно"
        else:
            return f"Частичный успех: {passed}/{total} тестов пройдено"
    else:
        if errors > 0:
            return f"Критические ошибки при выполнении ({errors} ошибок)"
        elif failed > 0:
            importance = test_info.get("importance", "medium")
            if importance == "critical":
                return f"КРИТИЧНО: Провалено {failed} тестов в критическом модуле"
            elif importance == "high":
                return f"Важно: Провалено {failed} тестов в важном модуле"
            else:
                return f"Провалено {failed} тестов"
        else:
            return "Неизвестная ошибка"