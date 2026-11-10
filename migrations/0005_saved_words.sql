CREATE TABLE saved_words (
  user_id TEXT NOT NULL,
  word_key TEXT NOT NULL,
  word TEXT NOT NULL,
  gloss TEXT NOT NULL,
  native_language TEXT NOT NULL,
  sentence_en TEXT NOT NULL DEFAULT '',
  sentence_native TEXT NOT NULL DEFAULT '',
  saved_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (user_id, word_key)
);

CREATE INDEX saved_words_user_saved_at ON saved_words (user_id, saved_at);
