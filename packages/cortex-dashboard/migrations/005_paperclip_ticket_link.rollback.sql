DROP INDEX IF EXISTS idx_pcl_status;
DROP INDEX IF EXISTS idx_pcl_issue;
DROP TABLE IF EXISTS paperclip_ticket_link;
DELETE FROM migrations WHERE name = '005_paperclip_ticket_link';
