import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ==================== APP STATE INTERFACE ====================
interface AppState {
  // UI Settings
  theme: 'dark' | 'light';
  lang: 'ru' | 'en';
  
  // Filters
  metric: 'traffic' | 'conns';
  unit: 'gb' | 'mb';
  
  // Selected users (for filtering)
  selectedUsers: string[];
  
  // Chart library preference
  chartLibrary: string;
  
  // Usage mode
  usageMode: 'daily' | 'cumulative';
  usageDate: string;
  
  // Live settings
  livePeriod: number;
  liveGran: number;
  liveMetric: 'traffic' | 'conns';
  liveScope: 'global' | 'user';
  livePaused: boolean;
  
  // Actions
  setTheme: (theme: 'dark' | 'light') => void;
  setLang: (lang: 'ru' | 'en') => void;
  setMetric: (metric: 'traffic' | 'conns') => void;
  setUnit: (unit: 'gb' | 'mb') => void;
  setSelectedUsers: (users: string[]) => void;
  toggleUserSelection: (uuid: string) => void;
  setChartLibrary: (library: string) => void;
  setUsageMode: (mode: 'daily' | 'cumulative') => void;
  setUsageDate: (date: string) => void;
  setLivePeriod: (period: number) => void;
  setLiveGran: (gran: number) => void;
  setLiveMetric: (metric: 'traffic' | 'conns') => void;
  setLiveScope: (scope: 'global' | 'user') => void;
  setLivePaused: (paused: boolean) => void;
}

// ==================== ZUSTAND STORE ====================
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      theme: 'dark',
      lang: 'ru',
      metric: 'traffic',
      unit: 'gb',
      selectedUsers: [],
      chartLibrary: 'recharts',
      usageMode: 'daily',
      usageDate: '',
      livePeriod: 3600,
      liveGran: 300,
      liveMetric: 'conns',
      liveScope: 'global',
      livePaused: false,

      // Actions
      setTheme: (theme) => set({ theme }),
      
      setLang: (lang) => set({ lang }),
      
      setMetric: (metric) => set({ metric }),
      
      setUnit: (unit) => set({ unit }),
      
      setSelectedUsers: (users) => set({ selectedUsers: users }),
      
      toggleUserSelection: (uuid) =>
        set((state) => ({
          selectedUsers: state.selectedUsers.includes(uuid)
            ? state.selectedUsers.filter((u) => u !== uuid)
            : [...state.selectedUsers, uuid],
        })),
      
      setChartLibrary: (library) => set({ chartLibrary: library }),
      
      setUsageMode: (mode) => set({ usageMode: mode }),
      
      setUsageDate: (date) => set({ usageDate: date }),
      
      setLivePeriod: (period) => set({ livePeriod: period }),
      
      setLiveGran: (gran) => set({ liveGran: gran }),
      
      setLiveMetric: (metric) => set({ liveMetric: metric }),
      
      setLiveScope: (scope) => set({ liveScope: scope }),
      
      setLivePaused: (paused) => set({ livePaused: paused }),
    }),
    {
      name: 'xray-ui-storage', // localStorage key
      partialize: (state) => ({
        // Сохраняем только нужные поля
        theme: state.theme,
        lang: state.lang,
        metric: state.metric,
        unit: state.unit,
        chartLibrary: state.chartLibrary,
        usageMode: state.usageMode,
        livePeriod: state.livePeriod,
        liveGran: state.liveGran,
        liveMetric: state.liveMetric,
        liveScope: state.liveScope,
      }),
    }
  )
);
