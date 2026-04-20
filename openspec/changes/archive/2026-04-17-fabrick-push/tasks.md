## 1. Skill Scaffold

- [x] 1.1 Create `.claude/skills/fabrick-push/SKILL.md`
- [x] 1.2 Write skill header: description, when to use, inputs expected

## 2. Implementation

- [x] 2.1 Read and parse `.fabrick/config.yaml` (repo name, backendUrl)
- [x] 2.2 Check `.fabrick/context/` exists, error if missing
- [x] 2.3 Zip `.fabrick/context/` to `/tmp/fabrick-context.zip` using shell
- [x] 2.4 POST zip to `{backendUrl}/context/{repo}` using curl
- [x] 2.5 Report success or failure based on HTTP response code
