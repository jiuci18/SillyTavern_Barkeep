//! Process-wide SQLite connection lifecycle.

import { createRequire } from 'module';
import { getConfig } from '../config/config';

export interface SQLiteStatement<TParams extends unknown[] = unknown[]> {
    all: (...params: TParams) => unknown[];
    get: (...params: TParams) => unknown;
    run: (...params: TParams) => { changes: number };
}

export interface SQLiteDatabase {
    exec: (sql: string) => unknown;
    prepare: <TParams extends unknown[] = unknown[]>(sql: string) => SQLiteStatement<TParams>;
    close: () => void;
}

interface SQLiteDatabaseOptions {
    nativeBinding: string;
}

type SQLiteDatabaseConstructor = new (filename: string, options: SQLiteDatabaseOptions) => SQLiteDatabase;

const nodeRequire = createRequire(__filename);
const Database = nodeRequire('better-sqlite3') as SQLiteDatabaseConstructor;
const nativeBinding = nodeRequire.resolve('better-sqlite3/build/Release/better_sqlite3.node');

let database: SQLiteDatabase | null = null;

function resolveDatabasePath(): string {
    const databasePath = getConfig().main.sys_conf.main_conf.database;
    if (!databasePath || databasePath.trim().length === 0) {
        throw new Error('database path is empty. Please set main_conf.database in data/config/main_conf.json.');
    }

    return databasePath;
}

/** Return the process-wide SQLite connection, opening it on first use. */
export function getDatabase(): SQLiteDatabase {
    if (!database) {
        database = new Database(resolveDatabasePath(), { nativeBinding });
    }

    return database;
}

/** Close the process-wide SQLite connection if it has been opened. */
export function closeDatabase(): void {
    if (!database) {
        return;
    }

    database.close();
    database = null;
}
