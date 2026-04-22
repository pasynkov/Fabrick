import { Test } from '@nestjs/testing';
import { SynthesisController } from './synthesis.controller';
import { SynthesisService } from './synthesis.service';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';

const mockSynthesisService = () => ({
  updateStatusFromCallback: jest.fn(),
  triggerForProject: jest.fn(),
  getStatus: jest.fn(),
  getFiles: jest.fn(),
  getSynthesisFileBySlug: jest.fn(),
});

describe('SynthesisController', () => {
  let controller: SynthesisController;
  let synthesisService: ReturnType<typeof mockSynthesisService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SynthesisController],
      providers: [{ provide: SynthesisService, useFactory: mockSynthesisService }],
    })
      .overrideGuard(FabrickAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SynthesisController);
    synthesisService = module.get(SynthesisService);
  });

  it('synthesisCallback delegates to updateStatusFromCallback', async () => {
    synthesisService.updateStatusFromCallback.mockResolvedValue(undefined);

    await controller.synthesisCallback('Bearer my-token', { projectId: 'proj1', status: 'done' });

    expect(synthesisService.updateStatusFromCallback).toHaveBeenCalledWith('my-token', 'proj1', 'done', undefined);
  });

  it('trigger delegates to triggerForProject', async () => {
    synthesisService.triggerForProject.mockResolvedValue(undefined);
    const req = { user: { id: 'uid1' } };

    await controller.trigger(req as any, 'proj1');

    expect(synthesisService.triggerForProject).toHaveBeenCalledWith('proj1', 'uid1');
  });

  it('getStatus delegates to synthesisService.getStatus', async () => {
    const expected = { status: 'done' };
    synthesisService.getStatus.mockResolvedValue(expected);
    const req = { user: { id: 'uid1' } };

    const result = await controller.getStatus(req as any, 'proj1');

    expect(synthesisService.getStatus).toHaveBeenCalledWith('proj1', 'uid1');
    expect(result).toBe(expected);
  });
});
