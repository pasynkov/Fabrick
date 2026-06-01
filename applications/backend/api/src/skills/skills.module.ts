import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PromptsModule } from '../prompts/prompts.module';
import { SkillsController } from './skills.controller';

@Module({
  imports: [AuthModule, PromptsModule],
  controllers: [SkillsController],
})
export class SkillsModule {}
