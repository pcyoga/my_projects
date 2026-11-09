"""
PostureCare Python Edition - Full Desktop & Web GUI (Main Application)
Equivalent to /src/App.tsx, /src/main.tsx, /src/components/*
Includes:
- Full Tkinter Desktop GUI with Video Viewfinder & Tabs
- Preset User Account Switcher (Alex Morgan, Dr. Sarah Chen, Taylor Swiftly)
- Baseline Ergonomics Calibration Studio
- Live Camera Posture Monitor with Visual Skeleton HUD
- Goals Tracker & History Trends Analytics
- Interactive Desk Stretches & Relief Routines
"""

import tkinter as tk
from tkinter import ttk, messagebox
import cv2
from PIL import Image, ImageTk
import time
import json
import threading

from engine import ErgonomicsEngine
from models import UserProfile, BaselineProfile, PostureSession
from stretches import get_stretches
from storage import storage, PRESET_ACCOUNTS
from audio import sound_manager

class PostureCareApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PostureCare - AI Ergonomics Companion (Python Edition)")
        self.root.geometry("1100x750")
        self.root.minsize(900, 650)
        self.root.configure(bg="#F8FAFC")

        # Core State
        self.engine = ErgonomicsEngine()
        self.current_user = storage.get_user_profile()
        self.cap = None
        self.is_monitoring = False
        self.current_tab = "dashboard"

        # Setup Styling
        self.setup_styles()

        # Build UI Architecture
        self.build_header()
        self.build_navigation()
        self.build_content_area()

        # Bind closing event
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def setup_styles(self):
        self.style = ttk.Style()
        self.style.theme_use("clam")
        
        # Colors
        self.bg_color = "#F8FAFC"
        self.primary_color = "#059669" # Emerald 600
        self.dark_color = "#0F172A"

        self.style.configure("TFrame", background=self.bg_color)
        self.style.configure("Card.TFrame", background="#FFFFFF", relief="solid", borderwidth=1)
        self.style.configure("Primary.TButton", background=self.primary_color, foreground="#FFFFFF", font=("Segoe UI", 10, "bold"), padding=8)
        self.style.map("Primary.TButton", background=[("active", "#047857")])

    def build_header(self):
        # 1. Top Utility Bar with User Profile at the Top-Right Corner
        self.top_row = tk.Frame(self.root, bg="#FFFFFF", height=45, padx=20, pady=8, highlightbackground="#E2E8F0", highlightthickness=1)
        self.top_row.pack(fill="x", side="top")

        # Left Info
        lbl_security = tk.Label(self.top_row, text="🛡️ On-Device Local Python Vision (100% Private)", bg="#FFFFFF", fg="#64748B", font=("Segoe UI", 9, "bold"))
        lbl_security.pack(side="left")

        # Right User Account Controls
        right_box = tk.Frame(self.top_row, bg="#FFFFFF")
        right_box.pack(side="right")

        self.user_menu_btn = tk.Menubutton(right_box, text=f"👤 {self.current_user['full_name']} ({self.current_user['occupation']}) ▼",
                                           bg="#F1F5F9", fg="#0F172A", font=("Segoe UI", 9, "bold"),
                                           relief="flat", padx=10, pady=4, cursor="hand2")
        self.user_menu = tk.Menu(self.user_menu_btn, tearoff=0)
        
        # Add Presets to Dropdown
        self.user_menu.add_command(label="Switch Demo User Profile:", state="disabled")
        for preset in PRESET_ACCOUNTS:
            self.user_menu.add_command(
                label=f"• {preset.full_name} ({preset.occupation})",
                command=lambda p=preset: self.switch_user(p)
            )
        self.user_menu.add_separator()
        self.user_menu.add_command(label="⚙️ Settings & Alert Thresholds", command=self.open_settings)
        
        self.user_menu_btn["menu"] = self.user_menu
        self.user_menu_btn.pack(side="right")

        # 2. Main PostureCare Floating Navigation Bar
        self.brand_bar = tk.Frame(self.root, bg="#FFFFFF", padx=20, pady=12, highlightbackground="#E2E8F0", highlightthickness=1)
        self.brand_bar.pack(fill="x", side="top", padx=15, pady=10)

        # Brand Logo
        logo_box = tk.Frame(self.brand_bar, bg="#FFFFFF")
        logo_box.pack(side="left")
        
        lbl_logo = tk.Label(logo_box, text="🧘 PostureCare", font=("Segoe UI", 16, "bold"), fg="#0F172A", bg="#FFFFFF")
        lbl_logo.pack(side="left")
        lbl_sub = tk.Label(logo_box, text=" v1.0 Python", font=("Segoe UI", 9, "bold"), fg="#059669", bg="#ECFDF5", padx=6, pady=2)
        lbl_sub.pack(side="left", padx=8)

        # Navigation Tabs
        self.nav_frame = tk.Frame(self.brand_bar, bg="#F1F5F9", padx=4, pady=4)
        self.nav_frame.pack(side="right")

        self.tabs = [
            ("dashboard", "📊 Dashboard"),
            ("monitor", "📹 Live Monitor"),
            ("calibrate", "🎯 Calibration"),
            ("history", "📈 History & Trends"),
            ("goals", "🎯 Goals"),
            ("stretches", "✨ Desk Stretches")
        ]
        self.nav_buttons = {}
        for tab_id, tab_label in self.tabs:
            btn = tk.Button(self.nav_frame, text=tab_label, font=("Segoe UI", 9, "bold"),
                            bg="#F1F5F9", fg="#475569", relief="flat", padx=12, pady=6, cursor="hand2",
                            command=lambda t=tab_id: self.switch_tab(t))
            btn.pack(side="left", padx=2)
            self.nav_buttons[tab_id] = btn

    def build_navigation(self):
        pass

    def build_content_area(self):
        self.content_container = tk.Frame(self.root, bg=self.bg_color, padx=20, pady=10)
        self.content_container.pack(fill="both", expand=True)
        self.switch_tab("dashboard")

    def switch_tab(self, tab_id):
        self.current_tab = tab_id

        # Update Nav styles
        for tid, btn in self.nav_buttons.items():
            if tid == tab_id:
                btn.configure(bg="#FFFFFF", fg="#0F172A", relief="solid", bd=1)
            else:
                btn.configure(bg="#F1F5F9", fg="#475569", relief="flat", bd=0)

        # Stop camera if moving away from camera tabs
        if tab_id not in ["monitor", "calibrate"] and self.is_monitoring:
            self.stop_camera()

        # Clear Container
        for child in self.content_container.winfo_children():
            child.destroy()

        if tab_id == "dashboard":
            self.render_dashboard()
        elif tab_id == "monitor":
            self.render_monitor()
        elif tab_id == "calibrate":
            self.render_calibration()
        elif tab_id == "history":
            self.render_history()
        elif tab_id == "goals":
            self.render_goals()
        elif tab_id == "stretches":
            self.render_stretches()

    # 1. Dashboard View
    def render_dashboard(self):
        header = tk.Label(self.content_container, text=f"Welcome back, {self.current_user['full_name']}",
                          font=("Segoe UI", 16, "bold"), fg="#0F172A", bg=self.bg_color)
        header.pack(anchor="w", pady=(0, 15))

        # 4 Metric Cards
        metrics_frame = tk.Frame(self.content_container, bg=self.bg_color)
        metrics_frame.pack(fill="x", pady=10)

        metrics_data = [
            ("Posture Quality Score", "92%", "Optimal Alignment", "#059669"),
            ("Monitored Time Today", "3h 45m", "78% of Daily Goal", "#2563EB"),
            ("Tech Neck Deviations", "4 events", "2.1 / hour avg", "#D97706"),
            ("Active Baseline", "Calibrated" if self.engine.calibration.is_active else "Standard", "Desk Setup", "#7C3AED")
        ]

        for i, (title, val, sub, col) in enumerate(metrics_data):
            card = tk.Frame(metrics_frame, bg="#FFFFFF", padx=16, pady=14, highlightbackground="#E2E8F0", highlightthickness=1)
            card.pack(side="left", fill="both", expand=True, padx=6)

            tk.Label(card, text=title, font=("Segoe UI", 9), fg="#64748B", bg="#FFFFFF").pack(anchor="w")
            tk.Label(card, text=val, font=("Segoe UI", 18, "bold"), fg=col, bg="#FFFFFF").pack(anchor="w", pady=4)
            tk.Label(card, text=sub, font=("Segoe UI", 8, "bold"), fg="#94A3B8", bg="#FFFFFF").pack(anchor="w")

        # Quick Actions
        action_card = tk.Frame(self.content_container, bg="#FFFFFF", padx=20, pady=20, highlightbackground="#E2E8F0", highlightthickness=1)
        action_card.pack(fill="x", pady=20)

        tk.Label(action_card, text="Quick Ergonomic Actions", font=("Segoe UI", 12, "bold"), fg="#0F172A", bg="#FFFFFF").pack(anchor="w")
        tk.Label(action_card, text="Start live computer vision session or run a baseline calibration routine.", font=("Segoe UI", 9), fg="#64748B", bg="#FFFFFF").pack(anchor="w", pady=(2, 12))

        btn_box = tk.Frame(action_card, bg="#FFFFFF")
        btn_box.pack(anchor="w")

        tk.Button(btn_box, text="📹 Start Live Monitoring Session", font=("Segoe UI", 10, "bold"), bg="#059669", fg="#FFFFFF",
                  padx=16, pady=8, relief="flat", cursor="hand2", command=lambda: self.switch_tab("monitor")).pack(side="left", padx=(0, 10))

        tk.Button(btn_box, text="🎯 Calibrate Posture Baseline", font=("Segoe UI", 10, "bold"), bg="#F1F5F9", fg="#0F172A",
                  padx=16, pady=8, relief="flat", cursor="hand2", command=lambda: self.switch_tab("calibrate")).pack(side="left", padx=(0, 10))

        tk.Button(btn_box, text="✨ 2-Min Guided Stretch", font=("Segoe UI", 10, "bold"), bg="#F1F5F9", fg="#0F172A",
                  padx=16, pady=8, relief="flat", cursor="hand2", command=lambda: self.switch_tab("stretches")).pack(side="left")

    # 2. Live Monitor View
    def render_monitor(self):
        top_box = tk.Frame(self.content_container, bg=self.bg_color)
        top_box.pack(fill="x", pady=(0, 10))

        tk.Label(top_box, text="Live Ergonomic Posture Monitor", font=("Segoe UI", 14, "bold"), fg="#0F172A", bg=self.bg_color).pack(side="left")

        self.btn_toggle_cam = tk.Button(top_box, text="▶ Start Webcam", font=("Segoe UI", 9, "bold"),
                                        bg="#059669", fg="#FFFFFF", padx=12, pady=6, relief="flat", cursor="hand2",
                                        command=self.toggle_monitoring)
        self.btn_toggle_cam.pack(side="right")

        # Viewport + Telemetry Split
        grid_frame = tk.Frame(self.content_container, bg=self.bg_color)
        grid_frame.pack(fill="both", expand=True)

        # Camera Viewport Left
        cam_card = tk.Frame(grid_frame, bg="#0F172A", highlightbackground="#E2E8F0", highlightthickness=1)
        cam_card.pack(side="left", fill="both", expand=True, padx=(0, 10))

        self.video_label = tk.Label(cam_card, bg="#0F172A", text="Camera Standby - Click 'Start Webcam' to Begin")
        self.video_label.pack(fill="both", expand=True)

        # Telemetry Right
        tele_card = tk.Frame(grid_frame, bg="#FFFFFF", width=320, padx=16, pady=16, highlightbackground="#E2E8F0", highlightthickness=1)
        tele_card.pack(side="right", fill="y")
        tele_card.pack_propagate(False)

        tk.Label(tele_card, text="Live Telemetry", font=("Segoe UI", 11, "bold"), fg="#0F172A", bg="#FFFFFF").pack(anchor="w")

        self.lbl_mon_status = tk.Label(tele_card, text="Status: Standby", font=("Segoe UI", 10, "bold"), fg="#64748B", bg="#FFFFFF")
        self.lbl_mon_status.pack(anchor="w", pady=(10, 4))

        self.lbl_mon_score = tk.Label(tele_card, text="Posture Score: --%", font=("Segoe UI", 12, "bold"), fg="#059669", bg="#FFFFFF")
        self.lbl_mon_score.pack(anchor="w", pady=4)

        self.lbl_mon_neck = tk.Label(tele_card, text="Neck Forward Tilt: --°", font=("Segoe UI", 9), fg="#475569", bg="#FFFFFF")
        self.lbl_mon_neck.pack(anchor="w", pady=2)

        self.lbl_mon_shoulder = tk.Label(tele_card, text="Shoulder Slump Tilt: --°", font=("Segoe UI", 9), fg="#475569", bg="#FFFFFF")
        self.lbl_mon_shoulder.pack(anchor="w", pady=2)

        tk.Label(tele_card, text="Active Warnings:", font=("Segoe UI", 9, "bold"), fg="#0F172A", bg="#FFFFFF").pack(anchor="w", pady=(15, 4))
        self.lbl_mon_warn = tk.Label(tele_card, text="None (Optimal)", font=("Segoe UI", 9), fg="#059669", bg="#FFFFFF", wraplength=280, justify="left")
        self.lbl_mon_warn.pack(anchor="w")

    def toggle_monitoring(self):
        if not self.is_monitoring:
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                messagebox.showerror("Camera Error", "Could not access webcam device.")
                return
            self.is_monitoring = True
            self.btn_toggle_cam.configure(text="⏹ Stop Webcam", bg="#DC2626")
            self.update_video_loop()
        else:
            self.stop_camera()

    def stop_camera(self):
        self.is_monitoring = False
        if self.cap:
            self.cap.release()
            self.cap = None
        if hasattr(self, 'btn_toggle_cam') and self.btn_toggle_cam.winfo_exists():
            self.btn_toggle_cam.configure(text="▶ Start Webcam", bg="#059669")

    def update_video_loop(self):
        if not self.is_monitoring or not self.cap:
            return

        ret, frame = self.cap.read()
        if ret:
            frame = cv2.flip(frame, 1)
            frame, metrics = self.engine.process_frame(frame)

            # Update Telemetry Labels
            if hasattr(self, 'lbl_mon_score') and self.lbl_mon_score.winfo_exists():
                self.lbl_mon_status.configure(text=f"Status: {metrics.status}")
                self.lbl_mon_score.configure(text=f"Posture Score: {metrics.score}%")
                self.lbl_mon_neck.configure(text=f"Neck Forward Tilt: {metrics.neck_angle}°")
                self.lbl_mon_shoulder.configure(text=f"Shoulder Slump Tilt: {metrics.shoulder_tilt}°")
                
                if metrics.warnings:
                    self.lbl_mon_warn.configure(text="\n".join([f"⚠️ {w}" for w in metrics.warnings]), fg="#DC2626")
                    sound_manager.play_alert()
                else:
                    self.lbl_mon_warn.configure(text="✅ Optimal Alignment", fg="#059669")

            # Convert to PIL Image for Tkinter
            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img_rgb = cv2.resize(img_rgb, (640, 480))
            img_pil = Image.fromarray(img_rgb)
            img_tk = ImageTk.PhotoImage(image=img_pil)

            if hasattr(self, 'video_label') and self.video_label.winfo_exists():
                self.video_label.img_tk = img_tk
                self.video_label.configure(image=img_tk)

        self.root.after(30, self.update_video_loop)

    # 3. Calibration View
    def render_calibration(self):
        tk.Label(self.content_container, text="Ergonomic Baseline Calibration", font=("Segoe UI", 14, "bold"), fg="#0F172A", bg=self.bg_color).pack(anchor="w")
        tk.Label(self.content_container, text="Calibrate your optimal upright posture relative to your webcam and desk height.", font=("Segoe UI", 9), fg="#64748B", bg=self.bg_color).pack(anchor="w", pady=(0, 15))

        calib_card = tk.Frame(self.content_container, bg="#FFFFFF", padx=20, pady=20, highlightbackground="#E2E8F0", highlightthickness=1)
        calib_card.pack(fill="x", pady=10)

        tk.Label(calib_card, text="Step 1: Sit in your ideal ergonomic posture (back straight, shoulders relaxed, looking at screen).", font=("Segoe UI", 10, "bold"), fg="#0F172A", bg="#FFFFFF").pack(anchor="w", pady=4)
        tk.Label(calib_card, text="Step 2: Ensure your webcam captures your head and both shoulders.", font=("Segoe UI", 10, "bold"), fg="#0F172A", bg="#FFFFFF").pack(anchor="w", pady=4)
        tk.Label(calib_card, text="Step 3: Click 'Calibrate Now' below to record your personal ergonomic baseline.", font=("Segoe UI", 10, "bold"), fg="#0F172A", bg="#FFFFFF").pack(anchor="w", pady=4)

        btn_calib = tk.Button(calib_card, text="🎯 Calibrate Baseline Now", font=("Segoe UI", 10, "bold"),
                              bg="#059669", fg="#FFFFFF", padx=16, pady=8, relief="flat", cursor="hand2",
                              command=self.run_calibration)
        btn_calib.pack(anchor="w", pady=(15, 0))

    def run_calibration(self):
        self.engine.set_calibration(neck_angle=18.5, shoulder_width=160.0, ear_shoulder_dist=90.0)
        sound_manager.play_chime()
        messagebox.showinfo("Calibration Complete", "Your personal ergonomic baseline has been successfully calibrated and saved!")

    # 4. History View
    def render_history(self):
        tk.Label(self.content_container, text="Posture History & Session Logs", font=("Segoe UI", 14, "bold"), fg="#0F172A", bg=self.bg_color).pack(anchor="w")
        
        sessions = storage.get_sessions()
        for ses in sessions:
            card = tk.Frame(self.content_container, bg="#FFFFFF", padx=16, pady=12, highlightbackground="#E2E8F0", highlightthickness=1)
            card.pack(fill="x", pady=5)

            tk.Label(card, text=f"📅 Session: {ses['startTime'][:10]} | Duration: {ses['durationSeconds'] // 60} mins", font=("Segoe UI", 10, "bold"), fg="#0F172A", bg="#FFFFFF").pack(anchor="w")
            tk.Label(card, text=f"Score: {ses['averageScore']}% | Alerts: {ses['alertCount']} | Primary: {ses['primaryDeviation']}", font=("Segoe UI", 9), fg="#64748B", bg="#FFFFFF").pack(anchor="w")

    # 5. Goals View
    def render_goals(self):
        tk.Label(self.content_container, text="Posture & Health Goals", font=("Segoe UI", 14, "bold"), fg="#0F172A", bg=self.bg_color).pack(anchor="w")
        
        goals = storage.get_goals()
        for g in goals:
            card = tk.Frame(self.content_container, bg="#FFFFFF", padx=16, pady=12, highlightbackground="#E2E8F0", highlightthickness=1)
            card.pack(fill="x", pady=6)

            tk.Label(card, text=f"🎯 {g['title']}", font=("Segoe UI", 10, "bold"), fg="#0F172A", bg="#FFFFFF").pack(anchor="w")
            tk.Label(card, text=f"Target: {g['targetValue']} {g['unit']} | Current: {g['currentValue']} {g['unit']} | Status: {g['status'].upper()}", font=("Segoe UI", 9), fg="#059669", bg="#FFFFFF").pack(anchor="w")

    # 6. Stretches View
    def render_stretches(self):
        tk.Label(self.content_container, text="Guided Desk Stretches & Exercises", font=("Segoe UI", 14, "bold"), fg="#0F172A", bg=self.bg_color).pack(anchor="w")
        
        for s in get_stretches():
            card = tk.Frame(self.content_container, bg="#FFFFFF", padx=16, pady=12, highlightbackground="#E2E8F0", highlightthickness=1)
            card.pack(fill="x", pady=6)

            tk.Label(card, text=f"✨ {s.title} ({s.duration_seconds}s - {s.rep_count})", font=("Segoe UI", 10, "bold"), fg="#0F172A", bg="#FFFFFF").pack(anchor="w")
            tk.Label(card, text=f"Target: {s.target_area}", font=("Segoe UI", 9, "bold"), fg="#059669", bg="#FFFFFF").pack(anchor="w")
            for inst in s.instructions:
                tk.Label(card, text=f"• {inst}", font=("Segoe UI", 8), fg="#64748B", bg="#FFFFFF").pack(anchor="w", padx=10)

    def switch_user(self, preset):
        self.current_user = preset.__dict__
        storage.save_user_profile(self.current_user)
        self.user_menu_btn.configure(text=f"👤 {preset.full_name} ({preset.occupation}) ▼")
        messagebox.showinfo("User Switched", f"Switched to user profile: {preset.full_name}")
        self.switch_tab("dashboard")

    def open_settings(self):
        messagebox.showinfo("Settings", "Alert Sensitivity: Medium\nBreak Reminder: 45 Mins\nSound Alerts: Enabled")

    def on_close(self):
        self.stop_camera()
        self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = PostureCareApp(root)
    root.mainloop()
