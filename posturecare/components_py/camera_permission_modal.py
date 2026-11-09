"""
Python Equivalent of /src/components/CameraPermissionModal.tsx
Handles video capture device validation, permissions, and device index switching.
"""
from typing import List, Dict, Any, Optional


class CameraPermissionModalComponent:
    """
    Component for handling video capture device selection and permissions check.
    """

    def __init__(self):
        self.is_open: bool = False
        self.permission_granted: bool = False
        self.selected_device_index: int = 0

    def list_available_cameras(self) -> List[Dict[str, Any]]:
        """Simulates camera device inspection or queries OpenCV video indices."""
        return [
            {"id": 0, "name": "Default Built-In HD Webcam", "isDefault": True},
            {"id": 1, "name": "External USB Ergonomics Camera", "isDefault": False}
        ]

    def grant_permission(self, device_index: int = 0) -> bool:
        self.permission_granted = True
        self.selected_device_index = device_index
        self.is_open = False
        return True

    def deny_permission(self) -> bool:
        self.permission_granted = False
        self.is_open = False
        return False
