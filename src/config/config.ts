import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import yaml from 'yaml';
import { EnvConfig, LoadedConfig, MainConfig, SillyTavernConfig } from '../types/config';
import { findSillyTavernRoot } from './sillytavern-root';

export { PRESET_CATEGORIES, PRESET_DIRECTORY_NAMES, PRESET_DIRECTORIES } from './constants';

let cachedConfig: LoadedConfig | null = null;
let loadPromise: Promise<LoadedConfig> | null = null;

export function getPluginRoot(): string {
    return path.resolve(__dirname, '..');
}

function resolvePluginPath(filePath: string): string {
    return path.resolve(getPluginRoot(), filePath);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
}

async function readYamlFile<T>(filePath: string): Promise<T> {
    const raw = await fs.readFile(filePath, 'utf8');
    return yaml.parse(raw) as T;
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) {
        return defaultValue;
    }

    const normalized = value.toLowerCase();
    if (normalized === 'true' || normalized === '1') {
        return true;
    }
    if (normalized === 'false' || normalized === '0') {
        return false;
    }

    return defaultValue;
}

function loadEnvConfig(): EnvConfig {
    const envPath = path.resolve(getPluginRoot(), '.env');
    dotenv.config({ path: envPath });
    return {
        API_PASSWORD: process.env.API_PASSWORD,
        API_PASSWORD_ENABLE: parseBooleanEnv(process.env.API_PASSWORD_ENABLE, false),
        API_PASSWORD_FORCE: parseBooleanEnv(process.env.API_PASSWORD_FORCE, false),
        BARKEEPER_CONFIG_PATH: process.env.BARKEEPER_CONFIG_PATH,
        BARKEEPER_LISTEN: process.env.BARKEEPER_LISTEN,
        HTTP_MODE: parseBooleanEnv(process.env.HTTP_MODE, false),
        JWT_SECRET: process.env.JWT_SECRET,
        SILLYTAVERN_ROOT: process.env.SILLYTAVERN_ROOT,
    };
}

async function loadSillyTavernConfig(rootPath: string): Promise<SillyTavernConfig> {
    const confPath = path.join(rootPath, 'config.yaml');
    try {
        await fs.access(confPath);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            throw new Error(`SillyTavern config not found: ${confPath}`);
        }
        throw error;
    }

    const data = await readYamlFile<Record<string, unknown>>(confPath);
    const configPath = path.resolve(confPath);
    const configDir = path.dirname(configPath);
    const dataRootValue = typeof data?.dataRoot === 'string' && data.dataRoot.trim().length > 0 ? data.dataRoot : './data';
    const basicAuthMode = data?.basicAuthMode === true;
    const whitelistMode = data?.whitelistMode === true;
    const whitelist = Array.isArray(data?.whitelist) ? data.whitelist.filter((v) => typeof v === 'string') : [];
    const enableUserAccounts = data?.enableUserAccounts === true;
    const perUserBasicAuth = data?.perUserBasicAuth === true;
    const enableDiscreetLogin = data?.enableDiscreetLogin === true;

    return {
        rootPath,
        configPath,
        dataRoot: path.resolve(configDir, dataRootValue),
        basicAuthMode,
        whitelistMode,
        whitelist,
        enableUserAccounts,
        perUserBasicAuth,
        enableDiscreetLogin,
    };
}

export async function loadConfig(): Promise<LoadedConfig> {
    if (cachedConfig) {
        return cachedConfig;
    }
    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = (async () => {
        const env = loadEnvConfig();
        if (!env.BARKEEPER_CONFIG_PATH) {
            throw new Error('BARKEEPER_CONFIG_PATH is required. Please set it in the plugin .env file.');
        }

        const mainPath = resolvePluginPath(env.BARKEEPER_CONFIG_PATH);
        const main = await readJsonFile<MainConfig>(mainPath);
        const databasePath = main.sys_conf.main_conf.database;
        if (!databasePath?.trim()) {
            throw new Error('database path is empty. Please set main_conf.database in the main config.');
        }
        main.sys_conf.main_conf.database = resolvePluginPath(databasePath);

        let sillytavernRoot: string;
        try {
            sillytavernRoot = await findSillyTavernRoot(getPluginRoot(), env.SILLYTAVERN_ROOT);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[Sillytavern_Barkeeper] ${message}`);
            throw error;
        }
        console.log(`[Sillytavern_Barkeeper] Detected SillyTavern root: ${sillytavernRoot}`);
        const sillytavern = await loadSillyTavernConfig(sillytavernRoot);
        const loaded: LoadedConfig = { main, env, sillytavern };
        cachedConfig = loaded;
        return loaded;
    })().catch((error) => {
        loadPromise = null;
        cachedConfig = null;
        throw error;
    });

    return loadPromise;
}

export function getConfig(): LoadedConfig {
    if (!cachedConfig) {
        throw new Error('Config not loaded. Call loadConfig() during initialization.');
    }
    return cachedConfig;
}
