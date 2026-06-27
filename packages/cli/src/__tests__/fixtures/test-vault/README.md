# Test Vault

This is a fixture vault used for integration testing of `vault-publish`.

It covers every inclusion/exclusion scenario:

| Note | Scenario |
|---|---|
| `README.md` (this file) | No frontmatter — excluded in default mode, included with `--include-all` |
| `draft.md` | `publish: false` — absolute veto, never published |
| `Blog/*` | Folder-level inclusion via `includedFolders: ["Blog"]` |
| `Blog/third-draft.md` | `publish: false` inside an included folder — veto still wins |
| `Blog/2024/year-recap.md` | Nested subfolder — prefix match includes `Blog/2024` via `Blog` |
| `Private/diary.md` | No frontmatter inside excluded folder — stays private |
| `Private/public-anyway.md` | `publish: true` inside excluded folder — override wins |
| `Pages/about-me.md` | `permalink: about`, full metadata (title, description, image) |
| `Pages/contact.md` | `publish: true`, `title` override |
| `Notes/linked-note.md` | `publish: true`, wikilink to `[[Pages/about-me]]` |
| `Notes/tagged-note.md` | `publish: true`, frontmatter tags |
| `Notes/cover-note.md` | `publish: true`, `cover:` field (fallback for `image:`) |
