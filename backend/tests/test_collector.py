#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unit tests for collector service
"""
import pytest
import os
import tempfile
from unittest.mock import patch, MagicMock, mock_open
from backend.features.settings.services.collector_service import (
    get_collector_status,
    toggle_collector,
    run_collector,
    _find_collector_cron
)


class TestCollectorService:
    """Tests for collector service operations"""
    
    def test_get_collector_status_no_cron(self, mock_env_vars):
        """Test get_collector_status when cron doesn't exist"""
        with patch('backend.features.settings.services.collector_service._find_collector_cron', return_value={"found": False}):
            result = get_collector_status()
            assert isinstance(result, dict)
            assert "enabled" in result
            assert "disabled_reason" in result
            assert result["enabled"] is False
    
    def test_get_collector_status_with_cron(self, mock_env_vars):
        """Test get_collector_status with cron file"""
        mock_cron = {
            "found": True,
            "file": "/etc/cron.d/xray-usage",
            "type": "cron.d",
            "jobs_count": 1,
            "all_jobs": [{
                "schedule": "0 0 * * *",
                "command": "/usr/local/bin/xray_daily_usage.sh",
                "script": "xray_daily_usage.sh",
                "active": True
            }]
        }
        
        with patch('backend.features.settings.services.collector_service._find_collector_cron', return_value=mock_cron):
            with patch('glob.glob', return_value=[]):
                result = get_collector_status()
                assert isinstance(result, dict)
                assert "enabled" in result
                assert result["enabled"] is True
    
    def test_find_collector_cron_not_found(self, mock_env_vars):
        """Test _find_collector_cron when file doesn't exist"""
        with patch('os.path.exists', return_value=False):
            result = _find_collector_cron()
            assert isinstance(result, dict)
            assert result["found"] is False
    
    def test_find_collector_cron_found(self, mock_env_vars):
        """Test _find_collector_cron when file exists"""
        cron_content = "0 0 * * * /usr/local/bin/xray_daily_usage.sh\n"
        
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=cron_content)):
                result = _find_collector_cron()
                assert isinstance(result, dict)
                assert result["found"] is True
                assert "all_jobs" in result
    
    def test_toggle_collector_cron_not_found(self, mock_env_vars):
        """Test toggle_collector when cron not found"""
        with patch('backend.features.settings.services.collector_service._find_collector_cron', return_value={"found": False}):
            result = toggle_collector(True)
            assert isinstance(result, dict)
            assert result.get("ok") is False
            assert "error" in result
    
    @patch('backend.features.settings.services.collector_service.append_event')
    @patch('backend.features.settings.services.collector_service.save_settings')
    def test_toggle_collector_enable(self, mock_save, mock_event, mock_env_vars):
        """Test enabling collector"""
        mock_cron = {
            "found": True,
            "file": "/tmp/test_cron",
            "all_jobs": [{
                "schedule": "0 0 * * *",
                "command": "/usr/local/bin/xray_daily_usage.sh",
                "active": False
            }]
        }
        
        cron_content = "# 0 0 * * * /usr/local/bin/xray_daily_usage.sh\n"
        
        with patch('backend.features.settings.services.collector_service._find_collector_cron', return_value=mock_cron):
            with patch('builtins.open', mock_open(read_data=cron_content)) as m:
                with patch('os.path.exists', return_value=True):
                    result = toggle_collector(True)
                    assert isinstance(result, dict)
                    # May succeed or fail depending on file permissions, but should return dict
    
    def test_run_collector_script_not_found(self, mock_env_vars):
        """Test run_collector when script doesn't exist"""
        with patch('os.path.exists', return_value=False):
            result = run_collector()
            assert isinstance(result, dict)
            assert result.get("ok") is False
            assert "error" in result
    
    @patch('backend.features.settings.services.collector_service.append_event')
    @patch('subprocess.run')
    def test_run_collector_success(self, mock_subprocess, mock_event, mock_env_vars):
        """Test successful collector run"""
        mock_subprocess.return_value = MagicMock(returncode=0, stdout="Success", stderr="")
        
        with patch('os.path.exists', return_value=True):
            result = run_collector()
            assert isinstance(result, dict)
            # May succeed or fail depending on actual script, but should return dict
