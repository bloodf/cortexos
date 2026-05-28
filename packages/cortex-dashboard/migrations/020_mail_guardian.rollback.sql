DELETE FROM services WHERE slug = 'cortex-mail-guardian';
DROP TABLE IF EXISTS mail_guardian_rules;
DROP TABLE IF EXISTS mail_guardian_processed;
DROP TABLE IF EXISTS mail_guardian_reviews;
