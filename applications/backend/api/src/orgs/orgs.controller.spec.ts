import { Test } from '@nestjs/testing';
import { OrgsController } from './orgs.controller';
import { OrgsService } from './orgs.service';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';

const mockOrgsService = () => ({
  createOrg: jest.fn(),
  listOrgs: jest.fn(),
  addMember: jest.fn(),
  listMembers: jest.fn(),
});

describe('OrgsController', () => {
  let controller: OrgsController;
  let orgsService: ReturnType<typeof mockOrgsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrgsController],
      providers: [{ provide: OrgsService, useFactory: mockOrgsService }],
    })
      .overrideGuard(FabrickAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OrgsController);
    orgsService = module.get(OrgsService);
  });

  it('create delegates to orgsService.createOrg', async () => {
    const expected = { id: 'org1', name: 'Acme', slug: 'acme' };
    orgsService.createOrg.mockResolvedValue(expected);
    const req = { user: { id: 'uid1' } };

    const result = await controller.create(req as any, { name: 'Acme' });

    expect(orgsService.createOrg).toHaveBeenCalledWith('uid1', 'Acme');
    expect(result).toBe(expected);
  });

  it('list delegates to orgsService.listOrgs', async () => {
    const expected = [{ id: 'org1', name: 'Acme', slug: 'acme', role: 'admin' }];
    orgsService.listOrgs.mockResolvedValue(expected);
    const req = { user: { id: 'uid1' } };

    const result = await controller.list(req as any);

    expect(orgsService.listOrgs).toHaveBeenCalledWith('uid1');
    expect(result).toBe(expected);
  });

  it('addMember delegates to orgsService.addMember', async () => {
    const expected = { userId: 'uid2', email: 'b@b.com', role: 'member' };
    orgsService.addMember.mockResolvedValue(expected);
    const req = { user: { id: 'uid1' } };

    const result = await controller.addMember(req as any, 'org1', { email: 'b@b.com', password: 'pass1234' });

    expect(orgsService.addMember).toHaveBeenCalledWith('uid1', 'org1', 'b@b.com', 'pass1234');
    expect(result).toBe(expected);
  });
});
