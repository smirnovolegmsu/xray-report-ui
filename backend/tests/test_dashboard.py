#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unit tests for dashboard service
"""
import pytest
from unittest.mock import patch, MagicMock
from backend.features.overview.services.dashboard_service import (
    load_dashboard_data,
    load_usage_dashboard,
    load_usage_data
)


class TestDashboardService:
    """Tests for dashboard service operations"""
    
    @patch('backend.features.overview.services.dashboard_service.list_usage_dates')
    @patch('backend.features.overview.services.dashboard_service.get_xray_clients')
    @patch('backend.features.overview.services.dashboard_service.read_usage_file')
    @patch('backend.features.overview.services.dashboard_service.read_conns_file')
    def test_load_dashboard_data(self, mock_conns, mock_usage, mock_clients, mock_dates):
        """Test load_dashboard_data"""
        # Mock dependencies
        mock_dates.return_value = ["2025-01-27", "2025-01-26"]
        mock_clients.return_value = [
            {"id": "test-uuid-1", "email": "test@example.com"}
        ]
        mock_usage.return_value = [
            {"user": "test-uuid-1", "downlink": "1000", "uplink": "500", "domain": "example.com"}
        ]
        mock_conns.return_value = [
            {"user": "test-uuid-1", "domain": "example.com"}
        ]
        
        result = load_dashboard_data(days=7)
        
        assert isinstance(result, dict)
        assert "global" in result
        assert "users" in result
        assert "meta" in result
        assert isinstance(result["global"]["daily_traffic_bytes"], list)
        assert isinstance(result["users"], dict)
    
    @patch('backend.features.overview.services.dashboard_service.get_xray_clients')
    @patch('backend.features.overview.services.dashboard_service.read_usage_file')
    @patch('backend.features.overview.services.dashboard_service.read_conns_file')
    def test_load_usage_dashboard(self, mock_conns, mock_usage, mock_clients):
        """Test load_usage_dashboard"""
        mock_clients.return_value = [
            {"id": "test-uuid-1", "email": "test@example.com"}
        ]
        mock_usage.return_value = [
            {"user": "test-uuid-1", "downlink": "1000", "uplink": "500", "domain": "example.com"}
        ]
        mock_conns.return_value = [
            {"user": "test-uuid-1", "domain": "example.com"}
        ]
        
        result = load_usage_dashboard("2025-01-27")
        
        assert isinstance(result, dict)
        assert "global" in result
        assert "users" in result
        assert "meta" in result
    
    @patch('backend.features.overview.services.dashboard_service.list_usage_dates')
    @patch('backend.features.overview.services.dashboard_service.read_usage_file')
    def test_load_usage_data(self, mock_usage, mock_dates):
        """Test load_usage_data"""
        mock_dates.return_value = ["2025-01-27", "2025-01-26"]
        mock_usage.return_value = [
            {"downlink": "1000", "uplink": "500"}
        ]
        
        result = load_usage_data(days=7)
        
        assert isinstance(result, dict)
        assert "data" in result
        assert isinstance(result["data"], list)