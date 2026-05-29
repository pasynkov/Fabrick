import { IsInt, IsString, Min } from 'class-validator';

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
}
