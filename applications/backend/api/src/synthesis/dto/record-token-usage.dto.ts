import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RecordTokenUsageDto {
  @IsString()
  projectId: string;

  @IsString()
  callbackToken: string;

  @IsInt()
  @Min(0)
  inputTokens: number;

  @IsInt()
  @Min(0)
  outputTokens: number;

  @IsOptional()
  @IsUUID()
  promptRevisionId?: string | null;
}
