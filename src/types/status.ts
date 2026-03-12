export interface AssetListItem {
    name: string;
    file: string;
    extension: string;
    size: number;
    updatedAt: string;
}

export interface PresetListItem extends AssetListItem {
    category: string;
}

export interface PresetCategoryDefinition {
    responseKey: string;
    directoryName: string;
    stripSuffixes: readonly string[];
}

export interface ListDirectoryOptions {
    allowedExtensions?: ReadonlySet<string>;
    stripSuffixes?: readonly string[];
}

export interface UserStatusListPresets {
    openai: AssetListItem[];
    textgen: AssetListItem[];
    koboldai: AssetListItem[];
    novelai: AssetListItem[];
    instruct: AssetListItem[];
    context: AssetListItem[];
    sysprompt: AssetListItem[];
    quickReplies: AssetListItem[];
    all: PresetListItem[];
}

export interface UserStatusListResponse {
    user: string;
    mode: 'single-user' | 'multi-user';
    characters: AssetListItem[];
    worlds: AssetListItem[];
    presets: UserStatusListPresets;
    counts: {
        characters: number;
        worlds: number;
        presets: number;
    };
}
