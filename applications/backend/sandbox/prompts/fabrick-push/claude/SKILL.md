---
name: fabrick-push
description: Upload local .fabrick/wiki/ to the Fabrick backend. Delegates to the
  fabrick CLI. Run after fabrick-analyze has produced wiki pages.
---

Upload the local wiki to Fabrick.

```bash
npx @fabrick/cli push
```

That's it. The CLI handles auth, compression, and upload.
