CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  fen TEXT NOT NULL,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  status JSONB NOT NULL DEFAULT '{}'::jsonb,
  commentary JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_players ON rooms USING GIN (players);
