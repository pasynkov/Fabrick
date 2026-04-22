# Fabrick

Fabrick  
The choreography layer for modern work

Fabrick connects people, AI agents, tools, and systems into a shared layer of context — enabling them to work together without central coordination or data sharing.

---

## ✨ Why Fabrick

Modern work is fragmented:

- knowledge lives in different tools
- communication is incomplete or outdated
- documentation becomes stale
- systems don’t understand each other

Fabrick turns this into a connected system, where participants continuously discover and adapt to each other.

---

## 🧠 What Fabrick does

Fabrick enables:

- agents to expose capabilities and context
- tools to become part of a shared system
- teams to collaborate without manual coordination
- knowledge to stay automatically up to date

Participants can include:

- developers (frontend, backend, DevOps)
- designers and design systems
- analysts and data platforms
- AI agents (local or cloud-based)
- third-party tools and services

---

## 🔒 Privacy-first by design

Fabrick does not store your source code or sensitive data.

- analysis happens locally via your agents (e.g. Claude, Codex, Cursor)
- only derived context is shared

Fabrick stores:

- metadata
- schemas
- relationships

Fabrick does not store:

- source code
- secrets or ENV values
- proprietary business logic

Example:

- ENV → only names and structure
- APIs → only contracts, not implementation

This enables collaboration without exposing intellectual property.

---

## 🧩 How it feels

Instead of asking:

> “Where is the documentation?”  
> “Which API should I use?”  
> “What data is available?”

You interact with the system — and it already knows.

---

## 🚀 Vision

Fabrick is building the infrastructure for distributed, agent-driven work.

A system where:

- agents coordinate through shared context
- tools become part of a unified layer
- teams stay aligned without friction

---

## 🚀 Getting Started

### Create an account

Go to [console.fabrick.me/register](https://console.fabrick.me/register) and sign up.

### Install the CLI

```bash
npm install -g @fabrick/cli
```

### Authenticate

```bash
fabrick login
```

Opens your browser to complete authentication. Credentials are saved to `.fabrick/credentials.yaml` in your project directory.

### Initialize a repository

```bash
fabrick init
```

- Selects or creates an organization and project
- Links the current git repository
- Selects your AI tool (Claude)
- Installs Fabrick skills into `.claude/skills/`
- Writes `.mcp.json` to configure the Fabrick MCP server for Claude Code

### Analyze your codebase

In Claude Code, run:

```
/fabrick-analyze
```

Extracts context from your repository into `.fabrick/context/` — framework, endpoints, environment variables, domain logic, and AI-generated summaries.

### Push context to Fabrick

```
/fabrick-push
```

Uploads your local `.fabrick/context/` to the Fabrick backend for synthesis and search.

### Search across your architecture

```
/fabrick-search
```

Ask questions about your codebase — Fabrick finds answers from the synthesized architecture index.

---

## 📦 Status

Early stage — actively evolving.

---

## 📜 License

This project is licensed under the Business Source License (BSL).

- free for non-commercial use
- commercial use requires a separate license

See LICENSE.md for details.

---

## 🤝 Contributing

Contributions, ideas, and discussions are welcome.

---

## 🌱 Where we're going

Fabrick is building the layer where teams and AI agents operate together — not as separate workflows, but as participants in the same shared understanding.

- context that updates automatically as code evolves
- shared understanding across teams, repos, and disciplines
- AI agents as first-class participants, not just tools