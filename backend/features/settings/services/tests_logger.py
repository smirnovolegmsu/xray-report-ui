#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test results logger - сохраняет результаты тестов в JSON файл
"""
import os
from typing import Any, Dict, List, Optional

from backend.core.helpers import atomic_write_json, read_json, now_utc_iso
from backend.core.config import load_settings, ensure_dirs

# Максимальное количество записей в истории (последние 1000 запусков)
MAX_HISTORY_ENTRIES = 1000


def get_tests_history_path() -> str:
    """Получить путь к файлу истории тестов"""
    settings = load_settings()
    data_dir = settings.get("paths", {}).get("data_dir", "/opt/xray-report-ui/data")
    return os.path.join(data_dir, "tests_history.json")


def save_test_result(
    test_path: Optional[str] = None,
    test_module: Optional[str] = None,
    test_function: Optional[str] = None,
    api_endpoint: Optional[str] = None,
    feature_module: Optional[str] = None,
    result: Optional[Dict[str, Any]] = None,
    summary: Optional[Dict[str, Any]] = None,
    tests: Optional[List[Dict[str, Any]]] = None,
    error: Optional[str] = None
) -> str:
    """
    Сохранить результат теста в историю
    
    Args:
        test_path: Путь к тестовому файлу (например, "tests/test_users.py")
        test_module: Модуль, который тестировался (например, "users", "backups")
        test_function: Конкретная функция/метод, который тестировался
        api_endpoint: API endpoint, который тестировался (например, "/api/users/add")
        feature_module: Feature модуль, который тестировался (например, "features.users")
        result: Полный результат выполнения теста
        summary: Сводка результатов (passed, failed, errors, total)
        tests: Список отдельных тестов с результатами
        error: Сообщение об ошибке, если тест не выполнился
    
    Returns:
        ID записи в истории
    """
    result = result or {}
    summary = summary or result.get("summary", {})
    tests = tests or result.get("tests", [])
    
    # Определяем, что именно тестировалось
    tested_item = None
    tested_type = None
    
    if api_endpoint:
        tested_item = api_endpoint
        tested_type = "api_endpoint"
    elif feature_module:
        tested_item = feature_module
        tested_type = "feature_module"
    elif test_module:
        tested_item = test_module
        tested_type = "test_module"
    elif test_path:
        # Извлекаем модуль из пути
        if "test_" in test_path:
            module_name = test_path.replace("tests/test_", "").replace(".py", "").split("::")[0]
            tested_item = module_name
            tested_type = "test_file"
        else:
            tested_item = test_path
            tested_type = "test_path"
    else:
        tested_item = "all_tests"
        tested_type = "all"
    
    # Определяем, что конкретно тестировалось
    what_tested = []
    if test_function:
        what_tested.append(f"function: {test_function}")
    if tests:
        test_names = [t.get("name", "") for t in tests if t.get("name")]
        if test_names:
            what_tested.append(f"tests: {', '.join(test_names[:5])}")  # Первые 5 тестов
            if len(test_names) > 5:
                what_tested.append(f"... and {len(test_names) - 5} more")
    
    # Формируем запись
    entry = {
        "id": now_utc_iso(),  # Используем timestamp как ID
        "timestamp": now_utc_iso(),
        "tested_type": tested_type,
        "tested_item": tested_item,
        "test_path": test_path,
        "test_module": test_module,
        "test_function": test_function,
        "api_endpoint": api_endpoint,
        "feature_module": feature_module,
        "what_tested": ", ".join(what_tested) if what_tested else "all tests",
        "success": result.get("success", False) if result else False,
        "return_code": result.get("return_code", -1) if result else -1,
        "summary": summary,
        "tests_count": len(tests) if tests else 0,
        "error": error,
        "response": {
            "passed": summary.get("passed", 0),
            "failed": summary.get("failed", 0),
            "errors": summary.get("errors", 0),
            "total": summary.get("total", 0)
        }
    }
    
    # Загружаем существующую историю
    history = load_tests_history()
    
    # Добавляем новую запись в начало (новые записи первыми)
    history.insert(0, entry)
    
    # Ограничиваем количество записей
    if len(history) > MAX_HISTORY_ENTRIES:
        history = history[:MAX_HISTORY_ENTRIES]
    
    # Сохраняем обратно
    ensure_tests_history_file()
    history_path = get_tests_history_path()
    atomic_write_json(history_path, {"history": history, "total": len(history)})
    
    return entry["id"]


def load_tests_history(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Загрузить историю тестов
    
    Args:
        limit: Максимальное количество записей для возврата
    
    Returns:
        Список записей истории (новые первыми)
    """
    ensure_tests_history_file()
    
    history_path = get_tests_history_path()
    data = read_json(history_path, {"history": [], "total": 0})
    history = data.get("history", [])
    
    if limit:
        return history[:limit]
    
    return history


def get_tests_history_stats() -> Dict[str, Any]:
    """
    Получить статистику по истории тестов
    
    Returns:
        Словарь со статистикой
    """
    history = load_tests_history()
    
    if not history:
        return {
            "total_runs": 0,
            "successful_runs": 0,
            "failed_runs": 0,
            "total_tests_passed": 0,
            "total_tests_failed": 0,
            "last_run": None,
            "success_rate": 0.0
        }
    
    successful_runs = sum(1 for entry in history if entry.get("success", False))
    failed_runs = len(history) - successful_runs
    
    total_passed = sum(entry.get("response", {}).get("passed", 0) for entry in history)
    total_failed = sum(entry.get("response", {}).get("failed", 0) for entry in history)
    
    return {
        "total_runs": len(history),
        "successful_runs": successful_runs,
        "failed_runs": failed_runs,
        "total_tests_passed": total_passed,
        "total_tests_failed": total_failed,
        "last_run": history[0] if history else None,
        "success_rate": round(successful_runs / len(history) * 100, 2) if history else 0.0
    }


def ensure_tests_history_file() -> None:
    """Убедиться, что файл истории тестов существует"""
    history_path = get_tests_history_path()
    if not os.path.exists(history_path):
        ensure_dirs()
        atomic_write_json(history_path, {"history": [], "total": 0})


def parse_test_path(test_path: str) -> Dict[str, Optional[str]]:
    """
    Парсит путь к тесту и извлекает информацию о модуле
    
    Args:
        test_path: Путь к тесту (например, "tests/test_users.py::TestUserOperations::test_add_user")
    
    Returns:
        Словарь с информацией о модуле, классе и функции
    """
    result = {
        "test_file": None,
        "test_module": None,
        "test_class": None,
        "test_function": None
    }
    
    if not test_path:
        return result
    
    # Убираем путь к директории tests
    if "tests/" in test_path:
        test_path = test_path.split("tests/")[-1]
    
    # Разделяем по ::
    parts = test_path.split("::")
    
    if len(parts) >= 1:
        # Первая часть - файл
        file_part = parts[0]
        if file_part.endswith(".py"):
            result["test_file"] = file_part
            # Извлекаем модуль из имени файла
            if file_part.startswith("test_"):
                module_name = file_part.replace("test_", "").replace(".py", "")
                result["test_module"] = module_name
    
    if len(parts) >= 2:
        # Вторая часть - класс
        result["test_class"] = parts[1]
    
    if len(parts) >= 3:
        # Третья часть - функция
        result["test_function"] = parts[2]
    
    return result
