import { WhoamiCommand } from './whoami.command';
import { CredentialsService } from '../../credentials.service';
import { ApiService } from '../../api.service';

describe('WhoamiCommand', () => {
  let command: WhoamiCommand;
  let creds: jest.Mocked<CredentialsService>;
  let api: jest.Mocked<ApiService>;

  beforeEach(() => {
    creds = { read: jest.fn(), write: jest.fn(), requireAuth: jest.fn() } as any;
    api = { get: jest.fn(), post: jest.fn(), request: jest.fn(), download: jest.fn() } as any;
    command = new WhoamiCommand(creds, api);
  });

  it('prints user info when credentials are valid', async () => {
    creds.read.mockReturnValue({ token: 'tok', api_url: 'http://api' });
    api.get.mockResolvedValue({ id: 'user-1', email: 'test@example.com', orgs: [{ name: 'Acme', slug: 'acme' }] });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.run();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('user-1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test@example.com'));
    logSpy.mockRestore();
  });

  it('exits non-zero when not authenticated', async () => {
    creds.read.mockReturnValue(null);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((n: number) => { throw new Error('EXIT_' + n); }) as any);
    await expect(command.run()).rejects.toThrow('EXIT_1');
    exitSpy.mockRestore();
  });

  it('exits non-zero on 401 from backend', async () => {
    creds.read.mockReturnValue({ token: 'tok', api_url: 'http://api' });
    api.get.mockRejectedValue(new Error('HTTP 401'));
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((n: number) => { throw new Error('EXIT_' + n); }) as any);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(command.run()).rejects.toThrow('EXIT_1');
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });
});
