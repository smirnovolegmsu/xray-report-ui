import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function handleApiError(error: any): string {
  // Support both 'error' and 'message' fields from backend
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @param options - Formatting options
 * @returns Formatted string or object with value and unit
 */
export function formatBytes(
  bytes: number,
  options: {
    returnObject?: boolean;
    decimals?: number;
    compact?: boolean; // For GB/MB only format
  } = {}
): string | { value: string; unit: string } {
  const { returnObject = false, decimals = 2, compact = false } = options;

  if (bytes === 0) {
    return returnObject ? { value: '0', unit: 'B' } : '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  
  // Compact mode: only GB or MB
  if (compact) {
    const gb = bytes / k / k / k;
    if (gb >= 1) {
      const value = gb.toFixed(1);
      return returnObject 
        ? { value: value.replace(/\.0$/, ''), unit: 'GB' }
        : `${value.replace(/\.0$/, '')} GB`;
    }
    const mb = bytes / k / k;
    const value = Math.round(mb).toString();
    return returnObject 
      ? { value, unit: 'MB' }
      : `${value} MB`;
  }

  // Standard mode: auto-select appropriate unit
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const numValue = bytes / Math.pow(k, i);
  
  let value: string;
  if (decimals === 0) {
    value = Math.round(numValue).toString();
  } else {
    value = numValue.toFixed(decimals);
    // Remove trailing zeros
    value = value.replace(/\.0+$/, '') || value;
  }

  if (returnObject) {
    return { value, unit: sizes[i] };
  }
  
  return `${value} ${sizes[i]}`;
}

/**
 * Calculate percentage change between two values
 * @param current - Current value
 * @param previous - Previous value
 * @returns Percentage change or null if previous is 0
 */
export function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Format percentage change for display
 * @param change - Percentage change value
 * @returns Formatted string
 */
export function formatChange(change: number): string {
  const absChange = Math.abs(change);
  if (absChange >= 10) {
    return Math.round(absChange).toString();
  }
  return absChange.toFixed(1);
}

/**
 * Development-only logger
 * Replaces console.log/error in production
 */
export const devLog = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(...args);
    }
  },
  warn: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args);
    }
  },
};
