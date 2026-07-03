export interface MainConfig {
    sys_conf: {
        safe_conf: {
            cors_allow_hostlist: string[];
        };
        main_conf: {
            database: string;
        };
    };
}

export interface EnvConfig {
    API_PASSWORD?: string;
    API_PASSWORD_ENABLE: boolean;
    API_PASSWORD_FORCE: boolean;
    BARKEEPER_CONFIG_PATH?: string;
    BARKEEPER_LISTEN?: string;
    HTTP_MODE: boolean;
    JWT_SECRET?: string;
    SILLYTAVERN_ROOT?: string;
}

export interface SillyTavernConfig {
    rootPath: string;
    configPath: string;
    dataRoot: string;
    basicAuthMode: boolean;
    whitelistMode: boolean;
    whitelist: string[];
    enableUserAccounts: boolean;
    perUserBasicAuth: boolean;
    enableDiscreetLogin: boolean;
}

export interface LoadedConfig {
    main: MainConfig;
    env: EnvConfig;
    sillytavern: SillyTavernConfig;
}
