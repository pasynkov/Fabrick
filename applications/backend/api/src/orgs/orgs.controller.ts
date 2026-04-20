import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AnyAuthGuard } from '../auth/any-auth.guard';
import { OrgsService } from './orgs.service';

@Controller('orgs')
@UseGuards(AnyAuthGuard)
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
}
