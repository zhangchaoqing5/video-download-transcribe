import { ThemeMode, ThemeOption } from '../types';

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'midnight',
    name: '午夜深蓝',
    desc: '深邃夜空靛青，沉浸护眼暗色',
    previewClass: 'bg-[#0b1120] border-sky-800/60 text-sky-300',
    iconName: 'sparkles',
  },
  {
    id: 'light',
    name: '明亮清爽',
    desc: '纯白高对比度，清晰明朗浅色',
    previewClass: 'bg-[#ffffff] border-slate-300 text-slate-900',
    iconName: 'sun',
  },
];

const STORAGE_KEY = 'video_transcribe_theme';

export function getSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'midnight') {
      return saved;
    }
  } catch {}
  return 'midnight';
}

export function applyTheme(theme: ThemeMode) {
  try {
    const activeTheme = theme === 'light' ? 'light' : 'midnight';
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.body.setAttribute('data-theme', activeTheme);
    localStorage.setItem(STORAGE_KEY, activeTheme);
  } catch {}
}
