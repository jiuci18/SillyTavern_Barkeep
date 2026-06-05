//! File metadata and content helpers for resource handlers.

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { FileMetadata } from '../../types/resource';

/** Compute a sha256 hash for file identity checks. */
export async function hashFile(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

/** Read size, mtime, and hash for an existing file. */
export async function readFileMetadata(filePath: string, relativePath: string): Promise<FileMetadata> {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
        const error = new Error('Resource path is not a file.');
        (error as Error & { code?: string }).code = 'RESOURCE_NOT_FILE';
        throw error;
    }

    return {
        path: relativePath,
        size: stat.size,
        hash: await hashFile(filePath),
        updatedAt: stat.mtime.toISOString(),
    };
}

/** Atomically write resource bytes and return the resulting metadata. */
export async function writeResourceFile(filePath: string, relativePath: string, content: Buffer): Promise<FileMetadata> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, content);
    await fs.rename(tempPath, filePath);
    return readFileMetadata(filePath, relativePath);
}
