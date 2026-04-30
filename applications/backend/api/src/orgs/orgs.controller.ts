import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { IsAdminGuard } from '../auth/is-admin.guard';
import { ApiKeyAuditService } from '../api-keys/api-key-audit.service';
import { AuditLogsQueryDto } from '../api-keys/dto/audit-logs-query.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { OrgsService } from './orgs.service';

@Controller('orgs')
@UseGuards(FabrickAuthGuard)
export class OrgsController {
  constructor(
    private readonly orgsService: OrgsService,
    private readonly apiKeyAuditService: ApiKeyAuditService,
  ) {}

  @Post()
  @HttpCode(201)
  create(
    @Request() req: { user: { id: string } },
    @Body() body: CreateOrgDto,
  ) {
    return this.orgsService.createOrg(req.user.id, body.name);
  }

  @Get()
  list(@Request() req: { user: { id: string } }) {
    return this.orgsService.listOrgs(req.user.id);
  }

  @Post(':orgId/members')
  @HttpCode(201)
  @UseGuards(IsAdminGuard)
  addMember(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Body() body: AddMemberDto,
  ) {
    return this.orgsService.addMember(req.user.id, orgId, body.email, body.password);
  }

  @Get(':orgId/members')
  listMembers(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
  ) {
    return this.orgsService.listMembers(req.user.id, orgId);
  }

  @Patch(':orgId')
  @UseGuards(IsAdminGuard)
  updateOrg(
    @Request() req: { user: { id: string }; ip?: string },
    @Param('orgId') orgId: string,
    @Body() body: UpdateOrgDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.orgsService.updateOrg(orgId, body, {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent,
    });
  }

  @Get(':orgId/api-key/status')
  @UseGuards(IsAdminGuard)
  getApiKeyStatus(
    @Param('orgId') orgId: string,
  ) {
    return this.orgsService.getOrgApiKeyStatus(orgId);
  }

  @Get(':orgId/api-key/audit-logs')
  @UseGuards(IsAdminGuard)
  getAuditLogs(
    @Param('orgId') orgId: string,
    @Query() query: AuditLogsQueryDto,
  ) {
    return this.apiKeyAuditService.getOrganizationAuditLogs(orgId, query.limit, query.offset);
  }
}
