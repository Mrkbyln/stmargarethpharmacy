/**
 * Unified date/time formatter for consistent display across the application.
 * Converts a date string or Date object to a formatted string in Manila time (Asia/Manila).
 * Output format: YYYY-MM-DD HH:MM:SS AM/PM
 */

function formatToCustomString(date: Date, includeSpace: boolean = false): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila', // Always display in Manila time
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);
  
  const partMap = new Map(parts.map(({ type, value }) => [type, value]));

  const year = partMap.get('year');
  const month = partMap.get('month');
  const day = partMap.get('day');
  let hour = partMap.get('hour') || '00';
  const minute = partMap.get('minute');
  const dayPeriod = partMap.get('dayPeriod'); // 'AM' or 'PM'

  // Ensure hour has leading zero if needed
  hour = String(hour).padStart(2, '0');

  // Reconstruct format based on includeSpace parameter
  const space = includeSpace ? ' ' : '';
  return `${year}-${month}-${day}/${hour}:${minute}${space}${dayPeriod}`;
}

export const formatDateTime = (dateString: string | Date): string => {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      console.warn('Invalid date format received:', dateString);
      return 'Invalid Date';
    }
    
    const formatted = formatToCustomString(date, false); // No space for receipt
    console.log('📅 Formatted date (receipt):', dateString, '→', formatted);
    return formatted;

  } catch (error) {
    console.error("Date formatting error:", error, "Input:", dateString);
    return 'Invalid Date';
  }
};

export const formatDateTimeWithSpace = (dateString: string | Date): string => {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      console.warn('Invalid date format received:', dateString);
      return 'Invalid Date';
    }
    
    const formatted = formatToCustomString(date, true); // With space for dashboard
    console.log('📅 Formatted date (dashboard):', dateString, '→', formatted);
    return formatted;

  } catch (error) {
    console.error("Date formatting error:", error, "Input:", dateString);
    return 'Invalid Date';
  }
};




