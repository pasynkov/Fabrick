import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WikiPageDto {
  @IsString()
  slug: string;

  @IsString()
  category: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsArray()
  @IsString({ each: true })
  sources: string[];

  @IsArray()
  @IsString({ each: true })
  related: string[];
}

export class UpsertWikiPagesDto {
  @IsString()
  projectId: string;

  @IsString()
  callbackToken: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WikiPageDto)
  pages: WikiPageDto[];
}
