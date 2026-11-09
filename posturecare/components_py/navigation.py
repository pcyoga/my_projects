"""
Python Equivalent of /src/components/Navigation.tsx
Manages tabs (Dashboard, Monitor, Calibrate, History, Goals, Stretches),
active session indicator, camera status badge, and user menu triggers.
"""
from typing import List, Dict, Any, Optional, Callable


class NavigationComponent:
    """
    Component model & logic for Top Navigation Bar and Tab Switcher.
    """

    TABS: List[Dict[str, str]] = [
        {"id": "dashboard", "label": "Dashboard", "icon": "📊"},
        {"id": "monitor", "label": "Live Monitor", "icon": "📹"},
        {"id": "calibrate", "label": "Calibration", "icon": "🎯"},
        {"id": "history", "label": "History & Trends", "icon": "📈"},
        {"id": "goals", "label": "Goals", "icon": "🎯"},
        {"id": "stretches", "label": "Desk Stretches", "icon": "✨"},
    ]

    def __init__(
        self,
        active_tab: str = "dashboard",
        on_select_tab: Optional[Callable[[str], None]] = None
    ):
        self.active_tab: str = active_tab
        self.on_select_tab = on_select_tab
        self.is_camera_active: bool = False
        self.is_user_menu_open: bool = False
        self.is_mailbox_modal_open: bool = False

    def select_tab(self, tab_id: str) -> str:
        """Sets active tab and triggers callback if present."""
        valid_ids = [t["id"] for t in self.TABS]
        if tab_id in valid_ids:
            self.active_tab = tab_id
            if self.on_select_tab:
                self.on_select_tab(tab_id)
        return self.active_tab

    def toggle_camera_state(self, is_active: bool) -> bool:
        self.is_camera_active = is_active
        return self.is_camera_active

    def toggle_user_menu(self) -> bool:
        self.is_user_menu_open = not self.is_user_menu_open
        return self.is_user_menu_open

    def toggle_mailbox_modal(self) -> bool:
        self.is_mailbox_modal_open = not self.is_mailbox_modal_open
        return self.is_mailbox_modal_open
