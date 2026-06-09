import { IsString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BundleRefDto {
  @IsString()
  container: string;

  @IsString()
  key: string;

  @IsString()
  hash: string;
}

export class CompendiumCallbackDto {
  @IsString()
  jobId: string;

  @ValidateNested()
  @Type(() => BundleRefDto)
  @IsObject()
  resultBundleRef: BundleRefDto;
}
