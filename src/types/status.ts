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

export interface CharacterChatGroup {
    character: AssetListItem;
    chats: AssetListItem[];
}

export interface UserStatusListChats {
    characters: CharacterChatGroup[];
    groupChats: AssetListItem[];
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
    chats: UserStatusListChats;
    counts: {
        characters: number;
        worlds: number;
        presets: number;
        characterChatGroups: number;
        characterChats: number;
        groupChats: number;
        chats: number;
    };
}
