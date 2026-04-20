import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;

  beforeEach(() => {
    service = new ApiService();
  });

  describe('request() URL normalization', () => {
    function mockFetch(status = 200, body: unknown = {}) {
      global.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(body),
        text: jest.fn().mockResolvedValue(JSON.stringify(body)),
      });
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('trims whitespace from apiUrl', async () => {
      mockFetch(200, { id: '1' });
      await service.get('  http://localhost:3000  ', '/orgs', 'token');

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('http://localhost:3000/orgs');
    });

    it('removes trailing slash from apiUrl', async () => {
      mockFetch(200, { id: '1' });
      await service.get('http://localhost:3000/', '/orgs', 'token');

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('http://localhost:3000/orgs');
    });

    it('handles clean URL without modification', async () => {
      mockFetch(200, { id: '1' });
      await service.get('http://localhost:3000', '/orgs', 'token');

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('http://localhost:3000/orgs');
    });

    it('sends Authorization header with Bearer token', async () => {
      mockFetch(200, {});
      await service.get('http://localhost:3000', '/orgs', 'mytoken');

      const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
      expect(opts.headers['Authorization']).toBe('Bearer mytoken');
    });

    it('throws on non-ok response', async () => {
      mockFetch(401, { message: 'Unauthorized' });
      await expect(service.get('http://localhost:3000', '/orgs', 'bad')).rejects.toThrow('Unauthorized');
    });
  });
});
