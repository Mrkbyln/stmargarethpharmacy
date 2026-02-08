/**
 * Timezone Helper - Ensure all timestamps use Philippine time (UTC+8)
 * This is critical for consistent data across Supabase and local database
 */

/**
 * Get current timestamp in Philippine time (UTC+8) formatted as YYYY-MM-DD HH:mm:ss
 * This format matches what the backend creates
 */
export function getPhilippineTimestamp(): string {
  const now = new Date();
  
  // Create a formatter for Philippine timezone
  const formatter = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila'
  });
  
  const parts = formatter.formatToParts(now);
  const dateObj: { [key: string]: string } = {};
  
  parts.forEach(part => {
    if (part.type !== 'literal') {
      dateObj[part.type] = part.value;
    }
  });
  
  // Format as: YYYY-MM-DD HH:mm:ss
  return `${dateObj.year}-${dateObj.month}-${dateObj.day} ${dateObj.hour}:${dateObj.minute}:${dateObj.second}`;
}

/**
 * Convert any date/timestamp to Philippine time string
 */
export function toPhilippineTimeString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  
  const formatter = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila'
  });
  
  const parts = formatter.formatToParts(d);
  const dateObj: { [key: string]: string } = {};
  
  parts.forEach(part => {
    if (part.type !== 'literal') {
      dateObj[part.type] = part.value;
    }
  });
  
  return `${dateObj.year}-${dateObj.month}-${dateObj.day} ${dateObj.hour}:${dateObj.minute}:${dateObj.second}`;
}

/**
 * Ensure a timestamp is in the correct format for saving to Supabase
 * If the input is already a string, return it (assuming backend formatted it)
 * If it's a Date, convert to Philippine time string
 */
export function ensurePhilippineTimestamp(timestamp: any): string {
  if (typeof timestamp === 'string' && timestamp.length >= 19) {
    // Already a string in expected format
    return timestamp;
  }
  
  if (timestamp instanceof Date) {
    return toPhilippineTimeString(timestamp);
  }
  
  if (typeof timestamp === 'string') {
    return toPhilippineTimeString(new Date(timestamp));
  }
  
  // Default: use current time
  return getPhilippineTimestamp();
}
