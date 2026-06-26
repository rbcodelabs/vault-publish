-- Migration 001_init
-- DSQL constraints: UUID PKs, no FK, ASYNC indexes, no SERIAL, no array types

CREATE TABLE IF NOT EXISTS "users" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "username"     VARCHAR(50)  NOT NULL,
  "api_key_hash" VARCHAR(255) NOT NULL,
  "display_name" VARCHAR(100),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS "users_username_key"     ON "users"("username");
CREATE UNIQUE INDEX ASYNC IF NOT EXISTS "users_api_key_hash_key" ON "users"("api_key_hash");

CREATE TABLE IF NOT EXISTS "notes" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID          NOT NULL,
  "slug"        VARCHAR(500)  NOT NULL,
  "title"       VARCHAR(500)  NOT NULL,
  "blob_url"    VARCHAR(2000) NOT NULL,
  "frontmatter" JSONB         NOT NULL DEFAULT '{}',
  "outlinks"    JSONB         NOT NULL DEFAULT '[]',
  "tags"        JSONB         NOT NULL DEFAULT '[]',
  "word_count"  INTEGER       NOT NULL DEFAULT 0,
  "updated_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS "notes_user_id_slug_key" ON "notes"("user_id", "slug");

CREATE TABLE IF NOT EXISTS "vault_graphs" (
  "user_id"    UUID         NOT NULL,
  "manifest"   JSONB        NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vault_graphs_pkey" PRIMARY KEY ("user_id")
);
