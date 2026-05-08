import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { SearchService } from './search.service';

@Controller({ version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('orgs/:orgSlug/projects/:projectSlug/search')
  @UseGuards(FabrickAuthGuard)
  async search(
    @Request() req: { user: { id: string } },
    @Param('orgSlug') orgSlug: string,
    @Param('projectSlug') projectSlug: string,
    @Body('question') question: string,
  ) {
    return this.searchService.search(req.user.id, orgSlug, projectSlug, question);
  }
}
