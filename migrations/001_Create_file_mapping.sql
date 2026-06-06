-- Create the base mapping table
CREATE TABLE IF NOT EXISTS file_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    file_hash TEXT,
    user TEXT NOT NULL DEFAULT 'default-user',
    file_type TEXT NOT NULL DEFAULT 'unknown' CHECK (
        file_type IN (
            'unknown',
            'chat',
            'worldinfo',
            'characters',
            'presets'
        )
    ),
    status TEXT NOT NULL DEFAULT 'normal' CHECK (
        status IN (
            'normal',
            'not-found',
            'pending',
            'unresolved'
        )
    ),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT 0
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_file_mapping_file_path ON file_mapping(file_path);
CREATE INDEX IF NOT EXISTS idx_file_mapping_user ON file_mapping(user);
CREATE INDEX IF NOT EXISTS idx_file_mapping_user_type ON file_mapping(user, file_type);

-- Create trigger on file_mapping to auto-update updated_at
CREATE TRIGGER IF NOT EXISTS trg_file_mapping_updated_at
AFTER UPDATE ON file_mapping
FOR EACH ROW
BEGIN
  UPDATE file_mapping SET updated_at = strftime('%s','now') WHERE id = OLD.id;
END;
