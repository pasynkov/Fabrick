export const PROMPT_REPOSITORY = Symbol('PROMPT_REPOSITORY');

export interface PromptRecord {
  id: string;
  name: string;
  agent: string;
  revision: number;
  content: {
    files: Record<string, string>;
  };
}

export interface PromptRepository {
  getLatest(name: string, agent: string): Promise<PromptRecord>;
}
