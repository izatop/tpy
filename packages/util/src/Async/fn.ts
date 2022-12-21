/**
 * @deprecated use @bunt/async timeout
 */
export function createAsyncTimeout(timeout: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * @deprecated use @bunt/async
 */
export function wait<T = unknown>(fn: (re: (v: T) => void) => void): Promise<T> {
    return new Promise((resolve) => {
        fn(resolve);
    });
}

/**
 * @deprecated use @bunt/async
 */
export async function watch<T>(expected: T, fn: () => Promise<T>, tries = Infinity): Promise<void> {
    while (tries-- > 0 && expected !== await fn()) {
        // nothing
    }
}

/**
 * @deprecated use @bunt/async
 */
export function throttle<A extends any[], R>(fn: (...args: A) => R, t = 100): (...args: A) => Promise<R> {
    return async (...args: A): Promise<R> => {
        await createAsyncTimeout(t);

        return fn(...args);
    };
}

/**
 * @deprecated use @bunt/async
 */
export async function all<P = unknown>(pending: Promise<P>[]): Promise<P[]> {
    return Promise.all(pending);
}

/**
 * @deprecated use @bunt/async
 */
export function toAsync<A extends any[], R>(fn: (...args: A) => R): (...args: A) => Promise<R> {
    return async (...args: A): Promise<R> => {
        return fn(...args);
    };
}

/**
 * @deprecated use @bunt/async
 */
export async function asyncCall<A extends any[], R>(fn: (...args: A) => R, ...args: A): Promise<R> {
    return fn(...args);
}
