import { 
  UserPlus, 
  UserMinus, 
  Power, 
  Settings, 
  Zap, 
  AlertCircle,
  FileText
} from 'lucide-react';

interface EventIconProps {
  type: string;
  action: string;
}

export function EventIcon({ type, action }: EventIconProps) {
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
  
  if (type === 'SYSTEM') {
    return <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
  }
  
  if (type === 'SETTINGS') {
    return <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  }
  
  if (type === 'XRAY') {
    return <Power className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
  }
  
  return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
}
