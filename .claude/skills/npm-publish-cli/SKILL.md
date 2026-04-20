---
name: npm-publish-cli
description: Publish the @fabrick/cli npm package. Use when the user wants to publish/release the CLI, bump the version, or run npm publish. Trigger on "publish cli", "release cli", "npm publish".
license: MIT
metadata:
  author: pasynkov
  version: "1.0"
---

Publish the `@fabrick/cli` package to npm.

**Package location:** `applications/cli/`

## Steps

1. **Show current version**

   Read `applications/cli/package.json` and display:
   - Current version (e.g., `0.2.0`)
   - Package name (`@fabrick/cli`)

2. **Ask what to do with the version**

   Use **AskUserQuestion** to ask:
   - Patch bump (0.2.0 → 0.2.1)
   - Minor bump (0.2.0 → 0.3.0)
   - Major bump (0.2.0 → 1.0.0)
   - Keep current version

   If bumping: edit `version` field in `applications/cli/package.json` directly.

3. **Build**

   ```bash
   cd applications/cli && npm run build
   ```

   If build fails: stop, show error, wait for user.

4. **Ask for OTP**

   Use **AskUserQuestion** (open-ended) to ask:
   > "Enter your npm OTP (one-time password):"

   Do NOT log or echo the OTP anywhere.

5. **Publish**

   ```bash
   cd applications/cli && npm publish --access public --otp <OTP>
   ```

   Show result. If error: display exact error message, stop.

6. **Confirm**

   Show: `✓ Published @fabrick/cli@<version>`

## Guardrails
- Always build before publish
- Never skip OTP step
- Stop on any error — don't retry automatically
- Don't commit version bump unless user asks
