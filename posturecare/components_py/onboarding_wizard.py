"""
Python Equivalent of /src/components/OnboardingWizard.tsx
Guides newly registered users through occupation setup, computer hours, and break targets.
"""
from typing import Dict, Any, List
from storage import storage


class OnboardingWizardComponent:
    """
    Component for initial profile setup and ergonomic personalization.
    """

    ACTIVITIES: List[Dict[str, str]] = [
        {"id": "programming", "label": "Software Development", "desc": "Extended deep-focus coding & terminal work"},
        {"id": "office", "label": "Office & Management", "desc": "Spreadsheets, emails & regular video calls"},
        {"id": "study", "label": "Study & Academics", "desc": "Reading papers, research & online coursework"},
        {"id": "design", "label": "Design & Creative", "desc": "Precision stylus/mouse work & graphic editors"},
        {"id": "gaming", "label": "Gaming & Entertainment", "desc": "Fast reflexes, controller/keyboard sessions"},
        {"id": "general", "label": "General Computer Use", "desc": "Browsing, casual media & everyday tasks"},
    ]

    def __init__(self):
        self.current_step: int = 1

    def complete_onboarding(
        self,
        full_name: str,
        occupation: str,
        computer_hours: int = 8,
        activity: str = "programming",
        break_frequency: int = 45,
        objective: str = "Prevent forward-head posture and neck fatigue"
    ) -> Dict[str, Any]:
        """Saves completed onboarding profile to storage."""
        profile = storage.get_user_profile()
        profile["fullName"] = full_name
        profile["occupation"] = occupation
        profile["computerUsageHours"] = computer_hours
        profile["primaryActivity"] = activity
        profile["breakFrequencyMinutes"] = break_frequency
        profile["primaryObjective"] = objective
        profile["hasCompletedOnboarding"] = True

        storage.save_user_profile(profile)
        return profile
