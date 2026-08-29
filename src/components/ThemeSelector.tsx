import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Sparkles, Coffee, Check, Palette } from 'lucide-react';
import { ThemeMode } from '../types';
import { THEME_OPTIONS } from '../utils/theme';

interface ThemeSelectorProps {
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getThemeIcon = (iconName: string, className: string = 'w-3.5 h-3.5') => {
    switch (iconName) {
      case 'sun':
        return <Sun className={className} />;
      case 'sparkles':
        return <Sparkles className={className} />;
      case 'coffee':
        return <Coffee className={className} />;
      case 'moon':
      default:
        return <Moon className={className} />;
    }
  };

  const activeOption = THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-700/70 text-zinc-200 transition-all shadow-xs cursor-pointer theme-trigger-btn"
        title={`切换主题风格 (当前: ${activeOption.name})`}
      >
        <Palette className="w-3.5 h-3.5 text-zinc-400 theme-icon" />
        <span className="hidden sm:inline text-zinc-300 font-sans">{activeOption.name}</span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 w-64 bg-[#16171b] border border-zinc-700/90 rounded-2xl shadow-2xl p-2.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 theme-dropdown-menu">
          <div className="px-2 py-1.5 mb-1 border-b border-zinc-800/80 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              界面主题风格
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">4 种配色</span>
          </div>

          <div className="space-y-1">
            {THEME_OPTIONS.map((option) => {
              const isSelected = option.id === currentTheme;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onThemeChange(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600 shadow-xs'
                      : 'hover:bg-zinc-800/60 text-zinc-300 hover:text-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Theme color preview square */}
                    <div
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center shadow-xs ${option.previewClass}`}
                    >
                      {getThemeIcon(option.iconName, 'w-3 h-3')}
                    </div>
                    <div>
                      <div className="text-xs font-semibold leading-none mb-0.5">
                        {option.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 leading-none font-sans">
                        {option.desc}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
