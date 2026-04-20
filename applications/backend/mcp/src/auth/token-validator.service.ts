import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { CliToken } from './cli-token.entity';

@Injectable()
export class TokenValidatorService {
  constructor(
    @InjectRepository(CliToken)
    private readonly tokenRepo: Repository<CliToken>,
  ) {}

  async validate(rawToken: string): Promise<boolean> {
    if (!rawToken) return false;
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.tokenRepo.findOne({ where: { tokenHash: hash } });
    return !!record;
  }
}
