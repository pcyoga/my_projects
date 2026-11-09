"""
PostureCare Python Edition - Modular Architecture
Data Models & Type Definitions
Exact 1-to-1 conversion of /src/types.ts
"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime

PostureState = Literal['good', 'warning', 'poor']

@dataclass
class PostureMetrics:
    headAngle: float = 0.0          # degrees forward/backward tilt
    neckAngle: float = 0.0          # degrees deviation from vertical
    shoulderAngle: float = 0.0      # degrees tilt left/right
    torsoAngle: float = 0.0         # degrees slouching/leaning
    cameraDistance: float = 1.0     # normalized distance ratio (e.g. 0.8 - 1.2)
    postureScore: int = 100         # 0 - 100
    state: PostureState = 'good'
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    warnings: List[str] = field(default_factory=list)
    is_detected: bool = False

@dataclass
class BaselineProfile:
    id: str = "base_default"
    userId: str = "usr_default"
    name: str = "Standard Desk Setup"
    headAngle: float = 1.5
    neckAngle: float = 4.2
    shoulderAngle: float = 0.8
    torsoAngle: float = 2.1
    cameraDistance: float = 1.0
    toleranceLevel: str = "standard"  # 'lenient' | 'standard' | 'strict'
    calibratedAt: str = field(default_factory=lambda: datetime.now().isoformat())
    isActive: bool = True

@dataclass
class CalibrationProfile:
    name: str = "Standard Desk Setup"
    neck_angle: float = 20.0
    shoulder_width: float = 150.0
    ear_shoulder_dist: float = 85.0
    calibrated_at: Optional[str] = None
    is_active: bool = False

@dataclass
class PostureSession:
    id: str
    userId: str
    postureProfileId: str
    startTime: str
    endTime: str
    durationSeconds: int
    averageScore: int
    goodSeconds: int
    warningSeconds: int
    poorSeconds: int
    alertCount: int
    primaryDeviation: Optional[str] = None
    metricsSample: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class PostureAlert:
    id: str
    sessionId: str
    timestamp: str
    severity: str  # 'level1' | 'level2' | 'level3' | 'level4'
    type: str      # 'forward_head' | 'shoulder_slump' | 'torso_lean' | 'slouch' | 'break_reminder'
    score: int
    message: str

@dataclass
class UserGoal:
    id: str
    title: str
    type: str  # 'good_posture_percent' | 'max_alerts' | 'daily_duration_minutes' | 'weekly_score_improvement'
    targetValue: float
    currentValue: float
    unit: str
    status: str  # 'in_progress' | 'completed' | 'expired'
    startDate: str
    targetDate: str
    category: str  # 'daily' | 'weekly' | 'habit'

@dataclass
class NotificationPreferences:
    dailyReminders: bool = True
    dailyReminderTime: str = "09:30"
    postureAlerts: bool = True
    soundAlerts: bool = True
    soundVolume: float = 0.7
    breakReminders: bool = True
    breakReminderMinutes: int = 45
    alertSensitivity: str = "medium"  # 'low' | 'medium' | 'high'
    alertDelaySeconds: int = 3
    cooldownSeconds: int = 10

@dataclass
class UserProfile:
    id: str = "usr_default"
    fullName: str = "Alex Morgan"
    email: str = "alex.morgan@workspace.io"
    occupation: str = "Senior Software Engineer"
    computerUsageHours: int = 8
    primaryActivity: str = "programming"
    breakFrequencyMinutes: int = 45
    primaryObjective: str = "Eliminate forward-head neck strain and maintain aligned shoulders"
    hasCompletedOnboarding: bool = True
    createdAt: str = field(default_factory=lambda: datetime.now().isoformat())
    avatarUrl: Optional[str] = None
    role: Optional[str] = "Professional"

@dataclass
class AuthState:
    isAuthenticated: bool = False
    user: Optional[UserProfile] = None
    token: Optional[str] = None

@dataclass
class StretchExercise:
    id: str
    title: str
    target_area: str
    duration_seconds: int
    instructions: List[str]
    rep_count: str

@dataclass
class UserEmailLog:
    id: str
    recipientEmail: str
    recipientName: str
    subject: str
    sentAt: str
    fromAddress: str = "PostureCare <posturehealthcare@gmail.com>"
    replyTo: str = "no-reply@posturehealthcare.com"
    type: str = "welcome_signup"
    status: str = "delivered"
    previewSnippet: str = ""

@dataclass
class RegisteredUser:
    id: str
    fullName: str
    email: str
    occupation: str = "Workstation User"
    computerUsageHours: int = 8
    primaryActivity: str = "general"
    breakFrequencyMinutes: int = 45
    primaryObjective: str = "Maintain healthy spinal alignment and ergonomic posture"
    hasCompletedOnboarding: bool = False
    createdAt: str = field(default_factory=lambda: datetime.now().isoformat())
    passwordHash: Optional[str] = None
