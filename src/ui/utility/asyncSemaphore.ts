export function asyncSemaphore(maxCount: number) {
    let currentCount = 0;
    const releaseMethods: (() => void)[] = [];

    const release = () => {
        currentCount--;
        if (releaseMethods.length > 0) {
            const nextRelease = releaseMethods.shift();
            if (nextRelease) {
                nextRelease();
            }
        }
    };

    return {
        async acquire(): Promise<() => void> {
            if (currentCount < maxCount) {
                currentCount++;
                return release;
            }

            return await new Promise<() => void>((resolve) => {
                currentCount++;
                releaseMethods.push(() => resolve(release));
            });
        },
    };
}