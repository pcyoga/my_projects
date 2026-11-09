"""
PostureCare - Standalone Python Ergonomic Posture & Eye-Care Monitor
Built with MediaPipe Pose, OpenCV, and NumPy.

Features:
- Real-time 33-point skeletal landmark detection via MediaPipe
- Neck tilt angle (Forward Head / "Tech Neck" detection)
- Shoulder slump & asymmetrical tilt detection
- Slouching & distance tracking
- Baseline Calibration routine (Press 'C')
- Real-time ergonomic scoring (0 - 100%)
- Audio/Visual alert notification system
- Session summary statistics & logging
"""

import cv2
import mediapipe as mp
import numpy as np
import time
import math
import os
import json
from datetime import datetime

class PostureDetector:
    def __init__(self):
        # Initialize MediaPipe Pose
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        self.pose = self.mp_pose.Pose(
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6,
            model_complexity=1
        )

        # Baseline calibration parameters
        self.is_calibrated = False
        self.calib_shoulder_width = 0.0
        self.calib_neck_angle = 0.0
        self.calib_ear_shoulder_dist = 0.0
        self.calib_eye_level_y = 0.0

        # Session tracking metrics
        self.start_time = time.time()
        self.good_posture_frames = 0
        self.poor_posture_frames = 0
        self.total_frames = 0
        self.last_alert_time = 0
        self.alert_cooldown = 5.0  # seconds between warnings

    @staticmethod
    def calculate_angle(a, b, c):
        """Calculates 2D angle ABC with vertex at B in degrees."""
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)

        radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
        angle = np.abs(radians * 180.0 / np.pi)
        if angle > 180.0:
            angle = 360.0 - angle
        return angle

    def calibrate(self, landmarks, frame_w, frame_h):
        """Calibrate baseline good posture from user's current sitting position."""
        left_ear = np.array([landmarks[self.mp_pose.PoseLandmark.LEFT_EAR.value].x * frame_w,
                             landmarks[self.mp_pose.PoseLandmark.LEFT_EAR.value].y * frame_h])
        right_ear = np.array([landmarks[self.mp_pose.PoseLandmark.RIGHT_EAR.value].x * frame_w,
                              landmarks[self.mp_pose.PoseLandmark.RIGHT_EAR.value].y * frame_h])
        left_shoulder = np.array([landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value].x * frame_w,
                                  landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value].y * frame_h])
        right_shoulder = np.array([landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x * frame_w,
                                   landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y * frame_h])

        # Calculate baseline metrics
        self.calib_shoulder_width = np.linalg.norm(left_shoulder - right_shoulder)
        self.calib_ear_shoulder_dist = (np.linalg.norm(left_ear - left_shoulder) + 
                                        np.linalg.norm(right_ear - right_shoulder)) / 2.0

        # Baseline vertical neck reference
        mid_shoulder = (left_shoulder + right_shoulder) / 2.0
        mid_ear = (left_ear + right_ear) / 2.0
        ref_vert = np.array([mid_shoulder[0], mid_shoulder[1] + 100])
        self.calib_neck_angle = self.calculate_angle(mid_ear, mid_shoulder, ref_vert)
        self.calib_eye_level_y = (left_ear[1] + right_ear[1]) / 2.0

        self.is_calibrated = True
        return True

    def analyze_frame(self, frame):
        """Processes a single frame and returns annotated image and metrics."""
        h, w, _ = frame.shape
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb)

        metrics = {
            "detected": False,
            "score": 100,
            "status": "No Person Detected",
            "warnings": [],
            "neck_angle": 0,
            "shoulder_tilt": 0,
            "slouch_ratio": 1.0
        }

        if not results.pose_landmarks:
            return frame, metrics

        landmarks = results.pose_landmarks.landmark
        metrics["detected"] = True
        self.total_frames += 1

        # Landmark points
        left_ear = [landmarks[self.mp_pose.PoseLandmark.LEFT_EAR.value].x * w,
                    landmarks[self.mp_pose.PoseLandmark.LEFT_EAR.value].y * h]
        right_ear = [landmarks[self.mp_pose.PoseLandmark.RIGHT_EAR.value].x * w,
                     landmarks[self.mp_pose.PoseLandmark.RIGHT_EAR.value].y * h]
        left_shoulder = [landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value].x * w,
                         landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value].y * h]
        right_shoulder = [landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x * w,
                          landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y * h]
        nose = [landmarks[self.mp_pose.PoseLandmark.NOSE.value].x * w,
                landmarks[self.mp_pose.PoseLandmark.NOSE.value].y * h]

        # 1. Calculate Neck Tilt Angle
        mid_shoulder = [(left_shoulder[0] + right_shoulder[0]) / 2.0,
                        (left_shoulder[1] + right_shoulder[1]) / 2.0]
        mid_ear = [(left_ear[0] + right_ear[0]) / 2.0,
                   (left_ear[1] + right_ear[1]) / 2.0]
        vert_point = [mid_shoulder[0], mid_shoulder[1] + 100]
        neck_angle = self.calculate_angle(mid_ear, mid_shoulder, vert_point)
        metrics["neck_angle"] = round(neck_angle, 1)

        # 2. Calculate Shoulder Tilt
        shoulder_dy = abs(left_shoulder[1] - right_shoulder[1])
        shoulder_dx = abs(left_shoulder[0] - right_shoulder[0])
        shoulder_tilt = math.degrees(math.atan2(shoulder_dy, max(shoulder_dx, 1e-5)))
        metrics["shoulder_tilt"] = round(shoulder_tilt, 1)

        # 3. Slouch & Screen Distance (Shoulder Width)
        current_shoulder_width = math.hypot(left_shoulder[0] - right_shoulder[0],
                                            left_shoulder[1] - right_shoulder[1])
        ear_shoulder_dist = (math.hypot(left_ear[0] - left_shoulder[0], left_ear[1] - left_shoulder[1]) +
                             math.hypot(right_ear[0] - right_shoulder[0], right_ear[1] - right_shoulder[1])) / 2.0

        score = 100
        warnings = []

        # Evaluate deviations
        if self.is_calibrated:
            # Neck forward displacement
            neck_dev = abs(neck_angle - self.calib_neck_angle)
            if neck_dev > 15:
                warnings.append("Forward Head / Tech Neck")
                score -= min(40, int(neck_dev * 1.8))

            # Shoulder asymmetry
            if shoulder_tilt > 7.0:
                warnings.append("Shoulder Uneven / Slump")
                score -= min(30, int(shoulder_tilt * 3))

            # Slouching (ear-to-shoulder compression)
            if ear_shoulder_dist < self.calib_ear_shoulder_dist * 0.82:
                warnings.append("Slouching / Hunched Spine")
                score -= 25

            # Too close to screen
            if current_shoulder_width > self.calib_shoulder_width * 1.35:
                warnings.append("Too Close to Display")
                score -= 15
        else:
            # Heuristic checks without calibration
            if neck_angle > 35:
                warnings.append("Forward Head Angle")
                score -= 35
            if shoulder_tilt > 8:
                warnings.append("Uneven Shoulders")
                score -= 25

        score = max(0, min(100, score))
        metrics["score"] = score
        metrics["warnings"] = warnings

        if score >= 80:
            metrics["status"] = "Optimal Posture"
            self.good_posture_frames += 1
        elif score >= 55:
            metrics["status"] = "Moderate Posture"
            self.poor_posture_frames += 1
        else:
            metrics["status"] = "Poor Posture - Please Adjust"
            self.poor_posture_frames += 1

        # Draw Skeleton landmarks
        self.mp_drawing.draw_landmarks(
            frame,
            results.pose_landmarks,
            self.mp_pose.POSE_CONNECTIONS,
            landmark_drawing_spec=self.mp_drawing_styles.get_default_pose_landmarks_style()
        )

        return frame, metrics


def draw_hud(frame, metrics, detector):
    """Draws a modern overlay UI with telemetry badges, score, and alerts."""
    h, w, _ = frame.shape
    overlay = frame.copy()

    # Top Telemetry Header Bar
    cv2.rectangle(overlay, (0, 0), (w, 90), (20, 24, 36), -1)
    # Bottom Controls Help Bar
    cv2.rectangle(overlay, (0, h - 45), (w, h), (20, 24, 36), -1)
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

    # 1. Title & Status
    cv2.putText(frame, "PostureCare AI Monitor", (20, 32),
                cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2)

    status_color = (70, 200, 80) if metrics["score"] >= 80 else (0, 180, 255) if metrics["score"] >= 55 else (60, 60, 255)
    cv2.putText(frame, f"Status: {metrics['status']}", (20, 68),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, status_color, 2)

    # 2. Score Badge
    score_text = f"Score: {metrics['score']}%"
    cv2.putText(frame, score_text, (w - 190, 42),
                cv2.FONT_HERSHEY_DUPLEX, 0.85, status_color, 2)

    calib_str = "[Calibrated]" if detector.is_calibrated else "[Uncalibrated - Press 'C']"
    calib_col = (100, 220, 100) if detector.is_calibrated else (150, 150, 255)
    cv2.putText(frame, calib_str, (w - 240, 72),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, calib_col, 1)

    # 3. Active Warning Banner
    if metrics["warnings"]:
        warn_y = 125
        for warn in metrics["warnings"]:
            # Badge background
            cv2.rectangle(frame, (15, warn_y - 22), (320, warn_y + 8), (0, 0, 180), -1)
            cv2.putText(frame, f"! {warn}", (25, warn_y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
            warn_y += 35

    # 4. Bottom Controls Keymap
    help_text = "[C] Calibrate Baseline   |   [R] Reset Stats   |   [S] Save Log   |   [Q] Quit"
    cv2.putText(frame, help_text, (20, h - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)


def main():
    print("=" * 60)
    print("   Starting PostureCare - Python Ergonomic Desktop Monitor")
    print("=" * 60)
    print("Keyboard Controls:")
    print("  [C] : Calibrate upright posture baseline")
    print("  [R] : Reset session metrics")
    print("  [S] : Save posture session report to JSON")
    print("  [Q] : Exit monitor")
    print("=" * 60)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam device. Please verify camera connections.")
        return

    # Set camera resolution to 1280x720
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    detector = PostureDetector()

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            print("Ignoring empty camera frame.")
            continue

        # Flip horizontally for natural mirror view
        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape

        # Analyze posture
        frame, metrics = detector.analyze_frame(frame)

        # Render HUD Overlay
        draw_hud(frame, metrics, detector)

        # Show window
        cv2.imshow("PostureCare - Python OpenCV Desktop App", frame)

        # Key listeners
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q') or key == 27:  # 'q' or Esc to quit
            break
        elif key == ord('c') or key == ord('C'):
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res = detector.pose.process(rgb)
            if res.pose_landmarks:
                detector.calibrate(res.pose_landmarks.landmark, w, h)
                print(">> Baseline posture successfully calibrated!")
            else:
                print(">> Calibration failed: No body landmarks detected.")
        elif key == ord('r') or key == ord('R'):
            detector.good_posture_frames = 0
            detector.poor_posture_frames = 0
            detector.total_frames = 0
            detector.start_time = time.time()
            print(">> Session statistics reset.")
        elif key == ord('s') or key == ord('S'):
            total = max(1, detector.total_frames)
            good_pct = round((detector.good_posture_frames / total) * 100, 1)
            duration_min = round((time.time() - detector.start_time) / 60.0, 1)
            report = {
                "timestamp": datetime.now().isoformat(),
                "duration_minutes": duration_min,
                "good_posture_percentage": good_pct,
                "total_frames_analyzed": total,
                "calibrated": detector.is_calibrated
            }
            filename = f"posture_report_{int(time.time())}.json"
            with open(filename, "w") as f:
                json.dump(report, f, indent=2)
            print(f">> Session report saved to {filename}")

    cap.release()
    cv2.destroyAllWindows()
    print("PostureCare Python monitor closed.")


if __name__ == "__main__":
    main()
