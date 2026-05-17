ALTER TABLE IF EXISTS whatsapp_messages
DROP CONSTRAINT IF EXISTS whatsapp_messages_sent_by_fkey;

ALTER TABLE IF EXISTS whatsapp_messages
ADD CONSTRAINT whatsapp_messages_sent_by_fkey
FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL;