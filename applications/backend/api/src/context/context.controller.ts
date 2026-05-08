import { Controller } from '@nestjs/common';

// Context upload moved to /repos/:repoId/context (see repos.controller.ts)
@Controller({ version: '1' })
export class ContextController {}
