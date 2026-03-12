export function assertSafeUserHandle(user: string): string {
    const value = user.trim();

    if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
        throw new Error('Invalid user handle.');
    }

    return value;
}
