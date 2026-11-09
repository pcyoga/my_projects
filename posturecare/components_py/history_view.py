"""
Python Equivalent of /src/components/HistoryView.tsx
Displays historical session logs, duration, alerts count, and posture quality breakdowns.
"""
from typing import List, Dict, Any
from storage import storage


class HistoryViewComponent:
    """
    Component for viewing historical monitoring sessions and posture trends.
    """

    def __init__(self):
        pass

    def get_session_history(self) -> List[Dict[str, Any]]:
        """Fetches all past recorded sessions from storage."""
        return storage.get_sessions()

    def get_aggregate_stats(self) -> Dict[str, Any]:
        """Calculates cumulative sitting ergonomics statistics."""
        sessions = self.get_session_history()
        if not sessions:
            return {
                "totalSessions": 0,
                "totalHours": 0.0,
                "overallScore": 92,
                "totalAlerts": 0
            }

        total_secs = sum(s.get("durationSeconds", 0) for s in sessions)
        avg_score = int(sum(s.get("averageScore", 90) for s in sessions) / len(sessions))
        total_alerts = sum(s.get("alertCount", 0) for s in sessions)

        return {
            "totalSessions": len(sessions),
            "totalHours": round(total_secs / 3600.0, 1),
            "overallScore": avg_score,
            "totalAlerts": total_alerts
        }
