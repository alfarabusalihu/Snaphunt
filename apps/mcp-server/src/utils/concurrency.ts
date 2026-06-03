/**
 * A simple concurrency limiter to process tasks in parallel with a maximum limit.
 * This replaces external libraries like p-limit for our use case.
 */
export function limitConcurrency<T>(concurrency: number) {
    const queue: (() => Promise<void>)[] = [];
    let activeCount = 0;

    const next = () => {
        activeCount--;
        if (queue.length > 0) {
            const task = queue.shift();
            if (task) task();
        }
    };

    const run = async (fn: () => Promise<T>): Promise<T> => {
        const execute = async (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => {
            activeCount++;
            try {
                const result = await fn();
                resolve(result);
            } catch (err) {
                reject(err);
            } finally {
                next();
            }
        };

        if (activeCount < concurrency) {
            return new Promise((resolve, reject) => execute(resolve, reject));
        } else {
            return new Promise((resolve, reject) => {
                queue.push(() => execute(resolve, reject));
            });
        }
    };

    return run;
}
