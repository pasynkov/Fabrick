import { Command, CommandRunner } from 'nest-commander';
import { ConfigService, coerceConfigValue } from '../../services/config.service';

@Command({ name: 'config', description: 'Read or update config values', arguments: '<subcommand> [path] [value]' })
export class ConfigCommand extends CommandRunner {
  constructor(private readonly configService: ConfigService) { super(); }

  async run(params: string[]): Promise<void> {
    const [subcommand, dotPath, rawValue] = params;

    if (subcommand === 'path') {
      console.log(this.configService.getConfigPath());
      return;
    }

    if (subcommand === 'get') {
      if (!dotPath) { console.error('Usage: fabrick config get <path>'); process.exit(1); }
      const value = this.configService.get(dotPath);
      console.log(value === undefined ? '' : JSON.stringify(value));
      return;
    }

    if (subcommand === 'set') {
      if (!dotPath || rawValue === undefined) { console.error('Usage: fabrick config set <path> <value>'); process.exit(1); }
      const value = coerceConfigValue(rawValue);
      this.configService.set(dotPath, value);
      console.log(`✓ Set ${dotPath}`);
      return;
    }

    console.error('Usage: fabrick config <get|set|path> [path] [value]');
    process.exit(1);
  }
}
