import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs';
import { join, basename } from 'path';
import { sign } from 'jsonwebtoken';
import { stringify } from 'yaml';
import { SandboxModule } from './sandbox.module';


const SANDBOX_SECRET = 'sandbox-local-secret';
const PORT = 3001;
const API_URL = `http://localhost:${PORT}`;

function parseArgs(): { repos: string[]; org: string; project: string } {
  const args = process.argv.slice(2);
  let repos: string[] = [];
  let org = 'sandbox';
  let project = 'sandbox';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repos' && args[i + 1]) {
      repos = args[++i].split(',').map((p) => p.trim());
    } else if (args[i] === '--org' && args[i + 1]) {
      org = args[++i];
    } else if (args[i] === '--project' && args[i + 1]) {
      project = args[++i];
    }
  }

  return { repos, org, project };
}

function setupRepoDirs(repos: string[], org: string, project: string): void {
  for (const repoPath of repos) {
    if (!existsSync(repoPath)) {
      console.error(`Error: repo path does not exist: ${repoPath}`);
      process.exit(1);
    }

    const slug = basename(repoPath);
    const fabrickDir = join(repoPath, '.fabrick');
    mkdirSync(fabrickDir, { recursive: true });

    const credentials = { token: 'sandbox-local-token', api_url: API_URL };
    const credPath = join(fabrickDir, 'credentials.yaml');
    writeFileSync(credPath, stringify(credentials), 'utf-8');
    chmodSync(credPath, 0o600);

    const config = { repo_id: slug, project_id: project, api_url: API_URL };
    writeFileSync(join(fabrickDir, 'config.yaml'), stringify(config), 'utf-8');

    console.log(`  ✓ ${repoPath} → repo_id: ${slug}`);
  }
}

async function bootstrap() {
  const { repos, org, project } = parseArgs();

  // Create sandbox-data directory
  const sandboxDataDir = join(process.cwd(), 'sandbox-data');
  mkdirSync(join(sandboxDataDir, 'blobs'), { recursive: true });
  mkdirSync(join(sandboxDataDir, 'pages'), { recursive: true });

  // Setup repo dirs
  if (repos.length > 0) {
    console.log('\nSetting up repo directories:');
    setupRepoDirs(repos, org, project);
  }

  // Generate MCP token
  const mcpToken = sign({ org, project }, SANDBOX_SECRET);
  const fabrickToken = `fbrk_${mcpToken}`;

  const app = await NestFactory.create(SandboxModule, { logger: ['error', 'warn', 'log'] });
  app.enableVersioning({ type: VersioningType.URI });
  await app.listen(PORT);

  console.log(`
┌─────────────────────────────────────────────────────┐
│                  FABRICK SANDBOX                    │
├─────────────────────────────────────────────────────┤
│  API:  ${API_URL}                          │
│  Org:  ${org.padEnd(44)}│
│  Project: ${project.padEnd(41)}│
└─────────────────────────────────────────────────────┘

MCP config for Claude Desktop / .mcp.json:
  FABRICK_TOKEN=${fabrickToken}
  FABRICK_API_URL=${API_URL}

Flow:
  1. cd <repo> && fabrick-analyze  (generate wiki)
  2. cd <repo> && fabrick push      (upload wiki)
  3. POST ${API_URL}/v1/sandbox/synthesize
  4. Search via MCP or curl:
     curl -X POST ${API_URL}/v1/orgs/${org}/projects/${project}/search \\
       -H 'Content-Type: application/json' \\
       -d '{"question":"how does auth work?"}'
`);
}

bootstrap();
