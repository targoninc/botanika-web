import {signal} from "@targoninc/jess";

export function toHumanizedTime(time: number) {
    const formattedTime = signal("");

    const updateTime = () => {
        const now = Date.now();
        const diff = time - now;
        const absDiff = Math.abs(diff);

        if (absDiff < 60000) {
            formattedTime.value = diff < 0 ? 'moments ago' : 'in moments';
            return;
        }

        const years = Math.floor(absDiff / (365 * 24 * 60 * 60 * 1000));
        const days = Math.floor((absDiff % (365 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
        const hours = Math.floor((absDiff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((absDiff % (60 * 60 * 1000)) / (60 * 1000));

        const parts: string[] = [];
        if (years > 0) parts.push(`${years}y`);
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);

        if (parts.length === 0) {
            parts.push('1m');
        }

        formattedTime.value = diff < 0
            ? `${parts.join(' ')} ago`
            : `in ${parts.join(' ')}`;
    };

    updateTime();

    const intervalId = setInterval(updateTime, 30000);

    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => clearInterval(intervalId));
    }

    return formattedTime;
}