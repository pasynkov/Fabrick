import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkillsController } from './skills.controller';

@Module({
  imports: [AuthModule],
  controllers: [SkillsController],
})
export class SkillsModule {}
