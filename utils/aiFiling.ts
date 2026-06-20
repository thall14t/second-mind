import {
  AiAssistPayload,
  Card,
  CardFilingDetailsSuggestion,
  CardFilingSuggestion,
  CardSource,
  CaptureStructuringResult,
  FilingLeafCandidate,
  FilingWhyContext,
  InboxCapture,
  ManagedCategory,
  ThinkingState,
} from '../types';
import {
  deriveConfidenceBand,
  forceManualReviewSuggestion,
  isReusableShelfTitle,
} from './aiCataloguing';
import {
  getNextCardAddress,
  getNextCategoryAddress,
  normalizeAddress,
  normalizeCardSource,
  parseRange,
} from './antinet';

export interface FilingPlanLike {
  payload: {
    semanticHints?: string[];
    leafCandidates: FilingLeafCandidate[];
  };
  preview: ThinkingState['filingPreview'];
  quickSuggestion: CardFilingSuggestion;
  localDetails: CardFilingDetailsSuggestion;
}

const AI_SHORTLIST_STOPWORDS = new Set([
  'about',
  'after',
  'also',
  'and',
  'card',
  'from',
  'have',
  'into',
  'just',
  'main',
  'note',
  'page',
  'quote',
  'that',
  'this',
  'with',
]);

const serializeCategoryNodeForAi = (category: ManagedCategory): AiAssistPayload['topLevelCategories'][number] => ({
  id: category.id,
  range: category.range,
  title: category.title,
  isLeaf: Boolean(category.isLeaf),
  children: [],
});

const tokenizeShortlistText = (value: string) =>
  Array.from(
    new Set(
      (value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(token => !AI_SHORTLIST_STOPWORDS.has(token))
    )
  );

const scoreShortlistMatch = (tokens: string[], values: Array<string | undefined>) => {
  const haystack = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += token.length >= 7 ? 5 : 3;
    }
  }

  return score;
};

export const findSmallestContainingRange = (address: string, allCategories: ManagedCategory[]) => {
  const numericAddress = parseInt(normalizeAddress(address), 10);
  if (Number.isNaN(numericAddress)) {
    return null;
  }

  return allCategories
    .filter(category => category.range.includes('-'))
    .map(category => ({ category, parsed: parseRange(category.range) }))
    .filter((entry): entry is { category: ManagedCategory; parsed: { start: number; end: number } } =>
      Boolean(entry.parsed) &&
      numericAddress >= entry.parsed!.start &&
      numericAddress <= entry.parsed!.end
    )
    .sort((a, b) => (a.parsed.end - a.parsed.start) - (b.parsed.end - b.parsed.start))[0]?.category ?? null;
};

export const resolveSuggestedNewCategoryRange = (
  suggestion: CardFilingSuggestion,
  allCategories: ManagedCategory[]
) => {
  const rawRange = normalizeAddress(suggestion.suggestedNewCategoryRange || suggestion.suggestedCategoryRange);
  if (/^\d{4}$/.test(rawRange)) {
    return rawRange;
  }

  const parentRange = normalizeAddress(suggestion.suggestedParentRange);
  if (parentRange.includes('-')) {
    const matchingParentRange = allCategories.find(category => normalizeAddress(category.range) === parentRange);
    if (matchingParentRange) {
      return getNextCategoryAddress(matchingParentRange);
    }
  }

  const suggestedParsedRange = parseRange(rawRange);
  if (suggestedParsedRange && rawRange.includes('-')) {
    const matchingRange = allCategories.find(category => normalizeAddress(category.range) === rawRange);
    if (matchingRange) {
      return getNextCategoryAddress(matchingRange);
    }
  }

  const suggestedCardPrefix = normalizeAddress(suggestion.suggestedCardAddress).slice(0, 4);
  if (/^\d{4}$/.test(suggestedCardPrefix)) {
    return suggestedCardPrefix;
  }

  return rawRange;
};

export const createFilingThinkingState = (preview: ThinkingState['filingPreview']): ThinkingState => ({
  kind: 'filing',
  title: 'Suggesting filing',
  body: 'Second Mind is narrowing your draft to the strongest master range and leaf category.',
  steps: [
    {
      label: 'Rank master ranges',
      value: preview?.topMasterRange ? `${preview.topMasterRange} ${preview.topMasterRangeTitle}`.trim() : 'Reading the category map',
      state: 'active',
    },
    {
      label: 'Choose category',
      value: preview?.selectedCategory ? `${preview.selectedCategory} ${preview.selectedCategoryTitle}`.trim() : 'Choosing the best leaf category',
      state: 'pending',
    },
    {
      label: 'Pick address',
      value: preview?.suggestedAddress || 'Choosing the next open address',
      state: 'pending',
    },
  ],
  filingPreview: preview,
});

export const applyFilingThinkingResult = (
  previousState: ThinkingState,
  suggestion: CardFilingSuggestion
): ThinkingState => ({
  ...previousState,
  steps: [
    {
      label: 'Rank master ranges',
      value: `${suggestion.selectedMasterRange} ${suggestion.selectedMasterRangeTitle}`.trim(),
      state: 'done',
    },
    {
      label: 'Choose category',
      value: suggestion.mode === 'new_category'
        ? `${suggestion.suggestedNewCategoryRange} ${suggestion.suggestedNewCategoryTitle}`.trim()
        : suggestion.mode === 'existing_category'
          ? `${suggestion.suggestedCategoryRange} ${suggestion.suggestedCategoryTitle}`.trim()
          : 'Manual review suggested',
      state: 'done',
    },
    {
      label: 'Pick address',
      value: suggestion.suggestedCardAddress || 'No address selected',
      state: 'done',
    },
  ],
  filingPreview: {
    draftTitle: previousState.filingPreview?.draftTitle ?? '',
    topMasterRange: suggestion.selectedMasterRange ?? '',
    topMasterRangeTitle: suggestion.selectedMasterRangeTitle ?? '',
    selectedCategory: suggestion.mode === 'new_category'
      ? suggestion.suggestedNewCategoryRange
      : suggestion.suggestedCategoryRange,
    selectedCategoryTitle: suggestion.mode === 'new_category'
      ? suggestion.suggestedNewCategoryTitle
      : suggestion.suggestedCategoryTitle,
    suggestedAddress: suggestion.suggestedCardAddress,
  },
});

export const buildSmartCategoryShortlist = ({
  draft,
  filingPlan,
  categoryTree,
  allCategories,
}: {
  draft: AiAssistPayload['draft'];
  filingPlan?: FilingPlanLike;
  categoryTree: ManagedCategory[];
  allCategories: ManagedCategory[];
}): AiAssistPayload['topLevelCategories'] => {
  const roots = categoryTree.map(topLevel => {
    const node = serializeCategoryNodeForAi(topLevel);
    node.children = (topLevel.children ?? []).map(child => ({
      ...serializeCategoryNodeForAi(child),
      children: [],
    }));
    return node;
  });

  const nodeById = new Map<string, AiAssistPayload['topLevelCategories'][number]>();
  const categoryById = new Map(allCategories.map(category => [category.id, category]));

  const registerNode = (node: AiAssistPayload['topLevelCategories'][number], rootRange: string) => {
    nodeById.set(node.id, node);
    for (const child of node.children ?? []) {
      registerNode(child, rootRange);
    }
  };

  roots.forEach(root => registerNode(root, root.range));

  const draftTokens = tokenizeShortlistText(
    [
      draft.address,
      draft.title,
      draft.content,
      draft.tags.join(' '),
      draft.source?.title ?? '',
      draft.source?.author ?? '',
      draft.source?.page ?? '',
      draft.source?.url ?? '',
      draft.source?.note ?? '',
    ]
      .filter(Boolean)
      .join(' ')
  );

  const rankedLeafIds = new Map<string, number>();
  for (const [index, candidate] of (filingPlan?.payload.leafCandidates ?? []).entries()) {
    rankedLeafIds.set(candidate.id, Math.max(0, 24 - index * 4));
  }

  const selectedMasterRanges = new Set<string>(
    [
      filingPlan?.quickSuggestion.selectedMasterRange,
      ...(filingPlan?.quickSuggestion.alternativeSuggestions ?? []).map(candidate => candidate.selectedMasterRange),
    ]
      .filter(Boolean)
      .map(range => normalizeAddress(range ?? ''))
  );

  const scoredLeafs = allCategories
    .filter(category => Boolean(category.isLeaf))
    .map(category => {
      const parent = category.parentId ? categoryById.get(category.parentId) : null;
      const topLevelRange = findSmallestContainingRange(category.range, allCategories)?.range ?? '';
      const rootBoost = selectedMasterRanges.has(normalizeAddress(topLevelRange)) ? 6 : 0;
      const parentTitle = parent?.title ?? '';
      const score =
        scoreShortlistMatch(draftTokens, [category.range, category.title, parentTitle, topLevelRange]) +
        (rankedLeafIds.get(category.id) ?? 0) +
        rootBoost;

      return {
        category,
        score,
        topLevelRange: normalizeAddress(topLevelRange),
      };
    })
    .filter(entry => entry.score > 0 && entry.topLevelRange)
    .sort((first, second) => second.score - first.score || first.category.range.localeCompare(second.category.range));

  const maxLeafsPerTopLevel = 3;
  const maxLeafsTotal = 18;
  const selectedLeafIds = new Set<string>();
  const selectedCountsByTopLevel = new Map<string, number>();

  for (const entry of scoredLeafs) {
    if (selectedLeafIds.size >= maxLeafsTotal) {
      break;
    }

    const used = selectedCountsByTopLevel.get(entry.topLevelRange) ?? 0;
    if (used >= maxLeafsPerTopLevel) {
      continue;
    }

    selectedLeafIds.add(entry.category.id);
    selectedCountsByTopLevel.set(entry.topLevelRange, used + 1);
  }

  const sortNodes = (nodes: AiAssistPayload['topLevelCategories']) => {
    nodes.sort((first, second) => {
      const firstParsed = parseRange(first.range)?.start;
      const secondParsed = parseRange(second.range)?.start;
      const firstNumeric = Number.parseInt(first.range, 10);
      const secondNumeric = Number.parseInt(second.range, 10);
      const firstStart = firstParsed ?? (Number.isNaN(firstNumeric) ? Number.MAX_SAFE_INTEGER : firstNumeric);
      const secondStart = secondParsed ?? (Number.isNaN(secondNumeric) ? Number.MAX_SAFE_INTEGER : secondNumeric);
      return firstStart - secondStart;
    });
  };

  for (const leafId of selectedLeafIds) {
    const leafCategory = categoryById.get(leafId);
    if (!leafCategory) {
      continue;
    }

    let ancestor = leafCategory.parentId ? categoryById.get(leafCategory.parentId) : null;
    let hostNode: AiAssistPayload['topLevelCategories'][number] | null = null;

    while (ancestor && !hostNode) {
      hostNode = nodeById.get(ancestor.id) ?? null;
      ancestor = ancestor.parentId ? categoryById.get(ancestor.parentId) : null;
    }

    if (!hostNode) {
      continue;
    }

    if ((hostNode.children ?? []).some(child => child.id === leafCategory.id)) {
      continue;
    }

    hostNode.children = [
      ...(hostNode.children ?? []),
      {
        ...serializeCategoryNodeForAi(leafCategory),
        children: [],
      },
    ];
    sortNodes(hostNode.children);
  }

  sortNodes(roots);
  return roots;
};

export const buildAiAssistPayload = ({
  draft,
  rejectedSuggestion,
  semanticHints = [],
  filingPlan,
  categoryTree,
  allCategories,
}: {
  draft: AiAssistPayload['draft'];
  rejectedSuggestion?: CardFilingSuggestion | null;
  semanticHints?: string[];
  filingPlan?: FilingPlanLike;
  categoryTree: ManagedCategory[];
  allCategories: ManagedCategory[];
}): AiAssistPayload => ({
  draft,
  rejectedSuggestion: rejectedSuggestion ?? undefined,
  semanticHints,
  topLevelCategories: buildSmartCategoryShortlist({
    draft,
    filingPlan,
    categoryTree,
    allCategories,
  }),
});

export const mergeFilingSuggestionWithLocalDetails = (
  suggestion: CardFilingSuggestion,
  localDetails: CardFilingDetailsSuggestion,
  draftSource?: CardSource,
  alternativeSuggestions: CardFilingSuggestion[] = []
): CardFilingSuggestion => {
  const normalizedSuggestionSource = normalizeCardSource(suggestion.suggestedSource);
  const normalizedDraftSource = normalizeCardSource(draftSource);
  const confidence = Math.max(suggestion.confidence ?? 0, localDetails.confidence ?? 0);
  const resolvedAlternatives =
    (suggestion.alternativeSuggestions?.length ?? 0) > 0
      ? suggestion.alternativeSuggestions
      : alternativeSuggestions;

  return {
    ...suggestion,
    suggestedTitle: suggestion.suggestedTitle?.trim() || localDetails.suggestedTitle?.trim() || '',
    suggestedContent: suggestion.suggestedContent?.trim() ?? '',
    suggestedTags: suggestion.suggestedTags.length > 0 ? suggestion.suggestedTags : localDetails.suggestedTags,
    suggestedStatus: suggestion.suggestedStatus ?? localDetails.suggestedStatus,
    suggestedRelatedAddresses:
      suggestion.suggestedRelatedAddresses.length > 0
        ? suggestion.suggestedRelatedAddresses
        : localDetails.suggestedRelatedAddresses,
    suggestedSource: normalizedSuggestionSource ?? normalizedDraftSource,
    corrections: suggestion.corrections ?? [],
    confidence,
    confidenceBand: suggestion.confidenceBand ?? deriveConfidenceBand(confidence),
    alternativeSuggestions:
      (suggestion.confidenceBand ?? deriveConfidenceBand(confidence)) === 'high'
        ? []
        : (resolvedAlternatives ?? []).map(candidate => ({
            ...candidate,
            alternativeSuggestions: [],
          })),
  };
};

export const buildDraftFromCaptureStructuring = (
  enrichment: {
    suggestedTitle?: string;
    suggestedContent?: string;
    suggestedSource?: CardSource;
    suggestedTags?: string[];
  },
  address = ''
): AiAssistPayload['draft'] => ({
  address,
  title: enrichment.suggestedTitle?.trim() ?? '',
  content: enrichment.suggestedContent?.trim() ?? '',
  tags: enrichment.suggestedTags ?? [],
  source: normalizeCardSource(enrichment.suggestedSource),
});

export interface InboxCardFormFields {
  title: string;
  content: string;
  status: 'Seed' | 'Growing' | 'Evergreen';
  tagsText: string;
  relatedAddressesText: string;
  sourceType: CardSource['type'];
  sourceTitle: string;
  sourceAuthor: string;
  sourceUrl: string;
  sourcePage: string;
  sourceNote: string;
}

const mergeTags = (baseTags: string[], extraTags: string[]): string => {
  const merged = Array.from(new Set([
    ...baseTags.map(tag => tag.trim()).filter(Boolean),
    ...extraTags.map(tag => tag.trim()).filter(Boolean),
  ]));
  return merged.join(', ');
};

const mergeRelatedAddresses = (
  baseAddresses: string[],
  extraAddresses: string[],
  cards: Card[],
  excludeAddress?: string
): string => {
  const existingCardAddresses = new Set(cards.map(card => normalizeAddress(card.address)));
  const excluded = excludeAddress ? normalizeAddress(excludeAddress) : '';
  const merged = Array.from(new Set([
    ...baseAddresses.map(normalizeAddress).filter(Boolean),
    ...extraAddresses
      .map(normalizeAddress)
      .filter(address => existingCardAddresses.has(address))
      .filter(address => address !== excluded),
  ]));
  return merged.join(', ');
};

const defaultCardSource = (): CardSource => ({ type: 'Other' });

const sourceFieldIsRicher = (
  candidate: CardSource | undefined,
  current: CardSource | undefined
): boolean => {
  const normalizedCandidate = normalizeCardSource(candidate) ?? defaultCardSource();
  const normalizedCurrent = normalizeCardSource(current) ?? defaultCardSource();
  const candidateScore = [
    normalizedCandidate.title,
    normalizedCandidate.author,
    normalizedCandidate.url,
    normalizedCandidate.page,
    normalizedCandidate.note,
    normalizedCandidate.type !== 'Other' ? normalizedCandidate.type : '',
  ].filter(Boolean).length;
  const currentScore = [
    normalizedCurrent.title,
    normalizedCurrent.author,
    normalizedCurrent.url,
    normalizedCurrent.page,
    normalizedCurrent.note,
    normalizedCurrent.type !== 'Other' ? normalizedCurrent.type : '',
  ].filter(Boolean).length;

  return candidateScore > currentScore;
};

export const buildCardFormFieldsFromCaptureEnrichment = ({
  capture,
  enrichment,
  filingSuggestion = null,
  cards = [],
  cardAddress = '',
}: {
  capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>;
  enrichment: CaptureStructuringResult | null;
  filingSuggestion?: CardFilingSuggestion | null;
  cards?: Card[];
  cardAddress?: string;
}): InboxCardFormFields => {
  const enrichmentSource = normalizeCardSource(enrichment?.suggestedSource);
  let title = enrichment?.suggestedTitle?.trim() || capture.title;
  let content = enrichment?.suggestedContent?.trim() || capture.content;
  let status: 'Seed' | 'Growing' | 'Evergreen' = enrichment?.suggestedStatus ?? 'Seed';
  let tagsText = (enrichment?.suggestedTags ?? []).join(', ');
  let relatedAddressesText = (enrichment?.suggestedRelatedAddresses ?? []).join(', ');
  let source: CardSource = enrichmentSource ?? normalizeCardSource({
    type: 'Other',
    note: capture.sourceText?.trim() || undefined,
  }) ?? defaultCardSource();

  if (filingSuggestion) {
    if (filingSuggestion.suggestedTitle?.trim()) {
      title = filingSuggestion.suggestedTitle.trim();
    }

    if (filingSuggestion.suggestedContent?.trim()) {
      content = filingSuggestion.suggestedContent.trim();
    }

    if (filingSuggestion.suggestedTags.length > 0) {
      tagsText = mergeTags(
        tagsText ? tagsText.split(',').map(tag => tag.trim()) : [],
        filingSuggestion.suggestedTags
      );
    }

    if (filingSuggestion.suggestedRelatedAddresses.length > 0) {
      relatedAddressesText = mergeRelatedAddresses(
        relatedAddressesText ? relatedAddressesText.split(',').map(address => address.trim()) : [],
        filingSuggestion.suggestedRelatedAddresses,
        cards,
        cardAddress
      );
    }

    if (['Seed', 'Growing', 'Evergreen'].includes(filingSuggestion.suggestedStatus)) {
      status = filingSuggestion.suggestedStatus;
    }

    if (sourceFieldIsRicher(filingSuggestion.suggestedSource, source)) {
      source = normalizeCardSource(filingSuggestion.suggestedSource) ?? source;
    }
  }

  return {
    title,
    content,
    status,
    tagsText,
    relatedAddressesText,
    sourceType: source.type,
    sourceTitle: source.title ?? '',
    sourceAuthor: source.author ?? '',
    sourceUrl: source.url ?? '',
    sourcePage: source.page ?? '',
    sourceNote: source.note ?? capture.sourceText ?? '',
  };
};

export const normalizeHierarchicalSuggestion = ({
  suggestion,
  cards,
  editingCardId,
  allCategories,
}: {
  suggestion: CardFilingSuggestion;
  cards: Card[];
  editingCardId?: string | null;
  allCategories: ManagedCategory[];
}): CardFilingSuggestion => {
  const normalizedSuggestion = { ...suggestion };
  const cardsForAddressing = cards.filter(card => card.id !== editingCardId);

  if (normalizedSuggestion.mode === 'existing_category') {
    const categoryRange = normalizeAddress(normalizedSuggestion.suggestedCategoryRange);
    normalizedSuggestion.suggestedParentRange = '';
    normalizedSuggestion.suggestedParentTitle = '';
    if (!normalizedSuggestion.suggestedCardAddress && /^\d{4}$/.test(categoryRange)) {
      normalizedSuggestion.suggestedCardAddress = getNextCardAddress(categoryRange, cardsForAddressing);
    }
  }

  if (normalizedSuggestion.mode === 'new_category') {
    const suggestedRange = resolveSuggestedNewCategoryRange(normalizedSuggestion, allCategories);
    if (/^\d{4}$/.test(suggestedRange)) {
      normalizedSuggestion.suggestedNewCategoryRange = suggestedRange;
      if (!normalizedSuggestion.suggestedCardAddress) {
        normalizedSuggestion.suggestedCardAddress = `${suggestedRange}a`;
      }
    }
  }

  if (normalizedSuggestion.mode === 'manual_review') {
    normalizedSuggestion.suggestedParentRange = '';
    normalizedSuggestion.suggestedParentTitle = '';
    normalizedSuggestion.suggestedNewCategoryRange = '';
    normalizedSuggestion.suggestedCardAddress = '';
  }

  return normalizedSuggestion;
};

export const buildFilingWhyContext = (
  attempted: CardFilingSuggestion,
  notAppliedReason: string
): FilingWhyContext => {
  let considered = 'Second Mind compared your card against the category tree.';

  if (attempted.mode === 'new_category') {
    const parent = [attempted.suggestedParentRange, attempted.suggestedParentTitle]
      .map(value => value?.trim())
      .filter(Boolean)
      .join(' — ');
    const shelf = attempted.suggestedNewCategoryTitle?.trim();
    if (shelf && parent) {
      considered = `New shelf "${shelf}" under ${parent}`;
    } else if (shelf) {
      considered = `New shelf "${shelf}"`;
    } else if (parent) {
      considered = `A new shelf under ${parent}`;
    }
  } else if (attempted.mode === 'existing_category') {
    const label = [attempted.suggestedCategoryRange, attempted.suggestedCategoryTitle]
      .map(value => value?.trim())
      .filter(Boolean)
      .join(' — ');
    if (label) {
      considered = `Existing shelf ${label}`;
    }
  } else if (attempted.reasoning?.trim()) {
    considered = attempted.reasoning.trim();
  }

  return {
    considered,
    notApplied: notAppliedReason.trim() || 'Second Mind needs a quick manual review for this filing.',
  };
};

export const ensureManualReviewFilingWhy = (
  suggestion: CardFilingSuggestion
): CardFilingSuggestion => {
  if (suggestion.mode !== 'manual_review' || suggestion.filingWhy) {
    return suggestion;
  }

  const attempted =
    suggestion.alternativeSuggestions?.find(candidate => candidate.mode !== 'manual_review') ??
    suggestion.alternativeSuggestions?.[0] ??
    suggestion;
  const notAppliedReason =
    suggestion.reasoning?.trim() ||
    'Second Mind needs a quick manual review for this filing.';

  return {
    ...suggestion,
    filingWhy: buildFilingWhyContext(attempted, notAppliedReason),
  };
};

export const buildManualReviewFallbackSuggestion = ({
  draft,
  baseSuggestion,
  reasoning,
  alternatives = [],
}: {
  draft: AiAssistPayload['draft'];
  baseSuggestion: CardFilingSuggestion;
  reasoning: string;
  alternatives?: CardFilingSuggestion[];
}): CardFilingSuggestion => {
  const suggestion = forceManualReviewSuggestion(
    baseSuggestion,
    draft,
    reasoning,
    alternatives,
    Math.min(0.52, baseSuggestion.confidence ?? 0.52)
  );

  return {
    ...suggestion,
    filingWhy: buildFilingWhyContext(baseSuggestion, reasoning),
  };
};

export const finalizeFilingSuggestion = ({
  suggestion,
  draft,
  filingPlan,
  allCategories,
  cards,
  editingCardId,
}: {
  suggestion: CardFilingSuggestion;
  draft: AiAssistPayload['draft'];
  filingPlan: FilingPlanLike;
  allCategories: ManagedCategory[];
  cards: Card[];
  editingCardId?: string | null;
}) => {
  const normalizedSuggestion = normalizeHierarchicalSuggestion({
    suggestion,
    cards,
    editingCardId,
    allCategories,
  });

  if (
    normalizedSuggestion.mode === 'existing_category' &&
    !/^\d{4}$/.test(normalizeAddress(normalizedSuggestion.suggestedCategoryRange))
  ) {
    return buildManualReviewFallbackSuggestion({
      draft,
      baseSuggestion: normalizedSuggestion,
      reasoning: 'Second Mind could not verify a specific existing filing shelf, so please review the nearby options.',
      alternatives: [
        filingPlan.quickSuggestion,
        ...(filingPlan.quickSuggestion.alternativeSuggestions ?? []),
      ],
    });
  }

  if (
    normalizedSuggestion.mode === 'new_category' &&
    !normalizeAddress(normalizedSuggestion.suggestedParentRange)
  ) {
    return buildManualReviewFallbackSuggestion({
      draft,
      baseSuggestion: normalizedSuggestion,
      reasoning: 'Second Mind could not verify which parent range should host the new category, so please review the nearby options.',
      alternatives: [
        filingPlan.quickSuggestion,
        ...(filingPlan.quickSuggestion.alternativeSuggestions ?? []),
      ],
    });
  }

  const mergedSuggestion = mergeFilingSuggestionWithLocalDetails(
    normalizedSuggestion,
    filingPlan.localDetails,
    draft.source,
    filingPlan.quickSuggestion.alternativeSuggestions ?? []
  );

  if (
    mergedSuggestion.mode === 'new_category' &&
    !isReusableShelfTitle(
      mergedSuggestion.suggestedNewCategoryTitle,
      draft,
      mergedSuggestion.suggestedParentTitle
    )
  ) {
    return buildManualReviewFallbackSuggestion({
      draft,
      baseSuggestion: mergedSuggestion,
      reasoning: 'Second Mind could not verify a reusable new category name, so please review the local options.',
      alternatives: [
        filingPlan.quickSuggestion,
        ...(filingPlan.quickSuggestion.alternativeSuggestions ?? []),
      ],
    });
  }

  if (mergedSuggestion.mode !== 'manual_review' && mergedSuggestion.confidenceBand === 'low') {
    return buildManualReviewFallbackSuggestion({
      draft,
      baseSuggestion: mergedSuggestion,
      reasoning: 'Second Mind was not confident enough to file this automatically. Please review the best nearby options.',
      alternatives: [
        filingPlan.quickSuggestion,
        ...(filingPlan.quickSuggestion.alternativeSuggestions ?? []),
      ],
    });
  }

  if (mergedSuggestion.mode === 'manual_review' && (mergedSuggestion.alternativeSuggestions?.length ?? 0) === 0) {
    return buildManualReviewFallbackSuggestion({
      draft,
      baseSuggestion: mergedSuggestion,
      reasoning: mergedSuggestion.reasoning || 'Second Mind needs a quick manual review for this filing.',
      alternatives: [
        filingPlan.quickSuggestion,
        ...(filingPlan.quickSuggestion.alternativeSuggestions ?? []),
      ],
    });
  }

  return ensureManualReviewFilingWhy(mergedSuggestion);
};

export const buildTimedOutLocalFilingFallbackSuggestion = ({
  draft,
  filingPlan,
  allCategories,
  cards,
  editingCardId,
}: {
  draft: AiAssistPayload['draft'];
  filingPlan: FilingPlanLike;
  allCategories: ManagedCategory[];
  cards: Card[];
  editingCardId?: string | null;
}) => {
  const fallbackConfidence = Math.min(0.64, Math.max(0.58, filingPlan.quickSuggestion.confidence ?? 0.6));
  const localSuggestion: CardFilingSuggestion = {
    ...filingPlan.quickSuggestion,
    reasoning: 'The AI filing assistant timed out, so Second Mind is using its strongest local filing suggestion. Confidence is moderate, so please review before applying.',
    confidence: fallbackConfidence,
    confidenceBand: deriveConfidenceBand(fallbackConfidence),
    alternativeSuggestions: filingPlan.quickSuggestion.alternativeSuggestions ?? [],
  };

  if (localSuggestion.mode === 'manual_review') {
    return buildManualReviewFallbackSuggestion({
      draft,
      baseSuggestion: localSuggestion,
      reasoning: 'The AI filing assistant timed out, and the local filing signal was still too weak to apply automatically. Please review the strongest nearby options.',
      alternatives: [
        localSuggestion,
        ...(localSuggestion.alternativeSuggestions ?? []),
      ],
    });
  }

  return finalizeFilingSuggestion({
    suggestion: localSuggestion,
    draft,
    filingPlan: {
      ...filingPlan,
      quickSuggestion: localSuggestion,
    },
    allCategories,
    cards,
    editingCardId,
  });
};
