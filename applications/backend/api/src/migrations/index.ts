import { DropCliTokens1745000000000 } from './1745000000000-DropCliTokens';
import { Init1700000000000 } from './1700000000000-Init';
import { AddApiKeys1745100000000 } from './1745100000000-AddApiKeys';
import { WidenKeyHash1745200000000 } from './1745200000000-WidenKeyHash';
import { AddAutoSynthesisEnabled1745300000000 } from './1745300000000-AddAutoSynthesisEnabled';
import { AddWikiPages1746700000000 } from './1746700000000-AddWikiPages';
import { AddUsageAnalytics1748000000000 } from './1748000000000-AddUsageAnalytics';
import { AddPlatformAdmin1748100000000 } from './1748100000000-AddPlatformAdmin';
import { AddPromptRevisions1748200000000 } from './1748200000000-AddPromptRevisions';
import { SeedPromptRevisions1748200100000 } from './1748200100000-SeedPromptRevisions';
import { AddPromptRevisionIdToAnalytics1748200200000 } from './1748200200000-AddPromptRevisionIdToAnalytics';

export const migrations = [
  Init1700000000000,
  DropCliTokens1745000000000,
  AddApiKeys1745100000000,
  WidenKeyHash1745200000000,
  AddAutoSynthesisEnabled1745300000000,
  AddWikiPages1746700000000,
  AddUsageAnalytics1748000000000,
  AddPlatformAdmin1748100000000,
  AddPromptRevisions1748200000000,
  SeedPromptRevisions1748200100000,
  AddPromptRevisionIdToAnalytics1748200200000,
];
