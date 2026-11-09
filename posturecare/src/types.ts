export type PostureState = 'good' | 'warning' | 'poor';

export interface PostureMetrics {
  headAngle: number;       // degrees forward/backward tilt
  neckAngle: number;       // degrees deviation from vertical
  shoulderAngle: number;   // degrees tilt left/right
  torsoAngle: number;      // degrees slouching/leaning
  cameraDistance: number;  // normalized distance ratio (e.g. 0.8 - 1.2)
  postureScore: number;    // 0 - 100
  state: PostureState;
  timestamp: number;
}

export interface BaselineProfile {
  id: string;
  userId: string;
  name: string;
  headAngle: number;
  neckAngle: number;
  shoulderAngle: number;
  torsoAngle: number;
  cameraDistance: number;
  shoulderWidth?: number; // Bi-acromial distance baseline in normalized units
  earShoulderDist?: number; // Ear to shoulder vertical baseline span
  toleranceLevel: 'lenient' | 'standard' | 'strict';
  calibratedAt: string;
  isActive: boolean;
}

export interface PostureSession {
  id: string;
  userId: string;
  postureProfileId: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  averageScore: number;
  goodSeconds: number;
  warningSeconds: number;
  poorSeconds: number;
  alertCount: number;
  primaryDeviation?: string;
  metricsSample?: Array<{
    timeOffsetSec: number;
    score: number;
    state: PostureState;
  }>;
}

export interface PostureAlert {
  id: string;
  sessionId: string;
  timestamp: string;
  severity: 'level1' | 'level2' | 'level3' | 'level4';
  type: 'forward_head' | 'shoulder_slump' | 'torso_lean' | 'slouch' | 'break_reminder';
  score: number;
  message: string;
}

export interface UserGoal {
  id: string;
  title: string;
  type: 'good_posture_percent' | 'max_alerts' | 'daily_duration_minutes' | 'weekly_score_improvement';
  targetValue: number;
  currentValue: number;
  unit: string;
  status: 'in_progress' | 'completed' | 'expired';
  startDate: string;
  targetDate: string;
  category: 'daily' | 'weekly' | 'habit';
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface NotificationPreferences {
  dailyReminders: boolean;
  dailyReminderTime: string;
  postureAlerts: boolean;
  soundAlerts: boolean;
  soundVolume: number;
  breakReminders: boolean;
  breakReminderMinutes: number;
  alertSensitivity: 'low' | 'medium' | 'high';
  alertDelaySeconds: number; // Persistent deviation threshold before trigger (e.g. 3s)
  cooldownSeconds: number;   // Minimum interval between successive alerts (e.g. 10s)
  theme?: ThemeMode;         // 'light' | 'dark' | 'system'
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  occupation: string;
  computerUsageHours: number;
  primaryActivity: 'programming' | 'office' | 'study' | 'gaming' | 'design' | 'general';
  breakFrequencyMinutes: number;
  primaryObjective: string;
  hasCompletedOnboarding: boolean;
  createdAt: string;
  avatarUrl?: string;
  role?: string;
}

export interface UserEmailLog {
  id: string;
  fromAddress?: string;
  replyTo?: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  sentAt: string;
  type: 'welcome_signup' | 'verification' | 'alert_digest' | 'password_reset' | 'password_changed';
  status: 'delivered';
  previewSnippet: string;
  verificationCode?: string;
}

export interface RegisteredUser {
  id: string;
  fullName: string;
  email: string;
  passwordHash?: string;
  occupation: string;
  computerUsageHours: number;
  primaryActivity: 'programming' | 'office' | 'study' | 'gaming' | 'design' | 'general';
  breakFrequencyMinutes: number;
  primaryObjective: string;
  hasCompletedOnboarding: boolean;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  token?: string;
}

export type ActiveTab = 'dashboard' | 'monitor' | 'calibrate' | 'history' | 'goals' | 'stretches' | 'settings' | 'auth';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type BadgeCategory = 'streak' | 'alignment' | 'endurance' | 'milestone';

export interface PostureBadge {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  iconName: string;
  xpValue: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number; // 0 to 100 percentage
  currentMetric: number;
  targetMetric: number;
  unit: string;
  requirementDescription: string;
  tierColor: string;
}

export interface GamificationState {
  totalXp: number;
  level: number;
  levelTitle: string;
  xpInLevel: number;
  xpForNextLevel: number;
  levelProgressPercent: number;
  currentStreakDays: number;
  bestStreakDays: number;
  badgesEarnedCount: number;
  totalBadgesCount: number;
  highScoreSession: number;
  activeGoalsMetCount: number;
}
