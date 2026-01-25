#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Custom exceptions and error handlers for Xray Report UI
"""
from flask import jsonify
from structlog import get_logger


# ============================================================================
# Custom Exceptions
# ============================================================================

class XrayReportError(Exception):
    """Базовое исключение для всех ошибок приложения"""
    pass


class UserNotFoundError(XrayReportError):
    """Пользователь не найден"""
    pass


class UserAlreadyExistsError(XrayReportError):
    """Пользователь уже существует"""
    pass


class XrayConfigError(XrayReportError):
    """Ошибка конфигурации Xray"""
    pass


class XrayConfigNotFoundError(XrayConfigError):
    """Файл конфигурации Xray не найден"""
    pass


class XrayConfigInvalidError(XrayConfigError):
    """Невалидная конфигурация Xray"""
    pass


class BackupError(XrayReportError):
    """Ошибка при работе с бэкапами"""
    pass


class BackupNotFoundError(BackupError):
    """Бэкап не найден"""
    pass


class SettingsError(XrayReportError):
    """Ошибка настроек"""
    pass


class ValidationError(XrayReportError):
    """Ошибка валидации данных"""
    pass


class RepositoryError(XrayReportError):
    """Ошибка репозитория (работа с данными)"""
    pass


# ============================================================================
# Error Handlers
# ============================================================================

logger = get_logger(__name__)


def register_error_handlers(app):
    """Регистрация обработчиков ошибок"""
    
    @app.errorhandler(XrayReportError)
    def handle_xray_error(error):
        """Обработка кастомных исключений приложения"""
        logger.error(
            "xray_error",
            error_type=type(error).__name__,
            message=str(error),
            exc_info=True,
        )
        return jsonify({
            "ok": False,
            "error": str(error),
            "type": type(error).__name__
        }), 400
    
    @app.errorhandler(404)
    def handle_not_found(error):
        """Обработка 404 ошибок"""
        logger.warning(
            "not_found",
            path=error.description if hasattr(error, 'description') else str(error),
        )
        return jsonify({
            "ok": False,
            "error": "Not found",
            "type": "NotFound"
        }), 404
    
    @app.errorhandler(500)
    def handle_internal_error(error):
        """Обработка внутренних ошибок сервера"""
        logger.exception(
            "internal_error",
            error=str(error),
        )
        return jsonify({
            "ok": False,
            "error": "Internal server error",
            "type": "InternalError"
        }), 500
    
    @app.errorhandler(Exception)
    def handle_generic_error(error):
        """Обработка всех необработанных исключений"""
        logger.exception(
            "unhandled_exception",
            error_type=type(error).__name__,
            error=str(error),
        )
        return jsonify({
            "ok": False,
            "error": "Internal server error",
            "type": "InternalError"
        }), 500
