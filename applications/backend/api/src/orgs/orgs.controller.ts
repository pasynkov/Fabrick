import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { OrgsService } from './orgs.service';

@Controller('orgs')
@UseGuards(FabrickAuthGuard)
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  @HttpCode(201)
  create(
    @Request() req: { user: { id: string } },
    @Body() body: { name: string },
  ) {
    return this.orgsService.createOrg(req.user.id, body.name);
  }

  @Get()
  list(@Request() req: { user: { id: string } }) {
    return this.orgsService.listOrgs(req.user.id);
  }

  @Post(':orgId/members')
  @HttpCode(201)
  addMember(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Body() body: { email: string; password: string },
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
  updateName(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Body() body: { name: string },
  ) {
    if (!body.name || body.name.trim().length === 0) throw new BadRequestException('Name must not be empty');
    if (body.name.length > 128) throw new BadRequestException('Name must not exceed 128 characters');
    return this.orgsService.updateOrgName(orgId, body.name.trim(), req.user.id);
  }
}
