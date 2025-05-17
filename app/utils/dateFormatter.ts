// app/utils/dateFormatter.ts (or src/utils/dateFormatter.ts)
import { parseISO, format, isValid } from 'date-fns';

/**
 * Formats an ISO date string (like "YYYY-MM-DD") to "M/D/YYYY" format.
 * Example: "2025-05-16" becomes "5/16/2025".
 * @param isoDateString The date string to format.
 * @param fallbackString The string to return if formatting fails or input is null/undefined.
 * @returns The formatted date string or the fallback string.
 */
export function formatToMDYYYY(
    isoDateString: string | null | undefined,
    fallbackString: string = '-' // Default fallback
): string {
    if (!isoDateString) {
        return fallbackString;
    }
    try {
        const dateObject = parseISO(isoDateString); // Handles "YYYY-MM-DD"
        if (!isValid(dateObject)) {
            console.warn(`[dateFormatter] Invalid date string provided to formatToMDYYYY: ${isoDateString}`);
            return isoDateString; // Return original invalid string
        }
        return format(dateObject, 'M/d/yyyy');
    } catch (error) {
        console.error(`[dateFormatter] Error formatting date string "${isoDateString}":`, error);
        return isoDateString; // Fallback to original string on unexpected error
    }
}

// You can add other common date formatting functions here as needed