"""
PostureCare Database Engine & Optimized Data Retrieval Layer
Implements an ACID-compliant SQLite relational database with high-performance B-tree indexing,
transactional consistency, and specialized analytical queries for ergonomic telemetry.
"""

import os
import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

DB_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "posturecare.db")

class DatabaseManager:
    """
    Thread-safe SQLite Database Manager for PostureCare.
    Provides schema migration, automated indexing, transactional writes,
    and optimized aggregations for instant posture analytics.
    """
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_database()

    def get_connection(self) -> sqlite3.Connection:
        """Creates a database connection with foreign key support and row factories enabled."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")  # Write-Ahead Logging for high concurrency
        conn.execute("PRAGMA synchronous = NORMAL;")
        return conn

    def _init_database(self):
        """Initializes tables and high-speed B-tree indexes if they do not exist."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # 1. Users Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                occupation TEXT DEFAULT 'Workstation Professional',
                computer_usage_hours REAL DEFAULT 8.0,
                primary_activity TEXT DEFAULT 'general',
                break_frequency_minutes INTEGER DEFAULT 45,
                primary_objective TEXT,
                has_completed_onboarding INTEGER DEFAULT 1,
                role TEXT DEFAULT 'Professional',
                avatar_url TEXT,
                created_at TEXT NOT NULL
            );
            """)

            # 2. Baseline Calibration Profiles Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS baseline_profiles (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                head_angle REAL NOT NULL,
                neck_angle REAL NOT NULL,
                shoulder_angle REAL NOT NULL,
                torso_angle REAL NOT NULL,
                camera_distance REAL DEFAULT 1.0,
                tolerance_level TEXT DEFAULT 'standard',
                calibrated_at TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)

            # 3. Posture Sessions Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS posture_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                posture_profile_id TEXT,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                average_score REAL NOT NULL,
                good_seconds INTEGER NOT NULL,
                warning_seconds INTEGER NOT NULL,
                poor_seconds INTEGER NOT NULL,
                alert_count INTEGER NOT NULL DEFAULT 0,
                primary_deviation TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (posture_profile_id) REFERENCES baseline_profiles(id) ON DELETE SET NULL
            );
            """)

            # 4. Posture Alerts Table (Fine-grained telemetry events)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS posture_alerts (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                deviation_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                angle_offset REAL NOT NULL,
                trigger_duration_seconds REAL NOT NULL,
                resolved INTEGER DEFAULT 1,
                FOREIGN KEY (session_id) REFERENCES posture_sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)

            # 5. User Ergonomic Goals Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_goals (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                type TEXT NOT NULL,
                target_value REAL NOT NULL,
                current_value REAL NOT NULL,
                unit TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'in_progress',
                start_date TEXT NOT NULL,
                target_date TEXT NOT NULL,
                category TEXT DEFAULT 'daily',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)

            # 6. Break Logs & Stretch Activities Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS break_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT,
                break_type TEXT NOT NULL,
                started_at TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                completed INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (session_id) REFERENCES posture_sessions(id) ON DELETE SET NULL
            );
            """)

            # -------------------------------------------------------------
            # B-TREE INDEXES FOR OPTIMIZED DATA RETRIEVAL (O(log N))
            # -------------------------------------------------------------
            # Accelerates date range filtering and sorting by recency
            cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user_time 
            ON posture_sessions(user_id, start_time DESC);
            """)

            # Accelerates score-based filtering (e.g. low-score sessions analysis)
            cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_score 
            ON posture_sessions(average_score);
            """)

            # Accelerates alert querying per session and time lookup
            cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_alerts_session_time 
            ON posture_alerts(session_id, timestamp);
            """)

            # Accelerates group-by aggregate queries on deviation patterns
            cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_alerts_deviation 
            ON posture_alerts(user_id, deviation_type);
            """)

            # Accelerates active goals lookup
            cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_goals_user_status 
            ON user_goals(user_id, status);
            """)

            conn.commit()

        # Seed initial default data if empty
        self._seed_default_data()

    def _seed_default_data(self):
        """Seeds initial user and historical benchmark sessions if database is freshly created."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM users;")
            if cursor.fetchone()["count"] > 0:
                return  # Already populated

            now = datetime.now()
            user_id = "usr_user_01"

            # Insert User
            cursor.execute("""
            INSERT INTO users (
                id, full_name, email, occupation, computer_usage_hours,
                primary_activity, break_frequency_minutes, primary_objective,
                has_completed_onboarding, role, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                user_id,
                "PostureCare User",
                "user@workspace.local",
                "Software Engineer & Ergonomics Focus",
                8.5,
                "coding_and_typing",
                45,
                "Maintain healthy spinal alignment and eliminate slouching",
                1,
                "Professional",
                (now - timedelta(days=30)).isoformat()
            ))

            # Insert Baseline Profile
            profile_id = "base_01"
            cursor.execute("""
            INSERT INTO baseline_profiles (
                id, user_id, name, head_angle, neck_angle, shoulder_angle,
                torso_angle, camera_distance, tolerance_level, calibrated_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                profile_id, user_id, "Standard Ergonomic Setup",
                1.5, 4.2, 0.8, 2.1, 1.0, "standard",
                (now - timedelta(days=20)).isoformat(), 1
            ))

            # Insert Sample Historical Sessions
            sessions_data = [
                ("ses_01", (now - timedelta(minutes=180)).isoformat(), (now - timedelta(minutes=125)).isoformat(), 3300, 92.4, 2800, 380, 120, 2, "Slight right shoulder slump near the 45m mark"),
                ("ses_02", (now - timedelta(minutes=360)).isoformat(), (now - timedelta(minutes=270)).isoformat(), 5400, 86.8, 4320, 780, 300, 4, "Forward head tilt during deep concentration"),
                ("ses_03", (now - timedelta(days=1, hours=4)).isoformat(), (now - timedelta(days=1, hours=2)).isoformat(), 7200, 89.1, 6120, 780, 300, 5, "Mid-torso slouching after 90m continuous sitting"),
                ("ses_04", (now - timedelta(days=2, hours=3)).isoformat(), (now - timedelta(days=2, hours=1)).isoformat(), 7200, 91.0, 6300, 600, 300, 3, "Intermittent forward neck lean"),
                ("ses_05", (now - timedelta(days=3, hours=5)).isoformat(), (now - timedelta(days=3, hours=3)).isoformat(), 7200, 84.5, 5200, 1400, 600, 7, "Cervical hyperextension looking down at laptop"),
                ("ses_06", (now - timedelta(days=4, hours=6)).isoformat(), (now - timedelta(days=4, hours=4)).isoformat(), 7200, 94.2, 6600, 450, 150, 1, "Optimal alignment maintained"),
                ("ses_07", (now - timedelta(days=5, hours=4)).isoformat(), (now - timedelta(days=5, hours=2)).isoformat(), 7200, 88.0, 5900, 900, 400, 4, "Shoulder elevation during typing bursts")
            ]

            for s in sessions_data:
                cursor.execute("""
                INSERT INTO posture_sessions (
                    id, user_id, posture_profile_id, start_time, end_time,
                    duration_seconds, average_score, good_seconds, warning_seconds,
                    poor_seconds, alert_count, primary_deviation
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (s[0], user_id, profile_id, s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9]))

            # Insert Sample Alerts
            sample_alerts = [
                ("alt_01", "ses_01", user_id, (now - timedelta(minutes=150)).isoformat(), "Forward Head Slouch", "warning", 18.5, 4.2),
                ("alt_02", "ses_01", user_id, (now - timedelta(minutes=135)).isoformat(), "Right Shoulder Elevation", "critical", 22.0, 5.8),
                ("alt_03", "ses_02", user_id, (now - timedelta(minutes=320)).isoformat(), "Forward Head Slouch", "critical", 24.1, 6.5),
                ("alt_04", "ses_02", user_id, (now - timedelta(minutes=295)).isoformat(), "Torso Slump", "warning", 16.8, 4.0),
                ("alt_05", "ses_03", user_id, (now - timedelta(days=1, hours=3, minutes=10)).isoformat(), "Thoracic Kyphosis", "critical", 26.5, 7.2),
                ("alt_06", "ses_05", user_id, (now - timedelta(days=3, hours=4, minutes=20)).isoformat(), "Forward Head Slouch", "critical", 28.0, 8.1),
                ("alt_07", "ses_05", user_id, (now - timedelta(days=3, hours=3, minutes=45)).isoformat(), "Left Shoulder Drop", "warning", 15.2, 3.8)
            ]

            for a in sample_alerts:
                cursor.execute("""
                INSERT INTO posture_alerts (
                    id, session_id, user_id, timestamp, deviation_type,
                    severity, angle_offset, trigger_duration_seconds, resolved
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);
                """, a)

            # Insert Sample Goals
            goals = [
                ("goal_01", user_id, "Maintain > 85% Good Posture Daily", "good_posture_percent", 85.0, 88.5, "%", "in_progress", (now - timedelta(days=7)).strftime("%Y-%m-%d"), (now + timedelta(days=7)).strftime("%Y-%m-%d"), "daily"),
                ("goal_02", user_id, "Keep Alerts Below 4 Per Session", "alert_count", 4.0, 2.8, "alerts", "in_progress", (now - timedelta(days=7)).strftime("%Y-%m-%d"), (now + timedelta(days=7)).strftime("%Y-%m-%d"), "daily"),
                ("goal_03", user_id, "Complete 4 Hourly Micro-Breaks Daily", "stretch_count", 4.0, 3.5, "breaks", "in_progress", (now - timedelta(days=7)).strftime("%Y-%m-%d"), (now + timedelta(days=7)).strftime("%Y-%m-%d"), "daily")
            ]

            for g in goals:
                cursor.execute("""
                INSERT INTO user_goals (
                    id, user_id, title, type, target_value, current_value,
                    unit, status, start_date, target_date, category
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, g)

            conn.commit()

    # =========================================================================
    # HIGH-PERFORMANCE RETRIEVAL METHODS (SPECIALIZED QUERIES)
    # =========================================================================

    def get_user_profile(self, user_id: str = "usr_user_01") -> Optional[Dict[str, Any]]:
        """Fetches user profile by ID using primary key index lookup (O(1))."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?;", (user_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_active_baseline(self, user_id: str = "usr_user_01") -> Optional[Dict[str, Any]]:
        """Retrieves active calibration baseline for the user."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM baseline_profiles 
            WHERE user_id = ? AND is_active = 1 
            ORDER BY calibrated_at DESC LIMIT 1;
            """, (user_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_recent_sessions(self, user_id: str = "usr_user_01", limit: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Retrieves recent posture sessions with index-accelerated sorting.
        Uses compound index: idx_sessions_user_time (user_id, start_time DESC).
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM posture_sessions 
            WHERE user_id = ? 
            ORDER BY start_time DESC 
            LIMIT ? OFFSET ?;
            """, (user_id, limit, offset))
            return [dict(r) for r in cursor.fetchall()]

    def get_sessions_by_date_range(self, user_id: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """
        Effective range query for reports and historical comparison.
        Leverages B-tree index scan rather than full table scanning.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM posture_sessions 
            WHERE user_id = ? 
              AND start_time >= ? 
              AND start_time <= ?
            ORDER BY start_time ASC;
            """, (user_id, start_date, end_date))
            return [dict(r) for r in cursor.fetchall()]

    def get_aggregated_posture_metrics(self, user_id: str = "usr_user_01", days: int = 7) -> Dict[str, Any]:
        """
        Executes high-performance SQL aggregate functions directly in the database engine.
        Returns total monitored time, average ergonomic score, and alert frequencies.
        """
        since_time = (datetime.now() - timedelta(days=days)).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT 
                COUNT(*) as total_sessions,
                ROUND(AVG(average_score), 1) as overall_avg_score,
                SUM(duration_seconds) as total_duration_seconds,
                SUM(good_seconds) as total_good_seconds,
                SUM(warning_seconds) as total_warning_seconds,
                SUM(poor_seconds) as total_poor_seconds,
                SUM(alert_count) as total_alerts,
                MAX(average_score) as best_score,
                MIN(average_score) as lowest_score
            FROM posture_sessions 
            WHERE user_id = ? AND start_time >= ?;
            """, (user_id, since_time))
            row = cursor.fetchone()
            res = dict(row) if row else {}
            
            # Compute ergonomic alignment ratio
            tot = res.get("total_duration_seconds") or 0
            good = res.get("total_good_seconds") or 0
            res["good_posture_percentage"] = round((good / tot * 100), 1) if tot > 0 else 0.0
            return res

    def get_daily_score_trends(self, user_id: str = "usr_user_01", days: int = 7) -> List[Dict[str, Any]]:
        """
        Time-series grouping query using SQLite strftime date formatting.
        Provides daily aggregated averages for charting and trend evaluation.
        """
        since_time = (datetime.now() - timedelta(days=days)).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT 
                strftime('%Y-%m-%d', start_time) as session_date,
                ROUND(AVG(average_score), 1) as daily_avg_score,
                SUM(duration_seconds) as total_seconds,
                SUM(alert_count) as daily_alerts,
                COUNT(*) as session_count
            FROM posture_sessions
            WHERE user_id = ? AND start_time >= ?
            GROUP BY strftime('%Y-%m-%d', start_time)
            ORDER BY session_date ASC;
            """, (user_id, since_time))
            return [dict(r) for r in cursor.fetchall()]

    def get_top_posture_deviations(self, user_id: str = "usr_user_01", limit: int = 5) -> List[Dict[str, Any]]:
        """
        Frequency analysis query grouping alerts by deviation type.
        Identifies the primary postural risk factors for the user.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT 
                deviation_type,
                COUNT(*) as occurrences,
                ROUND(AVG(angle_offset), 1) as avg_angle_deviation,
                ROUND(AVG(trigger_duration_seconds), 1) as avg_duration_before_recovery
            FROM posture_alerts
            WHERE user_id = ?
            GROUP BY deviation_type
            ORDER BY occurrences DESC
            LIMIT ?;
            """, (user_id, limit))
            return [dict(r) for r in cursor.fetchall()]

    def get_user_goals(self, user_id: str = "usr_user_01") -> List[Dict[str, Any]]:
        """Fetches active user goals."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM user_goals WHERE user_id = ? ORDER BY start_date DESC;", (user_id,))
            return [dict(r) for r in cursor.fetchall()]

    def save_session_transactional(self, session_data: Dict[str, Any], alerts: Optional[List[Dict[str, Any]]] = None) -> bool:
        """
        Atomic ACID transaction: inserts session record and all accompanying telemetry alerts.
        Rolls back completely if any constraint is violated.
        """
        with self.get_connection() as conn:
            try:
                cursor = conn.cursor()
                cursor.execute("""
                INSERT INTO posture_sessions (
                    id, user_id, posture_profile_id, start_time, end_time,
                    duration_seconds, average_score, good_seconds, warning_seconds,
                    poor_seconds, alert_count, primary_deviation
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (
                    session_data["id"],
                    session_data.get("userId", "usr_user_01"),
                    session_data.get("postureProfileId", "base_01"),
                    session_data["startTime"],
                    session_data["endTime"],
                    session_data.get("durationSeconds", 0),
                    session_data.get("averageScore", 85.0),
                    session_data.get("goodSeconds", 0),
                    session_data.get("warningSeconds", 0),
                    session_data.get("poorSeconds", 0),
                    session_data.get("alertCount", 0),
                    session_data.get("primaryDeviation", "General Alignment")
                ))

                if alerts:
                    for alt in alerts:
                        cursor.execute("""
                        INSERT INTO posture_alerts (
                            id, session_id, user_id, timestamp, deviation_type,
                            severity, angle_offset, trigger_duration_seconds, resolved
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                        """, (
                            alt["id"],
                            session_data["id"],
                            session_data.get("userId", "usr_user_01"),
                            alt["timestamp"],
                            alt.get("deviationType", "Postural Drift"),
                            alt.get("severity", "warning"),
                            alt.get("angleOffset", 0.0),
                            alt.get("triggerDurationSeconds", 3.0),
                            1 if alt.get("resolved", True) else 0
                        ))

                conn.commit()
                return True
            except Exception as e:
                conn.rollback()
                print(f"[DatabaseManager Error] Transaction rolled back: {e}")
                return False

    def update_user_profile(self, user_id: str, updates: Dict[str, Any]) -> bool:
        """Dynamically updates user fields with parameterized queries to prevent SQL injection."""
        allowed_fields = {
            "full_name", "email", "occupation", "computer_usage_hours",
            "primary_activity", "break_frequency_minutes", "primary_objective",
            "has_completed_onboarding", "role", "avatar_url"
        }
        valid_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        if not valid_updates:
            return False

        set_clause = ", ".join([f"{k} = ?" for k in valid_updates.keys()])
        values = list(valid_updates.values()) + [user_id]

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?;", values)
            conn.commit()
            return cursor.rowcount > 0

# Singleton instance for simple import and reuse across the application
db = DatabaseManager()
