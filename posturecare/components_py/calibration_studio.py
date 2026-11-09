"""
Python Equivalent of /src/components/CalibrationStudio.tsx
Guides user to set baseline upright ergonomics posture angles (neck, shoulder, ear distance).
"""
from typing import Dict, Any, Optional
from datetime import datetime
from storage import storage


class CalibrationStudioComponent:
    """
    Component logic for guided baseline ergonomics calibration.
    """

    def __init__(self, engine=None):
        if engine is None:
            try:
                from engine import ErgonomicsEngine
                self.engine = ErgonomicsEngine()
            except ImportError:
                self.engine = None
        else:
            self.engine = engine
        self.step: int = 1  # 1: Setup guidance, 2: Position check, 3: Active capture, 4: Confirmed
        self.captured_samples = []

    def get_calibration_guidance(self) -> Dict[str, Any]:
        """Provides setup posture guidance checklist."""
        return {
            "title": "Ergonomic Baseline Calibration",
            "steps": [
                "Adjust chair height so feet are flat on the floor.",
                "Sit with spine gently supported against lumbar backrest.",
                "Position webcam at eye level to prevent downward neck flexion.",
                "Relax shoulders and look directly forward at the center of the display."
            ]
        }

    def save_baseline(
        self,
        name: str = "Standard Desk Setup",
        neck_angle: float = 20.0,
        shoulder_width: float = 150.0,
        ear_shoulder_dist: float = 85.0
    ) -> Dict[str, Any]:
        """Saves calibrated baseline angles into the engine and local persistent storage."""
        self.engine.set_calibration(neck_angle, shoulder_width, ear_shoulder_dist)
        
        baseline_profile = {
            "id": f"base_{int(datetime.now().timestamp())}",
            "name": name,
            "neckAngle": neck_angle,
            "shoulderAngle": 0.8,
            "torsoAngle": 2.1,
            "cameraDistance": 1.0,
            "calibratedAt": datetime.now().isoformat(),
            "isActive": True
        }
        storage.save_baseline(baseline_profile)
        self.step = 4
        return baseline_profile
