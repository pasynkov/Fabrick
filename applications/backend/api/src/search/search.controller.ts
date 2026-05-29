import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { SearchService } from './search.service';

interface SearchRequestBody {
  question: string;
  reasoning?: boolean;
}

@Controller({ version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('orgs/:orgSlug/projects/:projectSlug/search')
  @UseGuards(FabrickAuthGuard)
  async search(
    @Request() req: { user: { id: string } },
    @Param('orgSlug') orgSlug: string,
    @Param('projectSlug') projectSlug: string,
    @Body() body: SearchRequestBody,
  ) {
    return this.searchService.search(req.user.id, orgSlug, projectSlug, body.question, body.reasoning);
  }
}
