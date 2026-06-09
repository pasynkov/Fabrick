import { Command, CommandRunner, Option } from 'nest-commander';
import AdmZip from 'adm-zip';
import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import * as readline from 'readline';
import { join } from 'path';
import { ApiService } from './api.service';
import { CredentialsService } from './credentials.service';
import { ConfigService } from './services/config.service';
import { FabrickConfig } from './services/config.service';

interface Org { id: string; name: string; slug: string; role: string }
interface Project { id: string; name: string; slug: string }
interface Repo { id: string; name: string; slug: string; gitRemote: string; projectId: string }

const DEFAULT_API_URL = 'https://api.fabrick.me/';
const AGENTS = ['claude', 'codex', 'gemini', 'none'] as const;
type Agent = typeof AGENTS[number];

function sshToHttps(remote: string): string {
  const match = remote.match(/^git@([^:]+):(.+)$/);
  if (match) return `https://${match[1]}/${match[2]}`;
  return remote;
}

@Command({ name: 'init', description: 'Initialize repository and link to Fabrick (v2)' })
export class InitCommand extends CommandRunner {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly api: ApiService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  @Option({ flags: '--non-interactive', description: 'Skip interactive prompts' })
  parseNonInteractive(): boolean { return true; }

  @Option({ flags: '--org <slug>', description: 'Organization slug' })
  parseOrg(val: string): string { return val; }

  @Option({ flags: '--project <slug>', description: 'Project slug' })
  parseProject(val: string): string { return val; }

  @Option({ flags: '--api-url <url>', description: 'API URL' })
  parseApiUrl(val: string): string { return val; }

  @Option({ flags: '--agent <name>', description: 'AI agent (claude/codex/gemini/none)' })
  parseAgent(val: string): string { return val; }

  @Option({ flags: '--yes', description: 'Skip confirmation prompts' })
  parseYes(): boolean { return true; }

  async run(_params: string[], options?: {
    nonInteractive?: boolean;
    org?: string;
    project?: string;
    apiUrl?: string;
    agent?: string;
    yes?: boolean;
  }): Promise<void> {
    if (options?.nonInteractive) {
      await this.runNonInteractive(options);
    } else {
      await this.runInteractive(options);
    }
  }

  private async runNonInteractive(options: {
    org?: string;
    project?: string;
    apiUrl?: string;
    agent?: string;
    yes?: boolean;
  }): Promise<void> {
    const missing: string[] = [];
    if (!options.org) missing.push('--org');
    if (!options.project) missing.push('--project');
    if (missing.length) {
      console.error(`Missing required flags: ${missing.join(', ')}`);
      process.exit(1);
    }

    const creds = this.credentials.requireAuth();
    const apiUrl = options.apiUrl ?? creds.api_url ?? DEFAULT_API_URL;

    let gitRemote: string;
    try {
      gitRemote = sshToHttps(execSync('git remote get-url origin', { encoding: 'utf8' }).trim());
    } catch {
      console.error('No git remote found. Is this a git repository with an origin remote?');
      process.exit(1);
    }

    const orgs = await this.api.get<Org[]>(apiUrl, '/orgs', creds.token);
    const org = orgs.find((o) => o.slug === options.org);
    if (!org) { console.error(`Organization not found: ${options.org}`); process.exit(1); }

    const projects = await this.api.get<Project[]>(apiUrl, `/orgs/${org.id}/projects`, creds.token);
    let project = projects.find((p) => p.slug === options.project);
    if (!project) {
      project = await this.api.post<Project>(apiUrl, `/orgs/${org.id}/projects`, creds.token, { name: options.project });
      console.log(`✓ Created project: ${project.name}`);
    }

    const repo = await this.api.post<Repo>(apiUrl, '/repos/find-or-create', creds.token, { gitRemote, projectId: project.id });
    const agent = (AGENTS.includes(options.agent as Agent) ? options.agent : 'claude') as Agent;

    await this.writeConfig({ creds, org, project, repo, agent, apiUrl, gitRemote });
    console.log('✓ Init complete (non-interactive)');
  }

  private async runInteractive(options?: { yes?: boolean }): Promise<void> {
    const creds = this.credentials.requireAuth();

    // Check existing config
    const configPath = join(process.cwd(), '.fabrick', 'config.json');
    if (existsSync(configPath) && !options?.yes) {
      const overwrite = await this.confirm('Overwrite .fabrick/config.json?');
      if (!overwrite) { console.log('Aborted.'); return; }
    }

    // API URL
    const apiUrl = await this.inputWithDefault('API URL:', DEFAULT_API_URL);

    // Git remote
    let gitRemote: string;
    try {
      const defaultRemote = sshToHttps(execSync('git remote get-url origin', { encoding: 'utf8' }).trim());
      gitRemote = await this.inputWithDefault('Repository remote URL:', defaultRemote);
    } catch {
      gitRemote = await this.input('Repository remote URL (no origin found):');
    }

    // Org
    const orgs = await this.api.get<Org[]>(apiUrl, '/orgs', creds.token);
    if (!orgs.length) { console.error('No organizations found. Create one at the console first.'); process.exit(1); }
    const org = await this.select<Org>('Select organization:', orgs, (o) => `${o.name} (${o.slug})`);

    // Project
    const projects = await this.api.get<Project[]>(apiUrl, `/orgs/${org.id}/projects`, creds.token);
    let project: Project;
    if (!projects.length) {
      const name = await this.input('No projects found. Enter new project name:');
      project = await this.api.post<Project>(apiUrl, `/orgs/${org.id}/projects`, creds.token, { name });
      console.log(`✓ Created project: ${project.name}`);
    } else {
      project = await this.select<Project>('Select project:', projects, (p) => p.name);
    }

    const repo = await this.api.post<Repo>(apiUrl, '/repos/find-or-create', creds.token, { gitRemote, projectId: project.id });
    const agent = await this.select<Agent>('Select AI agent:', [...AGENTS], (a) => a);

    await this.writeConfig({ creds, org, project, repo, agent, apiUrl, gitRemote });

    // Inline bootstrap
    const doBootstrap = await this.confirm('Run fabrick bootstrap now?');
    if (doBootstrap) {
      const result = spawnSync('node', [process.argv[1], 'bootstrap'], { stdio: 'inherit', cwd: process.cwd() });
      if (result.status !== 0) console.warn('Bootstrap exited with errors.');
    }
  }

  private async writeConfig(opts: {
    creds: { token: string; api_url: string };
    org: Org;
    project: Project;
    repo: Repo;
    agent: Agent;
    apiUrl: string;
    gitRemote: string;
  }): Promise<void> {
    const { creds, org, project, repo, agent, apiUrl, gitRemote } = opts;
    mkdirSync(join(process.cwd(), '.fabrick'), { recursive: true });

    const config: FabrickConfig = {
      version: 2,
      orgSlug: org.slug,
      projectId: project.id,
      projectSlug: project.slug,
      repoId: repo.id,
      repoName: repo.name,
      gitRemote,
      agent,
      apiUrl,
      scan: { ignore: [], rebuildThreshold: {} },
    };
    this.configService.save(config);
    console.log('✓ Written .fabrick/config.json');

    // MCP token
    try {
      const mcpTokenRes = await this.api.post<{ token: string }>(apiUrl, '/auth/mcp-token', creds.token, { orgSlug: org.slug, projectSlug: project.slug, repoId: repo.id });
      const mcpConfig = {
        mcpServers: {
          fabrick: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@fabrick/mcp'],
            env: { FABRICK_TOKEN: mcpTokenRes.token, FABRICK_API_URL: apiUrl },
          },
        },
      };
      writeFileSync(join(process.cwd(), '.mcp.json'), JSON.stringify(mcpConfig, null, 2));
      console.log('✓ Written .mcp.json');
    } catch (err: any) {
      console.warn(`⚠ Could not write .mcp.json: ${err.message}`);
    }

    // Skills
    try {
      const zipBuffer = await this.api.download(apiUrl, `/skills/${agent}`, creds.token);
      this.installSkills(zipBuffer);
      console.log('✓ Installed skills to .claude/skills/');
    } catch (err: any) {
      console.warn(`⚠ Could not install skills: ${err.message}`);
    }
  }

  private installSkills(zipBuffer: Buffer): void {
    const zip = new AdmZip(zipBuffer);
    mkdirSync(join(process.cwd(), '.claude', 'skills'), { recursive: true });
    for (const entry of zip.getEntries()) {
      const entryName = entry.entryName;
      const topDir = entryName.split('/')[0];
      if (!topDir.startsWith('fabrick-')) continue;
      if (entry.isDirectory) {
        mkdirSync(join(process.cwd(), '.claude', 'skills', entryName), { recursive: true });
      } else {
        const destPath = join(process.cwd(), '.claude', 'skills', entryName);
        mkdirSync(join(destPath, '..'), { recursive: true });
        writeFileSync(destPath, entry.getData());
      }
    }
  }

  private confirm(question: string): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`${question} (y/N) `, (answer) => { rl.close(); resolve(answer.toLowerCase() === 'y'); });
    });
  }

  private input(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`${question} `, (answer) => { rl.close(); resolve(answer.trim()); });
    });
  }

  private inputWithDefault(question: string, defaultValue: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`${question} [${defaultValue}] `, (answer) => { rl.close(); resolve(answer.trim() || defaultValue); });
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
        if (idx < 0 || idx >= items.length) { console.error('Invalid selection'); process.exit(1); }
        resolve(items[idx]);
      });
    });
  }
}
