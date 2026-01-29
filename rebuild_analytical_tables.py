#!/usr/bin/env python3
"""
Background job to rebuild analytical tables from connection_events
V3 - SUPER OPTIMIZED - minimum processing
"""

import sqlite3
import time
from pathlib import Path
from datetime import datetime, timedelta

DB_PATH = Path(__file__).parent / 'data' / 'quality.db'

def log(msg):
    print(f'[{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}] {msg}')

def rebuild_all(conn, lookback_days=90):
    """Rebuild all analytical tables in one go"""
    cursor = conn.cursor()
    cutoff = int((datetime.utcnow() - timedelta(days=lookback_days)).timestamp())

    log(f'Rebuilding all tables (last {lookback_days} days)...')

    # 1. Daily stats
    log('  1/3 Daily stats...')
    cursor.execute('DELETE FROM user_ip_daily_stats')
    cursor.execute('''
        INSERT INTO user_ip_daily_stats
            (email, ip_address, date, total_connections, first_seen, last_seen)
        SELECT
            email,
            ip_address,
            date(timestamp, 'unixepoch') as date,
            COUNT(*) as total_connections,
            MIN(timestamp) as first_seen,
            MAX(timestamp) as last_seen
        FROM connection_events
        WHERE action = 'connect' AND timestamp >= ?
        GROUP BY email, ip_address, date
    ''', (cutoff,))
    log(f'    ✅ {cursor.rowcount} rows')

    # 2. Sessions (simplified - one per day)
    log('  2/3 Sessions...')
    cursor.execute('DELETE FROM user_ip_sessions')
    cursor.execute('''
        INSERT INTO user_ip_sessions
            (email, ip_address, date, session_start, session_end, connection_count)
        SELECT
            email,
            ip_address,
            date(timestamp, 'unixepoch') as date,
            MIN(timestamp) as session_start,
            MAX(timestamp) as session_end,
            COUNT(*) as connection_count
        FROM connection_events
        WHERE action = 'connect' AND timestamp >= ?
        GROUP BY email, ip_address, date
    ''', (cutoff,))
    log(f'    ✅ {cursor.rowcount} rows')

    # 3. Shared IP analysis (SIMPLIFIED - no concurrent calculation, just use same_time_days)
    log('  3/3 Shared IP analysis...')
    cursor.execute('DELETE FROM shared_ip_analysis')

    # Create pairs
    cursor.execute('''
        WITH user_ips AS (
            SELECT DISTINCT
                ip_address,
                email,
                MIN(timestamp) as first_seen,
                MAX(timestamp) as last_seen
            FROM connection_events
            WHERE action = 'connect' AND timestamp >= ?
            GROUP BY ip_address, email
        ),
        shared_ips AS (
            SELECT ip_address
            FROM user_ips
            GROUP BY ip_address
            HAVING COUNT(DISTINCT email) > 1
        )
        INSERT INTO shared_ip_analysis
            (ip_address, user1_email, user2_email, first_concurrent, last_concurrent)
        SELECT
            u1.ip_address,
            u1.email as user1_email,
            u2.email as user2_email,
            max(u1.first_seen, u2.first_seen) as first_concurrent,
            min(u1.last_seen, u2.last_seen) as last_concurrent
        FROM user_ips u1
        JOIN user_ips u2 ON u1.ip_address = u2.ip_address AND u1.email < u2.email
        WHERE u1.ip_address IN (SELECT ip_address FROM shared_ips)
    ''', (cutoff,))
    pairs = cursor.rowcount
    log(f'    Created {pairs} pairs')

    # Update counts (simple COUNT, no JOIN)
    log('    Updating same_time_days...')
    cursor.execute('''
        UPDATE shared_ip_analysis
        SET same_time_days = (
            SELECT COUNT(DISTINCT date(timestamp, 'unixepoch'))
            FROM connection_events
            WHERE ip_address = shared_ip_analysis.ip_address
                AND (email = shared_ip_analysis.user1_email OR email = shared_ip_analysis.user2_email)
                AND action = 'connect'
                AND timestamp >= ?
        )
    ''', (cutoff,))
    log(f'    Updated {cursor.rowcount} pairs')

    # Set concurrent_days = same_time_days (approximation - good enough for now)
    log('    Setting concurrent_days (approximation)...')
    cursor.execute('UPDATE shared_ip_analysis SET concurrent_days = same_time_days')

    log(f'    ✅ {pairs} pairs analyzed')

    conn.commit()

def main():
    start_time = time.time()
    log('=== Starting analytical tables rebuild (V3 - FAST) ===')

    if not DB_PATH.exists():
        log(f'ERROR: Database not found at {DB_PATH}')
        return 1

    conn = sqlite3.connect(str(DB_PATH))
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA synchronous=NORMAL')
    conn.execute('PRAGMA temp_store=MEMORY')
    conn.execute('PRAGMA cache_size=10000')

    try:
        rebuild_all(conn, lookback_days=90)

        # Update metadata
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE analytical_metadata
            SET value = ?, updated_at = strftime('%s', 'now')
            WHERE key = 'last_full_rebuild'
        ''', (str(int(time.time())),))
        conn.commit()

        elapsed = time.time() - start_time
        log(f'=== Rebuild completed in {elapsed:.2f}s ===')

    except Exception as e:
        log(f'ERROR: {e}')
        import traceback
        traceback.print_exc()
        return 1
    finally:
        conn.close()

    return 0

if __name__ == '__main__':
    exit(main())
