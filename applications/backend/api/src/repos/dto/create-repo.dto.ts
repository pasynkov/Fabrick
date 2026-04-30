import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateRepoDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl()
  gitRemote: string;
}
