#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Structured logging setup and request logging middleware
"""
import logging
import os
import time
from flask import request, g
from structlog import configure, processors, stdlib, get_logger


logger = get_logger(__name__)


def setup_logging(environment: str = None):
    """
    Настройка структурированного логирования
    
    Args:
        environment: "production" или "development" (по умолчанию из NODE_ENV или "development")
    """
    if environment is None:
        environment = os.environ.get("ENVIRONMENT", os.environ.get("FLASK_ENV", "development"))
    
    # Настройка стандартного logging для structlog
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, log_level, logging.INFO),
    )
    
    if environment == "production":
        # JSON формат для production (для парсинга)
        configure(
            processors=[
                stdlib.filter_by_level,
                stdlib.add_logger_name,
                stdlib.add_log_level,
                stdlib.PositionalArgumentsFormatter(),
                processors.TimeStamper(fmt="iso"),
                processors.StackInfoRenderer(),
                processors.format_exc_info,
                processors.UnicodeDecoder(),
                processors.JSONRenderer()  # JSON для production
            ],
            wrapper_class=stdlib.BoundLogger,
            context_class=dict,
            logger_factory=stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )
    else:
        # Красивый формат для development
        configure(
            processors=[
                stdlib.filter_by_level,
                stdlib.add_logger_name,
                stdlib.add_log_level,
                processors.TimeStamper(fmt="iso"),
                processors.StackInfoRenderer(),
                processors.format_exc_info,
                processors.UnicodeDecoder(),
                stdlib.render_to_log_kwargs  # Форматирование для stderr
            ],
            wrapper_class=stdlib.BoundLogger,
            context_class=dict,
            logger_factory=stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )


def setup_request_logging(app):
    """Настройка логирования HTTP запросов"""
    
    @app.before_request
    def log_request_start():
        """Логирование начала запроса"""
        g.start_time = time.time()
        logger.info(
            "request_started",
            method=request.method,
            path=request.path,
            remote_addr=request.remote_addr,
        )
    
    @app.after_request
    def log_request_end(response):
        """Логирование завершения запроса"""
        duration = time.time() - g.start_time if hasattr(g, 'start_time') else 0
        logger.info(
            "request_completed",
            method=request.method,
            path=request.path,
            status_code=response.status_code,
            duration_ms=round(duration * 1000, 2),
        )
        return response
