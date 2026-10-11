-- Migration 001: D1-driven tracking domain rotation
-- Run once against an existing swift_tracker_db:
--   wrangler d1 execute swift_tracker_db --file=migrations/001-domains.sql --remote

CREATE TABLE IF NOT EXISTS tracking_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  label TEXT,
  priority INTEGER DEFAULT 100,
  active INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'healthy'
    CHECK(status IN ('healthy','spam','down','disabled')),
  last_checked DATETIME,
  last_spam_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_domains_active ON tracking_domains(active);
CREATE INDEX IF NOT EXISTS idx_domains_status ON tracking_domains(status);

-- Track which domain served each event (for per-domain analytics)
ALTER TABLE email_events ADD COLUMN tracked_domain TEXT;
CREATE INDEX IF NOT EXISTS idx_events_domain ON email_events(tracked_domain);

-- Track last spam timestamp on link_health
ALTER TABLE link_health ADD COLUMN domain_id INTEGER;

-- Seed with your primary domain (edit before running)
INSERT OR IGNORE INTO tracking_domains (domain, label, priority, active, status)
VALUES ('https://track.yourdomain.com', 'Primary', 10, 1, 'healthy');