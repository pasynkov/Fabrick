import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';

@Injectable()
export class UlidService {
  generate(): string {
    return ulid();
  }
}
