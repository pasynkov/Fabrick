import { Body, Controller, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { FabrickAuthGuard } from '../../auth/fabrick-auth.guard';
import { SearchServiceV2 } from './search.service.v2';

interface SearchRequestBodyV2 {
  question: string;
  reasoning?: boolean;
}

@Controller({ version: '2' })
export class SearchControllerV2 {
  constructor(private readonly searchServiceV2: SearchServiceV2) {}

  @Post('projects/:id/search')
  @UseGuards(FabrickAuthGuard)
  @HttpCode(200)
  async search(
    @Request() req: { user: { id: string } },
    @Param('id') projectId: string,
    @Body() body: SearchRequestBodyV2,
  ) {
    return this.searchServiceV2.search(req.user.id, projectId, body.question, body.reasoning);
  }
}
