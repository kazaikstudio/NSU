-- Noll Studio database schema. Safe to run repeatedly (IF NOT EXISTS).

-- artists
CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  genre TEXT NOT NULL,
  tracks_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  bio TEXT DEFAULT '',
  followers INTEGER DEFAULT 0,
  featured_track TEXT DEFAULT '',
  monthly_listeners INTEGER DEFAULT 0,
  banner_url TEXT,
  profile_url TEXT,
  artist_id TEXT,
  email TEXT,
  total_downloads INTEGER NOT NULL DEFAULT 0,
  total_plays INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- members
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  contact VARCHAR(50),
  contact2 VARCHAR(50),
  profile_pic TEXT,
  age INTEGER,
  date_joined DATE,
  village VARCHAR(255),
  district VARCHAR(255),
  guardian_name VARCHAR(255),
  guardian_contact VARCHAR(50),
  sub_county VARCHAR(255),
  suspended_at TIMESTAMP,
  suspension_days INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(100) NOT NULL DEFAULT 'Regular Members',
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- artist_follows
CREATE TABLE IF NOT EXISTS artist_follows (
  artist_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (artist_id, subscriber_id)
);

-- artist_media
CREATE TABLE IF NOT EXISTS artist_media (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  album TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  drive_file_id TEXT,
  play_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  thumbnail_drive_file_id TEXT,
  featured_artist_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- storage_items (Talk Show + member profiles)
CREATE TABLE IF NOT EXISTS storage_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  drive_file_id TEXT,
  thumbnail_url TEXT,
  thumbnail_drive_file_id TEXT,
  source TEXT NOT NULL DEFAULT 'talk-show',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- activity_logs (dashboard history)
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- activity_meta (history seeding marker)
CREATE TABLE IF NOT EXISTS activity_meta (
  id INTEGER PRIMARY KEY,
  initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- download_regions (top download regions in dashboard)
CREATE TABLE IF NOT EXISTS download_regions (
  region TEXT PRIMARY KEY,
  download_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);