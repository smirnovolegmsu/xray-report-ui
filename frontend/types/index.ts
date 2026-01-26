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
export interface ApiResponse<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

// Dashboard API Response Types
export interface DashboardApiResponse {
  ok: boolean;
  error?: string;
  global?: {
    daily_traffic_bytes?: number[];
    prev_daily_traffic_bytes?: number[];
    daily_conns?: number[];
    prev_daily_conns?: number[];
    cumulative_traffic_bytes?: number[];
    cumulative_conns?: number[];
    top_domains_traffic?: Array<{ domain: string; value: number }>;
    top_domains_conns?: Array<{ domain: string; value: number }>;
  };
  users?: Record<string, {
    uuid?: string;
    email?: string;
    alias?: string;
    anomaly?: boolean;
    sum7_traffic_bytes?: number;
    sum7_conns?: number;
    sum_prev7_traffic_bytes?: number;
    sum_prev7_conns?: number;
    daily_traffic_bytes?: number[];
    daily_conns?: number[];
    top_domains_traffic?: Array<{ domain: string; value: number; pct: number }>;
  }>;
  meta?: {
    days?: string[];
  };
}

export interface DatesApiResponse {
  dates: string[];
}

export interface LogsApiResponse {
  logs: string;
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

// ==================== SYSTEM TYPES ====================
export interface ServiceStatus {
  active: boolean;
  state: string;
  name?: string;
  uptime?: number;
  restart_count?: number;
  restart_count_14d?: number;
}

export interface NextjsStatus {
  active: boolean;
  state: string;
  port?: number;
  url?: string;
  status_code?: number;
  error?: string;
}

export interface SystemStatus {
  ui: ServiceStatus;
  xray: ServiceStatus;
  nextjs: NextjsStatus;
  restart_history?: Event[];
}

export interface SystemResources {
  cpu: number;
  ram: number;
  ram_total_gb: number;
  ram_used_gb: number;
}

export interface PortInfo {
  port: number;
  name: string;
  type: string;
  status: string;
  host: string;
  protocol?: string;
}

export interface PortsStatusResponse {
  ok: boolean;
  ports: PortInfo[];
  current: {
    port: number;
    host: string;
    url: string;
  };
  timestamp?: string;
}

// ==================== LIVE TYPES ====================
export interface LiveNowData {
  onlineUsers: string[];
  conns: number;
  trafficBytes: number;
}

export interface LiveNowResponse {
  ok: boolean;
  meta: {
    source: string;
    rollingWindowSec: number;
  };
  now: LiveNowData;
}

export interface LiveSeriesPoint {
  ts: number;
  value: number;
  users?: string[];
}

export interface LiveSeriesResponse {
  ok: boolean;
  series: LiveSeriesPoint[];
  meta: {
    metric: string;
    period: number;
    gran: number;
    scope: string;
  };
}

export interface LiveTopItem {
  user: string;
  value: number;
  pct?: number;
}

export interface LiveTopResponse {
  ok: boolean;
  top: LiveTopItem[];
  meta: {
    metric: string;
    period: number;
    scope: string;
  };
}

// ==================== USAGE TYPES ====================
export interface UsageDashboardResponse {
  ok: boolean;
  global?: {
    daily_traffic_bytes?: number[];
    prev_daily_traffic_bytes?: number[];
    daily_conns?: number[];
    prev_daily_conns?: number[];
    cumulative_traffic_bytes?: number[];
    cumulative_conns?: number[];
    top_domains_traffic?: Array<{ domain: string; value: number }>;
    top_domains_conns?: Array<{ domain: string; value: number }>;
  };
  users?: Record<string, any>;
  meta?: {
    days?: string[];
  };
}

// ==================== EVENTS TYPES ====================
export interface EventsStatsResponse {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  byType: Record<EventType, number>;
  recentCritical: Event[];
  timeline: EventsTimelinePoint[];
}

// ==================== COLLECTOR TYPES ====================
export interface CronJobStats {
  runs_count: number;
  last_run?: string;
  last_success?: string;
  last_error?: string;
  errors_count: number;
  created_files: string[];
  files_count: number;
  total_size_bytes?: number;
  date_range?: {
    oldest: string | null;
    newest: string | null;
  };
  log_entries?: string[];
}

export interface CronJobStatus {
  active: boolean;
  reason?: string;
}

export interface CronJob {
  schedule: string;
  command: string;
  script?: string;
  description?: string;
  stats?: CronJobStats;
  status?: CronJobStatus;
}

export interface CronInfo {
  found: boolean;
  schedule?: string;
  command?: string;
  file?: string;
  type?: string;
  jobs_count?: number;
  all_jobs?: CronJob[];
}

export interface CollectorStatus {
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  schedule?: string;
  status?: string;
  usage_dir?: string;
  files_count?: number;
  lag_days?: number | null;
  newest_file?: string | null;
  disabled_reason?: string;
  active_jobs_count?: number;
  total_jobs_count?: number;
  cron?: CronInfo;
}

// ==================== XRAY CONFIG TYPES ====================
export interface XrayConfig {
  log?: any;
  api?: any;
  routing?: any;
  policy?: any;
  inbounds?: any[];
  outbounds?: any[];
  stats?: any;
}

// ==================== BACKUP TYPES ====================
export interface Backup {
  name: string;
  size: number;
  mtime: string;
}

export interface BackupPreview {
  users_count: number;
  ports: number[];
  protocols: string[];
  inbounds_count: number;
}

export interface BackupUser {
  id: string;
  email: string;
  alias?: string;
  flow?: string;
}

export interface BackupInbound {
  protocol: string;
  port: number;
  tag: string;
  listen: string;
  users: BackupUser[];
}

export interface BackupDetail {
  users: BackupUser[];
  inbounds: BackupInbound[];
  ports: number[];
  protocols: string[];
}

export interface BackupContent {
  content: any;
}

export interface BackupCreateResponse {
  backup: Backup;
  message: string;
}

export interface BackupRestorePreview {
  preview: true;
  current: {
    users_count: number;
    config_exists: boolean;
  };
  backup: {
    users_count: number;
    inbounds_count: number;
  };
  warning: string;
}

export interface BackupRestoreResult {
  restored: true;
  backup_name: string;
  pre_restore_backup: string | null;
  restart_result: {
    ok: boolean;
    message: string;
  } | null;
  message: string;
}

export interface CollectorToggleResponse {
  enabled: boolean;
  cron_modified: boolean;
  jobs_modified: number;
  message: string;
}

export interface CollectorRunResponse {
  success: boolean;
  scripts_run: number;
  scripts_failed: string[];
  return_code: number;
  output: string;
  message: string;
}

export interface VersionResponse {
  version: string;
  name: string;
  components: {
    backend: string;
    api: string;
  };
}
