import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import { writeConfig } from '../config.js';

const SKILL_SRC = fileURLToPath(new URL('../skills/fabrick-analyze.md', import.meta.url));
const SKILL_DEST = '.claude/skills/fabrick-analyze/SKILL.md';
const CONFIG_PATH = '.fabrick/config.yaml';

export async function init() {
  const { aiTool } = await inquirer.prompt([
    {
      type: 'list',
      name: 'aiTool',
      message: 'Select your AI tool:',
      choices: ['Claude Code'],
    },
  ]);

  const defaultName = basename(resolve('.'));
  const { projectName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: defaultName,
    },
  ]);

  if (existsSync(CONFIG_PATH)) {
    const { overwriteConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwriteConfig',
        message: `.fabrick/config.yaml already exists. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwriteConfig) {
      console.log('Skipped config write.');
    } else {
      writeConfig({ project: projectName, repo: projectName });
      console.log('✓ Written .fabrick/config.yaml');
    }
  } else {
    writeConfig({ project: projectName, repo: projectName });
    console.log('✓ Written .fabrick/config.yaml');
  }

  if (existsSync(SKILL_DEST)) {
    const { overwriteSkill } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwriteSkill',
        message: `${SKILL_DEST} already exists. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwriteSkill) {
      console.log('Skipped skill install.');
    } else {
      mkdirSync('.claude/skills/fabrick-analyze', { recursive: true });
      copyFileSync(SKILL_SRC, SKILL_DEST);
      console.log(`✓ Installed skill: ${SKILL_DEST}`);
    }
  } else {
    mkdirSync('.claude/skills/fabrick-analyze', { recursive: true });
    copyFileSync(SKILL_SRC, SKILL_DEST);
    console.log(`✓ Installed skill: ${SKILL_DEST}`);
  }

  console.log(`
Next steps:
  1. Open Claude Code in this repo
  2. Run /fabrick-analyze to extract context
  3. Run: fabrick push
`);
}
