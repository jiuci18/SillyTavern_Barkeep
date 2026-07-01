//! Shared resource API contracts and domain types.

export type ResourceType = 'characters' | 'worlds' | 'presets' | 'chats';

export type MappingFileType = ResourceType | 'unknown';

export type MappingStatus = 'normal' | 'pending' | 'not-found' | 'unresolved';

export type StoredFileType = 'unknown' | 'characters' | 'worldinfo' | 'presets' | 'chat';

export interface FileMapping {
    uuid: string;
    user: string;
    fileType: MappingFileType;
    filePath: string;
    fileSize: number;
    fileHash: string | null;
    status: MappingStatus;
    createdAt: number;
    updatedAt: number;
}

/** Response returned when listing a user's registered resource mappings. */
export interface RegisteredResourceList {
    user: string;
    count: number;
    resources: FileMapping[];
}

export interface FileMetadata {
    path: string;
    size: number;
    hash: string;
    updatedAt: string;
}

export interface UpsertNormalMappingInput {
    user: string;
    fileType: ResourceType;
    filePath: string;
    fileSize: number;
    fileHash: string;
}

export interface CreatePendingMappingInput {
    user: string;
    fileType: ResourceType;
    filePath: string;
}
