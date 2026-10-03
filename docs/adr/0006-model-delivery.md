# ADR 0006: Model delivery with ordered URLs, a pinned revision, sha256 and Cache Storage

Date: 2026-10-04. Status: accepted.

## Context
The model is 29,546,882 bytes. Committing it would bloat the repo, and static hosts limit file sizes (Cloudflare Pages
documents a 25 MiB per-file limit). Hugging Face serves the file with `access-control-allow-origin: *`, so a COEP
`require-corp` page can fetch it in CORS mode (verified 2026-10-04).

## Decision
- `public/models/manifest.json` lists `urls` in order: the same-origin mirror `/models/migan.onnx` (filled by
  `pnpm models:fetch` and git-ignored), then the Hugging Face URL pinned to commit `406830d0fa60666da0071c342ad2fbc8f30c5c64`.
- The loader streams with progress, checks sha256 against the manifest, and never hands unverified bytes to ORT.
- Verified bytes go to Cache Storage `inpaint-web-models` under `models/<id>/<sha256>`. Older keys for the same id are
  deleted. Cached bytes are hashed again on load, which is cheap next to inference.

## Consequences
- Works on any static host, and offline after the first successful load.
- What we gave up: when the mirror is missing, first loads depend on Hugging Face being up, and the 404 on the mirror costs
  one extra request.
