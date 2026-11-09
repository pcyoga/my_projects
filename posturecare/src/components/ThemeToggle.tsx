import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Storage } from '../utils/storage';
import { ThemeMode } from '../types';

interface ThemeToggleProps {
  className?: string;
  variant?: 'segmented' | 'compact' | 'cards';
  onThemeChange?: (theme: ThemeMode) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  variant = 'segmented',
  onThemeChange
}) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => Storage.getTheme());

  useEffect(() => {
    // Sync state and apply initial theme
    Storage.applyTheme(currentTheme);

    // Listen for OS theme changes when in 'system' mode
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        if (Storage.getTheme() === 'system') {
          Storage.applyTheme('system');
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [currentTheme]);

  const handleSelectTheme = (newTheme: ThemeMode) => {
    setCurrentTheme(newTheme);
    Storage.setTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  // 1. CARDS VARIANT (For Settings Modal)
  if (variant === 'cards') {
    const options: { id: ThemeMode; label: string; desc: string; icon: React.FC<{ className?: string }> }[] = [
      {
        id: 'light',
        label: 'Light Mode',
        desc: 'Clean ivory workspace for daylight sessions',
        icon: Sun
      },
      {
        id: 'dark',
        label: 'Dark Mode',
        desc: 'Low-contrast obsidian theme for reduced eye strain',
        icon: Moon
      },
      {
        id: 'system',
        label: 'System Default',
        desc: 'Automatically adapts to your device theme',
        icon: Monitor
      }
    ];

    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = currentTheme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectTheme(opt.id)}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-600/30 shadow-2xs'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isSelected
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-xs text-stone-900 dark:text-stone-100">{opt.label}</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">{opt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // 2. COMPACT ICON CYCLE VARIANT
  if (variant === 'compact') {
    const cycleTheme = () => {
      const order: ThemeMode[] = ['light', 'dark', 'system'];
      const nextIndex = (order.indexOf(currentTheme) + 1) % order.length;
      handleSelectTheme(order[nextIndex]);
    };

    const getIcon = () => {
      if (currentTheme === 'light') return <Sun className="w-4 h-4 text-amber-500" />;
      if (currentTheme === 'dark') return <Moon className="w-4 h-4 text-indigo-400" />;
      return <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    };

    return (
      <button
        type="button"
        onClick={cycleTheme}
        className={`p-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 transition shadow-2xs flex items-center justify-center text-xs ${className}`}
        title={`Current: ${currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)} Mode (Click to toggle)`}
      >
        {getIcon()}
      </button>
    );
  }

  // 3. SEGMENTED SWITCH VARIANT (Default: Sun / Monitor / Moon)
  return (
    <div
      className={`inline-flex items-center p-1 bg-stone-100 dark:bg-stone-800/80 rounded-xl border border-stone-200/80 dark:border-stone-700/80 ${className}`}
      role="group"
      aria-label="Theme selection"
    >
      <button
        type="button"
        id="theme-btn-light"
        onClick={() => handleSelectTheme('light')}
        className={`p-1.5 px-2 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
          currentTheme === 'light'
            ? 'bg-white text-stone-900 shadow-2xs font-bold'
            : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
        }`}
        title="Light Mode"
      >
        <Sun className="w-3.5 h-3.5 text-amber-600" />
        <span className="hidden sm:inline text-[11px]">Light</span>
      </button>

      <button
        type="button"
        id="theme-btn-system"
        onClick={() => handleSelectTheme('system')}
        className={`p-1.5 px-2 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
          currentTheme === 'system'
            ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
            : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
        }`}
        title="System Default"
      >
        <Monitor className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
        <span className="hidden sm:inline text-[11px]">System</span>
      </button>

      <button
        type="button"
        id="theme-btn-dark"
        onClick={() => handleSelectTheme('dark')}
        className={`p-1.5 px-2 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
          currentTheme === 'dark'
            ? 'bg-stone-900 text-stone-100 shadow-2xs font-bold'
            : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
        }`}
        title="Dark Mode"
      >
        <Moon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
        <span className="hidden sm:inline text-[11px]">Dark</span>
      </button>
    </div>
  );
};
