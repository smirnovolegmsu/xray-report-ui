// ==================== USER TYPES ====================
export interface User {
  uuid: string;
  email: string;
  enabled: boolean;
  subId?: string;
  flow?: string;
  alias?: string;
}

export interface UserStats {
  email: string;
  alias?: string;
  uuid: string;
  totalTrafficBytes: number;
  daysUsed: number;
  isOnline: boolean;
  top3Domains: Array<{
    domain: string;
    trafficBytes: number;
  }>;
}

// ==================== SETTINGS TYPES ====================
export interface Settings {
  version: number;
  ui: {
    theme: 'dark' | 'light';
    lang: 'ru' | 'en';
    realtime_mode: 'live' | 'eco';
    eco_poll_sec: number;
    live_push_sec: number;
  };
  xray: {
    service_name: string;
    config_path: string;
    inbound_tag: string;
    server_host: string;
    server_port: number;
    sni: string;
    fp: string;
    flow: string;
    reality_pbk: string;
  };
  collector: {
    usage_dir: string;
    enabled: boolean;
  };
}

// ==================== DASHBOARD TYPES ====================
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalTraffic: number;
  totalConnections: number;
}

export interface ChartDataPoint {
  date: string;
  traffic: number;
  connections: number;
}

export interface TopDomain {
  domain: string;
  traffic: number;
  connections: number;
}

export interface Dashboard {
  stats: DashboardStats;
  chartData: ChartDataPoint[];
  topDomains: TopDomain[];
  users: User[];
}

// ==================== ONLINE/LIVE TYPES ====================
export interface LiveConnection {
  user: string;
  ip: string;
  duration: number;
  traffic: number;
}

export interface LiveData {
  connections: LiveConnection[];
  totalActive: number;
}

// ==================== API RESPONSE TYPES ====================
export interface ApiResponse<T = any> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface UserLink {
  link: string;
  qr?: string;
}

// ==================== EVENT TYPES ====================
export interface Event {
  ts: string;
  type: 'USER' | 'SYSTEM' | 'SETTINGS' | 'XRAY' | 'UNKNOWN';
  action: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  user?: string;
  email?: string;
  userId?: string;
  target?: string;
  message?: string;
  details?: string;
}
