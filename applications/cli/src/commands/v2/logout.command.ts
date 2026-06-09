import { Command, CommandRunner } from 'nest-commander';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

@Command({ name: 'logout', description: 'Remove project-local Fabrick credentials' })
export class LogoutCommand extends CommandRunner {
  async run(): Promise<void> {
    const localPath = join(process.cwd(), '.fabrick', 'credentials.yaml');
    if (!existsSync(localPath)) {
      console.log('Nothing to remove — no local credentials found.');
      return;
    }
    rmSync(localPath);
    console.log('✓ Removed .fabrick/credentials.yaml');
  }
}
