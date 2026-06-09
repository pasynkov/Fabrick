import { SearchCommand } from './search.command';
import { CredentialsService } from '../../credentials.service';
import { ApiService } from '../../api.service';
import { ConfigService } from '../../services/config.service';

describe('SearchCommand', () => {
  let command: SearchCommand;
  let creds: jest.Mocked<CredentialsService>;
  let api: jest.Mocked<ApiService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    creds = { read: jest.fn(), write: jest.fn(), requireAuth: jest.fn().mockReturnValue({ token: 'tok', api_url: 'http://api' }) } as any;
    api = { get: jest.fn(), post: jest.fn(), request: jest.fn(), download: jest.fn() } as any;
    configService = { load: jest.fn().mockReturnValue({ projectId: 'proj-1', apiUrl: 'http://api', repoId: 'r1', scan: { ignore: [], rebuildThreshold: {} } }), save: jest.fn(), get: jest.fn(), set: jest.fn(), getConfigPath: jest.fn() } as any;
    command = new SearchCommand(creds, api, configService);
  });

  it('posts with reasoning=false by default', async () => {
    api.post.mockResolvedValue({ answer: 'answer', sources: [] });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.run(['where is auth'], {});
    expect(api.post).toHaveBeenCalledWith('http://api', '/v2/projects/proj-1/search', 'tok', { question: 'where is auth', reasoning: false });
    logSpy.mockRestore();
  });

  it('posts with reasoning=true when flag is set', async () => {
    api.post.mockResolvedValue({ answer: 'answer' });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.run(['what?'], { reasoning: true });
    expect(api.post).toHaveBeenCalledWith('http://api', '/v2/projects/proj-1/search', 'tok', { question: 'what?', reasoning: true });
    logSpy.mockRestore();
  });

  it('prints sources when present', async () => {
    api.post.mockResolvedValue({ answer: 'answer', sources: ['file.ts'] });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.run(['q'], {});
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('sources:'));
    logSpy.mockRestore();
  });
});
