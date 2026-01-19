import { 
  UserPlus, 
  UserMinus, 
  Power, 
  Settings, 
  Zap, 
  AlertCircle,
  FileText,
  Link2,
  Activity,
  Bug,
  Gauge,
  Download,
  Database,
  Server,
  PlayCircle,
  XCircle,
  Shield
} from 'lucide-react';

interface EventIconProps {
  type: string;
  action: string;
}

export function EventIcon({ type, action }: EventIconProps) {
  // USER events
  if (type === 'USER') {
    if (action.includes('add')) {
      return <UserPlus className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (action.includes('delete')) {
      return <UserMinus className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (action.includes('kick')) {
      return <Power className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  }
  
  // SYSTEM events
  if (type === 'SYSTEM') {
    if (action.includes('startup')) {
      return <PlayCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (action.includes('shutdown')) {
      return <XCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    if (action.includes('restart')) {
      return <Power className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    return <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
  }
  
  // SETTINGS events
  if (type === 'SETTINGS') {
    return <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  }
  
  // XRAY events
  if (type === 'XRAY') {
    return <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
  }
  
  // CONNECTION events (renamed from LINK)
  if (type === 'CONNECTION') {
    if (action.includes('failed')) {
      return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    return <Link2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
  }
  
  // COLLECTOR events
  if (type === 'COLLECTOR') {
    return <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
  }
  
  // SERVICE_HEALTH events
  if (type === 'SERVICE_HEALTH') {
    if (action.includes('down')) {
      return <Server className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (action.includes('up')) {
      return <Server className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    return <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  }
  
  // APP_ERROR events
  if (type === 'APP_ERROR') {
    return <Bug className="w-4 h-4 text-red-600 dark:text-red-400" />;
  }
  
  // PERFORMANCE events
  if (type === 'PERFORMANCE') {
    return <Gauge className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
  }
  
  // UPDATE events
  if (type === 'UPDATE') {
    return <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  }
  
  // Unknown/fallback
  return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
}
