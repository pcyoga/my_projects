"""
Python Equivalent of /src/components/MonitoringStudio.tsx
Runs real-time posture computer vision analysis, skeleton HUD overlay, forward neck tracking, and session saving.
"""
from typing import Dict, Any, Tuple, Optional
import time
from storage import storage


class MonitoringStudioComponent:
    """
    Component logic powering real-time ergonomics webcam analysis and HUD overlay.
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
        self.is_monitoring: bool = False
        self.session_start_time: Optional[float] = None
        self.session_good_seconds: int = 0
        self.session_warning_seconds: int = 0
        self.session_poor_seconds: int = 0
        self.total_alerts: int = 0

    def start_session(self) -> None:
        """Starts a live posture tracking session."""
        self.is_monitoring = True
        self.session_start_time = time.time()
        self.session_good_seconds = 0
        self.session_warning_seconds = 0
        self.session_poor_seconds = 0
        self.total_alerts = 0

    def stop_session(self) -> Dict[str, Any]:
        """Stops live tracking and records session into storage."""
        if not self.is_monitoring:
            return {}

        self.is_monitoring = False
        duration = int(time.time() - (self.session_start_time or time.time()))
        
        total_tracked = max(1, self.session_good_seconds + self.session_warning_seconds + self.session_poor_seconds)
        avg_score = int((self.session_good_seconds * 100 + self.session_warning_seconds * 70 + self.session_poor_seconds * 40) / total_tracked)

        session_record = {
            "id": f"sess_{int(time.time())}",
            "startTime": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(self.session_start_time or time.time())),
            "endTime": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "durationSeconds": duration,
            "averageScore": max(60, min(100, avg_score)),
            "goodSeconds": self.session_good_seconds,
            "warningSeconds": self.session_warning_seconds,
            "poorSeconds": self.session_poor_seconds,
            "alertCount": self.total_alerts
        }
        storage.save_session(session_record)
        return session_record

    def process_video_frame(self, frame_bgr) -> Tuple[Any, Dict[str, Any]]:
        """
        Runs skeletal detection and posture metrics calculation on a raw BGR image frame.
        Returns annotated frame and posture metrics dict.
        """
        annotated_frame, metrics = self.engine.process_frame(frame_bgr)
        
        # Track statistics if active session
        if self.is_monitoring:
            if metrics.status == "Good Posture":
                self.session_good_seconds += 1
            elif metrics.status == "Moderate Slouch":
                self.session_warning_seconds += 1
            else:
                self.session_poor_seconds += 1
                self.total_alerts += 1

        return annotated_frame, {
            "status": metrics.status,
            "score": metrics.score,
            "neckAngle": metrics.neck_angle,
            "shoulderTilt": metrics.shoulder_tilt,
            "slouchRatio": metrics.slouch_ratio,
            "isCalibrated": self.engine.calibration.is_active
        }
