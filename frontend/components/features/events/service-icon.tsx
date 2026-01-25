import { 
  Monitor,
  Server,
  Shield,
  Database,
  Globe,
  Cloud,
  AlertCircle,
  Box
} from 'lucide-react';

interface ServiceIconProps {
  service: string;
  className?: string;
}

export function ServiceIcon({ service, className = "w-4 h-4" }: ServiceIconProps) {
  const serviceLower = (service || '').toLowerCase().trim();
  
  // Frontend / UI
  if (serviceLower.includes('frontend') || serviceLower.includes('ui') || serviceLower.includes('nextjs')) {
    return <Monitor className={`${className} text-blue-600 dark:text-blue-400`} />;
  }
  
  // Backend / API
  if (serviceLower.includes('backend') || serviceLower.includes('api') || serviceLower.includes('flask')) {
    return <Server className={`${className} text-purple-600 dark:text-purple-400`} />;
  }
  
  // Xray
  if (serviceLower.includes('xray')) {
    return <Shield className={`${className} text-indigo-600 dark:text-indigo-400`} />;
  }
  
  // Collector
  if (serviceLower.includes('collector')) {
    return <Database className={`${className} text-teal-600 dark:text-teal-400`} />;
  }
  
  // Network / Connection related
  if (serviceLower.includes('network') || serviceLower.includes('connection') || serviceLower.includes('proxy')) {
    return <Globe className={`${className} text-cyan-600 dark:text-cyan-400`} />;
  }
  
  // Cloud / External services
  if (serviceLower.includes('cloud') || serviceLower.includes('external')) {
    return <Cloud className={`${className} text-sky-600 dark:text-sky-400`} />;
  }
  
  // Unknown / Other
  if (serviceLower === 'unknown' || serviceLower === '' || serviceLower === 'null') {
    return <AlertCircle className={`${className} text-muted-foreground`} />;
  }
  
  // Default fallback
  return <Box className={`${className} text-gray-600 dark:text-gray-400`} />;
}
