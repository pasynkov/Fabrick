import { IsOptional, IsString } from 'class-validator';

export class SynthesisCallbackDto {
  @IsString()
  projectId: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  error?: string;
}
