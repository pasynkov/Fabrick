import { WikiPageData, ExistingPage } from '../wiki-page.types';
export interface RepoWikiInput {
    slug: string;
    files: {
        path: string;
        content: string;
    }[];
    indexContent?: string;
}
export declare class SynthesisImpl {
    private readonly logger;
    buildContext(repoWikis: RepoWikiInput[], existingPages: ExistingPage[], changedRepos: string[]): string;
    synthesize(context: string, apiKey: string): Promise<string>;
    parseResponse(rawText: string): {
        pages: WikiPageData[];
        deleteSlugs: string[];
    };
    parseFrontmatter(slug: string, yaml: string, content: string): WikiPageData | null;
}
