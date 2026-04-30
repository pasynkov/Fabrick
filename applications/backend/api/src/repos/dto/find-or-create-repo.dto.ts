import { IsUrl, IsUUID } from 'class-validator';

export class FindOrCreateRepoDto {
  @IsUrl()
  gitRemote: string;

  @IsUUID()
  projectId: string;
}
