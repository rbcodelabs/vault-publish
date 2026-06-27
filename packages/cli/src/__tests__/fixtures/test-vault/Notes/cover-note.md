---
publish: true
title: Cover Image Fallback
cover: https://example.com/cover-photo.jpg
---

# Cover Image Fallback

This note uses `cover:` instead of `image:`. Both are valid OG image sources
in vault-publish — `image` takes precedence, but `cover` is the fallback.

This is consistent with how Obsidian Publish treats these two properties.

## When to Use `cover` vs `image`

- `image` — canonical OG/Twitter card image
- `cover` — banner displayed at the top of the note in some Obsidian themes

If you set both, `image` wins for meta tags. If you only set `cover`,
vault-publish uses it as the OG image automatically.
