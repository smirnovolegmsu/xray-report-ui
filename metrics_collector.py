#!/usr/bin/env python3
"""
Metrics collector for CPU/RAM monitoring
Runs every minute via cron and stores metrics in SQLite
"""
import os
import sys
import sqlite3
import psutil
import datetime as dt
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "data" / "metrics.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

def init_db():
    """Initialize database schema"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Raw metrics table (1-minute granularity)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS metrics_1m (
            timestamp INTEGER PRIMARY KEY,
            cpu_percent REAL NOT NULL,
            ram_percent REAL NOT NULL,
            ram_used_gb REAL NOT NULL,
            ram_total_gb REAL NOT NULL
        )
    """)

    # 5-minute aggregated metrics
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS metrics_5m (
            timestamp INTEGER PRIMARY KEY,
            cpu_percent_avg REAL NOT NULL,
            cpu_percent_max REAL NOT NULL,
            ram_percent_avg REAL NOT NULL,
            ram_percent_max REAL NOT NULL,
            ram_used_gb_avg REAL NOT NULL,
            ram_total_gb REAL NOT NULL
        )
    """)

    # 30-minute aggregated metrics
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS metrics_30m (
            timestamp INTEGER PRIMARY KEY,
            cpu_percent_avg REAL NOT NULL,
            cpu_percent_max REAL NOT NULL,
            ram_percent_avg REAL NOT NULL,
            ram_percent_max REAL NOT NULL,
            ram_used_gb_avg REAL NOT NULL,
            ram_total_gb REAL NOT NULL
        )
    """)

    # Create indices for faster queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_metrics_1m_timestamp ON metrics_1m(timestamp DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_metrics_5m_timestamp ON metrics_5m(timestamp DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_metrics_30m_timestamp ON metrics_30m(timestamp DESC)")

    conn.commit()
    conn.close()

def collect_metrics():
    """Collect current metrics and store them"""
    try:
        # Get current metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory()
        ram_percent = mem.percent
        ram_used_gb = mem.used / (1024 ** 3)
        ram_total_gb = mem.total / (1024 ** 3)

        # Current timestamp (aligned to minute)
        now = dt.datetime.utcnow()
        timestamp = int(now.replace(second=0, microsecond=0).timestamp())

        # Store in database
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        cursor.execute("""
            INSERT OR REPLACE INTO metrics_1m
            (timestamp, cpu_percent, ram_percent, ram_used_gb, ram_total_gb)
            VALUES (?, ?, ?, ?, ?)
        """, (timestamp, cpu_percent, ram_percent, ram_used_gb, ram_total_gb))

        conn.commit()
        conn.close()

        print(f"[{now.isoformat()}] Collected: CPU={cpu_percent:.1f}% RAM={ram_percent:.1f}%")
        return True

    except Exception as e:
        print(f"ERROR: Failed to collect metrics: {e}", file=sys.stderr)
        return False

def aggregate_5m():
    """Aggregate 1-minute data into 5-minute buckets"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        # Get last 5m aggregation timestamp
        cursor.execute("SELECT MAX(timestamp) FROM metrics_5m")
        last_agg = cursor.fetchone()[0]
        start_ts = last_agg + 300 if last_agg else 0

        # Aggregate data in 5-minute buckets
        cursor.execute("""
            INSERT INTO metrics_5m (timestamp, cpu_percent_avg, cpu_percent_max,
                                     ram_percent_avg, ram_percent_max, ram_used_gb_avg, ram_total_gb)
            SELECT
                (timestamp / 300) * 300 as bucket_ts,
                AVG(cpu_percent) as cpu_avg,
                MAX(cpu_percent) as cpu_max,
                AVG(ram_percent) as ram_avg,
                MAX(ram_percent) as ram_max,
                AVG(ram_used_gb) as ram_used_avg,
                MAX(ram_total_gb) as ram_total
            FROM metrics_1m
            WHERE timestamp > ?
            GROUP BY bucket_ts
            HAVING COUNT(*) >= 3
        """, (start_ts,))

        conn.commit()
        conn.close()
        return True

    except Exception as e:
        print(f"ERROR: Failed to aggregate 5m: {e}", file=sys.stderr)
        return False

def aggregate_30m():
    """Aggregate 5-minute data into 30-minute buckets"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        # Get last 30m aggregation timestamp
        cursor.execute("SELECT MAX(timestamp) FROM metrics_30m")
        last_agg = cursor.fetchone()[0]
        start_ts = last_agg + 1800 if last_agg else 0

        # Aggregate data in 30-minute buckets
        cursor.execute("""
            INSERT INTO metrics_30m (timestamp, cpu_percent_avg, cpu_percent_max,
                                      ram_percent_avg, ram_percent_max, ram_used_gb_avg, ram_total_gb)
            SELECT
                (timestamp / 1800) * 1800 as bucket_ts,
                AVG(cpu_percent_avg) as cpu_avg,
                MAX(cpu_percent_max) as cpu_max,
                AVG(ram_percent_avg) as ram_avg,
                MAX(ram_percent_max) as ram_max,
                AVG(ram_used_gb_avg) as ram_used_avg,
                MAX(ram_total_gb) as ram_total
            FROM metrics_5m
            WHERE timestamp > ?
            GROUP BY bucket_ts
            HAVING COUNT(*) >= 4
        """, (start_ts,))

        conn.commit()
        conn.close()
        return True

    except Exception as e:
        print(f"ERROR: Failed to aggregate 30m: {e}", file=sys.stderr)
        return False

def cleanup_old_data():
    """Remove old data to save space"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        now = int(dt.datetime.utcnow().timestamp())

        # Keep 1m data for 48 hours
        cursor.execute("DELETE FROM metrics_1m WHERE timestamp < ?", (now - 48*3600,))

        # Keep 5m data for 7 days
        cursor.execute("DELETE FROM metrics_5m WHERE timestamp < ?", (now - 7*86400,))

        # Keep 30m data for 30 days
        cursor.execute("DELETE FROM metrics_30m WHERE timestamp < ?", (now - 30*86400,))

        deleted = cursor.rowcount
        conn.commit()
        conn.close()

        if deleted > 0:
            print(f"Cleaned up {deleted} old records")
        return True

    except Exception as e:
        print(f"ERROR: Failed to cleanup: {e}", file=sys.stderr)
        return False

def main():
    """Main entry point"""
    # Initialize database
    init_db()

    # Collect current metrics
    if not collect_metrics():
        sys.exit(1)

    # Aggregate data (run every 5th minute)
    now = dt.datetime.utcnow()
    if now.minute % 5 == 0:
        aggregate_5m()

    # Aggregate 30m data (run every 30th minute)
    if now.minute in (0, 30):
        aggregate_30m()

    # Cleanup old data (run once per hour)
    if now.minute == 0:
        cleanup_old_data()

    return 0

if __name__ == "__main__":
    sys.exit(main())
