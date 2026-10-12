-- Without this line MySQL reads the file as latin1 and stores 'Platný' as 'PlatnÃ½'.
-- The terminal output still looks correct — only HEX() tells the truth.
SET NAMES utf8mb4;

-- Minimal schema: gym members and turnstile pass records.
CREATE TABLE members (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  -- _bin: exact match. With the default _ai_ci collation 'card-001' would find 'CARD-001'.
  card_code    VARCHAR(32)  COLLATE utf8mb4_bin NOT NULL UNIQUE,
  full_name    VARCHAR(120) NOT NULL,
  valid_until  DATE         NOT NULL
);

CREATE TABLE entries (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  member_id   INT UNSIGNED NULL,
  card_code   VARCHAR(32)  COLLATE utf8mb4_bin NOT NULL,
  status      ENUM('opened','denied_expired','denied_unknown','device_failed') NOT NULL,
  detail      VARCHAR(255) NULL,
  device_ms   INT UNSIGNED NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entries_created (created_at),
  INDEX idx_entries_member (member_id, created_at)
);

INSERT INTO members (card_code, full_name, valid_until) VALUES
  ('CARD-001', 'Jan Platný',   '2027-12-31'),
  ('CARD-002', 'Eva Propadlá', '2025-01-31');

-- The application user may only read members and write/read pass records — nothing else.
-- (The image grants it ALL on `gym`; this script runs as root after that.)
REVOKE ALL PRIVILEGES ON gym.* FROM 'gym'@'%';
GRANT SELECT ON gym.members TO 'gym'@'%';
GRANT SELECT, INSERT ON gym.entries TO 'gym'@'%';
