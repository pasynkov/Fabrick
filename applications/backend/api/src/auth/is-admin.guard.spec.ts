import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrgMember } from '../entities/org-member.entity';
import { IsAdminGuard } from './is-admin.guard';

const mockMemberRepo = () => ({ findOne: jest.fn() });

function makeContext(userId: string | undefined, orgId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId !== undefined ? { id: userId } : undefined,
        params: orgId !== undefined ? { orgId } : {},
      }),
    }),
  } as any;
}

describe('IsAdminGuard', () => {
  let guard: IsAdminGuard;
  let memberRepo: ReturnType<typeof mockMemberRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IsAdminGuard,
        { provide: getRepositoryToken(OrgMember), useFactory: mockMemberRepo },
      ],
    }).compile();

    guard = module.get(IsAdminGuard);
    memberRepo = module.get(getRepositoryToken(OrgMember));
  });

  it('returns true when user is admin', async () => {
    memberRepo.findOne.mockResolvedValue({ role: 'admin' });
    const result = await guard.canActivate(makeContext('uid1', 'org1'));
    expect(result).toBe(true);
    expect(memberRepo.findOne).toHaveBeenCalledWith({ where: { orgId: 'org1', userId: 'uid1' } });
  });

  it('throws ForbiddenException when user is member (not admin)', async () => {
    memberRepo.findOne.mockResolvedValue({ role: 'member' });
    await expect(guard.canActivate(makeContext('uid1', 'org1'))).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is not in org', async () => {
    memberRepo.findOne.mockResolvedValue(null);
    await expect(guard.canActivate(makeContext('uid1', 'org1'))).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when orgId is missing', async () => {
    await expect(guard.canActivate(makeContext('uid1', undefined))).rejects.toThrow(BadRequestException);
  });
});
