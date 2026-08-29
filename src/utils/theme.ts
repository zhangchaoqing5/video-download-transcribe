import { ThemeMode, ThemeOption } from '../types';

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'dark',
    name: '暗夜极客',
    desc: '经典深灰黑曜石，沉浸专注',
    previewClass: 'bg-[#090a0c] border-zinc-700 text-zinc-100',
    iconName: 'moon',
  },
  {
    id: 'light',
    name: '明亮清爽',
    desc: '纯白高对比度，强光不费眼',
    previewClass: 'bg-[#f4f6f9] border-slate-300 text-slate-900',
    iconName: 'sun',
  },
  {
    id: 'midnight',
    name: '午夜深蓝',
    desc: '深邃夜空靛青，柔和深色护眼',
    previewClass: 'bg-[#0b0f19] border-indigo-900/60 text-indigo-100',
    iconName: 'sparkles',
  },
  {
    id: 'warm',
    name: '暖阳纸感',
    desc: '温润米黄纸质感，温和不刺目',
    previewClass: 'bg-[#f7f5f0] border-[#d8d0be] text-[#2c2621]',
    iconName: 'coffee',
  },
];

const STORAGE_KEY = 'video_transcribe_theme';

export function getSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'midnight' || saved === 'warm') {
      return saved;
    }
  } catch {}
  return 'dark';
}

export function applyTheme(theme: ThemeMode) {
  try {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
}
