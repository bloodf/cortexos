-- Retention cleanup indexes for dashboard history tables
CREATE INDEX IF NOT EXISTS idx_service_health_log_checked_at_retention ON service_health_log(checked_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at_retention ON alert_history(created_at);

-- One-time cleanup during migration; socket-server keeps retention enforced.
DELETE FROM service_health_log WHERE checked_at < NOW() - INTERVAL '30 days';
DELETE FROM alert_history WHERE created_at < NOW() - INTERVAL '90 days';

-- H-6: chat_sessions retention. Drop sessions past their expires_at TTL.
-- socket-server periodic cleanup keeps this enforced at runtime.
DELETE FROM chat_sessions WHERE expires_at < NOW();
