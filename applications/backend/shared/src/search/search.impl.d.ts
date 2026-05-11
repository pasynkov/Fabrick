import { WikiRepository } from '../wiki-repository.interface';
export declare class SearchImpl {
    private readonly wikiRepo;
    private readonly logger;
    constructor(wikiRepo: WikiRepository);
    search(projectId: string, question: string, apiKey: string): Promise<{
        answer: string;
        sources: string[];
    }>;
}
