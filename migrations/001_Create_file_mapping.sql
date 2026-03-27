-- 创建基础的映射表
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
            'pending'
        )
    ),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT 0
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_file_mapping_file_path ON file_mapping(file_path);
CREATE INDEX IF NOT EXISTS idx_file_mapping_user ON file_mapping(user);
CREATE INDEX IF NOT EXISTS idx_file_mapping_user_type ON file_mapping(user, file_type);

-- 为 file_mapping 表创建触发器, 用于自动更新 updated_at
CREATE TRIGGER IF NOT EXISTS trg_file_mapping_updated_at
AFTER UPDATE ON file_mapping
FOR EACH ROW
BEGIN
  UPDATE file_mapping SET updated_at = strftime('%s','now') WHERE id = OLD.id;
END;
