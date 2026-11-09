"""
Python Equivalent of /src/components/SettingsModal.tsx
Configures alert sensitivity, sound chimes volume, and micro-break reminder intervals.
"""
from typing import Dict, Any
from storage import storage
from audio import sound_manager


class SettingsModalComponent:
    """
    Component for viewing and adjusting notification and sensitivity preferences.
    """

    def __init__(self):
        self.is_open: bool = False

    def get_preferences(self) -> Dict[str, Any]:
        """Loads saved preferences."""
        return storage.get_preferences()

    def update_preferences(
        self,
        sound_alerts: bool = True,
        break_reminders: bool = True,
        sensitivity: str = "medium",
        break_minutes: int = 45,
        sound_volume: float = 0.7
    ) -> Dict[str, Any]:
        """Saves updated preferences."""
        prefs = {
            "soundAlerts": sound_alerts,
            "breakReminders": break_reminders,
            "alertSensitivity": sensitivity,
            "breakReminderMinutes": break_minutes,
            "soundVolume": sound_volume
        }
        storage.save_preferences(prefs)
        sound_manager.enabled = sound_alerts
        return prefs

    def test_audio_alert(self) -> None:
        """Plays test audio chime."""
        sound_manager.play_alert()
