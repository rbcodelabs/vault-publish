---
publish: true
title: My Public Statement
description: Sometimes even private folders have things worth sharing.
---

# My Public Statement

This note lives in `Private/` but has `publish: true` explicitly set.

That means it **overrides** the `excludedFolders: ["Private"]` rule and
gets published regardless. This is exactly how Obsidian Publish behaves.

Use this when most of a folder is private but individual notes should be public.
