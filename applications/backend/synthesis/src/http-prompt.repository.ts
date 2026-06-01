import { Injectable, Logger } from '@nestjs/common';
import { PromptRecord, PromptRepository } from '@app/shared';

@Injectable()
export class HttpPromptRepository implements PromptRepository {
  private readonly logger = new Logger(HttpPromptRepository.name);
  private readonly apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  async getLatest(name: string, agent: string): Promise<PromptRecord> {
    const url = `${this.apiBaseUrl}/v1/internal/prompts/${encodeURIComponent(name)}/${encodeURIComponent(agent)}/latest`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`No prompt found for (${name}, ${agent}): HTTP ${res.status}`);
    }
    return res.json() as Promise<PromptRecord>;
  }
}
