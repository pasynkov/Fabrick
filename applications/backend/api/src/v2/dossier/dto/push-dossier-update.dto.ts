import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsIn, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class DossierEventInputDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsObject()
  bodies?: Record<string, string>;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class ScopeEntryDto {
  @IsString()
  scope: string;

  @IsIn(['patch', 'regen', 'delete'])
  mode: 'patch' | 'regen' | 'delete';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DossierEventInputDto)
  events: DossierEventInputDto[];
}

export class PushDossierUpdateDto {
  @IsString()
  baseSha: string;

  @IsString()
  headSha: string;

  @IsOptional()
  @IsString()
  prTitle?: string;

  @IsOptional()
  @IsNumber()
  prNumber?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScopeEntryDto)
  scopes: ScopeEntryDto[];
}
