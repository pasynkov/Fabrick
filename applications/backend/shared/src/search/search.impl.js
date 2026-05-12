"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SearchImpl_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchImpl = void 0;
const common_1 = require("@nestjs/common");
const sdk_1 = require("@anthropic-ai/sdk");
const wiki_repository_interface_1 = require("../wiki-repository.interface");
let SearchImpl = SearchImpl_1 = class SearchImpl {
    constructor(wikiRepo) {
        this.wikiRepo = wikiRepo;
        this.logger = new common_1.Logger(SearchImpl_1.name);
    }
    async search(projectId, question, apiKey) {
        const indexPage = await this.wikiRepo.findBySlug(projectId, 'index');
        if (!indexPage) {
            throw new Error('No wiki pages found. Run synthesis first.');
        }
        const anthropic = new sdk_1.default({ apiKey });
        const slugSelectionResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: 'You are a search assistant. Given a wiki index and a question, return ONLY a JSON array of page slugs most relevant to the question. Return at most 5 slugs. Example: ["entities/user", "logic/auth-flow"]',
            messages: [{
                    role: 'user',
                    content: `Wiki index:\n${indexPage.content}\n\nQuestion: ${question}\n\nReturn only a JSON array of relevant page slugs.`,
                }],
        });
        const slugsText = slugSelectionResponse.content.find((c) => c.type === 'text')?.text ?? '[]';
        let selectedSlugs = [];
        try {
            const match = slugsText.match(/\[[\s\S]*\]/);
            selectedSlugs = match ? JSON.parse(match[0]) : [];
        }
        catch {
            selectedSlugs = [];
        }
        if (selectedSlugs.length === 0) {
            return { answer: 'No relevant information found in the project wiki for this question.', sources: [] };
        }
        const pages = await this.wikiRepo.findBySlugs(projectId, selectedSlugs);
        if (pages.length === 0) {
            return { answer: 'No relevant information found in the project wiki for this question.', sources: [] };
        }
        const pagesText = pages.map((p) => `=== ${p.slug} ===\n${p.content}`).join('\n\n');
        const answerResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: 'You are a helpful assistant answering questions about a software project based on its wiki. Be concise and specific. Use markdown formatting.',
            messages: [{
                    role: 'user',
                    content: `Wiki pages:\n${pagesText}\n\nQuestion: ${question}`,
                }],
        });
        const answer = answerResponse.content.find((c) => c.type === 'text')?.text ?? 'No answer generated.';
        const sources = pages.map((p) => p.slug);
        this.logger.log(`search answered: ${sources.length} pages used`);
        return { answer, sources };
    }
};
exports.SearchImpl = SearchImpl;
exports.SearchImpl = SearchImpl = SearchImpl_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(wiki_repository_interface_1.WIKI_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], SearchImpl);
//# sourceMappingURL=search.impl.js.map