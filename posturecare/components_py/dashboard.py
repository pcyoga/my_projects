"""
Python Equivalent of /src/components/Dashboard.tsx
Aggregates real-time score, weekly trends, daily ergonomic goals, active calibration, and micro-break prompts.
"""
from typing import Dict, Any, List
from storage import storage


class DashboardComponent:
    """
    Component logic providing aggregated metrics, daily posture scores,
    and ergonomic performance telemetry for the Dashboard view.
    """

    def __init__(self):
        pass

    def get_summary_metrics(self) -> Dict[str, Any]:
        """Returns the high-level KPI tiles for the dashboard."""
        sessions = storage.get_sessions()
        score = 92
        if sessions:
            score = int(sum(s.get("averageScore", 90) for s in sessions) / len(sessions))

        return {
            "postureQualityScore": score,
            "qualityScoreComparison": "+4% vs yesterday",
            "goodPostureDuration": "3h 45m",
            "goodPosturePercent": 78,
            "techNeckInterruptions": 4,
            "techNeckComparison": "-2 vs weekly average",
            "activeCalibrationStatus": "Active" if storage.get_active_baseline() else "Standard Setup"
        }

    def get_weekly_trends(self) -> List[Dict[str, Any]]:
        """Returns 7-day posture trend scores."""
        return [
            {"day": "Mon", "score": 85, "hours": 6.5},
            {"day": "Tue", "score": 88, "hours": 7.2},
            {"day": "Wed", "score": 82, "hours": 8.0},
            {"day": "Thu", "score": 91, "hours": 6.8},
            {"day": "Fri", "score": 94, "hours": 7.5},
            {"day": "Sat", "score": 89, "hours": 4.0},
            {"day": "Sun", "score": 92, "hours": 3.5},
        ]

    def get_active_goals(self) -> List[Dict[str, Any]]:
        """Returns active ergonomic health goals."""
        return storage.get_goals()
