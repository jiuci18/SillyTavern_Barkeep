//! In-memory snapshots of resource files and mapping synchronization by diff.

import fs from 'fs/promises';
import path from 'path';
import { getConfig } from '../../config/config';
import { findMappingByPath, markMappingStatus, updateMappingContent, updateMappingLocation } from '../../db/file-mapping';
import { hashFile } from '../resource/file';
import type { ResourceType } from '../../types/resource';
import { pathExists } from '../../utils/files';

const DEFAULT_SINGLE_USER_HANDLE = 'default-user';
const PRESET_DIRECTORIES = [
    'OpenAI Settings',
    'TextGen Settings',
    'KoboldAI Settings',
    'NovelAI Settings',
    'instruct',
    'context',
    'sysprompt',
    'QuickReplies',
] as const;

export interface FileSnapshotEntry {
    user: string;
    fileType: ResourceType;
    relativePath: string;
    absolutePath: string;
    size: number;
    mtimeMs: number;
}

export type FileSnapshot = Map<string, FileSnapshotEntry>;

function getSnapshotKey(entry: Pick<FileSnapshotEntry, 'user' | 'fileType' | 'relativePath'>): string {
    return `${entry.user}\0${entry.fileType}\0${entry.relativePath}`;
}

async function listUsers(dataRoot: string): Promise<string[]> {
    const config = getConfig();
    if (!config.sillytavern?.enableUserAccounts) {
        return [DEFAULT_SINGLE_USER_HANDLE];
    }

    const entries = await fs.readdir(dataRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name);
}

async function walkFiles(directoryPath: string): Promise<string[]> {
    if (!(await pathExists(directoryPath))) {
        return [];
    }

    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const nested = await Promise.all(
        entries
            .filter((entry) => !entry.name.startsWith('.'))
            .map(async (entry) => {
                const entryPath = path.join(directoryPath, entry.name);
                if (entry.isDirectory()) {
                    return walkFiles(entryPath);
                }
                if (entry.isFile()) {
                    return [entryPath];
                }
                return [];
            }),
    );

    return nested.flat();
}

async function scanResourceDirectory(
    snapshot: FileSnapshot,
    user: string,
    userDirectory: string,
    fileType: ResourceType,
    resourceDirectory: string,
): Promise<void> {
    const absoluteDirectory = path.join(userDirectory, resourceDirectory);
    const files = await walkFiles(absoluteDirectory);

    for (const absolutePath of files) {
        const stat = await fs.stat(absolutePath);
        const relativePath = path.relative(userDirectory, absolutePath).replace(/\\/g, '/');
        const entry: FileSnapshotEntry = {
            user,
            fileType,
            relativePath,
            absolutePath,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
        };
        snapshot.set(getSnapshotKey(entry), entry);
    }
}

/** Scan all known SillyTavern resource directories into a current file snapshot. */
export async function scanResourceSnapshot(): Promise<FileSnapshot> {
    const config = getConfig();
    if (!config.sillytavern) {
        throw new Error('SillyTavern config is not loaded.');
    }

    const snapshot: FileSnapshot = new Map();
    const users = await listUsers(config.sillytavern.dataRoot);

    for (const user of users) {
        const userDirectory = path.join(config.sillytavern.dataRoot, user);
        await Promise.all([
            scanResourceDirectory(snapshot, user, userDirectory, 'characters', 'characters'),
            scanResourceDirectory(snapshot, user, userDirectory, 'worlds', 'worlds'),
            scanResourceDirectory(snapshot, user, userDirectory, 'chats', 'chats'),
            scanResourceDirectory(snapshot, user, userDirectory, 'chats', 'group chats'),
            ...PRESET_DIRECTORIES.map((directory) => scanResourceDirectory(snapshot, user, userDirectory, 'presets', directory)),
        ]);
    }

    return snapshot;
}

async function hashEntry(entry: FileSnapshotEntry): Promise<string> {
    return hashFile(entry.absolutePath);
}

function takeMatchingAddedEntry(
    added: FileSnapshotEntry[],
    removed: FileSnapshotEntry,
    expectedHash: string,
    candidateHashes: Map<string, string>,
): FileSnapshotEntry | null {
    const index = added.findIndex((candidate) => {
        if (candidate.user !== removed.user || candidate.fileType !== removed.fileType || candidate.size !== removed.size) {
            return false;
        }

        return candidateHashes.get(getSnapshotKey(candidate)) === expectedHash;
    });

    if (index === -1) {
        return null;
    }

    const [matched] = added.splice(index, 1);
    return matched;
}

async function prehashAddedCandidates(added: FileSnapshotEntry[], removed: FileSnapshotEntry[]): Promise<Map<string, string>> {
    const candidateHashes = new Map<string, string>();
    const hasResolvableRemoval = removed.some((entry) => {
        const mapping = findMappingByPath(entry.user, entry.fileType, entry.relativePath);
        return Boolean(mapping?.fileHash);
    });

    if (!hasResolvableRemoval) {
        return candidateHashes;
    }

    await Promise.all(
        added.map(async (entry) => {
            candidateHashes.set(getSnapshotKey(entry), await hashEntry(entry));
        }),
    );

    return candidateHashes;
}

/** Diff two snapshots and update file_mapping for external edits, renames, and removals. */
export async function synchronizeMappingsFromSnapshots(previous: FileSnapshot, current: FileSnapshot): Promise<void> {
    const removed: FileSnapshotEntry[] = [];
    const added: FileSnapshotEntry[] = [];
    const changed: FileSnapshotEntry[] = [];

    for (const [key, oldEntry] of previous) {
        const newEntry = current.get(key);
        if (!newEntry) {
            removed.push(oldEntry);
            continue;
        }
        if (oldEntry.size !== newEntry.size || oldEntry.mtimeMs !== newEntry.mtimeMs) {
            changed.push(newEntry);
        }
    }

    for (const [key, newEntry] of current) {
        if (!previous.has(key)) {
            added.push(newEntry);
        }
    }

    const candidateHashes = await prehashAddedCandidates(added, removed);

    for (const oldEntry of removed) {
        const mapping = findMappingByPath(oldEntry.user, oldEntry.fileType, oldEntry.relativePath);
        if (!mapping) {
            continue;
        }

        const matched = mapping.fileHash
            ? takeMatchingAddedEntry(added, oldEntry, mapping.fileHash, candidateHashes)
            : null;
        if (matched) {
            const hash = candidateHashes.get(getSnapshotKey(matched)) ?? (await hashEntry(matched));
            updateMappingLocation(mapping.uuid, matched.relativePath, matched.size, hash);
            continue;
        }

        markMappingStatus(mapping.uuid, 'unresolved');
    }

    for (const entry of changed) {
        const mapping = findMappingByPath(entry.user, entry.fileType, entry.relativePath);
        if (!mapping) {
            continue;
        }

        updateMappingContent(mapping.uuid, entry.size, await hashEntry(entry), 'normal');
    }
}
