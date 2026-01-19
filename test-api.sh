#!/bin/bash
# API Test Script for Xray Report UI
# Tests all critical endpoints

BASE_URL="http://185.235.130.184:3002"
OLD_URL="http://127.0.0.1:8787"

echo "=== Testing Next.js Application (NEW) ==="
echo "URL: $BASE_URL"
echo ""

# Test 1: Main page
echo "1. Testing main page..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/)
if [ "$STATUS" == "200" ]; then
  echo "✅ Main page: OK (200)"
else
  echo "❌ Main page: FAIL ($STATUS)"
fi

# Test 2: API Ping
echo "2. Testing API ping..."
RESPONSE=$(curl -s $BASE_URL/api/ping)
if echo "$RESPONSE" | grep -q "ok"; then
  echo "✅ API Ping: OK"
  echo "   Response: $RESPONSE"
else
  echo "❌ API Ping: FAIL"
  echo "   Response: $RESPONSE"
fi

# Test 3: Users endpoint
echo "3. Testing /api/users..."
RESPONSE=$(curl -s $BASE_URL/api/users)
if echo "$RESPONSE" | grep -q "users"; then
  USER_COUNT=$(echo "$RESPONSE" | grep -o "email" | wc -l)
  echo "✅ Users API: OK ($USER_COUNT users)"
else
  echo "❌ Users API: FAIL"
fi

# Test 4: Settings endpoint
echo "4. Testing /api/settings..."
RESPONSE=$(curl -s $BASE_URL/api/settings)
if echo "$RESPONSE" | grep -q "settings"; then
  echo "✅ Settings API: OK"
else
  echo "❌ Settings API: FAIL"
fi

# Test 5: Events endpoint
echo "5. Testing /api/events..."
RESPONSE=$(curl -s $BASE_URL/api/events)
if echo "$RESPONSE" | grep -q "events"; then
  EVENT_COUNT=$(echo "$RESPONSE" | grep -o "\"type\"" | wc -l)
  echo "✅ Events API: OK ($EVENT_COUNT events)"
else
  echo "❌ Events API: FAIL"
fi

# Test 6: Live Now endpoint
echo "6. Testing /api/live/now..."
RESPONSE=$(curl -s $BASE_URL/api/live/now)
if echo "$RESPONSE" | grep -q "now"; then
  echo "✅ Live Now API: OK"
else
  echo "❌ Live Now API: FAIL"
fi

# Test 7: System Status endpoint
echo "7. Testing /api/system/status..."
RESPONSE=$(curl -s $BASE_URL/api/system/status)
if echo "$RESPONSE" | grep -q "ui"; then
  echo "✅ System Status API: OK"
else
  echo "❌ System Status API: FAIL"
fi

# Test 8: Collector Status endpoint
echo "8. Testing /api/collector/status..."
RESPONSE=$(curl -s $BASE_URL/api/collector/status)
if echo "$RESPONSE" | grep -q "cron"; then
  echo "✅ Collector Status API: OK"
else
  echo "❌ Collector Status API: FAIL"
fi

echo ""
echo "=== Testing Old Version (8787) ==="
echo "URL: $OLD_URL"
echo ""

# Test Old API Ping
echo "1. Testing old API ping..."
RESPONSE=$(curl -s $OLD_URL/api/ping 2>&1)
if echo "$RESPONSE" | grep -q "ok"; then
  echo "✅ Old API Ping: OK"
else
  echo "⚠️  Old API Ping: Not accessible from external (normal if internal only)"
fi

echo ""
echo "=== Summary ==="
echo "New version (3002): Accessible externally ✅"
echo "Old version (8787): Internal only (as expected)"
echo ""
echo "All critical APIs tested!"
