import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { FabrickAuthGuard } from '../auth/fabrick-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller({ version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('projects/:id/usage-analytics')
  @UseGuards(FabrickAuthGuard)
  async getUsage(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.analyticsService.getUsageForProject(id, req.user.id);
  }
}
