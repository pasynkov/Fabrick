---
slug: mcp-instructions
category: overview
title: MCP Instructions
sources:
  - backend1
  - kustomize
related:
  []
---

Use fabrick_search when working in one layer and needing context from another — for example, working in kustomize and needing to understand what a backend1 service does, or working in backend1 and needing deployment configuration details. Call fabrick_search at most once per question. If the wiki has no answer, report "not found in wiki" and suggest checking the source code directly — do not retry with rephrased queries. Do not use for questions answerable from local file context.
