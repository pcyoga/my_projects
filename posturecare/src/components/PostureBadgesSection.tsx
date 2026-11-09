import React, { useState } from 'react';
import {
  Flame,
  Award,
  Shield,
  Target,
  Sparkles,
  Trophy,
  Zap,
  Crown,
  Compass,
  Clock,
  HeartPulse,
  Lock,
  CheckCircle2,
  ChevronRight,
  Info,
  X,
  Share2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PostureBadge, GamificationState, BadgeCategory, BadgeTier } from '../types';
import { audioService } from '../utils/audio';

interface PostureBadgesSectionProps {
  badges: PostureBadge[];
  gamificationState: GamificationState;
  onRefreshBadges?: () => void;
  onNavigateToTab?: (tab: 'monitor' | 'calibrate' | 'goals' | 'stretches') => void;
  onSimulateStreak?: () => void;
}

// Icon mapper for dynamic badge icons
const getBadgeIcon = (iconName: string, className: string = 'w-6 h-6') => {
  switch (iconName) {
    case 'Flame':
      return <Flame className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Shield':
      return <Shield className={className} />;
    case 'Crown':
      return <Crown className={className} />;
    case 'Target':
      return <Target className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Compass':
      return <Compass className={className} />;
    case 'Clock':
      return <Clock className={className} />;
    case 'Trophy':
      return <Trophy className={className} />;
    case 'HeartPulse':
      return <HeartPulse className={className} />;
    default:
      return <Award className={className} />;
  }
};

// Styling helper for tier aesthetics
const getTierStyles = (tier: BadgeTier, unlocked: boolean) => {
  if (!unlocked) {
    return {
      cardBg: 'bg-stone-50/80 border-stone-200/70',
      iconBg: 'bg-stone-200/60 text-stone-400',
      borderGlow: 'border-dashed border-stone-300',
      badgeLabelBg: 'bg-stone-100 text-stone-500',
      accentColor: 'text-stone-400',
      ringColor: 'ring-stone-200'
    };
  }

  switch (tier) {
    case 'bronze':
      return {
        cardBg: 'bg-gradient-to-b from-amber-50/50 to-white border-amber-200/90 shadow-2xs hover:border-amber-300',
        iconBg: 'bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-xs',
        borderGlow: 'border-amber-200',
        badgeLabelBg: 'bg-amber-100/90 text-amber-800 border border-amber-200/80',
        accentColor: 'text-amber-700',
        ringColor: 'ring-amber-400/30'
      };
    case 'silver':
      return {
        cardBg: 'bg-gradient-to-b from-slate-50/70 to-white border-slate-300 shadow-2xs hover:border-slate-400',
        iconBg: 'bg-gradient-to-tr from-slate-600 to-slate-400 text-white shadow-xs',
        borderGlow: 'border-slate-300',
        badgeLabelBg: 'bg-slate-100 text-slate-800 border border-slate-300',
        accentColor: 'text-slate-700',
        ringColor: 'ring-slate-400/30'
      };
    case 'gold':
      return {
        cardBg: 'bg-gradient-to-b from-yellow-50/60 to-white border-yellow-300 shadow-2xs hover:border-yellow-400',
        iconBg: 'bg-gradient-to-tr from-amber-500 via-yellow-500 to-amber-400 text-stone-950 shadow-xs',
        borderGlow: 'border-yellow-300',
        badgeLabelBg: 'bg-yellow-100 text-yellow-900 border border-yellow-300',
        accentColor: 'text-amber-800',
        ringColor: 'ring-yellow-400/40'
      };
    case 'platinum':
      return {
        cardBg: 'bg-gradient-to-b from-indigo-50/50 to-white border-indigo-200 shadow-2xs hover:border-indigo-300',
        iconBg: 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-xs',
        borderGlow: 'border-indigo-300',
        badgeLabelBg: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
        accentColor: 'text-indigo-700',
        ringColor: 'ring-indigo-400/30'
      };
    case 'diamond':
      return {
        cardBg: 'bg-gradient-to-b from-cyan-50/60 to-white border-cyan-300 shadow-2xs hover:border-cyan-400',
        iconBg: 'bg-gradient-to-tr from-cyan-600 to-teal-400 text-white shadow-xs',
        borderGlow: 'border-cyan-300',
        badgeLabelBg: 'bg-cyan-100 text-cyan-900 border border-cyan-200',
        accentColor: 'text-cyan-800',
        ringColor: 'ring-cyan-400/40'
      };
  }
};

export const PostureBadgesSection: React.FC<PostureBadgesSectionProps> = ({
  badges,
  gamificationState,
  onRefreshBadges,
  onNavigateToTab,
  onSimulateStreak
}) => {
  const [selectedCategory, setSelectedCategory] = useState<BadgeCategory | 'all'>('all');
  const [activeBadgeModal, setActiveBadgeModal] = useState<PostureBadge | null>(null);
  const [filterUnlockedOnly, setFilterUnlockedOnly] = useState<boolean>(false);
  const [showCelebrationBanner, setShowCelebrationBanner] = useState<string | null>(null);

  // Trigger celebration effect
  const triggerCelebration = (badge: PostureBadge) => {
    try {
      confetti({
        particleCount: 85,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6']
      });
      audioService.playBadgeChime();
    } catch {
      // ignore
    }
    setShowCelebrationBanner(`Unlocked: ${badge.title} (+${badge.xpValue} XP)!`);
    setTimeout(() => {
      setShowCelebrationBanner(null);
    }, 4500);
  };

  // Filter badges
  const filteredBadges = badges.filter((b) => {
    if (selectedCategory !== 'all' && b.category !== selectedCategory) {
      return false;
    }
    if (filterUnlockedOnly && !b.unlocked) {
      return false;
    }
    return true;
  });

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const streakBadgesCount = badges.filter((b) => b.category === 'streak').length;
  const alignmentBadgesCount = badges.filter((b) => b.category === 'alignment').length;
  const enduranceBadgesCount = badges.filter((b) => b.category === 'endurance').length;
  const milestoneBadgesCount = badges.filter((b) => b.category === 'milestone').length;

  return (
    <div id="section-gamification-badges" className="space-y-6">
      {/* Toast Alert Banner for Recent Unlocks */}
      {showCelebrationBanner && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl p-4 shadow-md flex items-center justify-between border border-emerald-400/40 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-300 fill-yellow-300" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">Achievement Unlocked</p>
              <p className="text-sm font-bold text-white">{showCelebrationBanner}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCelebrationBanner(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-emerald-200 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Gamification Level & Streak Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Player Rank & XP */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>Ergonomic Rank</span>
            <span className="text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md font-bold border border-emerald-100">
              Level {gamificationState.level}
            </span>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <h4 className="text-lg font-bold text-stone-900">{gamificationState.levelTitle}</h4>
              <span className="text-xs font-bold text-emerald-700">{gamificationState.totalXp} XP</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {gamificationState.xpForNextLevel - gamificationState.totalXp > 0
                ? `${gamificationState.xpForNextLevel - gamificationState.totalXp} XP to Level ${gamificationState.level + 1}`
                : 'Maximum Rank Achieved'}
            </p>
          </div>
          <div className="mt-3">
            <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${gamificationState.levelProgressPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-stone-500 mt-1.5 font-medium">
              <span>Level {gamificationState.level}</span>
              <span>{gamificationState.levelProgressPercent}%</span>
              <span>Level {gamificationState.level + 1}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Streak Flame Tracker */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>Consecutive Day Streak</span>
            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md font-bold border border-amber-100 flex items-center space-x-1">
              <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>Active</span>
            </span>
          </div>
          <div className="flex items-center space-x-4 my-1">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-2xs">
              <Flame className="w-7 h-7 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-extrabold text-stone-900">{gamificationState.currentStreakDays}</span>
                <span className="text-xs font-bold text-stone-600">Days Consecutive</span>
              </div>
              <p className="text-[11px] text-stone-500">
                Personal Best: <strong className="text-stone-700">{gamificationState.bestStreakDays} Days</strong>
              </p>
            </div>
          </div>
          <p className="text-[11px] text-stone-500 mt-1 border-t border-stone-100 pt-2">
            Track at least one session daily to protect your momentum.
          </p>
        </div>

        {/* Card 3: Badges Unlocked Overview */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>Achievements Unlocked</span>
            <span className="text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md font-bold border border-blue-100">
              {Math.round((unlockedCount / badges.length) * 100)}% Complete
            </span>
          </div>
          <div className="flex items-center space-x-4 my-1">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 shadow-2xs">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-extrabold text-stone-900">{unlockedCount}</span>
                <span className="text-xs text-stone-600 font-medium">/ {badges.length} Badges</span>
              </div>
              <p className="text-[11px] text-stone-500">
                Peak Session Score: <strong className="text-emerald-700">{gamificationState.highScoreSession}%</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-500 border-t border-stone-100 pt-2">
            <span>Next Target:</span>
            <strong className="text-stone-800">
              {badges.find((b) => !b.unlocked)?.title || 'All Badges Unlocked!'}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Badges Showcase Panel */}
      <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs space-y-6">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-emerald-700" />
              <h3 className="text-base font-bold text-stone-900">Ergonomic Badges & Honors</h3>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Visual rewards awarded for consecutive posture streaks, high alignment scores, and endurance records.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-2">
            {onSimulateStreak && (
              <button
                onClick={onSimulateStreak}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-xl border border-emerald-200 transition flex items-center space-x-1 shadow-2xs"
                title="Log a high-alignment session to test streak progression and badge unlock celebration"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Simulate High Score / Streak</span>
              </button>
            )}
            <label className="flex items-center space-x-2 text-xs text-stone-600 cursor-pointer bg-stone-50 hover:bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 transition">
              <input
                type="checkbox"
                checked={filterUnlockedOnly}
                onChange={(e) => setFilterUnlockedOnly(e.target.checked)}
                className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 border-stone-300"
              />
              <span className="font-medium text-[11px]">Unlocked Only</span>
            </label>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedCategory === 'all'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
            }`}
          >
            All Badges ({badges.length})
          </button>
          <button
            onClick={() => setSelectedCategory('streak')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              selectedCategory === 'streak'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Streaks ({streakBadgesCount})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('alignment')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              selectedCategory === 'alignment'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Alignment Scores ({alignmentBadgesCount})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('endurance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              selectedCategory === 'endurance'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Endurance ({enduranceBadgesCount})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('milestone')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              selectedCategory === 'milestone'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Milestones ({milestoneBadgesCount})</span>
          </button>
        </div>

        {/* Badges Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => {
            const styles = getTierStyles(badge.tier, badge.unlocked);

            return (
              <div
                key={badge.id}
                onClick={() => setActiveBadgeModal(badge)}
                className={`relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between group ${styles.cardBg}`}
              >
                {/* Top Tier Tag & XP */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${styles.badgeLabelBg}`}>
                    {badge.tier}
                  </span>
                  <span className="text-[11px] font-bold text-stone-500 group-hover:text-stone-800 transition">
                    +{badge.xpValue} XP
                  </span>
                </div>

                {/* Badge Icon & Content */}
                <div className="flex items-start space-x-3 mb-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${styles.iconBg}`}>
                    {getBadgeIcon(badge.iconName, 'w-6 h-6')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-stone-900 truncate group-hover:text-emerald-800 transition">
                      {badge.title}
                    </h4>
                    <p className="text-[10px] font-medium text-stone-500 truncate mt-0.5">
                      {badge.tagline}
                    </p>
                    <p className="text-[11px] text-stone-600 line-clamp-2 mt-1 leading-snug">
                      {badge.description}
                    </p>
                  </div>
                </div>

                {/* Progress / Status Bar */}
                <div className="mt-2 pt-2.5 border-t border-stone-100">
                  {badge.unlocked ? (
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Unlocked</span>
                      </div>
                      <span className="text-[10px] text-stone-500 font-medium">
                        {badge.unlockedAt ? new Date(badge.unlockedAt).toLocaleDateString() : 'Verified'}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-semibold text-stone-500 mb-1">
                        <span className="flex items-center space-x-1">
                          <Lock className="w-3 h-3 text-stone-400" />
                          <span>Progress</span>
                        </span>
                        <span>
                          {badge.currentMetric} / {badge.targetMetric} {badge.unit}
                        </span>
                      </div>
                      <div className="w-full bg-stone-200/80 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full"
                          style={{ width: `${badge.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state if filtered */}
        {filteredBadges.length === 0 && (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
            <Trophy className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-stone-700">No Badges Match Filter</h4>
            <p className="text-[11px] text-stone-500 mt-1">
              Try switching categories or unchecking "Unlocked Only" to view all available achievements.
            </p>
          </div>
        )}
      </div>

      {/* Interactive Badge Detail Modal */}
      {activeBadgeModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md ${getTierStyles(activeBadgeModal.tier, activeBadgeModal.unlocked).badgeLabelBg}`}>
                {activeBadgeModal.tier} Tier • {activeBadgeModal.category}
              </span>
              <button
                onClick={() => setActiveBadgeModal(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badge Hero Icon */}
            <div className="flex flex-col items-center text-center space-y-3 py-2">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-md relative ${getTierStyles(activeBadgeModal.tier, activeBadgeModal.unlocked).iconBg}`}>
                {getBadgeIcon(activeBadgeModal.iconName, 'w-10 h-10')}
                {activeBadgeModal.unlocked && (
                  <span className="absolute -bottom-1 -right-1 bg-white text-emerald-700 p-1 rounded-full shadow-xs border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 fill-emerald-100" />
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">{activeBadgeModal.title}</h3>
                <p className="text-xs font-semibold text-stone-500">{activeBadgeModal.tagline}</p>
              </div>
              <p className="text-xs text-stone-600 max-w-xs leading-relaxed">
                {activeBadgeModal.description}
              </p>
            </div>

            {/* Criteria Box */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-stone-700">
                <span className="font-semibold text-stone-500">Requirement:</span>
                <span className="font-bold text-stone-900">{activeBadgeModal.requirementDescription}</span>
              </div>
              <div className="flex items-center justify-between text-stone-700">
                <span className="font-semibold text-stone-500">XP Reward:</span>
                <span className="font-extrabold text-emerald-800">+{activeBadgeModal.xpValue} XP</span>
              </div>
              <div className="flex items-center justify-between text-stone-700">
                <span className="font-semibold text-stone-500">Current Status:</span>
                <span className={`font-bold ${activeBadgeModal.unlocked ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {activeBadgeModal.unlocked ? 'Unlocked & Verified' : `${activeBadgeModal.currentMetric} / ${activeBadgeModal.targetMetric} ${activeBadgeModal.unit} (${activeBadgeModal.progress}%)`}
                </span>
              </div>
              {activeBadgeModal.unlockedAt && (
                <div className="flex items-center justify-between text-stone-700 border-t border-stone-200/60 pt-2 text-[11px]">
                  <span className="text-stone-500">Earned Date:</span>
                  <span className="text-stone-700 font-medium">{new Date(activeBadgeModal.unlockedAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              {activeBadgeModal.unlocked ? (
                <button
                  onClick={() => {
                    triggerCelebration(activeBadgeModal);
                    setActiveBadgeModal(null);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-2xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Celebrate Achievement</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setActiveBadgeModal(null);
                    if (onNavigateToTab) {
                      if (activeBadgeModal.category === 'alignment' || activeBadgeModal.category === 'streak') {
                        onNavigateToTab('monitor');
                      } else if (activeBadgeModal.id === 'milestone_baseline') {
                        onNavigateToTab('calibrate');
                      } else {
                        onNavigateToTab('goals');
                      }
                    }
                  }}
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                >
                  <span>Work Toward Badge</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setActiveBadgeModal(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
