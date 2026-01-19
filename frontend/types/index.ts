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
  firstSeenAt?: string; // ISO timestamp of first connection
  lastSeenAt?: string; // ISO timestamp of last activity
  top3Domains: Array<{
    domain: string;
    trafficBytes: number;
  }>;
}

export type UserFilter = 'all' | 'active' | 'low-activity' | 'online';

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
export type EventType = 
  | 'USER'           // User management events (add, delete, kick, update)
  | 'SYSTEM'         // System events (startup, shutdown, restart)
  | 'SETTINGS'       // Settings changes
  | 'XRAY'           // Xray service events
  | 'CONNECTION'     // User connection link generation (renamed from LINK)
  | 'COLLECTOR'      // Data collector events
  | 'SERVICE_HEALTH' // Service health monitoring (ports, availability)
  | 'APP_ERROR'      // Application errors and exceptions
  | 'PERFORMANCE'    // Performance warnings (slow responses, high load)
  | 'UPDATE'         // Software updates and version checks
  | 'UNKNOWN';       // Unknown event type

export type EventSeverity = 'INFO' | 'WARN' | 'ERROR';

export interface Event {
  ts: string;
  type: EventType;
  action: string;
  severity: EventSeverity;
  user?: string;
  email?: string;
  userId?: string;
  target?: string;
  service?: string;
  port?: number;
  error?: string;
  message?: string;
  details?: string;
  duration_ms?: number;
  downtime_sec?: number;
  endpoint?: string;
  current?: string;
  latest?: string;
  version?: string;
  enabled?: boolean;
  result?: string;
  alias?: string;
}

export interface EventsStats {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  byType: Record<EventType, number>;
  recentCritical: Event[];
}

export interface EventsTimelinePoint {
  timestamp: number;
  count: number;
  errors: number;
  warnings: number;
}
