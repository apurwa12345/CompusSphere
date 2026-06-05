/**
 * Safely formats a date string or object to a localized string.
 * Returns a fallback string if the date is invalid or missing.
 * 
 * @param {string|Date} dateValue - The date to format
 * @param {string} fallback - The string to return if date is invalid
 * @returns {string} Formatted date or fallback
 */
export const formatDate = (dateValue, fallback = '—') => {
  if (!dateValue) return fallback;
  
  try {
    // If it's a number (timestamp), convert to Date
    // If it's a string, try to parse it
    const date = new Date(dateValue);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // Try to handle "YYYY-MM-DD HH:mm:ss" which sometimes fails in some browsers
      if (typeof dateValue === 'string') {
        const t = dateValue.replace(' ', 'T');
        const date2 = new Date(t);
        if (!isNaN(date2.getTime())) {
          return date2.toLocaleString();
        }
      }
      return fallback;
    }
    return date.toLocaleString();
  } catch (error) {
    return fallback;
  }
};

/**
 * Safely formats a date to a short localized string (Date only).
 */
export const formatDateShort = (dateValue, fallback = '—') => {
  if (!dateValue) return fallback;
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString();
  } catch (error) {
    return fallback;
  }
};
