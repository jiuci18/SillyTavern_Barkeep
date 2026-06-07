import fs from 'fs/promises';
import path from 'path';
import { Chalk } from 'chalk';
import { getConfig } from '../config/config';
import { getDatabase } from '../db/connection';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';

function getMigrationsDir(): string {
    return path.resolve(__dirname, '..', 'migrations');
}

async function readMigrationFiles(migrationsDir: string): Promise<string[]> {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

export async function runDatabaseMigrations(): Promise<void> {
    const databasePath = getConfig().main.sys_conf.main_conf.database;
    if (!databasePath || databasePath.trim().length === 0) {
        throw new Error('database path is empty. Please set main_conf.database in data/config/main_conf.json.');
    }

    const migrationsDir = getMigrationsDir();
    const migrationFiles = await readMigrationFiles(migrationsDir);

    if (migrationFiles.length === 0) {
        console.log(chalk.yellow(MODULE_NAME), '[DB]No migration files found');
        return;
    }

    await fs.mkdir(path.dirname(databasePath), { recursive: true });
    const db = getDatabase();

    for (const migrationFile of migrationFiles) {
        const migrationPath = path.join(migrationsDir, migrationFile);
        const sql = await fs.readFile(migrationPath, 'utf8');

        if (!sql.trim()) {
            continue;
        }

        db.exec(sql);
        console.log(chalk.green(MODULE_NAME), `[DB]Executed migration: ${migrationFile}`);
    }
}
