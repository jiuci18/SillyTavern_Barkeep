interface AttemptWindow {
    count: number;
    resetsAt: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MILLISECONDS = 60_000;
const attempts = new Map<string, AttemptWindow>();

/** Consume one login attempt and return retry seconds when the caller is limited. */
export function consumeLoginAttempt(clientAddress: string, now = Date.now()): number | null {
    const current = attempts.get(clientAddress);
    const window = !current || current.resetsAt <= now
        ? { count: 0, resetsAt: now + WINDOW_MILLISECONDS }
        : current;

    window.count += 1;
    attempts.set(clientAddress, window);

    if (window.count <= MAX_ATTEMPTS) {
        return null;
    }

    return Math.max(1, Math.ceil((window.resetsAt - now) / 1000));
}

/** Clear failed-attempt state after a successful login. */
export function clearLoginAttempts(clientAddress: string): void {
    attempts.delete(clientAddress);
}
