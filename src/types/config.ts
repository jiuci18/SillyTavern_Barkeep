export interface MainConfig {
    sys_conf: {
        safe_conf: {
            cors_allow_hostlist: string[];
        };
        main_conf: {
            sillytavern_conf_path: string;
        };
    };
}

export interface EnvConfig {
    API_PASSWORD?: string;
    BARKEEPER_CONFIG_PATH?: string;
    BARKEEPER_LISTEN?: string;
    HTTP_MODE: boolean;
}

export interface SillyTavernConfig {
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
    sillytavern: SillyTavernConfig | null;
}
