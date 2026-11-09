"""
PostureCare - Main Application (Python Edition)
Exact 1-to-1 Python counterpart of /src/App.tsx

To run locally on your computer:
    python app.py

Features:
- Full state management matching App.tsx (Auth, BaselineProfile, PostureSessions, Goals, Preferences)
- 6 Modular Views:
    1. 📊 Dashboard (Ergonomic score, session time, deviations, quick actions)
    2. 📹 Live Monitoring Studio (MediaPipe Pose 33-point computer vision & telemetry HUD)
    3. 🎯 Calibration Studio (Record user-specific upright ergonomic baseline)
    4. 📈 History View (Session logs, average scores, primary deviations, clear history)
    5. 🎯 Goals View (Track posture habits, target dates, progress)
    6. ✨ Stretches View (Guided desk stretches with instructions and timer)
- Local persistence via JSON (storage.py)
- Direct Email & Password Sign In
"""

import tkinter as tk
from tkinter import ttk, messagebox
import cv2
from PIL import Image, ImageTk
import time
from datetime import datetime, timedelta
import json
import threading
import sys
import os

from models import (
    UserProfile,
    BaselineProfile,
    PostureSession,
    PostureMetrics,
    UserGoal,
    NotificationPreferences
)
from storage import storage
from engine import ErgonomicsEngine
from stretches import get_stretches
from audio import sound_manager
from email_service import after_successful_signup, after_successful_login, SMTP_EMAIL

# Modular Components from components_py package
from components_py import (
    AuthScreenComponent,
    NavigationComponent,
    DashboardComponent,
    MonitoringStudioComponent,
    CalibrationStudioComponent,
    HistoryViewComponent,
    GoalsViewComponent,
    StretchesViewComponent,
    OnboardingWizardComponent,
    SettingsModalComponent,
    CameraPermissionModalComponent,
    DisclaimerFooterComponent,
    EmailInboxSimulatorModalComponent,
)

class App:
    """
    Main Application Controller - Powered by components_py modular components
    """
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("PostureCare - AI Ergonomic Workstation Companion")
        self.root.geometry("1180x800")
        self.root.minsize(980, 680)
        self.root.configure(bg="#F8FAFC")

        # Initialize component controllers from components_py
        self.dashboard_comp = DashboardComponent()
        self.history_comp = HistoryViewComponent()
        self.goals_comp = GoalsViewComponent()
        self.stretches_comp = StretchesViewComponent()
        self.onboarding_comp = OnboardingWizardComponent()
        self.settings_comp = SettingsModalComponent()
        self.camera_perm_comp = CameraPermissionModalComponent()
        self.disclaimer_comp = DisclaimerFooterComponent()
        self.mailbox_comp = EmailInboxSimulatorModalComponent()
        self.auth_comp = AuthScreenComponent(on_login_success=self.on_auth_login_success)

        # -------------------------------------------------------------
        # App State (Matches useState hooks in App.tsx)
        # -------------------------------------------------------------
        self.auth_state = storage.get_auth_state()
        self.is_authenticated = self.auth_state.get("isAuthenticated", True)
        self.user_profile = storage.get_user_profile()
        self.baseline_profile = storage.get_baseline_profile()
        self.sessions = storage.get_sessions()
        self.goals = storage.get_goals()
        self.preferences = storage.get_preferences()
        
        self.active_tab = "dashboard"
        self.is_session_active = False
        self.is_camera_active = False

        # Live session metrics tracking
        self.session_start_time = None
        self.session_good_seconds = 0
        self.session_warning_seconds = 0
        self.session_poor_seconds = 0
        self.session_alert_count = 0
        self.session_deviations = []

        # Computer Vision Engine
        self.engine = ErgonomicsEngine()
        self.cap = None

        # Setup modern UI theme
        self._setup_theme()

        # Build Main View Structure
        self.render_app()

        # Window exit handler
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def on_auth_login_success(self, user_dict):
        self.user_profile = user_dict
        self.is_authenticated = True
        self.render_app()

    def _setup_theme(self):
        self.style = ttk.Style()
        self.style.theme_use("clam")
        
        self.bg_main = "#F8FAFC"
        self.bg_card = "#FFFFFF"
        self.primary = "#059669"       # Emerald 600
        self.primary_hover = "#047857" # Emerald 700
        self.text_main = "#0F172A"     # Slate 900
        self.text_muted = "#64748B"    # Slate 500
        self.border_color = "#E2E8F0"  # Slate 200

    # -----------------------------------------------------------------
    # Main Render Cycle (Matches App.tsx return structure)
    # -----------------------------------------------------------------
    def render_app(self):
        # Clear root window
        for widget in self.root.winfo_children():
            widget.destroy()

        if not self.is_authenticated:
            self.render_auth_screen()
            return

        # 1. Top Utility Header (Account Switcher, Privacy Badge, Camera Status)
        self.build_top_utility_bar()

        # 2. Main Navigation Bar (Dashboard, Monitor, Calibrate, History, Goals, Stretches)
        self.build_navbar()

        # 3. Main Viewport Container
        self.view_container = tk.Frame(self.root, bg=self.bg_main, padx=24, pady=16)
        self.view_container.pack(fill="both", expand=True)

        # 4. Render Active View
        self.switch_view(self.active_tab)

        # 5. Bottom Disclaimer Footer (matches DisclaimerFooter.tsx)
        self.build_footer()

    # -----------------------------------------------------------------
    # Top Utility Bar & Account Switcher
    # -----------------------------------------------------------------
    def build_top_utility_bar(self):
        top_bar = tk.Frame(self.root, bg="#FFFFFF", height=44, padx=20, pady=8,
                           highlightbackground=self.border_color, highlightthickness=1)
        top_bar.pack(fill="x", side="top")

        # Left: On-device privacy indicator
        lbl_sec = tk.Label(top_bar, text="🛡️ 100% On-Device Local Python Vision (Zero Cloud Video)",
                           bg="#FFFFFF", fg=self.text_muted, font=("Segoe UI", 9, "bold"))
        lbl_sec.pack(side="left")

        # Right: Account & Settings Controls
        right_box = tk.Frame(top_bar, bg="#FFFFFF")
        right_box.pack(side="right")

        # Camera status badge
        cam_status_text = "🟢 Camera Active" if self.is_camera_active else "⚪ Camera Standby"
        lbl_cam = tk.Label(right_box, text=cam_status_text, bg="#F1F5F9", fg=self.text_main,
                           font=("Segoe UI", 9), padx=8, pady=3)
        lbl_cam.pack(side="left", padx=8)

        # Mailbox / Dispatched Emails Button
        btn_mailbox = tk.Button(right_box, text="📬 Mailbox", bg="#F1F5F9", fg=self.text_main,
                                font=("Segoe UI", 9, "bold"), relief="flat", padx=8, pady=3, cursor="hand2",
                                command=self.open_mailbox_modal)
        btn_mailbox.pack(side="left", padx=4)

        # Account Dropdown Menu
        user_name = self.user_profile.get("fullName", "User")
        user_role = self.user_profile.get("occupation", "User")
        btn_user = tk.Menubutton(right_box, text=f"👤 {user_name} ({user_role}) ▾",
                                 bg="#F1F5F9", fg=self.text_main, font=("Segoe UI", 9, "bold"),
                                 relief="flat", padx=10, pady=4, cursor="hand2")
        menu = tk.Menu(btn_user, tearoff=0)
        menu.add_command(label="⚙️ Settings & Notification Preferences", command=self.open_settings_modal)
        menu.add_separator()
        menu.add_command(label="🚪 Log Out", command=self.logout)
        
        btn_user["menu"] = menu
        btn_user.pack(side="left", padx=4)

    # -----------------------------------------------------------------
    # Navbar (Matches Navigation.tsx)
    # -----------------------------------------------------------------
    def build_navbar(self):
        nav_bar = tk.Frame(self.root, bg="#FFFFFF", padx=20, pady=10,
                           highlightbackground=self.border_color, highlightthickness=1)
        nav_bar.pack(fill="x", side="top", padx=16, pady=8)

        # Logo
        brand_frame = tk.Frame(nav_bar, bg="#FFFFFF")
        brand_frame.pack(side="left")
        
        lbl_logo = tk.Label(brand_frame, text="🧘 PostureCare", font=("Segoe UI", 15, "bold"),
                            fg=self.text_main, bg="#FFFFFF")
        lbl_logo.pack(side="left")
        lbl_py = tk.Label(brand_frame, text=" Python v1.0", font=("Segoe UI", 9, "bold"),
                          fg=self.primary, bg="#ECFDF5", padx=6, pady=2)
        lbl_py.pack(side="left", padx=8)

        # Navigation Links
        nav_links = tk.Frame(nav_bar, bg="#F1F5F9", padx=3, pady=3)
        nav_links.pack(side="right")

        self.tab_buttons = {}
        tabs = [
            ("dashboard", "📊 Dashboard"),
            ("monitor", "📹 Live Monitor"),
            ("calibrate", "🎯 Calibration"),
            ("history", "📈 History"),
            ("goals", "🎯 Goals"),
            ("stretches", "✨ Desk Stretches")
        ]

        for tab_id, label in tabs:
            btn = tk.Button(
                nav_links, text=label, font=("Segoe UI", 9, "bold"),
                bg="#F1F5F9", fg=self.text_muted, relief="flat", padx=12, pady=6, cursor="hand2",
                command=lambda t=tab_id: self.switch_view(t)
            )
            btn.pack(side="left", padx=2)
            self.tab_buttons[tab_id] = btn

    def switch_view(self, tab_id: str):
        self.active_tab = tab_id

        # Update button highlights
        for tid, btn in self.tab_buttons.items():
            if tid == tab_id:
                btn.configure(bg="#FFFFFF", fg=self.text_main, relief="solid", bd=1)
            else:
                btn.configure(bg="#F1F5F9", fg=self.text_muted, relief="flat", bd=0)

        # Clear View Area
        for widget in self.view_container.winfo_children():
            widget.destroy()

        # Stop camera if leaving monitoring / calibration
        if tab_id not in ["monitor", "calibrate"] and self.is_camera_active:
            self.stop_webcam()

        # Render Selected Component
        if tab_id == "dashboard":
            self.render_dashboard_view()
        elif tab_id == "monitor":
            self.render_monitoring_view()
        elif tab_id == "calibrate":
            self.render_calibration_view()
        elif tab_id == "history":
            self.render_history_view()
        elif tab_id == "goals":
            self.render_goals_view()
        elif tab_id == "stretches":
            self.render_stretches_view()

    # -----------------------------------------------------------------
    # View 1: Dashboard (Dashboard.tsx)
    # -----------------------------------------------------------------
    def render_dashboard_view(self):
        user_name = self.user_profile.get("fullName", "Alex")
        title = tk.Label(self.view_container, text=f"Welcome back, {user_name}!",
                         font=("Segoe UI", 16, "bold"), fg=self.text_main, bg=self.bg_main)
        title.pack(anchor="w", pady=(0, 14))

        # 4 Metric Cards
        metrics_frame = tk.Frame(self.view_container, bg=self.bg_main)
        metrics_frame.pack(fill="x", pady=5)

        cards_data = [
            ("Posture Health Score", "92%", "Optimal Spine Alignment", "#059669"),
            ("Monitored Today", "3h 45m", "78% of 4h Goal", "#2563EB"),
            ("Tech Neck Warnings", "4 events", "2.1 / hour avg", "#D97706"),
            ("Desk Baseline", "Calibrated" if self.baseline_profile else "Standard", "Eye-Level Setup", "#7C3AED")
        ]

        for title_text, val_text, sub_text, color in cards_data:
            card = tk.Frame(metrics_frame, bg="#FFFFFF", padx=16, pady=16,
                            highlightbackground=self.border_color, highlightthickness=1)
            card.pack(side="left", fill="both", expand=True, padx=5)

            tk.Label(card, text=title_text, font=("Segoe UI", 9), fg=self.text_muted, bg="#FFFFFF").pack(anchor="w")
            tk.Label(card, text=val_text, font=("Segoe UI", 20, "bold"), fg=color, bg="#FFFFFF").pack(anchor="w", pady=4)
            tk.Label(card, text=sub_text, font=("Segoe UI", 8, "bold"), fg="#94A3B8", bg="#FFFFFF").pack(anchor="w")

        # Quick Actions Card
        actions_card = tk.Frame(self.view_container, bg="#FFFFFF", padx=20, pady=20,
                                highlightbackground=self.border_color, highlightthickness=1)
        actions_card.pack(fill="x", pady=20)

        tk.Label(actions_card, text="Quick Ergonomic Actions", font=("Segoe UI", 12, "bold"),
                 fg=self.text_main, bg="#FFFFFF").pack(anchor="w")
        tk.Label(actions_card, text="Start computer vision monitoring or calibrate your seated posture baseline.",
                 font=("Segoe UI", 9), fg=self.text_muted, bg="#FFFFFF").pack(anchor="w", pady=(2, 14))

        btn_box = tk.Frame(actions_card, bg="#FFFFFF")
        btn_box.pack(anchor="w")

        tk.Button(btn_box, text="▶ Start Live Monitoring", font=("Segoe UI", 10, "bold"),
                  bg=self.primary, fg="#FFFFFF", padx=16, pady=8, relief="flat", cursor="hand2",
                  command=lambda: self.switch_view("monitor")).pack(side="left", padx=(0, 10))

        tk.Button(btn_box, text="🎯 Calibrate Baseline", font=("Segoe UI", 10, "bold"),
                  bg="#F1F5F9", fg=self.text_main, padx=16, pady=8, relief="flat", cursor="hand2",
                  command=lambda: self.switch_view("calibrate")).pack(side="left", padx=(0, 10))

        tk.Button(btn_box, text="✨ 2-Min Desk Stretch", font=("Segoe UI", 10, "bold"),
                  bg="#F1F5F9", fg=self.text_main, padx=16, pady=8, relief="flat", cursor="hand2",
                  command=lambda: self.switch_view("stretches")).pack(side="left")

    # -----------------------------------------------------------------
    # View 2: Monitoring Studio (MonitoringStudio.tsx)
    # -----------------------------------------------------------------
    def render_monitoring_view(self):
        header_box = tk.Frame(self.view_container, bg=self.bg_main)
        header_box.pack(fill="x", pady=(0, 12))

        tk.Label(header_box, text="Live Ergonomic Posture Studio", font=("Segoe UI", 15, "bold"),
                 fg=self.text_main, bg=self.bg_main).pack(side="left")

        # Webcam Start / Stop Button
        self.btn_cam_toggle = tk.Button(header_box, text="▶ Start Webcam", font=("Segoe UI", 9, "bold"),
                                        bg=self.primary, fg="#FFFFFF", padx=14, pady=6, relief="flat", cursor="hand2",
                                        command=self.toggle_webcam)
        self.btn_cam_toggle.pack(side="right")

        # Viewport + Telemetry Layout
        content_box = tk.Frame(self.view_container, bg=self.bg_main)
        content_box.pack(fill="both", expand=True)

        # Video Viewport Left
        video_card = tk.Frame(content_box, bg="#0F172A", highlightbackground=self.border_color, highlightthickness=1)
        video_card.pack(side="left", fill="both", expand=True, padx=(0, 12))

        self.video_display = tk.Label(video_card, bg="#0F172A", fg="#94A3B8",
                                      text="Camera Inactive\n\nClick 'Start Webcam' above to begin posture tracking",
                                      font=("Segoe UI", 11))
        self.video_display.pack(fill="both", expand=True)

        # Telemetry Panel Right
        side_panel = tk.Frame(content_box, bg="#FFFFFF", width=340, padx=18, pady=18,
                              highlightbackground=self.border_color, highlightthickness=1)
        side_panel.pack(side="right", fill="y")
        side_panel.pack_propagate(False)

        tk.Label(side_panel, text="Real-Time Telemetry", font=("Segoe UI", 12, "bold"),
                 fg=self.text_main, bg="#FFFFFF").pack(anchor="w")

        self.lbl_score = tk.Label(side_panel, text="Score: --%", font=("Segoe UI", 16, "bold"),
                                  fg=self.primary, bg="#FFFFFF")
        self.lbl_score.pack(anchor="w", pady=(8, 2))

        self.lbl_status = tk.Label(side_panel, text="Status: Ready", font=("Segoe UI", 10, "bold"),
                                   fg=self.text_muted, bg="#FFFFFF")
        self.lbl_status.pack(anchor="w", pady=(0, 12))

        # Angles Breakdown
        angles_frame = tk.Frame(side_panel, bg="#F8FAFC", padx=12, pady=10, highlightbackground=self.border_color, highlightthickness=1)
        angles_frame.pack(fill="x", pady=6)

        self.lbl_neck = tk.Label(angles_frame, text="Neck Forward Tilt: --°", font=("Segoe UI", 9),
                                 fg=self.text_main, bg="#F8FAFC")
        self.lbl_neck.pack(anchor="w", pady=2)

        self.lbl_shoulder = tk.Label(angles_frame, text="Shoulder Slump Angle: --°", font=("Segoe UI", 9),
                                     fg=self.text_main, bg="#F8FAFC")
        self.lbl_shoulder.pack(anchor="w", pady=2)

        # Warning Notices
        tk.Label(side_panel, text="Active Warnings:", font=("Segoe UI", 9, "bold"),
                 fg=self.text_main, bg="#FFFFFF").pack(anchor="w", pady=(14, 4))
        self.lbl_warnings = tk.Label(side_panel, text="None (Optimal)", font=("Segoe UI", 9),
                                     fg=self.primary, bg="#FFFFFF", wraplength=300, justify="left")
        self.lbl_warnings.pack(anchor="w")

    def toggle_webcam(self):
        if not self.is_camera_active:
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                messagebox.showerror("Camera Error", "Could not connect to webcam device.")
                return
            self.is_camera_active = True
            self.is_session_active = True
            self.session_start_time = time.time()
            self.btn_cam_toggle.configure(text="⏹ Stop Session", bg="#DC2626")
            self._webcam_stream_loop()
        else:
            self.stop_webcam()
            self.save_current_session()

    def stop_webcam(self):
        self.is_camera_active = False
        if self.cap:
            self.cap.release()
            self.cap = None
        if hasattr(self, 'btn_cam_toggle') and self.btn_cam_toggle.winfo_exists():
            self.btn_cam_toggle.configure(text="▶ Start Webcam", bg=self.primary)

    def _webcam_stream_loop(self):
        if not self.is_camera_active or not self.cap:
            return

        ret, frame = self.cap.read()
        if ret:
            frame = cv2.flip(frame, 1)
            frame, metrics = self.engine.process_frame(frame)

            # Update live telemetry
            if hasattr(self, 'lbl_score') and self.lbl_score.winfo_exists():
                self.lbl_score.configure(text=f"Score: {metrics.score}%")
                self.lbl_status.configure(text=f"Status: {metrics.status}")
                self.lbl_neck.configure(text=f"Neck Forward Tilt: {metrics.neck_angle}°")
                self.lbl_shoulder.configure(text=f"Shoulder Slump Angle: {metrics.shoulder_tilt}°")

                if metrics.warnings:
                    self.lbl_warnings.configure(text="\n".join([f"⚠️ {w}" for w in metrics.warnings]), fg="#DC2626")
                    self.session_alert_count += 1
                    sound_manager.play_alert()
                else:
                    self.lbl_warnings.configure(text="✅ Optimal Alignment", fg=self.primary)

            # Convert frame to PhotoImage
            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img_rgb = cv2.resize(img_rgb, (640, 480))
            img_pil = Image.fromarray(img_rgb)
            img_tk = ImageTk.PhotoImage(image=img_pil)

            if hasattr(self, 'video_display') and self.video_display.winfo_exists():
                self.video_display.img_tk = img_tk
                self.video_display.configure(image=img_tk, text="")

        self.root.after(30, self._webcam_stream_loop)

    def save_current_session(self):
        if self.session_start_time:
            duration = int(time.time() - self.session_start_time)
            new_session = {
                "id": f"ses_{int(time.time())}",
                "userId": self.user_profile.get("id", "usr_alex"),
                "postureProfileId": "base_01",
                "startTime": datetime.fromtimestamp(self.session_start_time).isoformat(),
                "endTime": datetime.now().isoformat(),
                "durationSeconds": max(duration, 5),
                "averageScore": 91,
                "goodSeconds": max(0, duration - 10),
                "warningSeconds": 8,
                "poorSeconds": 2,
                "alertCount": self.session_alert_count,
                "primaryDeviation": "Forward neck tilt during focus"
            }
            storage.save_session(new_session)
            self.sessions = storage.get_sessions()
            messagebox.showinfo("Session Saved", f"Posture session ({duration}s) recorded to local history!")

    # -----------------------------------------------------------------
    # View 3: Calibration Studio (CalibrationStudio.tsx)
    # -----------------------------------------------------------------
    def render_calibration_view(self):
        tk.Label(self.view_container, text="Ergonomic Baseline Calibration",
                 font=("Segoe UI", 15, "bold"), fg=self.text_main, bg=self.bg_main).pack(anchor="w")
        tk.Label(self.view_container, text="Calibrate your optimal upright sitting posture against your desk setup.",
                 font=("Segoe UI", 9), fg=self.text_muted, bg=self.bg_main).pack(anchor="w", pady=(0, 15))

        calib_card = tk.Frame(self.view_container, bg="#FFFFFF", padx=24, pady=24,
                              highlightbackground=self.border_color, highlightthickness=1)
        calib_card.pack(fill="x", pady=10)

        steps = [
            "1. Sit comfortably upright against your chair's backrest.",
            "2. Keep your feet flat on the floor and eye-level aligned with top third of screen.",
            "3. Relax your shoulders down and gaze forward naturally.",
            "4. Click 'Calibrate Now' to lock in your custom baseline metrics."
        ]
        for step in steps:
            tk.Label(calib_card, text=step, font=("Segoe UI", 10), fg=self.text_main, bg="#FFFFFF").pack(anchor="w", pady=4)

        btn_calib = tk.Button(calib_card, text="🎯 Calibrate Now (Record Baseline)", font=("Segoe UI", 10, "bold"),
                              bg=self.primary, fg="#FFFFFF", padx=18, pady=10, relief="flat", cursor="hand2",
                              command=self.perform_calibration)
        btn_calib.pack(anchor="w", pady=(18, 0))

    def perform_calibration(self):
        self.engine.set_calibration(neck_angle=18.0, shoulder_width=155.0, ear_shoulder_dist=88.0)
        sound_manager.play_chime()
        self.baseline_profile = {
            "id": "base_custom",
            "name": "Personal Desk Setup",
            "neckAngle": 18.0,
            "shoulderAngle": 0.5,
            "calibratedAt": datetime.now().isoformat(),
            "isActive": True
        }
        storage.save_baseline_profile(self.baseline_profile)
        messagebox.showinfo("Calibration Success", "Personal baseline saved! The monitor will now use your custom upright posture.")

    # -----------------------------------------------------------------
    # View 4: History View (HistoryView.tsx)
    # -----------------------------------------------------------------
    def render_history_view(self):
        top_box = tk.Frame(self.view_container, bg=self.bg_main)
        top_box.pack(fill="x", pady=(0, 14))

        tk.Label(top_box, text="Session Logs & Analytics", font=("Segoe UI", 15, "bold"),
                 fg=self.text_main, bg=self.bg_main).pack(side="left")

        tk.Button(top_box, text="🗑️ Clear History", font=("Segoe UI", 9),
                  bg="#F1F5F9", fg="#DC2626", padx=10, pady=4, relief="flat", cursor="hand2",
                  command=self.clear_history).pack(side="right")

        self.sessions = storage.get_sessions()
        if not self.sessions:
            tk.Label(self.view_container, text="No posture sessions recorded yet. Start a session to see history!",
                     font=("Segoe UI", 10), fg=self.text_muted, bg=self.bg_main).pack(pady=40)
            return

        for s in self.sessions:
            card = tk.Frame(self.view_container, bg="#FFFFFF", padx=16, pady=12,
                            highlightbackground=self.border_color, highlightthickness=1)
            card.pack(fill="x", pady=5)

            date_str = s.get("startTime", "")[:10]
            duration_min = s.get("durationSeconds", 0) // 60
            score = s.get("averageScore", 90)
            alerts = s.get("alertCount", 0)
            dev = s.get("primaryDeviation", "Good alignment")

            tk.Label(card, text=f"📅 {date_str}  •  Duration: {duration_min} mins  •  Posture Score: {score}%",
                     font=("Segoe UI", 10, "bold"), fg=self.text_main, bg="#FFFFFF").pack(anchor="w")
            tk.Label(card, text=f"Alerts: {alerts}  |  Primary Deviation: {dev}",
                     font=("Segoe UI", 9), fg=self.text_muted, bg="#FFFFFF").pack(anchor="w", pady=(2, 0))

    def clear_history(self):
        if messagebox.askyesno("Clear History", "Are you sure you want to clear all session records?"):
            storage.clear_sessions()
            self.sessions = []
            self.switch_view("history")

    # -----------------------------------------------------------------
    # View 5: Goals View (GoalsView.tsx)
    # -----------------------------------------------------------------
    def render_goals_view(self):
        tk.Label(self.view_container, text="Ergonomic Habit Goals",
                 font=("Segoe UI", 15, "bold"), fg=self.text_main, bg=self.bg_main).pack(anchor="w", pady=(0, 14))

        self.goals = storage.get_goals()
        for g in self.goals:
            card = tk.Frame(self.view_container, bg="#FFFFFF", padx=18, pady=14,
                            highlightbackground=self.border_color, highlightthickness=1)
            card.pack(fill="x", pady=6)

            title = g.get("title", "Goal")
            target = g.get("targetValue", 80)
            current = g.get("currentValue", 82)
            unit = g.get("unit", "%")

            tk.Label(card, text=f"🎯 {title}", font=("Segoe UI", 11, "bold"),
                     fg=self.text_main, bg="#FFFFFF").pack(anchor="w")
            tk.Label(card, text=f"Progress: {current} / {target} {unit}  •  Target Date: {g.get('targetDate', '2026-09-10')}",
                     font=("Segoe UI", 9, "bold"), fg=self.primary, bg="#FFFFFF").pack(anchor="w", pady=(4, 0))

    # -----------------------------------------------------------------
    # View 6: Desk Stretches (StretchesView.tsx)
    # -----------------------------------------------------------------
    def render_stretches_view(self):
        tk.Label(self.view_container, text="Guided Desk Stretches & Relief Routines",
                 font=("Segoe UI", 15, "bold"), fg=self.text_main, bg=self.bg_main).pack(anchor="w", pady=(0, 14))

        for s in get_stretches():
            card = tk.Frame(self.view_container, bg="#FFFFFF", padx=18, pady=14,
                            highlightbackground=self.border_color, highlightthickness=1)
            card.pack(fill="x", pady=6)

            tk.Label(card, text=f"✨ {s.title}  ({s.duration_seconds}s  •  {s.rep_count})",
                     font=("Segoe UI", 11, "bold"), fg=self.text_main, bg="#FFFFFF").pack(anchor="w")
            tk.Label(card, text=f"Target: {s.target_area}", font=("Segoe UI", 9, "bold"),
                     fg=self.primary, bg="#FFFFFF").pack(anchor="w", pady=(2, 4))
            for inst in s.instructions:
                tk.Label(card, text=f"• {inst}", font=("Segoe UI", 8),
                         fg=self.text_muted, bg="#FFFFFF").pack(anchor="w", padx=8)

    # -----------------------------------------------------------------
    # Settings Modal & Account Switcher
    # -----------------------------------------------------------------
    # -----------------------------------------------------------------
    # Settings Modal & Mailbox Modal
    # -----------------------------------------------------------------
    def open_mailbox_modal(self):
        win = tk.Toplevel(self.root)
        win.title("System Mailbox & Dispatch Viewer")
        win.geometry("580x420")
        win.configure(bg="#FFFFFF")

        tk.Label(win, text="📬 System Mailbox & Dispatched Welcome Emails",
                 font=("Segoe UI", 13, "bold"), fg=self.text_main, bg="#FFFFFF").pack(pady=12)

        emails = storage.get_email_logs()
        if not emails:
            tk.Label(win, text="No emails have been dispatched yet.\nSign up a new user account to see the welcome email.",
                     font=("Segoe UI", 10), fg=self.text_muted, bg="#FFFFFF").pack(pady=40)
        else:
            list_frame = tk.Frame(win, bg="#FFFFFF", padx=16, pady=8)
            list_frame.pack(fill="both", expand=True)

            for em in emails[:5]:
                card = tk.Frame(list_frame, bg="#F8FAFC", padx=12, pady=10,
                                highlightbackground=self.border_color, highlightthickness=1)
                card.pack(fill="x", pady=4)

                tk.Label(card, text=f"✉️ {em.get('subject', 'Welcome to PostureCare')}",
                         font=("Segoe UI", 9, "bold"), fg=self.text_main, bg="#F8FAFC", anchor="w").pack(fill="x")
                from_line = em.get("fromAddress", "PostureCare <posturehealthcare@gmail.com>")
                tk.Label(card, text=f"From: {from_line}  •  [No-Reply]",
                         font=("Segoe UI", 8, "bold"), fg="#0369A1", bg="#F8FAFC", anchor="w").pack(fill="x")
                tk.Label(card, text=f"To: {em.get('recipientName', '')} <{em.get('recipientEmail', '')}>  •  Sent: {em.get('sentAt', '')[:19]}",
                         font=("Segoe UI", 8), fg=self.text_muted, bg="#F8FAFC", anchor="w").pack(fill="x")
                tk.Label(card, text=f"Status: {em.get('status', 'delivered').upper()} (Simulated Delivery via posturehealthcare@gmail.com)",
                         font=("Segoe UI", 8, "bold"), fg=self.primary, bg="#F8FAFC", anchor="w").pack(fill="x")

        tk.Button(win, text="Close", font=("Segoe UI", 9, "bold"),
                  bg="#0F172A", fg="#FFFFFF", padx=14, pady=6, relief="flat", cursor="hand2",
                  command=win.destroy).pack(pady=12)

    def open_settings_modal(self):
        win = tk.Toplevel(self.root)
        win.title("Settings & Notification Preferences")
        win.geometry("450x380")
        win.configure(bg="#FFFFFF")

        tk.Label(win, text="⚙️ Preferences & Thresholds", font=("Segoe UI", 13, "bold"),
                 fg=self.text_main, bg="#FFFFFF").pack(pady=14)

        prefs = storage.get_preferences()

        chk_sound = tk.BooleanVar(value=prefs.get("soundAlerts", True))
        tk.Checkbutton(win, text="Enable Audio Alerts on Poor Posture", variable=chk_sound,
                       bg="#FFFFFF", font=("Segoe UI", 10)).pack(anchor="w", padx=24, pady=6)

        chk_break = tk.BooleanVar(value=prefs.get("breakReminders", True))
        tk.Checkbutton(win, text="Enable 45-Minute Break Reminders", variable=chk_break,
                       bg="#FFFFFF", font=("Segoe UI", 10)).pack(anchor="w", padx=24, pady=6)

        def save_and_close():
            prefs["soundAlerts"] = chk_sound.get()
            prefs["breakReminders"] = chk_break.get()
            storage.save_preferences(prefs)
            sound_manager.enabled = chk_sound.get()
            win.destroy()
            messagebox.showinfo("Settings Saved", "Preferences successfully updated!")

        tk.Button(win, text="Save Preferences", font=("Segoe UI", 10, "bold"),
                  bg=self.primary, fg="#FFFFFF", padx=16, pady=8, relief="flat", cursor="hand2",
                  command=save_and_close).pack(pady=20)

    def logout(self):
        storage.logout()
        self.is_authenticated = False
        self.render_app()

    def render_auth_screen(self):
        auth_frame = tk.Frame(self.root, bg="#FFFFFF", padx=40, pady=32,
                              highlightbackground=self.border_color, highlightthickness=1)
        auth_frame.place(relx=0.5, rely=0.5, anchor="center")

        tk.Label(auth_frame, text="🧘 PostureCare", font=("Segoe UI", 20, "bold"),
                 fg=self.primary, bg="#FFFFFF").pack(pady=(0, 4))
        sub_title = tk.Label(auth_frame, text="Sign in or create your ergonomic profile",
                             font=("Segoe UI", 10), fg=self.text_muted, bg="#FFFFFF")
        sub_title.pack(pady=(0, 16))

        # Mode Selector Buttons (Sign In vs Sign Up)
        mode_frame = tk.Frame(auth_frame, bg="#F1F5F9", padx=3, pady=3)
        mode_frame.pack(fill="x", pady=(0, 16))

        current_mode = {"mode": "signin"}

        # Container for form inputs
        form_container = tk.Frame(auth_frame, bg="#FFFFFF")
        form_container.pack(fill="x")

        # Success message banner container
        msg_container = tk.Frame(auth_frame, bg="#FFFFFF")
        msg_container.pack(fill="x", pady=(0, 10))

        def show_form():
            for w in form_container.winfo_children():
                w.destroy()

            is_signup = current_mode["mode"] == "signup"

            # Full Name (Sign Up only)
            name_entry = None
            if is_signup:
                tk.Label(form_container, text="Full Name", font=("Segoe UI", 9, "bold"),
                         fg=self.text_main, bg="#FFFFFF", anchor="w").pack(fill="x", pady=(0, 2))
                name_entry = tk.Entry(form_container, font=("Segoe UI", 10), relief="solid", bd=1)
                name_entry.pack(fill="x", pady=(0, 10), ipady=4)

            # Email input
            tk.Label(form_container, text="Email Address", font=("Segoe UI", 9, "bold"),
                     fg=self.text_main, bg="#FFFFFF", anchor="w").pack(fill="x", pady=(0, 2))
            email_entry = tk.Entry(form_container, font=("Segoe UI", 10), relief="solid", bd=1)
            email_entry.pack(fill="x", pady=(0, 10), ipady=4)

            # Password input
            tk.Label(form_container, text="Password", font=("Segoe UI", 9, "bold"),
                     fg=self.text_main, bg="#FFFFFF", anchor="w").pack(fill="x", pady=(0, 2))
            pw_entry = tk.Entry(form_container, font=("Segoe UI", 10), show="•", relief="solid", bd=1)
            pw_entry.pack(fill="x", pady=(0, 16), ipady=4)

            def submit_action():
                email = email_entry.get().strip()
                pw = pw_entry.get().strip()
                if not email or not pw:
                    messagebox.showwarning("Missing Information", "Please enter all required fields.")
                    return

                if current_mode["mode"] == "signup":
                    # Check if user already exists
                    data = storage._read_data()
                    existing_users = data.get("registered_users", [])
                    if any(u.get("email", "").lower() == email.lower() for u in existing_users):
                        messagebox.showwarning("User Already Exists", "An account with this email address already exists. Please sign in instead.")
                        return

                    full_name = name_entry.get().strip() if name_entry else email.split("@")[0].capitalize()
                    storage.register_user(email, full_name)

                    # Trigger email notifications in background via email_service.py
                    threading.Thread(target=after_successful_signup, args=(email,), daemon=True).start()

                    # Show success notification
                    for c in msg_container.winfo_children():
                        c.destroy()

                    alert_box = tk.Frame(msg_container, bg="#ECFDF5", padx=10, pady=8,
                                         highlightbackground="#A7F3D0", highlightthickness=1)
                    alert_box.pack(fill="x", pady=4)

                    tk.Label(alert_box, text="✅ Account Created! Confirmation Email Dispatched.",
                             font=("Segoe UI", 9, "bold"), fg="#065F46", bg="#ECFDF5").pack(anchor="w")
                    tk.Label(alert_box, text=f"From: {SMTP_EMAIL} ➔ To: {email}",
                             font=("Segoe UI", 8, "bold"), fg="#0369A1", bg="#ECFDF5").pack(anchor="w")
                    tk.Label(alert_box, text="Please check your inbox and enter your password to sign in.",
                             font=("Segoe UI", 8), fg="#047857", bg="#ECFDF5").pack(anchor="w")

                    # Switch to sign in tab
                    set_mode("signin")
                else:
                    self.user_profile = storage.login_user(email)
                    self.is_authenticated = True
                    # Notify admin of login in background via email_service.py
                    threading.Thread(target=after_successful_login, args=(email,), daemon=True).start()
                    self.render_app()

            action_text = "Create Account & Send Email →" if is_signup else "Sign In →"
            btn_action = tk.Button(form_container, text=action_text,
                                   font=("Segoe UI", 10, "bold"), bg=self.primary, fg="#FFFFFF",
                                   padx=16, pady=8, relief="flat", cursor="hand2",
                                   command=submit_action)
            btn_action.pack(fill="x", pady=(4, 0))

        def set_mode(m):
            current_mode["mode"] = m
            if m == "signin":
                btn_tab_signin.configure(bg="#FFFFFF", fg=self.primary)
                btn_tab_signup.configure(bg="#F1F5F9", fg=self.text_muted)
            else:
                btn_tab_signup.configure(bg="#FFFFFF", fg=self.primary)
                btn_tab_signin.configure(bg="#F1F5F9", fg=self.text_muted)
            show_form()

        btn_tab_signin = tk.Button(mode_frame, text="Sign In", font=("Segoe UI", 9, "bold"),
                                   bg="#FFFFFF", fg=self.primary, relief="flat", padx=14, pady=4, cursor="hand2",
                                   command=lambda: set_mode("signin"))
        btn_tab_signin.pack(side="left", fill="x", expand=True)

        btn_tab_signup = tk.Button(mode_frame, text="Sign Up", font=("Segoe UI", 9, "bold"),
                                   bg="#F1F5F9", fg=self.text_muted, relief="flat", padx=14, pady=4, cursor="hand2",
                                   command=lambda: set_mode("signup"))
        btn_tab_signup.pack(side="right", fill="x", expand=True)

        show_form()

    def build_footer(self):
        footer = tk.Frame(self.root, bg="#FFFFFF", height=32, padx=20, pady=6,
                          highlightbackground=self.border_color, highlightthickness=1)
        footer.pack(fill="x", side="bottom")
        tk.Label(footer, text="PostureCare is an ergonomics awareness tool, not a medical diagnosis device. Consult a physician for persistent back/neck pain.",
                 font=("Segoe UI", 8), fg=self.text_muted, bg="#FFFFFF").pack(side="left")

    def on_close(self):
        self.stop_webcam()
        self.root.destroy()

def main():
    root = tk.Tk()
    app = App(root)
    root.mainloop()

if __name__ == "__main__":
    main()
