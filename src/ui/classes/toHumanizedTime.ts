import {signal} from "@targoninc/jess";

export function toHumanizedTime(time: number) {
    // Create a signal that will be updated every second
    const formattedTime = signal("");

    // Calculate and format time difference
    const updateTime = () => {
        const now = Date.now();
        const diff = time - now;
        const absDiff = Math.abs(diff);

        // Convert to different units
        const years = Math.floor(absDiff / (365 * 24 * 60 * 60 * 1000));
        const days = Math.floor((absDiff % (365 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
        const hours = Math.floor((absDiff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((absDiff % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((absDiff % (60 * 1000)) / 1000);

        // Build the time string
        const parts: string[] = [];
        if (years > 0) parts.push(`${years}y`);
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0) parts.push(`${seconds}s`);

        // Handle special cases
        if (parts.length === 0) {
            parts.push('0s');
        }

        // Add "ago" or "in" prefix based on whether the time is in the past or future
        formattedTime.value = diff < 0
            ? `${parts.join(' ')} ago`
            : `in ${parts.join(' ')}`;
    };

    // Initial update
    updateTime();

    // Set up interval to update every second
    const intervalId = setInterval(updateTime, 1000);

    // Clean up interval when signal is disposed
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => clearInterval(intervalId));
    }

    return formattedTime;
}