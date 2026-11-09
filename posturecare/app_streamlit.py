"""
PostureCare Python - Streamlit Web Dashboard & UI Application
Run with: streamlit run app_streamlit.py
"""
import streamlit as st
import cv2
import numpy as np
import time
from engine import ErgonomicsEngine
from stretches import get_stretches
from models import UserProfile
from components_py import (
    DashboardComponent,
    HistoryViewComponent,
    GoalsViewComponent,
    StretchesViewComponent,
    DisclaimerFooterComponent,
    EmailInboxSimulatorModalComponent
)

st.set_page_config(
    page_title="PostureCare AI - Python Ergonomics",
    page_icon="🧘",
    layout="wide"
)

# Initialize Engine and components in Session State
if "engine" not in st.session_state:
    st.session_state.engine = ErgonomicsEngine()
if "user" not in st.session_state:
    st.session_state.user = UserProfile()
if "dashboard_comp" not in st.session_state:
    st.session_state.dashboard_comp = DashboardComponent()
if "history_comp" not in st.session_state:
    st.session_state.history_comp = HistoryViewComponent()
if "goals_comp" not in st.session_state:
    st.session_state.goals_comp = GoalsViewComponent()

# Sidebar User Info & Settings
with st.sidebar:
    st.title("🧘 PostureCare")
    st.caption("AI Workstation Ergonomics Companion (Python Edition)")
    
    st.divider()
    st.subheader("👤 User Account")
    
    auth_mode = st.radio("Account Mode", ["Sign In", "Sign Up", "Active Profile"], index=2 if st.session_state.get("is_logged_in", False) else 0)

    if auth_mode == "Sign Up":
        st.markdown("**Create New Account**")
        su_name = st.text_input("Full Name", value="")
        su_email = st.text_input("Email Address", key="su_email")
        su_pw = st.text_input("Password", type="password", key="su_pw")
        if st.button("Create Account & Send Email", type="primary"):
            if su_email and su_pw:
                from storage import storage
                storage.register_user(su_email, su_name or su_email.split('@')[0].capitalize())
                st.success(f"✅ Account created! Welcome confirmation email sent from posturehealthcare@gmail.com (No-Reply) to {su_email}. Please switch to Sign In.")
            else:
                st.warning("Please enter your email and password.")

    elif auth_mode == "Sign In":
        st.markdown("**Sign In to Your Account**")
        si_email = st.text_input("Email Address", value=st.session_state.user.email, key="si_email")
        si_pw = st.text_input("Password", type="password", key="si_pw")
        if st.button("Sign In →", type="primary"):
            if si_email and si_pw:
                from storage import storage
                u = storage.login_user(si_email)
                st.session_state.user.full_name = u.get("fullName", si_email.split('@')[0])
                st.session_state.user.email = u.get("email", si_email)
                st.session_state.is_logged_in = True
                st.success("Successfully logged in!")
            else:
                st.warning("Please enter your credentials.")

    else:
        st.write(f"**Name:** {st.session_state.user.full_name}")
        st.write(f"**Email:** {st.session_state.user.email}")
        st.write(f"**Role:** {st.session_state.user.occupation}")

    # Mailbox viewer popover / expander
    with st.expander("📬 System Mailbox & Dispatches"):
        from storage import storage
        emails = storage.get_email_logs()
        if not emails:
            st.caption("No emails dispatched yet.")
        else:
            for em in emails[:5]:
                st.markdown(f"**{em.get('subject', 'Welcome')}**")
                from_addr = em.get('fromAddress', 'PostureCare <posturehealthcare@gmail.com>')
                st.caption(f"From: {from_addr} • [No-Reply]")
                st.caption(f"To: {em.get('recipientEmail')} • {em.get('status', 'delivered').upper()}")

    st.divider()
    st.subheader("⚙️ Settings")
    st.session_state.user.daily_goal_minutes = st.slider("Daily Goal (Minutes)", 60, 480, 240, step=30)
    st.session_state.user.sensitivity = st.selectbox("Detection Sensitivity", ["Low", "Medium", "High"], index=1)
    st.session_state.user.alert_sound_enabled = st.checkbox("Audio Alerts Enabled", value=True)

# Navigation Tabs
tab_dash, tab_live, tab_calib, tab_stretches = st.tabs([
    "📊 Dashboard",
    "📹 Live Camera Monitor",
    "🎯 Posture Calibration",
    "🧘 Desk Stretches"
])

# 1. Dashboard Tab
with tab_dash:
    st.header("Ergonomic Health Overview")
    metrics = st.session_state.dashboard_comp.get_summary_metrics()
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Posture Quality Score", f"{metrics['postureQualityScore']}%", metrics['qualityScoreComparison'])
    with col2:
        st.metric("Good Posture Time", metrics['goodPostureDuration'], f"{metrics['goodPosturePercent']}% of session")
    with col3:
        st.metric("Tech Neck Interruptions", f"{metrics['techNeckInterruptions']} events", metrics['techNeckComparison'])
    with col4:
        st.metric("Active Calibration", metrics['activeCalibrationStatus'])

    st.subheader("Weekly Posture Trend")
    trend_data = st.session_state.dashboard_comp.get_weekly_trends()
    chart_data = {t["day"]: t["score"] for t in trend_data}
    st.line_chart(chart_data)

# 2. Live Camera Monitor Tab
with tab_live:
    st.header("Live Ergonomic Tracking")
    st.write("MediaPipe Pose analyzes neck angle, shoulder tilt, and spine slouching.")
    
    run_cam = st.toggle("Start Live Webcam Feed", value=False)
    frame_window = st.image([])
    status_holder = st.empty()

    if run_cam:
        cap = cv2.VideoCapture(0)
        while run_cam and cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                st.warning("Webcam not available. Ensure device permissions are granted.")
                break
            
            frame = cv2.flip(frame, 1)
            frame, metrics = st.session_state.engine.process_frame(frame)
            
            # Display frame
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame_window.image(frame_rgb, channels="RGB", use_container_width=True)

            status_holder.markdown(f"""
            **Current Status:** `{metrics.status}` | **Score:** `{metrics.score}%` | **Neck Angle:** `{metrics.neck_angle}°` | **Shoulder Tilt:** `{metrics.shoulder_tilt}°`
            """)
            time.sleep(0.03)
        cap.release()

# 3. Calibration Tab
with tab_calib:
    st.header("Ergonomic Baseline Calibration")
    st.write("Sit upright in your natural, ergonomic position and save your baseline.")
    
    col_c1, col_c2 = st.columns(2)
    with col_c1:
        st.subheader("Standard Baseline Angles")
        calib_neck = st.number_input("Optimal Neck Angle (degrees)", 10.0, 45.0, 20.0)
        calib_shoulders = st.number_input("Optimal Shoulder Width (pixels)", 80.0, 300.0, 150.0)
        calib_ear_dist = st.number_input("Optimal Ear-Shoulder Distance", 40.0, 200.0, 85.0)
        
        if st.button("Save Calibration Baseline", type="primary"):
            st.session_state.engine.set_calibration(calib_neck, calib_shoulders, calib_ear_dist)
            st.success("Calibration successfully updated!")

    with col_c2:
        st.info("""
        **Tips for accurate calibration:**
        - Ensure your webcam is positioned at eye-level.
        - Sit back against your chair's lumbar support.
        - Keep your shoulders relaxed and feet flat on the floor.
        """)

# 4. Desk Stretches Tab
with tab_stretches:
    st.header("Guided Desk Stretches & Relief Routines")
    st.write("Short, guided exercises designed to release tension from long desk hours.")
    
    for s in get_stretches():
        with st.expander(f"✨ {s.title} ({s.duration_seconds}s - {s.rep_count})"):
            st.write(f"**Target Area:** {s.target_area}")
            st.write("**Instructions:**")
            for step in s.instructions:
                st.write(f"- {step}")

# Footer Disclaimer (from components_py.disclaimer_footer)
st.divider()
footer_info = DisclaimerFooterComponent.get_footer_info()
st.caption(f"ℹ️ **{footer_info['appName']} {footer_info['version']}** — {footer_info['disclaimer']}")
st.caption(f"🔒 {footer_info['privacy']}")
