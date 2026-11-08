CREATE TABLE catalog_chapters (
  book_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  chapter_id TEXT NOT NULL,
  body_json TEXT NOT NULL,
  PRIMARY KEY (book_id, position)
);
