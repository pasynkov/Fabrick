export { SharedModule } from './shared.module';
export { WIKI_REPOSITORY, WikiRepository, WikiPage, WikiPageMeta, extractOneLiner } from './wiki-repository.interface';
export { PROMPT_REPOSITORY, PromptRepository, PromptRecord } from './prompt-repository.interface';
export { WikiPageData, ExistingPage } from './wiki-page.types';
export { SynthesisImpl, RepoWikiInput } from './synthesis/synthesis.impl';
export { SearchImpl, SearchResult, SearchMetrics, StopReason, parseFinalAnswer } from './search/search.impl';
export {
  synthesizeCompendiumBundle,
  parseTopicBodies,
  COMPENDIUM_TOPIC_SLUGS,
} from './synthesize-compendium-bundle';
export {
  COMPENDIUM_REPOSITORY,
  CompendiumRepository,
  CompendiumPage,
  DOSSIER_REPOSITORY,
  DossierRepository,
  DossierPage,
  DossierPageRef,
  SearchImplV2,
  SearchResultV2,
  SearchMetricsV2,
  StopReasonV2,
  SearchBudgetV2,
  parseFinalAnswerV2,
  ParsedFinalAnswerV2,
} from './v2-search';
