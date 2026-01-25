#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unit tests for live service
"""
import pytest
import os
import time
from unittest.mock import patch, MagicMock
from backend.features.live.services.live_service import (
    get_live_now,
    get_live_series,
    get_live_top,
    update_live_buffer,
    load_live_buffer_from_dump,
    _parse_access_log_recent
)


class TestLiveService:
    """Tests for live service operations"""
    
    def test_get_live_now_empty(self, mock_env_vars):
        """Test get_live_now with empty buffer"""
        result = get_live_now()
        assert isinstance(result, dict)
        assert "online" in result
        assert "users" in result
        assert "source" in result
        assert "traffic_available" in result
        assert result["online"] == 0
        assert isinstance(result["users"], list)
    
    def test_get_live_series(self, mock_env_vars):
        """Test get_live_series"""
        result = get_live_series("traffic", 60, 5, "all")
        assert isinstance(result, list)
        # TODO: When implemented, add more assertions
    
    def test_get_live_top(self, mock_env_vars):
        """Test get_live_top"""
        result = get_live_top("traffic", 60, "all")
        assert isinstance(result, list)
        # TODO: When implemented, add more assertions
    
    def test_update_live_buffer(self, mock_env_vars, temp_data_dir):
        """Test updating live buffer"""
        # Create mock access log
        access_log = os.path.join(temp_data_dir, "access.log")
        with open(access_log, "w", encoding="utf-8") as f:
            f.write("2025-01-20 12:00:00 access accepted email: test@example.com\n")
        
        with patch('backend.features.live.services.live_service.ACCESS_LOG', access_log):
            update_live_buffer()
        
        # Check that buffer was updated
        result = get_live_now()
        assert isinstance(result, dict)
    
    def test_load_live_buffer_from_dump(self, mock_env_vars, temp_data_dir):
        """Test loading live buffer from dump"""
        import json
        from backend.core.config import LIVE_STATE_PATH
        
        # Create test buffer
        test_buffer = {
            "test@example.com": [
                {"ts": int(time.time()) - 100, "conns": 5, "traffic": 1000}
            ]
        }
        
        buffer_path = os.path.join(temp_data_dir, "usage_live.json")
        with open(buffer_path, "w", encoding="utf-8") as f:
            json.dump(test_buffer, f)
        
        with patch('backend.features.live.services.live_service.LIVE_STATE_PATH', buffer_path):
            load_live_buffer_from_dump()
            result = get_live_now()
            assert isinstance(result, dict)
    
    def test_parse_access_log_recent_no_file(self, mock_env_vars):
        """Test parsing access log when file doesn't exist"""
        with patch('backend.features.live.services.live_service.ACCESS_LOG', "/nonexistent.log"):
            result = _parse_access_log_recent(5)
            assert isinstance(result, dict)
            assert "users" in result
            assert "conns" in result
            assert "traffic" in result
            assert result["conns"] == 0
    
    def test_parse_access_log_recent_with_file(self, mock_env_vars, temp_data_dir):
        """Test parsing access log with valid file"""
        access_log = os.path.join(temp_data_dir, "access.log")
        with open(access_log, "w", encoding="utf-8") as f:
            f.write("2025-01-20 12:00:00 access accepted email: test@example.com\n")
            f.write("2025-01-20 12:01:00 access accepted email: test2@example.com\n")
        
        with patch('backend.features.live.services.live_service.ACCESS_LOG', access_log):
            result = _parse_access_log_recent(5)
            assert isinstance(result, dict)
            assert "users" in result
            assert isinstance(result["users"], set)
