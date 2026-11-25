-- 客户随访便签（医生本地标记）架构
-- 版本: 3
-- 描述: 医生在客户档案中记录的随访便签文本，以及历史纸质记录照片的元数据。
--       照片文件本身保存在便签照片库目录，这里只保存元数据。

-- 1. 便签文本（每个客户一条）
CREATE TABLE IF NOT EXISTS customer_memos (
    customer_id TEXT PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 便签照片元数据
--    deleted_at 非空表示已删除（软删除，照片文件暂时保留在磁盘上，防止误删）
CREATE TABLE IF NOT EXISTS customer_memo_images (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    file_name TEXT,                    -- 医生添加时的原始文件名
    stored_name TEXT NOT NULL,         -- 照片库中的原图文件名 {id}.jpg / .png / .webp
    thumb_name TEXT,                   -- 照片库中的缩略图文件名 {id}_thumb.jpg
    mime_type TEXT,
    file_size INTEGER DEFAULT 0,
    width INTEGER,
    height INTEGER,
    caption TEXT,                      -- 预留：照片说明
    record_date TEXT,                  -- 预留：纸质记录的日期
    sort_order INTEGER DEFAULT 0,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_memo_images_customer
    ON customer_memo_images (customer_id, deleted_at, sort_order);
