import fs from 'fs/promises';
import path from 'path';
import type { AssetListItem, ListDirectoryOptions } from '../types/status';

function stripKnownSuffix(fileName: string, suffixes: readonly string[]): string {
    const lowerFileName = fileName.toLowerCase();

    for (const suffix of suffixes) {
        if (lowerFileName.endsWith(suffix.toLowerCase())) {
            return fileName.slice(0, fileName.length - suffix.length);
        }
    }

    return path.parse(fileName).name;
}

export function sortAssetItems<T extends AssetListItem>(items: T[]): T[] {
    return items.sort((left, right) => left.file.localeCompare(right.file, undefined, { numeric: true, sensitivity: 'base' }));
}

export async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

export async function listFilesInDirectory(
    directoryPath: string,
    options?: ListDirectoryOptions,
): Promise<AssetListItem[]> {
    const exists = await pathExists(directoryPath);
    if (!exists) {
        return [];
    }

    const dirEntries = await fs.readdir(directoryPath, { withFileTypes: true });
    const items = await Promise.all(
        dirEntries
            .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
            .filter((entry) => {
                if (!options?.allowedExtensions) {
                    return true;
                }

                return options.allowedExtensions.has(path.extname(entry.name).toLowerCase());
            })
            .map(async (entry) => {
                const filePath = path.join(directoryPath, entry.name);
                const stat = await fs.stat(filePath);
                const extension = path.extname(entry.name);
                return {
                    name: stripKnownSuffix(entry.name, options?.stripSuffixes ?? [extension]),
                    file: entry.name,
                    extension,
                    size: stat.size,
                    updatedAt: stat.mtime.toISOString(),
                };
            }),
    );

    return sortAssetItems(items);
}
