"""
Python Equivalent of /src/components/StretchesView.tsx
Interactive guided desk relief exercises, step-by-step instructions, and target muscle groups.
"""
from typing import List
from stretches import get_stretches
from models import StretchExercise


class StretchesViewComponent:
    """
    Component for viewing guided ergonomic stretches and muscular relief routines.
    """

    def __init__(self):
        self.active_exercise: StretchExercise = get_stretches()[0]
        self.is_timer_running: bool = False

    def list_exercises(self) -> List[StretchExercise]:
        """Returns catalog of all guided desk stretches."""
        return get_stretches()

    def select_exercise(self, exercise_id: str) -> StretchExercise:
        """Selects an exercise by ID."""
        for ex in get_stretches():
            if ex.id == exercise_id:
                self.active_exercise = ex
                break
        return self.active_exercise
