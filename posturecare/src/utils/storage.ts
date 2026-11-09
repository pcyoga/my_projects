import {
  UserProfile,
  BaselineProfile,
  PostureSession,
  PostureAlert,
  UserGoal,
  NotificationPreferences,
  RegisteredUser,
  UserEmailLog,
  ThemeMode
} from '../types';
import { indexedDBManager } from './indexedDb';

const STORAGE_KEYS = {
  USER_PROFILE: 'posturecare_user_profile',
  BASELINE_PROFILE: 'posturecare_baseline_profile',
  SESSIONS: 'posturecare_sessions',
  ALERTS: 'posturecare_alerts',
  GOALS: 'posturecare_goals',
  PREFERENCES: 'posturecare_preferences',
  APP_MODE: 'posturecare_app_mode', // 'new_user' vs 'existing_user'
  AUTH_STATE: 'posturecare_auth_state',
  REGISTERED_USERS: 'posturecare_registered_users',
  EMAIL_LOGS: 'posturecare_email_logs'
};

export const defaultPreferences: NotificationPreferences = {
  dailyReminders: true,
  dailyReminderTime: '09:30',
  postureAlerts: true,
  soundAlerts: true,
  soundVolume: 0.7,
  breakReminders: true,
  breakReminderMinutes: 45,
  alertSensitivity: 'medium',
  alertDelaySeconds: 3,
  cooldownSeconds: 12,
  theme: 'system'
};

export const defaultUserProfile: UserProfile = {
  id: 'usr_user_01',
  fullName: 'PostureCare User',
  email: 'user@workspace.local',
  occupation: 'Workstation User',
  computerUsageHours: 8,
  primaryActivity: 'general',
  breakFrequencyMinutes: 45,
  primaryObjective: 'Maintain healthy spinal alignment and ergonomic posture',
  hasCompletedOnboarding: true,
  createdAt: new Date().toISOString()
};

export const defaultBaseline: BaselineProfile = {
  id: 'base_01',
  userId: 'usr_default_01',
  name: 'Standard Desk Setup',
  headAngle: 1.5,
  neckAngle: 4.2,
  shoulderAngle: 0.8,
  torsoAngle: 2.1,
  cameraDistance: 1.0,
  toleranceLevel: 'standard',
  calibratedAt: '2026-08-28T10:15:00Z',
  isActive: true
};

export const defaultGoals: UserGoal[] = [
  {
    id: 'goal_01',
    title: 'Maintain > 80% Good Posture Daily',
    type: 'good_posture_percent',
    targetValue: 80,
    currentValue: 84,
    unit: '%',
    status: 'in_progress',
    startDate: '2026-08-25',
    targetDate: '2026-09-05',
    category: 'daily'
  },
  {
    id: 'goal_02',
    title: 'Keep Alerts Below 4 Per Session',
    type: 'max_alerts',
    targetValue: 4,
    currentValue: 3,
    unit: 'alerts',
    status: 'in_progress',
    startDate: '2026-08-25',
    targetDate: '2026-09-01',
    category: 'habit'
  },
  {
    id: 'goal_03',
    title: 'Monitor 4+ Hours Every Workday',
    type: 'daily_duration_minutes',
    targetValue: 240,
    currentValue: 260,
    unit: 'mins',
    status: 'completed',
    startDate: '2026-08-20',
    targetDate: '2026-08-30',
    category: 'daily'
  },
  {
    id: 'goal_04',
    title: 'Boost Weekly Posture Score by 10%',
    type: 'weekly_score_improvement',
    targetValue: 90,
    currentValue: 88,
    unit: 'score',
    status: 'in_progress',
    startDate: '2026-08-24',
    targetDate: '2026-09-07',
    category: 'weekly'
  }
];

export function getSampleSessions(): PostureSession[] {
  const now = new Date();
  const sessions: PostureSession[] = [
    {
      id: 'ses_01',
      userId: 'usr_default_01',
      postureProfileId: 'base_01',
      startTime: new Date(now.getTime() - 1000 * 60 * 180).toISOString(),
      endTime: new Date(now.getTime() - 1000 * 60 * 125).toISOString(),
      durationSeconds: 3300,
      averageScore: 92,
      goodSeconds: 2800,
      warningSeconds: 380,
      poorSeconds: 120,
      alertCount: 2,
      primaryDeviation: 'Slight right shoulder slump near the 45m mark'
    },
    {
      id: 'ses_02',
      userId: 'usr_default_01',
      postureProfileId: 'base_01',
      startTime: new Date(now.getTime() - 1000 * 60 * 360).toISOString(),
      endTime: new Date(now.getTime() - 1000 * 60 * 270).toISOString(),
      durationSeconds: 5400,
      averageScore: 86,
      goodSeconds: 4320,
      warningSeconds: 780,
      poorSeconds: 300,
      alertCount: 4,
      primaryDeviation: 'Forward head tilt during deep concentration'
    },
    {
      id: 'ses_03',
      userId: 'usr_default_01',
      postureProfileId: 'base_01',
      startTime: new Date(now.getTime() - 1000 * 60 * 60 * 26).toISOString(),
      endTime: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      durationSeconds: 7200,
      averageScore: 89,
      goodSeconds: 6120,
      warningSeconds: 780,
      poorSeconds: 300,
      alertCount: 5,
      primaryDeviation: 'Mid-torso slouching after 90m continuous sitting'
    },
    {
      id: 'ses_04',
      userId: 'usr_default_01',
      postureProfileId: 'base_01',
      startTime: new Date(now.getTime() - 1000 * 60 * 60 * 50).toISOString(),
      endTime: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      durationSeconds: 6800,
      averageScore: 84,
      goodSeconds: 5300,
      warningSeconds: 1100,
      poorSeconds: 400,
      alertCount: 6,
      primaryDeviation: 'Neck angle dropped 6° forward'
    },
    {
      id: 'ses_05',
      userId: 'usr_default_01',
      postureProfileId: 'base_01',
      startTime: new Date(now.getTime() - 1000 * 60 * 60 * 75).toISOString(),
      endTime: new Date(now.getTime() - 1000 * 60 * 60 * 73).toISOString(),
      durationSeconds: 6400,
      averageScore: 88,
      goodSeconds: 5280,
      warningSeconds: 820,
      poorSeconds: 300,
      alertCount: 3,
      primaryDeviation: 'Left shoulder elevation'
    },
    {
      id: 'ses_06',
      userId: 'usr_default_01',
      postureProfileId: 'base_01',
      startTime: new Date(now.getTime() - 1000 * 60 * 60 * 120).toISOString(),
      endTime: new Date(now.getTime() - 1000 * 60 * 60 * 118).toISOString(),
      durationSeconds: 7200,
      averageScore: 81,
      goodSeconds: 4900,
      warningSeconds: 1500,
      poorSeconds: 800,
      alertCount: 8,
      primaryDeviation: 'Late-afternoon spine fatigue'
    }
  ];
  return sessions;
}

export const initialGoalsForNewUser: UserGoal[] = [
  {
    id: 'goal_01',
    title: 'Maintain > 80% Good Posture Daily',
    type: 'good_posture_percent',
    targetValue: 80,
    currentValue: 0,
    unit: '%',
    status: 'in_progress',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    category: 'daily'
  },
  {
    id: 'goal_02',
    title: 'Keep Alerts Below 4 Per Session',
    type: 'max_alerts',
    targetValue: 4,
    currentValue: 0,
    unit: 'alerts',
    status: 'in_progress',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    category: 'habit'
  },
  {
    id: 'goal_03',
    title: 'Monitor 4+ Hours Every Workday',
    type: 'daily_duration_minutes',
    targetValue: 240,
    currentValue: 0,
    unit: 'mins',
    status: 'in_progress',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    category: 'daily'
  }
];

export const Storage = {
  getCurrentUser(): UserProfile | null {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_STATE);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed.user || null;
      } catch { /* ignore */ }
    }
    return null;
  },

  getUserProfile(): UserProfile {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return defaultUserProfile;
  },

  saveUserProfile(profile: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  },

  getBaselineProfile(userId?: string): BaselineProfile | null {
    const targetUser = userId || Storage.getCurrentUser()?.id;
    if (targetUser) {
      const userKey = `posturecare_baseline_${targetUser}`;
      const rawUser = localStorage.getItem(userKey);
      if (rawUser) {
        try { return JSON.parse(rawUser); } catch { /* ignore */ }
      }
      // If it's the demo account only, fall back to defaultBaseline
      if (targetUser === 'usr_default_01') {
        return defaultBaseline;
      }
      return null;
    }

    const raw = localStorage.getItem(STORAGE_KEYS.BASELINE_PROFILE);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return null;
  },

  hasCustomBaselineProfile(userId?: string): boolean {
    const targetUser = userId || Storage.getCurrentUser()?.id;
    if (targetUser) {
      const raw = localStorage.getItem(`posturecare_baseline_${targetUser}`);
      return !!raw;
    }
    const raw = localStorage.getItem(STORAGE_KEYS.BASELINE_PROFILE);
    return !!raw;
  },

  clearBaselineProfile(userId?: string): void {
    const targetUser = userId || Storage.getCurrentUser()?.id;
    if (targetUser) {
      localStorage.removeItem(`posturecare_baseline_${targetUser}`);
    }
    localStorage.removeItem(STORAGE_KEYS.BASELINE_PROFILE);
  },

  saveBaselineProfile(baseline: BaselineProfile, userId?: string): void {
    const targetUser = userId || baseline.userId || Storage.getCurrentUser()?.id;
    if (targetUser) {
      localStorage.setItem(`posturecare_baseline_${targetUser}`, JSON.stringify(baseline));
    }
    localStorage.setItem(STORAGE_KEYS.BASELINE_PROFILE, JSON.stringify(baseline));
  },

  getSessions(userId?: string): PostureSession[] {
    const targetUser = userId || Storage.getCurrentUser()?.id;
    if (targetUser) {
      const userKey = `posturecare_sessions_${targetUser}`;
      const raw = localStorage.getItem(userKey);
      if (raw !== null) {
        try { return JSON.parse(raw); } catch { return []; }
      }
      // If it's the default demo user, seed sample data
      if (targetUser === 'usr_default_01') {
        const sample = getSampleSessions();
        localStorage.setItem(userKey, JSON.stringify(sample));
        return sample;
      }
      // Any new or other user has an empty sessions list
      localStorage.setItem(userKey, JSON.stringify([]));
      return [];
    }

    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return [];
  },

  saveSession(session: PostureSession, userId?: string): void {
    const targetUser = userId || session.userId || Storage.getCurrentUser()?.id;
    const existing = Storage.getSessions(targetUser);
    const updated = [session, ...existing];
    if (targetUser) {
      localStorage.setItem(`posturecare_sessions_${targetUser}`, JSON.stringify(updated));
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
    // Asynchronously commit to structured IndexedDB for indexed retrieval & aggregations
    indexedDBManager.saveSession(session).catch((err) => {
      console.warn('[Storage] IndexedDB sync notice:', err);
    });
  },

  getIndexedDB(): typeof indexedDBManager {
    return indexedDBManager;
  },

  initNewUser(userId: string): void {
    localStorage.setItem(`posturecare_sessions_${userId}`, JSON.stringify([]));
    localStorage.removeItem(`posturecare_baseline_${userId}`);
    localStorage.setItem(`posturecare_alerts_${userId}`, JSON.stringify([]));
    localStorage.setItem(`posturecare_goals_${userId}`, JSON.stringify(initialGoalsForNewUser));
  },

  getGoals(userId?: string): UserGoal[] {
    const targetUser = userId || Storage.getCurrentUser()?.id;
    if (targetUser) {
      const raw = localStorage.getItem(`posturecare_goals_${targetUser}`);
      if (raw) {
        try { return JSON.parse(raw); } catch { /* ignore */ }
      }
      if (targetUser === 'usr_default_01') {
        return defaultGoals;
      }
      return initialGoalsForNewUser;
    }
    const raw = localStorage.getItem(STORAGE_KEYS.GOALS);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return initialGoalsForNewUser;
  },

  saveGoals(goals: UserGoal[], userId?: string): void {
    const targetUser = userId || Storage.getCurrentUser()?.id;
    if (targetUser) {
      localStorage.setItem(`posturecare_goals_${targetUser}`, JSON.stringify(goals));
    }
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
  },

  getPreferences(): NotificationPreferences {
    const raw = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return defaultPreferences;
  },

  savePreferences(prefs: NotificationPreferences): void {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
  },

  getTheme(): ThemeMode {
    const raw = localStorage.getItem('posturecare_theme');
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
    const prefs = Storage.getPreferences();
    if (prefs.theme) return prefs.theme;
    return 'system';
  },

  setTheme(theme: ThemeMode): void {
    localStorage.setItem('posturecare_theme', theme);
    const prefs = Storage.getPreferences();
    Storage.savePreferences({ ...prefs, theme });
    Storage.applyTheme(theme);
  },

  applyTheme(theme?: ThemeMode): void {
    const activeTheme = theme || Storage.getTheme();
    const systemDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = activeTheme === 'dark' || (activeTheme === 'system' && systemDark);

    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    }
  },

  getAlerts(): PostureAlert[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ALERTS);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return [];
  },

  saveAlert(alert: PostureAlert): void {
    const existing = Storage.getAlerts();
    const updated = [alert, ...existing.slice(0, 49)];
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(updated));
  },

  resetToNewUser(): void {
    const emptyProfile: UserProfile = {
      id: 'usr_new',
      fullName: 'New User',
      email: 'user@example.com',
      occupation: '',
      computerUsageHours: 6,
      primaryActivity: 'general',
      breakFrequencyMinutes: 60,
      primaryObjective: '',
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(emptyProfile));
    localStorage.removeItem(STORAGE_KEYS.BASELINE_PROFILE);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify([]));
  },

  resetToSampleData(): void {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(defaultUserProfile));
    localStorage.setItem(STORAGE_KEYS.BASELINE_PROFILE, JSON.stringify(defaultBaseline));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(getSampleSessions()));
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(defaultGoals));
  },

  getAuthState(): { isAuthenticated: boolean; user: UserProfile | null } {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_STATE);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed;
      } catch { /* ignore */ }
    }
    // Default to authenticated with default user
    return {
      isAuthenticated: true,
      user: Storage.getUserProfile()
    };
  },

  setAuthState(authState: { isAuthenticated: boolean; user: UserProfile | null }): void {
    localStorage.setItem(STORAGE_KEYS.AUTH_STATE, JSON.stringify(authState));
    if (authState.user) {
      Storage.saveUserProfile(authState.user);
    }
  },

  logout(): void {
    Storage.setAuthState({ isAuthenticated: false, user: null });
  },

  getRegisteredUsers(): RegisteredUser[] {
    const raw = localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return [];
  },

  registerUser(user: RegisteredUser): void {
    const users = Storage.getRegisteredUsers();
    const existingIndex = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(users));
  },

  findUserByEmail(email: string): RegisteredUser | undefined {
    const clean = email.trim().toLowerCase();
    const users = Storage.getRegisteredUsers();
    const foundInRegistered = users.find(u => u.email.toLowerCase() === clean);
    if (foundInRegistered) return foundInRegistered;

    const current = Storage.getUserProfile();
    if (current && current.email && current.email.toLowerCase() === clean) {
      return {
        ...current,
        passwordHash: 'sha256_mock_hash'
      };
    }
    return undefined;
  },

  updateUserPassword(email: string, newPasswordPlain: string): boolean {
    const users = Storage.getRegisteredUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (userIndex >= 0) {
      users[userIndex].passwordHash = `mock_hash_${newPasswordPlain.length}_${Date.now()}`;
      localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(users));
      return true;
    }
    // If user is resetting password for an email not explicitly pre-registered,
    // auto-register the account profile with their updated credentials
    const cleanEmail = email.trim().toLowerCase();
    const namePart = cleanEmail.split('@')[0];
    const generatedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const newUser: RegisteredUser = {
      id: `usr_${Date.now()}`,
      fullName: generatedName,
      email: cleanEmail,
      passwordHash: `mock_hash_${newPasswordPlain.length}_${Date.now()}`,
      occupation: 'Workstation User',
      computerUsageHours: 8,
      primaryActivity: 'general',
      breakFrequencyMinutes: 45,
      primaryObjective: 'Maintain healthy spinal alignment',
      hasCompletedOnboarding: true,
      createdAt: new Date().toISOString()
    };
    Storage.registerUser(newUser);
    return true;
  },

  getEmailLogs(): UserEmailLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EMAIL_LOGS);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return [];
  },

  logEmail(emailLog: UserEmailLog): void {
    const logs = Storage.getEmailLogs();
    const updated = [emailLog, ...logs.slice(0, 49)];
    localStorage.setItem(STORAGE_KEYS.EMAIL_LOGS, JSON.stringify(updated));
  }
};
