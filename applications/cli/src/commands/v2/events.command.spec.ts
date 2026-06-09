import { EventsCommand } from './events.command';
import { CredentialsService } from '../../credentials.service';
import { ApiService } from '../../api.service';
import { ConfigService } from '../../services/config.service';

describe('EventsCommand', () => {
  let command: EventsCommand;
  let creds: jest.Mocked<CredentialsService>;
  let api: jest.Mocked<ApiService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    creds = { read: jest.fn(), write: jest.fn(), requireAuth: jest.fn().mockReturnValue({ token: 'tok', api_url: 'http://api' }) } as any;
    api = { get: jest.fn(), post: jest.fn(), request: jest.fn(), download: jest.fn() } as any;
    configService = { load: jest.fn().mockReturnValue({ projectId: 'proj-1', apiUrl: 'http://api', repoId: 'r1', scan: { ignore: [], rebuildThreshold: {} } }), save: jest.fn(), get: jest.fn(), set: jest.fn(), getConfigPath: jest.fn() } as any;
    command = new EventsCommand(creds, api, configService);
  });

  it('calls correct API endpoint with limit=20', async () => {
    api.get.mockResolvedValue([{ id: 'ev-1', type: 'DossierUpdated', createdAt: '2025-01-01' }]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.run([], {});
    expect(api.get).toHaveBeenCalledWith('http://api', expect.stringContaining('/v2/projects/proj-1/events'), 'tok');
    expect(api.get).toHaveBeenCalledWith('http://api', expect.stringContaining('limit=20'), 'tok');
    logSpy.mockRestore();
  });

  it('forwards --types flag', async () => {
    api.get.mockResolvedValue([]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.run([], { types: 'DossierUpdated,DossierPatchApplied' });
    expect(api.get).toHaveBeenCalledWith('http://api', expect.stringContaining('types=DossierUpdated'), 'tok');
    logSpy.mockRestore();
  });
});
