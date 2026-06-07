//! Persistence for stable resource UUID to file path mappings.

import crypto from 'crypto';
import type { CreatePendingMappingInput, FileMapping, MappingStatus, ResourceType, UpsertNormalMappingInput } from '../types/resource';
import { fromStoredFileType, toStoredFileType } from '../service/resource/type';
import { getDatabase } from './connection';

interface FileMappingRow {
    uuid: string;
    file_path: string;
    file_size: number;
    file_hash: string | null;
    user: string;
    file_type: string;
    status: MappingStatus;
    created_at: number;
    updated_at: number;
}

function mapRow(row: FileMappingRow): FileMapping {
    return {
        uuid: row.uuid,
        user: row.user,
        fileType: fromStoredFileType(row.file_type),
        filePath: row.file_path,
        fileSize: row.file_size,
        fileHash: row.file_hash,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/** Find a file mapping by user and UUID. */
export function findMappingByUuid(user: string, uuid: string): FileMapping | null {
    const row = getDatabase()
        .prepare<[string, string]>('SELECT * FROM file_mapping WHERE user = ? AND uuid = ?')
        .get(user, uuid) as FileMappingRow | undefined;
    return row ? mapRow(row) : null;
}

/** Find a file mapping by current known path. */
export function findMappingByPath(user: string, fileType: ResourceType, filePath: string): FileMapping | null {
    const row = getDatabase()
        .prepare<[string, string, string]>('SELECT * FROM file_mapping WHERE user = ? AND file_type = ? AND file_path = ?')
        .get(user, toStoredFileType(fileType), filePath) as FileMappingRow | undefined;
    return row ? mapRow(row) : null;
}

/** Create a pending mapping for a future file write. */
export function createPendingMapping(input: CreatePendingMappingInput): FileMapping {
    const uuid = crypto.randomUUID();
    const created = getDatabase()
        .prepare<[string, string, string, string, string]>(
            `INSERT INTO file_mapping (uuid, file_path, user, file_type, status)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user, file_type, file_path) DO NOTHING
             RETURNING *`,
        )
        .get(uuid, input.filePath, input.user, toStoredFileType(input.fileType), 'pending') as FileMappingRow | undefined;

    if (created) {
        return mapRow(created);
    }

    const mapping = findMappingByPath(input.user, input.fileType, input.filePath);
    if (!mapping) {
        throw new Error('Pending mapping could not be read after upsert.');
    }
    return mapping;
}

/** Insert or refresh a normal mapping for an existing file. */
export function upsertNormalMapping(input: UpsertNormalMappingInput): FileMapping {
    const db = getDatabase();
    const uuid = crypto.randomUUID();
    const mapping = db.prepare<[string, string, number, string, string, string, string]>(
        `INSERT INTO file_mapping (uuid, file_path, file_size, file_hash, user, file_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user, file_type, file_path) DO UPDATE SET
             file_size = excluded.file_size,
             file_hash = excluded.file_hash,
             status = excluded.status
         RETURNING *`,
    ).get(
        uuid,
        input.filePath,
        input.fileSize,
        input.fileHash,
        input.user,
        toStoredFileType(input.fileType),
        'normal',
    ) as FileMappingRow;

    return mapRow(mapping);
}

/** Update size, hash, and status after a resource write. */
export function updateMappingContent(uuid: string, fileSize: number, fileHash: string, status: MappingStatus): void {
    getDatabase()
        .prepare<[number, string, string, string]>('UPDATE file_mapping SET file_size = ?, file_hash = ?, status = ? WHERE uuid = ?')
        .run(
            fileSize,
            fileHash,
            status,
            uuid,
        );
}

/** Update a mapping path after an external rename has been resolved. */
export function updateMappingLocation(uuid: string, filePath: string, fileSize: number, fileHash: string): void {
    getDatabase()
        .prepare<[string, number, string, string, string]>(
            'UPDATE file_mapping SET file_path = ?, file_size = ?, file_hash = ?, status = ? WHERE uuid = ?',
        )
        .run(filePath, fileSize, fileHash, 'normal', uuid);
}

/** Mark a mapping status without changing its identity. */
export function markMappingStatus(uuid: string, status: MappingStatus): void {
    getDatabase().prepare<[string, string]>('UPDATE file_mapping SET status = ? WHERE uuid = ?').run(status, uuid);
}
