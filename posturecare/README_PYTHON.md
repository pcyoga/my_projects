# PostureCare - 100% Python Edition

PostureCare converted into a modular Python codebase for local execution on Windows, macOS, or Linux.

---

## 📁 1-to-1 Python Architecture Mapping

| TypeScript / Web Source | Converted Python Module | Role & Description |
| :--- | :--- | :--- |
| **`/src/App.tsx`** | **`app.py`** | **Main Python Application**: Exact 1-to-1 conversion of `App.tsx` containing authentication, all 6 view switchers (Dashboard, Monitor, Calibrate, History, Goals, Stretches), live camera HUD, settings modal, and storage synchronization. |
| **`/src/components/*`** | **`components_py/`** | **Modular Python Component Package**: Exact 1-to-1 conversions of all 13 `.tsx` UI components into modular Python classes. |
| `/src/types.ts` | **`models.py`** | Python `dataclasses` for `UserProfile`, `PostureMetrics`, `BaselineProfile`, `PostureSession`, `UserGoal`, `StretchExercise`. |
| `/src/utils/poseDetector.ts` | **`engine.py`** | Computer vision engine using MediaPipe Pose (33 skeletal landmarks, forward neck angle, shoulder tilt, slouch ratio). |
| `/src/utils/storage.ts` | **`storage.py`** | Local JSON storage manager with demo user presets, session history, goals, and notification preferences. |
| `/src/utils/audio.ts` | **`audio.py`** | Non-blocking cross-platform sound synthesizer for posture alerts and calibration chimes. |
| `/src/components/StretchesView.tsx` | **`stretches.py`** & **`components_py/stretches_view.py`** | Guided desk stretch exercises, rep counts, and instructions. |
| `/src/components/MonitoringStudio.tsx` | **`posture_care_app.py`** & **`components_py/monitoring_studio.py`** | Standalone high-performance OpenCV headless/HUD monitor with keyboard controls (`C` to calibrate, `S` to save report). |
| *Web Dashboard Alternative* | **`app_streamlit.py`** | Modern browser web dashboard built in pure Python via Streamlit. |

---

## 📦 Converted Component Package (`components_py/`)

Every `.tsx` file in `/src/components` has a dedicated, direct `.py` equivalent in `components_py/`:

- `AuthScreen.tsx` ➡️ `components_py/auth_screen.py` (`AuthScreenComponent`)
- `Navigation.tsx` ➡️ `components_py/navigation.py` (`NavigationComponent`)
- `Dashboard.tsx` ➡️ `components_py/dashboard.py` (`DashboardComponent`)
- `MonitoringStudio.tsx` ➡️ `components_py/monitoring_studio.py` (`MonitoringStudioComponent`)
- `CalibrationStudio.tsx` ➡️ `components_py/calibration_studio.py` (`CalibrationStudioComponent`)
- `HistoryView.tsx` ➡️ `components_py/history_view.py` (`HistoryViewComponent`)
- `GoalsView.tsx` ➡️ `components_py/goals_view.py` (`GoalsViewComponent`)
- `StretchesView.tsx` ➡️ `components_py/stretches_view.py` (`StretchesViewComponent`)
- `OnboardingWizard.tsx` ➡️ `components_py/onboarding_wizard.py` (`OnboardingWizardComponent`)
- `SettingsModal.tsx` ➡️ `components_py/settings_modal.py` (`SettingsModalComponent`)
- `CameraPermissionModal.tsx` ➡️ `components_py/camera_permission_modal.py` (`CameraPermissionModalComponent`)
- `DisclaimerFooter.tsx` ➡️ `components_py/disclaimer_footer.py` (`DisclaimerFooterComponent`)
- `EmailInboxSimulatorModal.tsx` ➡️ `components_py/email_inbox_simulator_modal.py` (`EmailInboxSimulatorModalComponent`)

---

## 🚀 How to Run Locally

### 1. Install Requirements
```bash
pip install -r requirements.txt
```

### 2. Run the Main Application (`app.py`):
```bash
python app.py
```

### 3. Alternative Runners:
- **Fast OpenCV HUD Monitor**:
  ```bash
  python posture_care_app.py
  ```
- **Streamlit Web Dashboard**:
  ```bash
  streamlit run app_streamlit.py
  ```
