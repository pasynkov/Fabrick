import { Command, CommandRunner } from 'nest-commander';
import AdmZip from 'adm-zip';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import * as readline from 'readline';
import { join } from 'path';
import { stringify } from 'yaml';
import { ApiService } from './api.service';
import { CredentialsService } from './credentials.service';

interface Org { id: string; name: string; slug: string; role: string }
interface Project { id: string; name: string; slug: string }
interface Repo { id: string; name: string; slug: string; gitRemote: string; projectId: string }

const AI_TOOLS = ['claude'] as const;
type AiTool = typeof AI_TOOLS[number];

@Command({ name: 'init', description: 'Initialize repository and link to Fabrick' })
export class InitCommand extends CommandRunner {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly api: ApiService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const creds = this.credentials.requireAuth();

    // Get git remote
    let gitRemote: string;
    try {
      gitRemote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    } catch {
      console.error('No git remote found. Is this a git repository with an origin remote?');
      process.exit(1);
    }

    // Check existing config
    if (existsSync('.fabrick/config.yaml')) {
      const overwrite = await this.confirm('.fabrick/config.yaml already exists. Overwrite?');
      if (!overwrite) {
        console.log('Aborted.');
        return;
      }
    }

    // Fetch orgs
    const orgs = await this.api.get<Org[]>(creds.api_url, '/orgs', creds.token);
    if (!orgs.length) {
      console.error('No organizations found. Create one at the console first.');
      process.exit(1);
    }

    const org = await this.select<Org>('Select organization:', orgs, (o) => `${o.name} (${o.slug})`);
    const projects = await this.api.get<Project[]>(creds.api_url, `/orgs/${org.id}/projects`, creds.token);

    let project: Project;
    if (!projects.length) {
      const name = await this.input('No projects found. Enter new project name:');
      project = await this.api.post<Project>(creds.api_url, `/orgs/${org.id}/projects`, creds.token, { name });
      console.log(`✓ Created project: ${project.name}`);
    } else {
      project = await this.select<Project>('Select project:', projects, (p) => p.name);
    }

    const result = await this.api.post<Repo>(
      creds.api_url,
      '/repos/find-or-create',
      creds.token,
      { gitRemote, projectId: project.id },
    );

    // AI tool selection
    const aiTool = await this.select<AiTool>(
      'Select AI tool:',
      [...AI_TOOLS],
      (t) => t.charAt(0).toUpperCase() + t.slice(1),
    );

    // Write config
    mkdirSync('.fabrick', { recursive: true });
    writeFileSync(
      '.fabrick/config.yaml',
      stringify({ repo_id: result.id, api_url: creds.api_url, ai_tool: aiTool }),
    );
    console.log(`✓ Initialized. Repo: ${result.name} (${result.gitRemote})`);
    console.log('✓ Written .fabrick/config.yaml');

    // Get MCP token (embeds org/project/repo claims)
    const mcpTokenRes = await this.api.post<{ token: string }>(
      creds.api_url,
      '/auth/mcp-token',
      creds.token,
      { orgSlug: org.slug, projectSlug: project.slug, repoId: result.id },
    );

    // Write .mcp.json for Claude Code MCP integration
    const mcpConfig = {
      mcpServers: {
        fabrick: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@fabrick/mcp'],
          env: {
            FABRICK_TOKEN: mcpTokenRes.token,
            FABRICK_API_URL: creds.api_url,
          },
        },
      },
    };
    writeFileSync('.mcp.json', JSON.stringify(mcpConfig, null, 2));
    console.log('✓ Written .mcp.json (Fabrick MCP server configured)');

    // Download and install skills
    try {
      const zipBuffer = await this.api.download(creds.api_url, `/skills/${aiTool}`, creds.token);
      this.installSkills(zipBuffer);
      console.log('✓ Installed Claude skills to .claude/skills/');
    } catch (err: any) {
      console.warn(`⚠ Could not install skills: ${err.message}`);
    }
  }

  private installSkills(zipBuffer: Buffer): void {
    const zip = new AdmZip(zipBuffer);
    mkdirSync(join('.claude', 'skills'), { recursive: true });

    for (const entry of zip.getEntries()) {
      const entryName = entry.entryName;
      // Only extract fabrick-* skills
      const topDir = entryName.split('/')[0];
      if (!topDir.startsWith('fabrick-')) continue;

      if (entry.isDirectory) {
        mkdirSync(join('.claude', 'skills', entryName), { recursive: true });
      } else {
        const destPath = join('.claude', 'skills', entryName);
        mkdirSync(join(destPath, '..'), { recursive: true });
        writeFileSync(destPath, entry.getData());
      }
    }
  }

  private confirm(question: string): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`${question} (y/N) `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }

  private input(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`${question} `, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  private select<T>(question: string, items: T[], label: (item: T) => string): Promise<T> {
    console.log(`\n${question}`);
    items.forEach((item, i) => console.log(`  ${i + 1}) ${label(item)}`));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question('Enter number: ', (answer) => {
        rl.close();
        const idx = parseInt(answer, 10) - 1;
        if (idx < 0 || idx >= items.length) {
          console.error('Invalid selection');
          process.exit(1);
        }
        resolve(items[idx]);
      });
    });
  }
}
