import { IsEmail, IsString } from 'class-validator';

export class AddMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
