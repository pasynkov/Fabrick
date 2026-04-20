import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { parse, stringify } from 'yaml';

const CONFIG_PATH = '.fabrick/config.yaml';

export function readConfig() {
  try {
    const content = readFileSync(CONFIG_PATH, 'utf8');
    return parse(content);
  } catch {
    throw new Error('`.fabrick/config.yaml` not found. Run `fabrick init` first.');
  }
}

export function writeConfig({ project, repo, backendUrl = 'http://localhost:3000' }) {
  mkdirSync('.fabrick', { recursive: true });
  writeFileSync(CONFIG_PATH, stringify({ project, repo, backendUrl }));
}
