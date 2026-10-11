-- SwiftTrackerForCampaign — full schema (fresh install)
-- Run: wrangler d1 execute swift_tracker_db --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('open','click','unsubscribe')),
  recipient_email TEXT,
  campaign_subject TEXT,
  destination_url TEXT,
  ip TEXT,
  country TEXT,
  user_agent TEXT,
  language TEXT,
  tracked_domain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_tracking_id ON email_events(tracking_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON email_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_domain ON email_events(tracked_domain);

CREATE TABLE IF NOT EXISTS link_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_url TEXT NOT NULL,
  domain_id INTEGER,
  status TEXT NOT NULL CHECK(status IN ('healthy','spam','down')),
  reported_by TEXT,
  report_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_url ON link_health(tracking_url);

CREATE TABLE IF NOT EXISTS domain_rotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  old_domain TEXT NOT NULL,
  new_domain TEXT NOT NULL,
  reason TEXT,
  rotated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS firewall_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('block_country','allow_country','block_ua','allow_ua')),
  rule_value TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unsubscribes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  tracking_id TEXT,
  unsubscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- NEW: tracking domain pool
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

-- Seed primary domain (edit this line before running)
INSERT OR IGNORE INTO tracking_domains (domain, label, priority, active, status)
VALUES ('https://track.yourdomain.com', 'Primary', 10, 1, 'healthy');