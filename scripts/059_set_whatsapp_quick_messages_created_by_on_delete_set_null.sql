ALTER TABLE IF EXISTS whatsapp_quick_messages
DROP CONSTRAINT IF EXISTS whatsapp_quick_messages_created_by_fkey;

ALTER TABLE IF EXISTS whatsapp_quick_messages
ADD CONSTRAINT whatsapp_quick_messages_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;