import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreatePromptRevisionDto {
  @IsObject()
  files: Record<string, string>;

  @IsOptional()
  @IsString()
  note?: string;
}
