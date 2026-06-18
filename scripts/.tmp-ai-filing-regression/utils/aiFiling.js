"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTimedOutLocalFilingFallbackSuggestion = exports.finalizeFilingSuggestion = exports.buildManualReviewFallbackSuggestion = exports.normalizeHierarchicalSuggestion = exports.mergeFilingSuggestionWithLocalDetails = exports.buildAiAssistPayload = exports.buildSmartCategoryShortlist = exports.applyFilingThinkingResult = exports.createFilingThinkingState = exports.resolveSuggestedNewCategoryRange = exports.findSmallestContainingRange = void 0;
const aiCataloguing_1 = require("./aiCataloguing");
const antinet_1 = require("./antinet");
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
const serializeCategoryNodeForAi = (category) => ({
    id: category.id,
    range: category.range,
    title: category.title,
    isLeaf: Boolean(category.isLeaf),
    children: [],
});
const tokenizeShortlistText = (value) => Array.from(new Set((value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(token => !AI_SHORTLIST_STOPWORDS.has(token))));
const scoreShortlistMatch = (tokens, values) => {
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
const findSmallestContainingRange = (address, allCategories) => {
    const numericAddress = parseInt((0, antinet_1.normalizeAddress)(address), 10);
    if (Number.isNaN(numericAddress)) {
        return null;
    }
    return allCategories
        .filter(category => category.range.includes('-'))
        .map(category => ({ category, parsed: (0, antinet_1.parseRange)(category.range) }))
        .filter((entry) => Boolean(entry.parsed) &&
        numericAddress >= entry.parsed.start &&
        numericAddress <= entry.parsed.end)
        .sort((a, b) => (a.parsed.end - a.parsed.start) - (b.parsed.end - b.parsed.start))[0]?.category ?? null;
};
exports.findSmallestContainingRange = findSmallestContainingRange;
const resolveSuggestedNewCategoryRange = (suggestion, allCategories) => {
    const rawRange = (0, antinet_1.normalizeAddress)(suggestion.suggestedNewCategoryRange || suggestion.suggestedCategoryRange);
    if (/^\d{4}$/.test(rawRange)) {
        return rawRange;
    }
    const parentRange = (0, antinet_1.normalizeAddress)(suggestion.suggestedParentRange);
    if (parentRange.includes('-')) {
        const matchingParentRange = allCategories.find(category => (0, antinet_1.normalizeAddress)(category.range) === parentRange);
        if (matchingParentRange) {
            return (0, antinet_1.getNextCategoryAddress)(matchingParentRange);
        }
    }
    const suggestedParsedRange = (0, antinet_1.parseRange)(rawRange);
    if (suggestedParsedRange && rawRange.includes('-')) {
        const matchingRange = allCategories.find(category => (0, antinet_1.normalizeAddress)(category.range) === rawRange);
        if (matchingRange) {
            return (0, antinet_1.getNextCategoryAddress)(matchingRange);
        }
    }
    const suggestedCardPrefix = (0, antinet_1.normalizeAddress)(suggestion.suggestedCardAddress).slice(0, 4);
    if (/^\d{4}$/.test(suggestedCardPrefix)) {
        return suggestedCardPrefix;
    }
    return rawRange;
};
exports.resolveSuggestedNewCategoryRange = resolveSuggestedNewCategoryRange;
const createFilingThinkingState = (preview) => ({
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
exports.createFilingThinkingState = createFilingThinkingState;
const applyFilingThinkingResult = (previousState, suggestion) => ({
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
exports.applyFilingThinkingResult = applyFilingThinkingResult;
const buildSmartCategoryShortlist = ({ draft, filingPlan, categoryTree, allCategories, }) => {
    const roots = categoryTree.map(topLevel => {
        const node = serializeCategoryNodeForAi(topLevel);
        node.children = (topLevel.children ?? []).map(child => ({
            ...serializeCategoryNodeForAi(child),
            children: [],
        }));
        return node;
    });
    const nodeById = new Map();
    const categoryById = new Map(allCategories.map(category => [category.id, category]));
    const registerNode = (node, rootRange) => {
        nodeById.set(node.id, node);
        for (const child of node.children ?? []) {
            registerNode(child, rootRange);
        }
    };
    roots.forEach(root => registerNode(root, root.range));
    const draftTokens = tokenizeShortlistText([
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
        .join(' '));
    const rankedLeafIds = new Map();
    for (const [index, candidate] of (filingPlan?.payload.leafCandidates ?? []).entries()) {
        rankedLeafIds.set(candidate.id, Math.max(0, 24 - index * 4));
    }
    const selectedMasterRanges = new Set([
        filingPlan?.quickSuggestion.selectedMasterRange,
        ...(filingPlan?.quickSuggestion.alternativeSuggestions ?? []).map(candidate => candidate.selectedMasterRange),
    ]
        .filter(Boolean)
        .map(range => (0, antinet_1.normalizeAddress)(range ?? '')));
    const scoredLeafs = allCategories
        .filter(category => Boolean(category.isLeaf))
        .map(category => {
        const parent = category.parentId ? categoryById.get(category.parentId) : null;
        const topLevelRange = (0, exports.findSmallestContainingRange)(category.range, allCategories)?.range ?? '';
        const rootBoost = selectedMasterRanges.has((0, antinet_1.normalizeAddress)(topLevelRange)) ? 6 : 0;
        const parentTitle = parent?.title ?? '';
        const score = scoreShortlistMatch(draftTokens, [category.range, category.title, parentTitle, topLevelRange]) +
            (rankedLeafIds.get(category.id) ?? 0) +
            rootBoost;
        return {
            category,
            score,
            topLevelRange: (0, antinet_1.normalizeAddress)(topLevelRange),
        };
    })
        .filter(entry => entry.score > 0 && entry.topLevelRange)
        .sort((first, second) => second.score - first.score || first.category.range.localeCompare(second.category.range));
    const maxLeafsPerTopLevel = 3;
    const maxLeafsTotal = 18;
    const selectedLeafIds = new Set();
    const selectedCountsByTopLevel = new Map();
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
    const sortNodes = (nodes) => {
        nodes.sort((first, second) => {
            const firstParsed = (0, antinet_1.parseRange)(first.range)?.start;
            const secondParsed = (0, antinet_1.parseRange)(second.range)?.start;
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
        let hostNode = null;
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
exports.buildSmartCategoryShortlist = buildSmartCategoryShortlist;
const buildAiAssistPayload = ({ draft, rejectedSuggestion, semanticHints = [], filingPlan, categoryTree, allCategories, }) => ({
    draft,
    rejectedSuggestion: rejectedSuggestion ?? undefined,
    semanticHints,
    topLevelCategories: (0, exports.buildSmartCategoryShortlist)({
        draft,
        filingPlan,
        categoryTree,
        allCategories,
    }),
});
exports.buildAiAssistPayload = buildAiAssistPayload;
const mergeFilingSuggestionWithLocalDetails = (suggestion, localDetails, draftSource, alternativeSuggestions = []) => {
    const normalizedSuggestionSource = (0, antinet_1.normalizeCardSource)(suggestion.suggestedSource);
    const normalizedDraftSource = (0, antinet_1.normalizeCardSource)(draftSource);
    const confidence = Math.max(suggestion.confidence ?? 0, localDetails.confidence ?? 0);
    return {
        ...suggestion,
        suggestedTitle: suggestion.suggestedTitle?.trim() || localDetails.suggestedTitle?.trim() || '',
        suggestedContent: suggestion.suggestedContent?.trim() ?? '',
        suggestedTags: suggestion.suggestedTags.length > 0 ? suggestion.suggestedTags : localDetails.suggestedTags,
        suggestedStatus: suggestion.suggestedStatus ?? localDetails.suggestedStatus,
        suggestedRelatedAddresses: suggestion.suggestedRelatedAddresses.length > 0
            ? suggestion.suggestedRelatedAddresses
            : localDetails.suggestedRelatedAddresses,
        suggestedSource: normalizedSuggestionSource ?? normalizedDraftSource,
        corrections: suggestion.corrections ?? [],
        confidence,
        confidenceBand: suggestion.confidenceBand ?? (0, aiCataloguing_1.deriveConfidenceBand)(confidence),
        alternativeSuggestions: (suggestion.confidenceBand ?? (0, aiCataloguing_1.deriveConfidenceBand)(confidence)) === 'high'
            ? []
            : alternativeSuggestions.map(candidate => ({
                ...candidate,
                alternativeSuggestions: [],
            })),
    };
};
exports.mergeFilingSuggestionWithLocalDetails = mergeFilingSuggestionWithLocalDetails;
const normalizeHierarchicalSuggestion = ({ suggestion, cards, editingCardId, allCategories, }) => {
    const normalizedSuggestion = { ...suggestion };
    const cardsForAddressing = cards.filter(card => card.id !== editingCardId);
    if (normalizedSuggestion.mode === 'existing_category') {
        const categoryRange = (0, antinet_1.normalizeAddress)(normalizedSuggestion.suggestedCategoryRange);
        normalizedSuggestion.suggestedParentRange = '';
        normalizedSuggestion.suggestedParentTitle = '';
        if (!normalizedSuggestion.suggestedCardAddress && /^\d{4}$/.test(categoryRange)) {
            normalizedSuggestion.suggestedCardAddress = (0, antinet_1.getNextCardAddress)(categoryRange, cardsForAddressing);
        }
    }
    if (normalizedSuggestion.mode === 'new_category') {
        const suggestedRange = (0, exports.resolveSuggestedNewCategoryRange)(normalizedSuggestion, allCategories);
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
exports.normalizeHierarchicalSuggestion = normalizeHierarchicalSuggestion;
const buildManualReviewFallbackSuggestion = ({ draft, baseSuggestion, reasoning, alternatives = [], }) => (0, aiCataloguing_1.forceManualReviewSuggestion)(baseSuggestion, draft, reasoning, alternatives, Math.min(0.52, baseSuggestion.confidence ?? 0.52));
exports.buildManualReviewFallbackSuggestion = buildManualReviewFallbackSuggestion;
const finalizeFilingSuggestion = ({ suggestion, draft, filingPlan, allCategories, cards, editingCardId, }) => {
    const normalizedSuggestion = (0, exports.normalizeHierarchicalSuggestion)({
        suggestion,
        cards,
        editingCardId,
        allCategories,
    });
    if (normalizedSuggestion.mode === 'existing_category' &&
        !/^\d{4}$/.test((0, antinet_1.normalizeAddress)(normalizedSuggestion.suggestedCategoryRange))) {
        return (0, exports.buildManualReviewFallbackSuggestion)({
            draft,
            baseSuggestion: normalizedSuggestion,
            reasoning: 'Second Mind could not verify a specific existing filing shelf, so please review the nearby options.',
            alternatives: [
                filingPlan.quickSuggestion,
                ...(filingPlan.quickSuggestion.alternativeSuggestions ?? []),
            ],
        });
    }
    if (normalizedSuggestion.mode === 'new_category' &&
        !(0, antinet_1.normalizeAddress)(normalizedSuggestion.suggestedParentRange)) {
        return (0, exports.buildManualReviewFallbackSuggestion)({
            draft,
            baseSuggestion: normalizedSuggestion,
            reasoning: 'Second Mind could not verify which parent range should host the new category, so please review the nearby options.',
            alternatives: [
                filingPlan.quickSuggestion,
                ...(filingPlan.quickSuggestion.alternativeSuggestions ?? []),
            ],
        });
    }
    const mergedSuggestion = (0, exports.mergeFilingSuggestionWithLocalDetails)(normalizedSuggestion, filingPlan.localDetails, draft.source, filingPlan.quickSuggestion.alternativeSuggestions ?? []);
    if (mergedSuggestion.mode === 'new_category' &&
        !(0, aiCataloguing_1.isReusableShelfTitle)(mergedSuggestion.suggestedNewCategoryTitle, draft, mergedSuggestion.suggestedParentTitle)) {
        return (0, exports.buildManualReviewFallbackSuggestion)({
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
        return (0, exports.buildManualReviewFallbackSuggestion)({
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
        return (0, exports.buildManualReviewFallbackSuggestion)({
            draft,
            baseSuggestion: mergedSuggestion,
            reasoning: mergedSuggestion.reasoning || 'Second Mind needs a quick manual review for this filing.',
            alternatives: [
                filingPlan.quickSuggestion,
                ...(filingPlan.quickSuggestion.alternativeSuggestions ?? []),
            ],
        });
    }
    return mergedSuggestion;
};
exports.finalizeFilingSuggestion = finalizeFilingSuggestion;
const buildTimedOutLocalFilingFallbackSuggestion = ({ draft, filingPlan, allCategories, cards, editingCardId, }) => {
    const fallbackConfidence = Math.min(0.64, Math.max(0.58, filingPlan.quickSuggestion.confidence ?? 0.6));
    const localSuggestion = {
        ...filingPlan.quickSuggestion,
        reasoning: 'The AI filing assistant timed out, so Second Mind is using its strongest local filing suggestion. Confidence is moderate, so please review before applying.',
        confidence: fallbackConfidence,
        confidenceBand: (0, aiCataloguing_1.deriveConfidenceBand)(fallbackConfidence),
        alternativeSuggestions: filingPlan.quickSuggestion.alternativeSuggestions ?? [],
    };
    if (localSuggestion.mode === 'manual_review') {
        return (0, exports.buildManualReviewFallbackSuggestion)({
            draft,
            baseSuggestion: localSuggestion,
            reasoning: 'The AI filing assistant timed out, and the local filing signal was still too weak to apply automatically. Please review the strongest nearby options.',
            alternatives: [
                localSuggestion,
                ...(localSuggestion.alternativeSuggestions ?? []),
            ],
        });
    }
    return (0, exports.finalizeFilingSuggestion)({
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
exports.buildTimedOutLocalFilingFallbackSuggestion = buildTimedOutLocalFilingFallbackSuggestion;
