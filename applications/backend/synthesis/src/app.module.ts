import { Module } from '@nestjs/common';
import { SynthesisModule } from './synthesis/synthesis.module';

@Module({
  imports: [SynthesisModule],
})
export class AppModule {}
