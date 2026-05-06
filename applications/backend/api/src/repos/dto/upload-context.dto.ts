import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO for the multipart form data sent to POST /repos/:repoId/context.
 * The `triggerSynthesis` field is optional and arrives as a string from
 * multipart form data, so a @Transform decorator converts it to a boolean.
 */
export class UploadContextDto {
  /** When true, the backend will trigger synthesis after storing the context. */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  triggerSynthesis?: boolean;
}
