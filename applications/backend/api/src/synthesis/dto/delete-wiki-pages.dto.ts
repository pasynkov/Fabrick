import { IsArray, IsString } from 'class-validator';

export class DeleteWikiPagesDto {
  @IsString()
  projectId: string;

  @IsString()
  callbackToken: string;

  @IsArray()
  @IsString({ each: true })
  slugs: string[];
}
