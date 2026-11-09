import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  Clock,
  TrendingUp,
  Award,
  CheckCircle2,
  Calendar,
  Sparkles,
  Info,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Activity
} from 'lucide-react';
import { PostureSession } from '../types';

interface WeeklySummaryWidgetProps {
  sessions: PostureSession[];
  onStartMonitoring?: () => void;
  onNavigateToGoals?: () => void;
  isNewUser?: boolean;
}

interface DayData {
  day: string;
  fullDate: string;
  shortDate: string;
  score: number;
  goodSeconds: number;
  goodMinutes: number;
  goodHours: number;
  totalSeconds: number;
  sessionCount: number;
  alertCount: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'empty';
  hasData: boolean;
}

export const WeeklySummaryWidget: React.FC<WeeklySummaryWidgetProps> = ({
  sessions,
  onStartMonitoring,
  onNavigateToGoals,
  isNewUser = false
}) => {
  const [chartMetric, setChartMetric] = useState<'score' | 'time'>('score');
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  // Process sessions for the current 7-day period
  const weeklyData = useMemo(() => {
    // Current date reference
    const now = new Date();
    
    // Generate the last 7 calendar days ending today
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days: DayData[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayName = dayNames[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];
      const shortDate = `${d.getMonth() + 1}/${d.getDate()}`;

      // Find sessions belonging to this date (comparing YYYY-MM-DD in local time)
      const daySessions = sessions.filter((s) => {
        try {
          const sDate = new Date(s.startTime);
          const sDateStr = sDate.toISOString().split('T')[0];
          // Also match local date string
          const localMatch = 
            sDate.getFullYear() === d.getFullYear() &&
            sDate.getMonth() === d.getMonth() &&
            sDate.getDate() === d.getDate();
          return sDateStr === dateStr || localMatch;
        } catch {
          return false;
        }
      });

      if (daySessions.length > 0) {
        const totalDuration = daySessions.reduce((acc, s) => acc + s.durationSeconds, 0);
        const totalScoreWeight = daySessions.reduce((acc, s) => acc + (s.averageScore * s.durationSeconds), 0);
        const avgScore = totalDuration > 0 ? Math.round(totalScoreWeight / totalDuration) : Math.round(daySessions.reduce((acc, s) => acc + s.averageScore, 0) / daySessions.length);
        const goodSecs = daySessions.reduce((acc, s) => acc + s.goodSeconds, 0);
        const alerts = daySessions.reduce((acc, s) => acc + s.alertCount, 0);

        let status: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
        if (avgScore >= 90) status = 'excellent';
        else if (avgScore >= 80) status = 'good';
        else if (avgScore >= 70) status = 'fair';
        else status = 'poor';

        days.push({
          day: dayName,
          fullDate: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
          shortDate,
          score: avgScore,
          goodSeconds: goodSecs,
          goodMinutes: Math.round(goodSecs / 60),
          goodHours: +(goodSecs / 3600).toFixed(1),
          totalSeconds: totalDuration,
          sessionCount: daySessions.length,
          alertCount: alerts,
          status,
          hasData: true
        });
      } else {
        // If user is brand new or no sessions on this day
        // If user has NO sessions at all, provide a baseline guidance score
        days.push({
          day: dayName,
          fullDate: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
          shortDate,
          score: 0,
          goodSeconds: 0,
          goodMinutes: 0,
          goodHours: 0,
          totalSeconds: 0,
          sessionCount: 0,
          alertCount: 0,
          status: 'empty',
          hasData: false
        });
      }
    }

    return days;
  }, [sessions]);

  // Aggregate Weekly Metrics
  const summaryMetrics = useMemo(() => {
    const activeDays = weeklyData.filter((d) => d.hasData);
    const totalGoodSeconds = activeDays.reduce((acc, d) => acc + d.goodSeconds, 0);
    const totalMonitoredSeconds = activeDays.reduce((acc, d) => acc + d.totalSeconds, 0);
    const totalSessions = activeDays.reduce((acc, d) => acc + d.sessionCount, 0);
    const totalAlerts = activeDays.reduce((acc, d) => acc + d.alertCount, 0);

    // Format Total Time in Good Posture
    const hours = Math.floor(totalGoodSeconds / 3600);
    const minutes = Math.floor((totalGoodSeconds % 3600) / 60);
    const formattedGoodTime = totalGoodSeconds > 0
      ? hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`
      : '0m';

    // Weighted average weekly score
    const weeklyAvgScore = activeDays.length > 0 && totalMonitoredSeconds > 0
      ? Math.round(activeDays.reduce((acc, d) => acc + (d.score * d.totalSeconds), 0) / totalMonitoredSeconds)
      : activeDays.length > 0
        ? Math.round(activeDays.reduce((acc, d) => acc + d.score, 0) / activeDays.length)
        : 0;

    // Good posture proportion
    const goodRatioPercent = totalMonitoredSeconds > 0
      ? Math.round((totalGoodSeconds / totalMonitoredSeconds) * 100)
      : 0;

    // Best day
    const bestDay = activeDays.length > 0
      ? [...activeDays].sort((a, b) => b.score - a.score)[0]
      : null;

    // Weekly Target (e.g. 10 hours of good posture)
    const weeklyTargetSeconds = 10 * 3600; // 10 hours
    const targetProgressPercent = Math.min(100, Math.round((totalGoodSeconds / weeklyTargetSeconds) * 100));

    return {
      totalGoodSeconds,
      formattedGoodTime,
      weeklyAvgScore,
      goodRatioPercent,
      totalSessions,
      totalAlerts,
      bestDay,
      targetProgressPercent,
      activeDaysCount: activeDays.length
    };
  }, [weeklyData]);

  // Custom Recharts Tooltip
  const CustomWeeklyTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data: DayData = payload[0].payload;

    if (!data.hasData) {
      return (
        <div className="bg-stone-900 text-white text-xs p-3 rounded-xl shadow-xl border border-stone-800 space-y-1">
          <p className="font-bold text-stone-200">{data.fullDate}</p>
          <p className="text-stone-400 text-[11px]">No monitoring sessions recorded</p>
        </div>
      );
    }

    const hours = Math.floor(data.goodSeconds / 3600);
    const mins = Math.floor((data.goodSeconds % 3600) / 60);
    const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return (
      <div className="bg-stone-900 text-white text-xs p-3.5 rounded-2xl shadow-xl border border-stone-700 space-y-2 min-w-[180px]">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2">
          <span className="font-bold text-stone-200">{data.fullDate}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            data.score >= 90 ? 'bg-emerald-900 text-emerald-300 border border-emerald-700' :
            data.score >= 80 ? 'bg-teal-900 text-teal-300 border border-teal-700' :
            data.score >= 70 ? 'bg-amber-900 text-amber-300 border border-amber-700' :
            'bg-rose-900 text-rose-300 border border-rose-700'
          }`}>
            {data.score >= 90 ? 'Excellent' : data.score >= 80 ? 'Good' : data.score >= 70 ? 'Fair' : 'Needs Focus'}
          </span>
        </div>

        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-stone-300">
            <span>Average Alignment:</span>
            <span className="font-bold text-white text-sm">{data.score}%</span>
          </div>

          <div className="flex items-center justify-between text-stone-300">
            <span>Time in Good Posture:</span>
            <span className="font-bold text-emerald-400">{timeFormatted}</span>
          </div>

          <div className="flex items-center justify-between text-stone-400 text-[11px]">
            <span>Sessions / Alerts:</span>
            <span>{data.sessionCount} ses • {data.alertCount} alerts</span>
          </div>
        </div>
      </div>
    );
  };

  // Color generator for chart bars
  const getBarColor = (item: DayData, isHovered: boolean) => {
    if (!item.hasData) return '#e7e5e4'; // stone-200
    if (chartMetric === 'score') {
      if (item.score >= 90) return isHovered ? '#047857' : '#059669'; // emerald-700 : emerald-600
      if (item.score >= 80) return isHovered ? '#0f766e' : '#0d9488'; // teal-700 : teal-600
      if (item.score >= 70) return isHovered ? '#d97706' : '#f59e0b'; // amber-600 : amber-500
      return isHovered ? '#e11d48' : '#f43f5e'; // rose-600 : rose-500
    } else {
      // Time metric coloring
      if (item.goodHours >= 2) return isHovered ? '#047857' : '#059669';
      if (item.goodHours >= 1) return isHovered ? '#0f766e' : '#0d9488';
      return isHovered ? '#0284c7' : '#0ea5e9'; // sky-600 : sky-500
    }
  };

  return (
    <div id="weekly-summary-widget" className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs overflow-hidden">
      {/* Header Bar */}
      <div className="p-6 pb-4 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
              <Calendar className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-stone-900">Weekly Summary</h3>
            <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200/60">
              Last 7 Days
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Real-time biometric posture alignment telemetry and cumulative spine health metrics
          </p>
        </div>

        {/* View mode toggle button */}
        <div className="flex items-center space-x-2 self-start md:self-auto">
          <div className="bg-stone-100 p-1 rounded-xl flex items-center space-x-1 border border-stone-200/60 text-xs">
            <button
              onClick={() => setChartMetric('score')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                chartMetric === 'score'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Alignment Score (%)
            </button>
            <button
              onClick={() => setChartMetric('time')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                chartMetric === 'time'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Good Posture Time (hrs)
            </button>
          </div>
        </div>
      </div>

      {/* Hero Metrics Row featuring "Time in Good Posture" */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-100 bg-stone-50/50 border-b border-stone-100">
        {/* Metric 1: PRIMARY USER REQUIREMENT - Total Time in Good Posture */}
        <div className="p-5 flex flex-col justify-between bg-gradient-to-br from-emerald-50/60 to-transparent">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-1.5">
              <span className="flex items-center space-x-1.5 text-emerald-950 font-bold">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Time in Good Posture</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                Weekly Total
              </span>
            </div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-3xl font-extrabold text-stone-900 tracking-tight">
                {isNewUser ? '0m' : summaryMetrics.formattedGoodTime}
              </span>
              <span className="text-xs font-medium text-emerald-700">
                {isNewUser ? 'Awaiting session' : `${summaryMetrics.goodRatioPercent}% of sitting`}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
              <span>Goal: 10h / week</span>
              <span className="font-semibold text-stone-700">{summaryMetrics.targetProgressPercent}%</span>
            </div>
            <div className="w-full bg-stone-200/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${isNewUser ? 0 : summaryMetrics.targetProgressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Metric 2: Average Posture Alignment Score */}
        <div className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-1.5">
              <span className="flex items-center space-x-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                <span>Weekly Average Score</span>
              </span>
              <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                Spinal Alignment
              </span>
            </div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-3xl font-extrabold text-stone-900 tracking-tight">
                {isNewUser || summaryMetrics.weeklyAvgScore === 0 ? '—' : `${summaryMetrics.weeklyAvgScore}%`}
              </span>
              <span className="text-xs font-medium text-stone-500">
                {summaryMetrics.weeklyAvgScore >= 85
                  ? 'Optimal Ergonomics'
                  : summaryMetrics.weeklyAvgScore > 0
                  ? 'Active Monitoring'
                  : 'Start Monitoring'}
              </span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-stone-500 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="truncate">
              Target: &gt;85% neutral cervical angle
            </span>
          </div>
        </div>

        {/* Metric 3: Best Day & Consistency */}
        <div className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-1.5">
              <span className="flex items-center space-x-1.5">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>Peak Alignment Day</span>
              </span>
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                Personal Best
              </span>
            </div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-stone-900 truncate">
                {summaryMetrics.bestDay ? summaryMetrics.bestDay.day : '—'}
              </span>
              {summaryMetrics.bestDay && (
                <span className="text-xs font-bold text-emerald-700">
                  {summaryMetrics.bestDay.score}% score
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 text-[11px] text-stone-500 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="truncate">
              {summaryMetrics.activeDaysCount} of 7 days logged
            </span>
          </div>
        </div>

        {/* Metric 4: Total Sessions & Alerts */}
        <div className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-1.5">
              <span className="flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-600" />
                <span>Tracked Sessions</span>
              </span>
              <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                Telemetry
              </span>
            </div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-3xl font-extrabold text-stone-900 tracking-tight">
                {isNewUser ? '0' : summaryMetrics.totalSessions}
              </span>
              <span className="text-xs font-medium text-stone-500">
                {summaryMetrics.totalAlerts} alerts handled
              </span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-stone-500 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Zero-cloud on-device CV processing</span>
          </div>
        </div>
      </div>

      {/* Main Recharts Section */}
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center space-x-3">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
              {chartMetric === 'score'
                ? 'Daily Posture Alignment Scores'
                : 'Daily Time in Good Posture (Hours)'}
            </h4>
            <div className="flex items-center space-x-2 text-[11px] text-stone-500">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <span>&gt;90% Optimal</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                <span>80-89% Good</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>70-79% Fair</span>
              </span>
            </div>
          </div>

          <div className="text-[11px] text-stone-500 flex items-center space-x-1">
            <Info className="w-3.5 h-3.5 text-stone-400" />
            <span>Hover bars for detailed ergonomic drilldown</span>
          </div>
        </div>

        {/* Recharts Bar Chart Container */}
        <div className="w-full h-64 relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeklyData}
              margin={{ top: 20, right: 12, left: -16, bottom: 0 }}
              onMouseMove={(state: any) => {
                if (state && state.activePayload && state.activePayload[0]) {
                  setHoveredDay(state.activePayload[0].payload.day);
                }
              }}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0eee9" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#78716c', fontSize: 12, fontWeight: 500 }}
                axisLine={{ stroke: '#e7e5e4' }}
                tickLine={false}
              />
              <YAxis
                domain={chartMetric === 'score' ? [0, 100] : [0, 'auto']}
                ticks={chartMetric === 'score' ? [0, 25, 50, 75, 100] : undefined}
                tick={{ fill: '#78716c', fontSize: 11 }}
                axisLine={{ stroke: '#e7e5e4' }}
                tickLine={false}
                unit={chartMetric === 'score' ? '%' : 'h'}
              />
              <Tooltip content={<CustomWeeklyTooltip />} cursor={{ fill: 'rgba(245, 245, 244, 0.7)' }} />
              {chartMetric === 'score' && (
                <ReferenceLine
                  y={85}
                  stroke="#059669"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Ergonomic Target (85%)',
                    position: 'insideTopRight',
                    fill: '#059669',
                    fontSize: 10,
                    fontWeight: 700
                  }}
                />
              )}
              <Bar
                dataKey={chartMetric === 'score' ? 'score' : 'goodHours'}
                radius={[8, 8, 0, 0]}
                maxBarSize={44}
              >
                {weeklyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(entry, hoveredDay === entry.day)}
                    className="transition-colors duration-200 cursor-pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom Legend and Action Footer */}
        <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              {summaryMetrics.activeDaysCount > 0
                ? `Accumulated ${summaryMetrics.formattedGoodTime} of verified healthy spine alignment this week.`
                : 'Complete your first live monitoring session to populate your weekly trend.'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {onNavigateToGoals && (
              <button
                onClick={onNavigateToGoals}
                className="font-semibold text-emerald-800 hover:text-emerald-950 flex items-center space-x-1"
              >
                <span>Ergonomic Goals</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onStartMonitoring && (
              <button
                onClick={onStartMonitoring}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition flex items-center space-x-1.5 shadow-2xs"
              >
                <Sparkles className="w-3 h-3" />
                <span>Launch Session</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
