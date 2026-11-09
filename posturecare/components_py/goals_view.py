"""
Python Equivalent of /src/components/GoalsView.tsx
Manages daily sitting duration goals, good posture score targets, and streak milestones.
"""
from typing import List, Dict, Any
from storage import storage


class GoalsViewComponent:
    """
    Component for viewing, creating, and updating ergonomic health targets.
    """

    def __init__(self):
        pass

    def get_goals(self) -> List[Dict[str, Any]]:
        """Returns all configured ergonomic goals."""
        return storage.get_goals()

    def add_goal(
        self,
        title: str,
        target_value: float,
        unit: str = "%",
        category: str = "daily"
    ) -> Dict[str, Any]:
        """Creates a new goal."""
        goals = storage.get_goals()
        new_goal = {
            "id": f"goal_{len(goals) + 1}",
            "title": title,
            "targetValue": target_value,
            "currentValue": 0.0,
            "unit": unit,
            "status": "in_progress",
            "category": category
        }
        goals.append(new_goal)
        storage.save_goals(goals)
        return new_goal
