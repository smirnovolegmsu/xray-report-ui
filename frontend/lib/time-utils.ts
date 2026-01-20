/**
 * Утилиты для форматирования времени
 */

export function formatRelativeTime(date: Date | string, lang: 'ru' | 'en' = 'ru'): string {
  const now = new Date();
  const eventDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - eventDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return lang === 'ru' ? 'только что' : 'just now';
  }
  
  if (diffMinutes < 60) {
    return lang === 'ru' 
      ? `${diffMinutes} ${diffMinutes === 1 ? 'минуту' : diffMinutes < 5 ? 'минуты' : 'минут'} назад`
      : `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  if (diffHours < 24) {
    return lang === 'ru'
      ? `${diffHours} ${diffHours === 1 ? 'час' : diffHours < 5 ? 'часа' : 'часов'} назад`
      : `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  if (diffDays < 7) {
    return lang === 'ru'
      ? `${diffDays} ${diffDays === 1 ? 'день' : diffDays < 5 ? 'дня' : 'дней'} назад`
      : `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }
  
  // Для старых событий показываем дату
  return eventDate.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: diffDays > 365 ? 'numeric' : undefined,
  });
}

export function formatEventTime(
  date: Date | string,
  timeRange: number,
  lang: 'ru' | 'en' = 'ru',
  showRelative: boolean = true
): string {
  const eventDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - eventDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Для событий старше 24 часов показываем дату, иначе относительное время
  if (showRelative && diffHours < 24 && timeRange < 168) {
    const relative = formatRelativeTime(eventDate, lang);
    const absolute = eventDate.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${absolute} (${relative})`;
  }
  
  // Абсолютное время
  return eventDate.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeRange >= 24 ? { day: '2-digit', month: '2-digit' } : {}),
  });
}
