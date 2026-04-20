import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cli_tokens')
export class CliToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tokenHash: string;

  @Column()
  userId: string;
}
