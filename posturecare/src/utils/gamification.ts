/**
 * PostureCare Gamification & Badge Engine
 * Evaluates streaks, alignment scores, endurance records, and awards interactive badges.
 */

import {
  PostureBadge,
  GamificationState,
  PostureSession,
  UserGoal,
  BaselineProfile
} from '../types';

const STORAGE_BADGES_KEY = 'posturecare_unlocked_badges';

export interface UnlockedBadgeRecord {
  badgeId: string;
  unlockedAt: string;
}

// Base badge definitions
export const BADGE_CATALOG: Omit<PostureBadge, 'unlocked' | 'progress' | 'currentMetric' | 'unlockedAt'>[] = [
  // --- STREAK BADGES ---
  {
    id: 'streak_3_days',
    title: '3-Day Momentum',
    tagline: 'Initial Habit Spark',
    description: 'Track posture sessions or achieve daily goals for 3 consecutive days.',
    category: 'streak',
    tier: 'bronze',
    iconName: 'Flame',
    xpValue: 120,
    targetMetric: 3,
    unit: 'days',
    requirementDescription: '3 consecutive active days',
    tierColor: 'amber'
  },
  {
    id: 'streak_7_days',
    title: '7-Day Habit Warrior',
    tagline: 'Full Week Alignment',
    description: 'Maintain uninterrupted daily posture monitoring for an entire 7-day week.',
    category: 'streak',
    tier: 'silver',
    iconName: 'Zap',
    xpValue: 300,
    targetMetric: 7,
    unit: 'days',
    requirementDescription: '7 consecutive active days',
    tierColor: 'slate'
  },
  {
    id: 'streak_14_days',
    title: 'Fortress Spine',
    tagline: 'Fortified Postural Reflexes',
    description: 'Sustain uninterrupted posture monitoring and goal completion for 14 straight days.',
    category: 'streak',
    tier: 'gold',
    iconName: 'Shield',
    xpValue: 650,
    targetMetric: 14,
    unit: 'days',
    requirementDescription: '14 consecutive active days',
    tierColor: 'yellow'
  },
  {
    id: 'streak_30_days',
    title: 'Titan of Discipline',
    tagline: '30-Day Master Milestone',
    description: 'Achieve the golden milestone: 30 consecutive days of ergonomic dedication.',
    category: 'streak',
    tier: 'platinum',
    iconName: 'Crown',
    xpValue: 1500,
    targetMetric: 30,
    unit: 'days',
    requirementDescription: '30 consecutive active days',
    tierColor: 'indigo'
  },

  // --- ALIGNMENT SCORE BADGES ---
  {
    id: 'score_elite_90',
    title: 'Precision Aligned',
    tagline: 'Clinical Excellence',
    description: 'Complete a live session with an average alignment score of 90% or higher.',
    category: 'alignment',
    tier: 'bronze',
    iconName: 'Target',
    xpValue: 150,
    targetMetric: 90,
    unit: '%',
    requirementDescription: 'Single session average score >= 90%',
    tierColor: 'emerald'
  },
  {
    id: 'score_master_95',
    title: 'Eagle Spine',
    tagline: 'Peak Ergonomic Form',
    description: 'Attain an exceptional 95%+ posture score in any validated monitoring session.',
    category: 'alignment',
    tier: 'silver',
    iconName: 'Award',
    xpValue: 350,
    targetMetric: 95,
    unit: '%',
    requirementDescription: 'Single session average score >= 95%',
    tierColor: 'cyan'
  },
  {
    id: 'score_perfection_98',
    title: 'Zen Posture Master',
    tagline: 'Flawless Neuromuscular Balance',
    description: 'Score 98% or higher in a substantial session (15+ minutes) with minimal micro-deviations.',
    category: 'alignment',
    tier: 'gold',
    iconName: 'Sparkles',
    xpValue: 800,
    targetMetric: 98,
    unit: '%',
    requirementDescription: 'Session score >= 98% (15+ mins)',
    tierColor: 'amber'
  },
  {
    id: 'alert_free_anchor',
    title: 'Steady Anchor',
    tagline: 'Zero Interruptions',
    description: 'Complete a continuous session with 0 forward slump alerts.',
    category: 'alignment',
    tier: 'silver',
    iconName: 'Compass',
    xpValue: 280,
    targetMetric: 1,
    unit: 'session',
    requirementDescription: 'Session with 0 posture alerts',
    tierColor: 'teal'
  },

  // --- ENDURANCE & VOLUME BADGES ---
  {
    id: 'endurance_bronze',
    title: 'Desk Explorer',
    tagline: 'First 2 Hours Logged',
    description: 'Accumulate at least 2 hours (120 mins) of verified good posture time.',
    category: 'endurance',
    tier: 'bronze',
    iconName: 'Clock',
    xpValue: 100,
    targetMetric: 2,
    unit: 'hours',
    requirementDescription: '2 hours of good posture logged',
    tierColor: 'emerald'
  },
  {
    id: 'endurance_silver',
    title: 'Ergonomic Centurion',
    tagline: '10 Hours in the Zone',
    description: 'Accumulate 10 total hours of confirmed ergonomic sitting alignment.',
    category: 'endurance',
    tier: 'silver',
    iconName: 'Trophy',
    xpValue: 400,
    targetMetric: 10,
    unit: 'hours',
    requirementDescription: '10 hours of good posture logged',
    tierColor: 'blue'
  },
  {
    id: 'endurance_gold',
    title: 'Iron Lumbar Titan',
    tagline: '25 Hours of Spinal Health',
    description: 'Log 25 cumulative hours of verified good posture time.',
    category: 'endurance',
    tier: 'gold',
    iconName: 'Flame',
    xpValue: 900,
    targetMetric: 25,
    unit: 'hours',
    requirementDescription: '25 hours of good posture logged',
    tierColor: 'violet'
  },

  // --- MILESTONES & HABITS ---
  {
    id: 'milestone_baseline',
    title: 'Calibration Pioneer',
    tagline: 'Ergonomic Ground Zero',
    description: 'Successfully complete initial 3-second neutral neck and shoulder calibration.',
    category: 'milestone',
    tier: 'bronze',
    iconName: 'HeartPulse',
    xpValue: 100,
    targetMetric: 1,
    unit: 'profile',
    requirementDescription: 'Active calibrated baseline profile',
    tierColor: 'rose'
  },
  {
    id: 'goals_champion',
    title: 'Goal Crusher',
    tagline: 'Multi-Goal Mastery',
    description: 'Reach or exceed target values on active ergonomic goals.',
    category: 'milestone',
    tier: 'gold',
    iconName: 'Trophy',
    xpValue: 500,
    targetMetric: 2,
    unit: 'goals',
    requirementDescription: '2+ completed ergonomic goals',
    tierColor: 'amber'
  }
];

export const GamificationEngine = {
  /**
   * Calculates consecutive days streak from an array of sessions
   */
  calculateStreak(sessions: PostureSession[]): { currentStreak: number; bestStreak: number; activeDays: string[] } {
    if (!sessions || sessions.length === 0) {
      return { currentStreak: 0, bestStreak: 0, activeDays: [] };
    }

    // Extract unique calendar days YYYY-MM-DD
    const dateSet = new Set<string>();
    sessions.forEach((s) => {
      try {
        const d = new Date(s.startTime);
        if (!isNaN(d.getTime())) {
          dateSet.add(d.toISOString().split('T')[0]);
        }
      } catch {
        // ignore malformed
      }
    });

    const sortedDays = Array.from(dateSet).sort().reverse();
    if (sortedDays.length === 0) {
      return { currentStreak: 0, bestStreak: 0, activeDays: [] };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if streak is active (active today or yesterday)
    let currentStreak = 0;
    const mostRecentDay = sortedDays[0];
    const isStreakAlive = mostRecentDay === todayStr || mostRecentDay === yesterdayStr;

    if (isStreakAlive) {
      currentStreak = 1;
      let checkDate = new Date(mostRecentDay);

      for (let i = 1; i < sortedDays.length; i++) {
        const prevDayDate = new Date(checkDate.getTime() - 86400000).toISOString().split('T')[0];
        if (sortedDays[i] === prevDayDate) {
          currentStreak++;
          checkDate = new Date(sortedDays[i]);
        } else {
          break;
        }
      }
    }

    // Compute best historical streak
    let bestStreak = currentStreak;
    let tempStreak = 1;
    for (let i = 0; i < sortedDays.length - 1; i++) {
      const dayCurr = new Date(sortedDays[i]);
      const expectedPrev = new Date(dayCurr.getTime() - 86400000).toISOString().split('T')[0];
      if (sortedDays[i + 1] === expectedPrev) {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else {
        tempStreak = 1;
      }
    }

    return { currentStreak, bestStreak, activeDays: sortedDays };
  },

  /**
   * Retrieves manually unlocked badges or persistent unlock records
   */
  getStoredUnlockRecords(userId?: string): Record<string, string> {
    const key = userId ? `${STORAGE_BADGES_KEY}_${userId}` : STORAGE_BADGES_KEY;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  /**
   * Saves unlock timestamp for a badge
   */
  saveUnlockRecord(badgeId: string, userId?: string): void {
    const records = GamificationEngine.getStoredUnlockRecords(userId);
    if (!records[badgeId]) {
      records[badgeId] = new Date().toISOString();
      const key = userId ? `${STORAGE_BADGES_KEY}_${userId}` : STORAGE_BADGES_KEY;
      localStorage.setItem(key, JSON.stringify(records));
    }
  },

  /**
   * Evaluates all badges and returns full badges with progress and gamification state
   */
  evaluateBadges(
    sessions: PostureSession[],
    goals: UserGoal[],
    baseline: BaselineProfile | null,
    userId?: string
  ): { badges: PostureBadge[]; state: GamificationState; newlyUnlocked: PostureBadge[] } {
    const unlockRecords = GamificationEngine.getStoredUnlockRecords(userId);
    const { currentStreak, bestStreak } = GamificationEngine.calculateStreak(sessions);

    // Compute session aggregates
    const maxSessionScore = sessions.length > 0 ? Math.max(...sessions.map((s) => s.averageScore)) : 0;
    const totalGoodSeconds = sessions.reduce((acc, s) => acc + (s.goodSeconds || 0), 0);
    const totalGoodHours = Math.round((totalGoodSeconds / 3600) * 10) / 10;
    const hasZeroAlertSession = sessions.some((s) => s.alertCount === 0 && s.durationSeconds >= 600); // 10m+ alert free
    const hasLong98PlusSession = sessions.some((s) => s.averageScore >= 98 && s.durationSeconds >= 900); // 15m+ 98%
    const isBaselineActive = !!baseline && baseline.headAngle !== undefined;
    const completedGoalsCount = goals.filter((g) => g.status === 'completed' || g.currentValue >= g.targetValue).length;

    const newlyUnlocked: PostureBadge[] = [];

    const badges: PostureBadge[] = BADGE_CATALOG.map((item) => {
      let currentMetric = 0;
      let meetsRequirement = false;

      switch (item.id) {
        case 'streak_3_days':
          currentMetric = currentStreak;
          meetsRequirement = currentStreak >= 3;
          break;
        case 'streak_7_days':
          currentMetric = currentStreak;
          meetsRequirement = currentStreak >= 7;
          break;
        case 'streak_14_days':
          currentMetric = currentStreak;
          meetsRequirement = currentStreak >= 14;
          break;
        case 'streak_30_days':
          currentMetric = currentStreak;
          meetsRequirement = currentStreak >= 30;
          break;
        case 'score_elite_90':
          currentMetric = maxSessionScore;
          meetsRequirement = maxSessionScore >= 90;
          break;
        case 'score_master_95':
          currentMetric = maxSessionScore;
          meetsRequirement = maxSessionScore >= 95;
          break;
        case 'score_perfection_98':
          currentMetric = maxSessionScore;
          meetsRequirement = hasLong98PlusSession || maxSessionScore >= 98;
          break;
        case 'alert_free_anchor':
          currentMetric = hasZeroAlertSession ? 1 : 0;
          meetsRequirement = hasZeroAlertSession;
          break;
        case 'endurance_bronze':
          currentMetric = totalGoodHours;
          meetsRequirement = totalGoodHours >= 2;
          break;
        case 'endurance_silver':
          currentMetric = totalGoodHours;
          meetsRequirement = totalGoodHours >= 10;
          break;
        case 'endurance_gold':
          currentMetric = totalGoodHours;
          meetsRequirement = totalGoodHours >= 25;
          break;
        case 'milestone_baseline':
          currentMetric = isBaselineActive ? 1 : 0;
          meetsRequirement = isBaselineActive;
          break;
        case 'goals_champion':
          currentMetric = completedGoalsCount;
          meetsRequirement = completedGoalsCount >= 2;
          break;
        default:
          currentMetric = 0;
      }

      // If unlocked previously in storage or currently qualifies
      const wasUnlockedBefore = !!unlockRecords[item.id];
      const isUnlocked = wasUnlockedBefore || meetsRequirement;

      let unlockedAt: string | undefined = unlockRecords[item.id];
      if (meetsRequirement && !wasUnlockedBefore) {
        unlockedAt = new Date().toISOString();
        GamificationEngine.saveUnlockRecord(item.id, userId);
      }

      const progress = Math.min(100, Math.round((currentMetric / item.targetMetric) * 100));

      const badge: PostureBadge = {
        ...item,
        unlocked: isUnlocked,
        unlockedAt: isUnlocked ? unlockedAt || new Date().toISOString() : undefined,
        progress: isUnlocked ? 100 : progress,
        currentMetric,
        targetMetric: item.targetMetric,
        unit: item.unit
      };

      if (meetsRequirement && !wasUnlockedBefore) {
        newlyUnlocked.push(badge);
      }

      return badge;
    });

    // Compute XP, Level, and Ranks
    const unlockedBadges = badges.filter((b) => b.unlocked);
    const totalXp = unlockedBadges.reduce((acc, b) => acc + b.xpValue, 0);

    // Levels:
    // Level 1: 0 - 300 XP (Desk Novice)
    // Level 2: 301 - 700 XP (Ergonomic Scout)
    // Level 3: 701 - 1300 XP (Spinal Guardian)
    // Level 4: 1301 - 2200 XP (Postural Artisan)
    // Level 5: 2201+ XP (Biomechanical Grandmaster)
    let level = 1;
    let levelTitle = 'Desk Novice';
    let minXpForLevel = 0;
    let nextLevelXp = 300;

    if (totalXp >= 2200) {
      level = 5;
      levelTitle = 'Biomechanical Grandmaster';
      minXpForLevel = 2200;
      nextLevelXp = 3500;
    } else if (totalXp >= 1300) {
      level = 4;
      levelTitle = 'Postural Artisan';
      minXpForLevel = 1300;
      nextLevelXp = 2200;
    } else if (totalXp >= 700) {
      level = 3;
      levelTitle = 'Spinal Guardian';
      minXpForLevel = 700;
      nextLevelXp = 1300;
    } else if (totalXp >= 300) {
      level = 2;
      levelTitle = 'Ergonomic Scout';
      minXpForLevel = 300;
      nextLevelXp = 700;
    }

    const xpInLevel = totalXp - minXpForLevel;
    const xpSpan = nextLevelXp - minXpForLevel;
    const levelProgressPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / xpSpan) * 100)));

    const state: GamificationState = {
      totalXp,
      level,
      levelTitle,
      xpInLevel,
      xpForNextLevel: nextLevelXp,
      levelProgressPercent,
      currentStreakDays: currentStreak,
      bestStreakDays: bestStreak,
      badgesEarnedCount: unlockedBadges.length,
      totalBadgesCount: badges.length,
      highScoreSession: maxSessionScore,
      activeGoalsMetCount: completedGoalsCount
    };

    return { badges, state, newlyUnlocked };
  }
};
