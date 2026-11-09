import React from 'react';
import { Settings, X, Volume2, Bell, Sliders, RefreshCw, Check } from 'lucide-react';
import { NotificationPreferences, ThemeMode } from '../types';
import { Storage } from '../utils/storage';
import { audioService } from '../utils/audio';
import { ThemeToggle } from './ThemeToggle';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: NotificationPreferences;
  onPreferencesChange: (newPrefs: NotificationPreferences) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onPreferencesChange
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="settings-modal"
      className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in"
    >
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center">
              <Settings className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Workspace & Ergonomic Settings</h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">Configure visual themes, sound alerts, and detection sensitivity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="py-4 space-y-5 text-xs">
          {/* 1. Theme Appearance Section */}
          <div>
            <div className="mb-2">
              <label className="font-bold text-stone-900 dark:text-stone-100 block">Theme Appearance</label>
              <p className="text-stone-500 dark:text-stone-400 text-[11px]">
                Choose between Light, Dark, or System Default theme
              </p>
            </div>
            <ThemeToggle
              variant="cards"
              onThemeChange={(newTheme: ThemeMode) => {
                const updated = { ...preferences, theme: newTheme };
                onPreferencesChange(updated);
                Storage.savePreferences(updated);
              }}
            />
          </div>

          <div className="border-t border-stone-100 dark:border-stone-800 pt-4 space-y-4">
            {/* 2. Sound Feedback */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800">
              <div className="flex items-start space-x-2.5">
                <Volume2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-stone-800 dark:text-stone-200">Audio Chimes</p>
                  <p className="text-stone-500 dark:text-stone-400 text-[11px]">Soft harmonic audio reminders when poor posture persists</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.soundAlerts}
                onChange={(e) => {
                  const updated = { ...preferences, soundAlerts: e.target.checked };
                  onPreferencesChange(updated);
                  Storage.savePreferences(updated);
                  audioService.setMuted(!e.target.checked);
                }}
                className="rounded text-emerald-700 w-4 h-4 cursor-pointer"
              />
            </div>

            {/* 3. Break Reminders */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800">
              <div className="flex items-start space-x-2.5">
                <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-stone-800 dark:text-stone-200">Micro-Break Prompts</p>
                  <p className="text-stone-500 dark:text-stone-400 text-[11px]">Periodic alerts encouraging desk stretches every {preferences.breakReminderMinutes} mins</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.breakReminders}
                onChange={(e) => {
                  const updated = { ...preferences, breakReminders: e.target.checked };
                  onPreferencesChange(updated);
                  Storage.savePreferences(updated);
                }}
                className="rounded text-emerald-700 w-4 h-4 cursor-pointer"
              />
            </div>

            {/* 4. Sensitivity Threshold */}
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800 space-y-2">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <label className="font-bold text-stone-800 dark:text-stone-200">Posture Detection Sensitivity</label>
              </div>
              <select
                value={preferences.alertSensitivity}
                onChange={(e) => {
                  const updated = { ...preferences, alertSensitivity: e.target.value as 'low' | 'medium' | 'high' };
                  onPreferencesChange(updated);
                  Storage.savePreferences(updated);
                }}
                className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-emerald-700"
              >
                <option value="low">Low (Lenient - optimal for active/dynamic desks)</option>
                <option value="medium">Medium (Standard recommended balance)</option>
                <option value="high">High (Strict - immediate corrective feedback)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center">
          <span className="text-[11px] text-stone-400">Settings automatically saved</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-2xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
