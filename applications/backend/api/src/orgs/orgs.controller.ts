import {
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
import { IsAdminGuard } from '../auth/is-admin.guard';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgNameDto } from './dto/update-org-name.dto';
import { OrgsService } from './orgs.service';

@Controller('orgs')
@UseGuards(FabrickAuthGuard)
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

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
  updateName(
    @Request() req: { user: { id: string } },
    @Param('orgId') orgId: string,
    @Body() body: UpdateOrgNameDto,
  ) {
    return this.orgsService.updateOrgName(orgId, body.name, req.user.id);
  }
}
