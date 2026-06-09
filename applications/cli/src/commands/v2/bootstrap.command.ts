import { Command, CommandRunner } from 'nest-commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ClaudeCodeService } from '../../pipeline/llm/claude-code.service';
import { ConfigService } from '../../services/config.service';
import { StateService } from '../../services/state.service';
import { detectScopes } from '../../pipeline/scope/detect';
import { estimateScopeSourceBytes, computeRebuildThresholds } from '../../pipeline/threshold';

const SKILL_DIR = join(__dirname, '../../skills');
const BOOTSTRAP_SKILL_NAME = 'bootstrap-routing';

@Command({ name: 'bootstrap', description: 'Derive routing rules and file-slug map via LLM' })
export class BootstrapCommand extends CommandRunner {
  constructor(
    private readonly claude: ClaudeCodeService,
    private readonly configService: ConfigService,
    private readonly stateService: StateService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const cwd = process.cwd();
    const config = this.configService.load();
    const scopes = detectScopes(cwd);

    // Verify skill is available (dev or dist)
    const hasDevSkill = existsSync(join(SKILL_DIR, BOOTSTRAP_SKILL_NAME, 'SKILL.md'));
    const distSkill = join(__dirname, '..', '..', 'skills', BOOTSTRAP_SKILL_NAME);
    if (!hasDevSkill && !existsSync(distSkill)) {
      console.error(`Bootstrap-routing skill not found. Expected at ${distSkill}`);
      process.exit(1);
    }

    console.log('Running bootstrap-routing...');

    // Build source listing for LLM
    const sourceFiles: string[] = [];
    for (const scope of scopes) {
      const scopePath = join(cwd, scope.root);
      const { bytes } = estimateScopeSourceBytes(scopePath);
      sourceFiles.push(`scope: ${scope.name} (${scope.kind}) root: ${scope.root} ~${bytes} bytes`);
    }

    const system = `You are a routing-rules generator for a Fabrick dossier. Given a repo scope list, emit a JSON routing-rules object that maps file patterns to dossier slugs, and a file-slug-map.json. Output ONLY valid JSON in this format:
{
  "routing-rules": { "<glob-pattern>": "<slug>" },
  "file-slug-map": { "<file-path>": "<slug>" }
}`;
    const user = `Repository scopes:\n${sourceFiles.join('\n')}\n\nGenerate routing rules for this repository.`;

    let result: { 'routing-rules': Record<string, string>; 'file-slug-map': Record<string, string> };
    try {
      const res = await this.claude.call({ model: 'claude-sonnet-4-6', systemPrompt: system, userInput: user, cwd });
      const jsonMatch = res.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      result = JSON.parse(jsonMatch[0]);
    } catch (e: any) {
      console.error(`Bootstrap LLM call failed: ${e.message}`);
      process.exit(1);
    }

    // Write outputs
    const fabrickDir = join(cwd, '.fabrick');
    mkdirSync(fabrickDir, { recursive: true });

    writeFileSync(join(fabrickDir, 'routing-rules.json'), JSON.stringify(result['routing-rules'] ?? {}, null, 2));
    writeFileSync(join(fabrickDir, 'file-slug-map.json'), JSON.stringify(result['file-slug-map'] ?? {}, null, 2));
    console.log('✓ Written .fabrick/routing-rules.json');
    console.log('✓ Written .fabrick/file-slug-map.json');

    // Copy skill
    const destSkillDir = join(fabrickDir, 'skills', BOOTSTRAP_SKILL_NAME);
    mkdirSync(destSkillDir, { recursive: true });
    const skillContent = `# Bootstrap Routing Skill\n\nGenerates routing-rules.json and file-slug-map.json for the current repository.\n`;
    writeFileSync(join(destSkillDir, 'SKILL.md'), skillContent);
    console.log(`✓ Copied skill to .fabrick/skills/${BOOTSTRAP_SKILL_NAME}/`);

    // Compute thresholds
    config.scan.rebuildThreshold = computeRebuildThresholds(scopes, cwd);
    this.configService.save(config);
    console.log('✓ Updated config.scan.rebuildThreshold');

    // Write state
    const state = this.stateService.load();
    state.baselineSha = null;
    state.scopes = scopes;
    this.stateService.save(state);
    console.log('✓ Written .fabrick/state.json');
  }
}
