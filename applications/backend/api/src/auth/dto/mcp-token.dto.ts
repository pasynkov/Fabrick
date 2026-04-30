import { IsString } from 'class-validator';

export class McpTokenDto {
  @IsString()
  orgSlug: string;

  @IsString()
  projectSlug: string;

  @IsString()
  repoId: string;
}
