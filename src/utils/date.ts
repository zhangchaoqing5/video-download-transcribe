/**
 * Date & Time Formatting Utilities for Tasks and Logs
 */

export function formatDate(isoStr?: string): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '-';
  }
}

export function formatDateTime(isoStr?: string): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return '-';
  }
}

export function formatTimeOnly(isoStr?: string): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  } catch {
    return '-';
  }
}

export function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso) return '-';
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    if (isNaN(start) || (endIso && isNaN(end))) return '-';

    const diffMs = Math.max(0, end - start);
    const diffSec = diffMs / 1000;

    if (diffSec < 60) {
      return `${diffSec.toFixed(1)} 秒`;
    }
    const minutes = Math.floor(diffSec / 60);
    const remainingSec = Math.floor(diffSec % 60);
    if (minutes < 60) {
      return `${minutes} 分 ${remainingSec} 秒`;
    }
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours} 小时 ${remMin} 分 ${remainingSec} 秒`;
  } catch {
    return '-';
  }
}

export function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateWithinDays(isoStr: string, days: number): boolean {
  if (!isoStr) return false;
  try {
    const d = new Date(isoStr).getTime();
    if (isNaN(d)) return false;
    const now = Date.now();
    const rangeMs = days * 24 * 60 * 60 * 1000;
    return now - d <= rangeMs && d <= now + 60000;
  } catch {
    return false;
  }
}
