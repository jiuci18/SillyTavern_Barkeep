//! Filesystem watcher that treats events as dirty signals and reconciles snapshots.

import fsPromises from 'fs/promises';
import fs, { FSWatcher } from 'fs';
import path from 'path';
import { Chalk } from 'chalk';
import { getConfig } from '../../config/config';
import { scanResourceSnapshot, synchronizeMappingsFromSnapshots, type FileSnapshot } from './file-index';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';
const WATCH_DEBOUNCE_MS = 750;
const WATCH_RETRY_INITIAL_MS = 2_000;
const WATCH_RETRY_MAX_MS = 30_000;

let watchers = new Map<string, FSWatcher>();
let snapshot: FileSnapshot | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let syncing = false;
let dirty = false;
let retryDelayMs = WATCH_RETRY_INITIAL_MS;

async function listWatchDirectories(rootDirectory: string): Promise<string[]> {
    const directories = [rootDirectory];
    const entries = await fsPromises.readdir(rootDirectory, { withFileTypes: true });

    const nested = await Promise.all(
        entries
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .map((entry) => listWatchDirectories(path.join(rootDirectory, entry.name))),
    );

    return directories.concat(nested.flat());
}

async function rebuildWatchers(): Promise<void> {
    const config = getConfig();
    const directories = await listWatchDirectories(config.sillytavern.dataRoot);
    const nextDirectories = new Set(directories);

    for (const [directory, watcher] of watchers) {
        if (nextDirectories.has(directory)) {
            continue;
        }

        watcher.close();
        watchers.delete(directory);
    }

    for (const directory of directories) {
        if (watchers.has(directory)) {
            continue;
        }

        const watcher = fs.watch(directory, () => {
            scheduleReconcile(WATCH_DEBOUNCE_MS);
        });
        watcher.on('error', (error) => {
            console.error(chalk.red(MODULE_NAME), `[Watch]Filesystem watcher failed for ${directory}`, error);
            scheduleReconcile(retryDelayMs);
        });
        watchers.set(directory, watcher);
    }
}

async function reconcileSnapshot(): Promise<void> {
    if (syncing) {
        dirty = true;
        return;
    }

    syncing = true;
    dirty = false;
    let failed = false;
    try {
        const nextSnapshot = await scanResourceSnapshot();
        if (snapshot) {
            await synchronizeMappingsFromSnapshots(snapshot, nextSnapshot);
        }
        snapshot = nextSnapshot;
        await rebuildWatchers();
        retryDelayMs = WATCH_RETRY_INITIAL_MS;
    } catch (error) {
        failed = true;
        console.error(chalk.red(MODULE_NAME), '[Watch]Failed to synchronize resource snapshot', error);
        retryDelayMs = Math.min(retryDelayMs * 2, WATCH_RETRY_MAX_MS);
        dirty = true;
    } finally {
        syncing = false;
    }

    if (dirty) {
        scheduleReconcile(failed ? retryDelayMs : WATCH_DEBOUNCE_MS);
    }
}

function scheduleReconcile(delayMs: number): void {
    dirty = true;
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void reconcileSnapshot();
    }, delayMs);
}

/** Start the resource watcher and build the initial in-memory snapshot. */
export async function startFileWatcher(): Promise<void> {
    if (watchers.size > 0) {
        return;
    }

    const config = getConfig();
    snapshot = await scanResourceSnapshot();
    await rebuildWatchers();

    console.log(chalk.green(MODULE_NAME), `[Watch]Resource watcher started (${watchers.size} directories)`);
}

/** Stop the resource watcher and clear its in-memory snapshot. */
export async function stopFileWatcher(): Promise<void> {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }

    for (const watcher of watchers.values()) {
        watcher.close();
    }
    watchers = new Map();

    snapshot = null;
    syncing = false;
    dirty = false;
    retryDelayMs = WATCH_RETRY_INITIAL_MS;
}
