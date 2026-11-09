"""
Components package initialization for PostureCare Python Edition.
Exposes pure Python component modules translated from /src/components/*.tsx
"""

from .auth_screen import AuthScreenComponent
from .navigation import NavigationComponent
from .dashboard import DashboardComponent
from .monitoring_studio import MonitoringStudioComponent
from .calibration_studio import CalibrationStudioComponent
from .history_view import HistoryViewComponent
from .goals_view import GoalsViewComponent
from .stretches_view import StretchesViewComponent
from .onboarding_wizard import OnboardingWizardComponent
from .settings_modal import SettingsModalComponent
from .camera_permission_modal import CameraPermissionModalComponent
from .disclaimer_footer import DisclaimerFooterComponent
from .email_inbox_simulator_modal import EmailInboxSimulatorModalComponent

__all__ = [
    "AuthScreenComponent",
    "NavigationComponent",
    "DashboardComponent",
    "MonitoringStudioComponent",
    "CalibrationStudioComponent",
    "HistoryViewComponent",
    "GoalsViewComponent",
    "StretchesViewComponent",
    "OnboardingWizardComponent",
    "SettingsModalComponent",
    "CameraPermissionModalComponent",
    "DisclaimerFooterComponent",
    "EmailInboxSimulatorModalComponent",
]
