import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { formatDate, getTodayDateStr, getYesterdayDateStr } from '../utils/date';

interface CustomDatePickerProps {
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (dateStr: string) => void;
  onClear: () => void;
  activePreset: 'all' | 'today' | 'yesterday' | 'week' | 'custom';
  onSelectPreset: (preset: 'all' | 'today' | 'yesterday' | 'week') => void;
  totalMatchesCount?: number;
  hasJobDates?: string[]; // Array of 'YYYY-MM-DD' dates with jobs to highlight
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  onClear,
  activePreset,
  onSelectPreset,
  hasJobDates = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize view year & month from selected date or current date
  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear() || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth() ?? new Date().getMonth());

  const todayStr = getTodayDateStr();
  const yesterdayStr = getYesterdayDateStr();

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  // When value changes from outside, sync view if valid
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const formatted = `${viewYear}-${monthStr}-${dayStr}`;
    onChange(formatted);
    setIsOpen(false);
  };

  // Compute days in month and layout padding
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  // Convert Sunday=0 to Monday=0 (Monday=0 ... Sunday=6)
  const startingCol = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  // Set of dates with jobs for quick dot indicator lookup
  const jobDatesSet = new Set(hasJobDates);

  const getDisplayText = () => {
    if (activePreset === 'today') return '今天';
    if (activePreset === 'yesterday') return '昨天';
    if (activePreset === 'week') return '近 7 天';
    if (activePreset === 'custom' && value) return value;
    return '全部日期';
  };

  return (
    <div className="flex flex-wrap items-center gap-2" ref={containerRef}>
      {/* Preset Pill Switches */}
      <div className="inline-flex items-center p-0.5 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs shadow-inner">
        <button
          type="button"
          onClick={() => {
            onSelectPreset('all');
            setIsOpen(false);
          }}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-medium ${
            activePreset === 'all'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700/60 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          全部
        </button>
        <button
          type="button"
          onClick={() => {
            onSelectPreset('today');
            setIsOpen(false);
          }}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-medium ${
            activePreset === 'today'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700/60 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          今天
        </button>
        <button
          type="button"
          onClick={() => {
            onSelectPreset('yesterday');
            setIsOpen(false);
          }}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-medium ${
            activePreset === 'yesterday'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700/60 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          昨天
        </button>
        <button
          type="button"
          onClick={() => {
            onSelectPreset('week');
            setIsOpen(false);
          }}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-medium ${
            activePreset === 'week'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700/60 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          近7天
        </button>
      </div>

      {/* Custom Date Trigger Button & Popover */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer shadow-xs ${
            activePreset === 'custom' && value
              ? 'bg-zinc-800/95 border-zinc-500 text-zinc-100 ring-1 ring-zinc-500/40'
              : 'bg-zinc-900/90 hover:bg-zinc-800/80 border-zinc-700/80 text-zinc-300 hover:text-zinc-100'
          }`}
        >
          <CalendarIcon className={`w-3.5 h-3.5 ${activePreset === 'custom' && value ? 'text-emerald-400' : 'text-zinc-400'}`} />
          <span className="font-medium">{activePreset === 'custom' && value ? value : '指定某一天'}</span>
          {activePreset === 'custom' && value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-0.5 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="清除指定日期"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </button>

        {/* Elegant Dark Calendar Dropdown */}
        {isOpen && (
          <div className="absolute left-0 mt-2 z-50 w-72 bg-[#16171b] border border-zinc-700/90 rounded-2xl shadow-2xl p-3.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 theme-dropdown-menu">
            {/* Header: Month / Year Navigation */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-800/90 px-1">
              <div className="flex items-center gap-1.5 font-sans font-semibold text-xs text-zinc-100">
                <CalendarDays className="w-4 h-4 text-emerald-500" />
                <span>{viewYear} 年 {MONTHS[viewMonth]}</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  title="上一月"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  title="下一月"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekdays row */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-medium text-zinc-400">
              {WEEKDAYS.map((wd, i) => (
                <div key={i} className="py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {/* Prev month padded days */}
              {Array.from({ length: startingCol }).map((_, i) => {
                const dayNum = prevMonthDays - startingCol + i + 1;
                return (
                  <div
                    key={`prev-${i}`}
                    className="h-8 flex items-center justify-center text-zinc-400 font-mono text-[11px] select-none opacity-40"
                  >
                    {dayNum}
                  </div>
                );
              })}

              {/* Current month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const monthStr = String(viewMonth + 1).padStart(2, '0');
                const dayStr = String(day).padStart(2, '0');
                const dateKey = `${viewYear}-${monthStr}-${dayStr}`;

                const isSelected = value === dateKey;
                const isToday = todayStr === dateKey;
                const isYesterday = yesterdayStr === dateKey;
                const hasJobs = jobDatesSet.has(dateKey);

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`h-8 rounded-lg flex flex-col items-center justify-center relative font-mono text-xs transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-950/50'
                        : isToday
                        ? 'bg-zinc-800/80 text-emerald-500 font-semibold border border-emerald-500/40 hover:bg-zinc-700'
                        : 'text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100'
                    }`}
                  >
                    <span>{day}</span>
                    {/* Dots indicator for days with records */}
                    {hasJobs && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
                    )}
                    {isSelected && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer with Quick Action buttons */}
            <div className="pt-3 mt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onChange(todayStr);
                    setIsOpen(false);
                  }}
                  className="px-2 py-1 text-[11px] text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                >
                  选中今天
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(yesterdayStr);
                    setIsOpen(false);
                  }}
                  className="px-2 py-1 text-[11px] text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                >
                  选中昨天
                </button>
              </div>

              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setIsOpen(false);
                  }}
                  className="text-[11px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-950/40 transition-colors cursor-pointer"
                >
                  清除
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
