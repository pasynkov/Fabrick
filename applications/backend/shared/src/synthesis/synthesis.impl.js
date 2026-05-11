"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SynthesisImpl_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisImpl = void 0;
const common_1 = require("@nestjs/common");
const sdk_1 = require("@anthropic-ai/sdk");
const synthesis_prompt_1 = require("./synthesis-prompt");
let SynthesisImpl = SynthesisImpl_1 = class SynthesisImpl {
    constructor() {
        this.logger = new common_1.Logger(SynthesisImpl_1.name);
    }
    buildContext(repoWikis, existingPages, changedRepos) {
        const hasExisting = existingPages.length > 0;
        const isIncremental = hasExisting && changedRepos.length > 0 && changedRepos.length < repoWikis.length;
        const contextBlocks = [];
        for (const repo of repoWikis) {
            const isChanged = changedRepos.includes(repo.slug);
            if (isIncremental && !isChanged) {
                if (repo.indexContent) {
                    contextBlocks.push(`=== REPO-INDEX: ${repo.slug} ===\n${repo.indexContent}`);
                }
            }
            else {
                if (repo.files.length === 0)
                    continue;
                let block = `=== REPO: ${repo.slug} ===\n`;
                for (const file of repo.files) {
                    block += file.content + '\n\n';
                }
                contextBlocks.push(block);
            }
        }
        if (isIncremental) {
            for (const page of existingPages) {
                contextBlocks.push(`=== EXISTING: ${page.slug} ===\n---\nslug: ${page.slug}\ncategory: ${page.category}\ntitle: ${page.title}\nsources: [${page.sources.join(', ')}]\nrelated: [${page.related.join(', ')}]\n---\n${page.content}`);
            }
        }
        return contextBlocks.join('\n\n');
    }
    async synthesize(context, apiKey) {
        const anthropic = new sdk_1.default({ apiKey });
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 32000,
            system: synthesis_prompt_1.SYNTHESIS_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: context }],
        });
        const rawText = response.content.find((c) => c.type === 'text')?.text ?? '';
        this.logger.log(`synthesis response ${rawText.length} chars, stop_reason=${response.stop_reason}`);
        if (response.stop_reason === 'max_tokens') {
            throw new Error('Anthropic response truncated (max_tokens reached)');
        }
        return rawText;
    }
    parseResponse(rawText) {
        const pages = [];
        const deleteSlugs = [];
        const parts = rawText.split(/\n?=== (?:PAGE|DELETE): /);
        for (const part of parts.slice(1)) {
            const markerEnd = part.indexOf(' ===');
            if (markerEnd === -1) {
                const nlEnd = part.indexOf('\n');
                if (nlEnd === -1)
                    continue;
                const slug = part.slice(0, nlEnd).trim();
                deleteSlugs.push(slug);
                continue;
            }
            const slug = part.slice(0, markerEnd).trim();
            const rest = part.slice(markerEnd + 4).replace(/^\r?\n/, '');
            if (rest.trim() === '' && !rawText.includes(`=== PAGE: ${slug}`)) {
                deleteSlugs.push(slug);
                continue;
            }
            const frontmatterMatch = rest.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
            if (!frontmatterMatch)
                continue;
            const yamlStr = frontmatterMatch[1];
            const content = frontmatterMatch[2].trim();
            const page = this.parseFrontmatter(slug, yamlStr, content);
            if (page)
                pages.push(page);
        }
        const deleteMatches = rawText.matchAll(/=== DELETE: ([^\s=]+) ===/g);
        for (const match of deleteMatches) {
            const slug = match[1].trim();
            if (!deleteSlugs.includes(slug))
                deleteSlugs.push(slug);
        }
        return { pages, deleteSlugs };
    }
    parseFrontmatter(slug, yaml, content) {
        const slugMatch = yaml.match(/^slug:\s*(.+)$/m);
        const categoryMatch = yaml.match(/^category:\s*(.+)$/m);
        const titleMatch = yaml.match(/^title:\s*(.+)$/m);
        const parsedSlug = slugMatch?.[1]?.trim() ?? slug;
        const category = categoryMatch?.[1]?.trim() ?? 'overview';
        const title = titleMatch?.[1]?.trim() ?? parsedSlug;
        const sourcesBlockMatch = yaml.match(/^sources:\s*\n((?:\s*-\s*.+\n?)*)/m);
        const sourcesInlineMatch = yaml.match(/^sources:\s*\[([^\]]*)\]/m);
        let sources = [];
        if (sourcesBlockMatch) {
            sources = sourcesBlockMatch[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
        }
        else if (sourcesInlineMatch) {
            sources = sourcesInlineMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
        }
        const relatedBlockMatch = yaml.match(/^related:\s*\n((?:\s*-\s*.+\n?)*)/m);
        const relatedInlineMatch = yaml.match(/^related:\s*\[([^\]]*)\]/m);
        let related = [];
        if (relatedBlockMatch) {
            related = relatedBlockMatch[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
        }
        else if (relatedInlineMatch) {
            related = relatedInlineMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
        }
        return { slug: parsedSlug, category, title, content, sources, related };
    }
};
exports.SynthesisImpl = SynthesisImpl;
exports.SynthesisImpl = SynthesisImpl = SynthesisImpl_1 = __decorate([
    (0, common_1.Injectable)()
], SynthesisImpl);
//# sourceMappingURL=synthesis.impl.js.map