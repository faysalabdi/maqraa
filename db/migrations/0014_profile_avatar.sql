-- An optional emoji avatar readers can pick, shown on the leaderboard and in
-- the app header. Null falls back to the initial of the display name.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar text;
