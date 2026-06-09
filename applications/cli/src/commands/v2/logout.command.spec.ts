import { existsSync, rmSync } from 'fs';
import { LogoutCommand } from './logout.command';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn(), rmSync: jest.fn() }));

const mockExistsSync = existsSync as jest.Mock;
const mockRmSync = rmSync as jest.Mock;

describe('LogoutCommand', () => {
  let command: LogoutCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new LogoutCommand();
  });

  it('removes credentials.yaml when it exists', async () => {
    mockExistsSync.mockReturnValue(true);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.run();
    expect(mockRmSync).toHaveBeenCalledWith(expect.stringContaining('credentials.yaml'));
    logSpy.mockRestore();
  });

  it('is idempotent when file does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.run();
    expect(mockRmSync).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
