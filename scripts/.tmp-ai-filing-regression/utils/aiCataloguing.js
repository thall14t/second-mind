"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCapturePreview = exports.buildFilingPlanV2 = exports.buildFilingPlan = exports.buildCapturePayload = exports.buildExistingCardSummariesForEnrichment = exports.restrainStructuringToCapture = exports.captureHasExplicitSourceCues = exports.buildMinimalCaptureStructuringDraft = exports.forceManualReviewSuggestion = exports.isReusableShelfTitle = exports.deriveConfidenceBand = void 0;
exports.classifyNoteFunction = classifyNoteFunction;
exports.rankMasterRangesByFunction = rankMasterRangesByFunction;
const antinet_1 = require("./antinet");
/**
 * Filing architecture:
 * - V1 (buildFilingPlan) remains for regression comparisons only.
 * - V2 (buildFilingPlanV2) is the production planner used by the app.
 * - V2 works top-down: classify note function -> rank plausible master ranges ->
 *   score shelves inside those branches -> only then consider new shelf naming.
 */
const TOKEN_STOPWORDS = new Set([
    'across',
    'about',
    'against',
    'after',
    'also',
    'and',
    'around',
    'become',
    'becomes',
    'because',
    'before',
    'between',
    'but',
    'card',
    'each',
    'every',
    'from',
    'have',
    'into',
    'just',
    'long',
    'main',
    'many',
    'more',
    'most',
    'note',
    'onto',
    'over',
    'page',
    'quote',
    'section',
    'some',
    'that',
    'than',
    'then',
    'the',
    'their',
    'them',
    'they',
    'there',
    'this',
    'those',
    'through',
    'under',
    'using',
    'while',
    'which',
    'with',
    'without',
    'within',
]);
const CANONICAL_BIBLE_BOOKS = [
    'Genesis',
    'Exodus',
    'Leviticus',
    'Numbers',
    'Deuteronomy',
    'Joshua',
    'Judges',
    'Ruth',
    '1 Samuel',
    '2 Samuel',
    '1 Kings',
    '2 Kings',
    '1 Chronicles',
    '2 Chronicles',
    'Ezra',
    'Nehemiah',
    'Esther',
    'Job',
    'Psalms',
    'Proverbs',
    'Ecclesiastes',
    'Song of Solomon',
    'Isaiah',
    'Jeremiah',
    'Lamentations',
    'Ezekiel',
    'Daniel',
    'Hosea',
    'Joel',
    'Amos',
    'Obadiah',
    'Jonah',
    'Micah',
    'Nahum',
    'Habakkuk',
    'Zephaniah',
    'Haggai',
    'Zechariah',
    'Malachi',
    'Matthew',
    'Mark',
    'Luke',
    'John',
    'Acts',
    'Romans',
    '1 Corinthians',
    '2 Corinthians',
    'Galatians',
    'Ephesians',
    'Philippians',
    'Colossians',
    '1 Thessalonians',
    '2 Thessalonians',
    '1 Timothy',
    '2 Timothy',
    'Titus',
    'Philemon',
    'Hebrews',
    'James',
    '1 Peter',
    '2 Peter',
    '1 John',
    '2 John',
    '3 John',
    'Jude',
    'Revelation',
];
const MASTER_RANGE_SEMANTIC_CUES = {
    '0000-0999': ['belief', 'discernment', 'duty', 'duties', 'evidence', 'ethic', 'faith', 'judgment', 'knowledge', 'logic', 'love', 'loves', 'meaning', 'moral', 'principle', 'reason', 'truth', 'virtue', 'wisdom', 'calibration', 'bias'],
    '1000-1999': ['ancient', 'century', 'civilization', 'empire', 'era', 'history', 'historical', 'kingdom', 'medieval', 'war'],
    '2000-2999': ['biology', 'chemical', 'data', 'disease', 'ecology', 'environment', 'experiment', 'math', 'mildew', 'nature', 'physics', 'plant', 'science', 'statistics'],
    '3000-3999': ['attention', 'behavior', 'confidence', 'desire', 'emotion', 'habit', 'identity', 'motivation', 'psychology', 'trauma'],
    '4000-4999': ['catechize', 'catechized', 'church', 'community', 'culture', 'family', 'gender', 'liturgy', 'liturgies', 'media', 'religion', 'ritual', 'society', 'social', 'worship'],
    '5000-5999': ['citizen', 'government', 'law', 'policy', 'political', 'rights', 'state'],
    '6000-6999': ['budget', 'economy', 'finance', 'inflation', 'labor', 'market', 'money', 'price'],
    '7000-7999': ['art', 'beauty', 'creative', 'design', 'literary', 'music', 'poem', 'story'],
    '8000-8999': ['algorithm', 'automation', 'computer', 'engineering', 'innovation', 'software', 'technology'],
    '9000-9999': ['budget', 'checklist', 'clean', 'decision', 'fix', 'habit', 'how to', 'manual', 'method', 'organize', 'plan', 'practical', 'recipe', 'repair', 'routine', 'schedule', 'setup', 'skill', 'spray', 'mix', 'tool', 'workflow', 'garden', 'plant'],
};
const CATEGORY_SEMANTIC_CUES = {
    '0101': ['discernment', 'prudence', 'wisdom'],
    '0102': ['belief', 'calibration', 'evidence', 'error', 'knowledge', 'truth', 'understanding'],
    '0200-0299': ['argument', 'fallacy', 'logic', 'reasoning'],
    '0300-0399': ['duty', 'duties', 'love', 'loves', 'moral', 'virtue'],
    '0800-0899': ['church', 'doctrine', 'faith', 'liturgies', 'liturgy', 'ritual', 'theology', 'worship'],
    '4500-4599': ['belief', 'catechize', 'catechized', 'church', 'liturgies', 'liturgy', 'ritual', 'religion', 'worship'],
    '9002': ['calibration', 'choice', 'clarity', 'decision', 'judgment'],
    '9003': ['action', 'agency', 'initiative', 'responsibility'],
    '9400-9499': ['analysis', 'bias', 'calibration', 'error', 'logic', 'problem', 'reasoning', 'signal', 'thinking'],
    '9600-9699': ['disease', 'healing', 'health', 'nutrition', 'sleep', 'symptom', 'wellness'],
    '9900-9999': ['bottle', 'garden', 'maintenance', 'mix', 'plant', 'recipe', 'repair', 'spray', 'tool'],
};
const PRACTICAL_PROCEDURE_CUES = ['apply', 'bottle', 'build', 'checklist', 'clean', 'fix', 'garden', 'how to', 'maintain', 'method', 'mix', 'plant', 'recipe', 'repair', 'routine', 'setup', 'skill', 'spray', 'step', 'tool', 'workflow'];
const EPISTEMIC_REASONING_CUES = ['argument', 'bias', 'belief', 'calibration', 'discernment', 'error', 'evidence', 'judgment', 'knowledge', 'logic', 'reason', 'signal', 'truth', 'understanding', 'wisdom'];
const HANDS_ON_NATURE_OR_HEALTH_CUES = ['disease', 'garden', 'heal', 'health', 'mildew', 'nutrition', 'plant', 'remedy', 'spray', 'symptom', 'wellness'];
const CREATIVE_AUTHORING_CUES = ['article idea', 'article concept', 'article premise', 'book concept', 'book idea', 'book premise', 'chapter idea', 'essay concept', 'essay idea', 'idea for a book', 'novel idea', 'sermon idea', 'story idea', 'talk idea', 'writing project'];
const IDEA_SEED_CUES = ['app idea', 'concept', 'outline', 'premise', 'product idea', 'project idea', 'startup idea'];
const SOURCE_NOTE_CUES = ['according to', 'author', 'by ', 'chapter', 'citation', 'from ', 'loc', 'location', 'page', 'pages', 'paraphrase', 'podcast', 'quote', 'quoted', 'section', 'source', 'timestamp', 'url', 'verse', 'verses', 'www.', 'youtube'];
const PROJECT_MATERIAL_CUES = ['for second mind', 'for the app', 'for the book', 'for this chapter', 'for this project', 'in the draft', 'in my book', 'in my essay', 'in my project', 'material for', 'project note', 'project material', 'use this in'];
const GARDENING_DOMAIN_CUES = ['garden', 'mildew', 'plant', 'soil', 'spray', 'weed'];
const HEALTH_DOMAIN_CUES = ['diet', 'exercise', 'health', 'nutrition', 'sleep', 'symptom', 'wellness'];
const REUSABLE_SHELF_PROSE_CUES = ['are', 'be', 'because', 'did', 'do', 'does', 'had', 'has', 'have', 'is', 'should', 'this', 'those', 'when', 'while'];
const CREATIVE_TITLE_CUES = ['author', 'book', 'creative', 'essay', 'idea', 'innovation', 'literary', 'novel', 'project', 'story', 'writing'];
const SHELF_SIMILARITY_STOPWORDS = new Set([
    'analogies',
    'analogy',
    'concept',
    'concepts',
    'framework',
    'frameworks',
    'idea',
    'ideas',
    'metaphor',
    'metaphors',
    'method',
    'methods',
    'note',
    'notes',
    'pattern',
    'patterns',
    'practice',
    'practices',
    'principle',
    'principles',
    'project',
    'projects',
    'remedy',
    'remedies',
    'system',
    'systems',
    'theories',
    'theory',
]);
const FUNCTION_TO_DEFAULT_RANGE_BIAS = {
    idea_seed: [
        { range: '9800-9899', score: 28 },
        { range: '7000-7999', score: 24 },
        { range: '0000-0999', score: 8 },
    ],
    practical_method: [
        { range: '9900-9999', score: 28 },
        { range: '9000-9999', score: 22 },
        { range: '2000-2999', score: 10 },
    ],
    concept_note: [
        { range: '0000-0999', score: 24 },
        { range: '3000-3999', score: 18 },
        { range: '9400-9499', score: 14 },
    ],
    source_note: [
        { range: '0000-0999', score: 18 },
        { range: '1000-1999', score: 14 },
        { range: '4000-4999', score: 10 },
    ],
    project_material: [
        { range: '9800-9899', score: 18 },
        { range: '8000-8999', score: 16 },
        { range: '9000-9999', score: 10 },
    ],
    raw_capture: [
        { range: '9000-9999', score: 10 },
        { range: '0000-0999', score: 8 },
    ],
};
const FUNCTION_TO_TITLE_AFFINITY_CUES = {
    idea_seed: ['analogy', 'book', 'books', 'chapter', 'chapters', 'creative', 'creativity', 'essay', 'essays', 'framing', 'idea', 'ideas', 'innovation', 'literary', 'metaphor', 'metaphors', 'novel', 'novels', 'outline', 'premise', 'story', 'stories', 'writing'],
    practical_method: ['applied', 'checklist', 'guide', 'guides', 'how-to', 'how to', 'manual', 'method', 'methods', 'practical', 'process', 'recipe', 'recipes', 'remedy', 'remedies', 'repair', 'setup', 'skill', 'skills', 'step', 'steps', 'system', 'systems', 'tactic', 'workflow', 'workflows'],
    concept_note: ['analogy', 'argument', 'concept', 'concepts', 'distinction', 'distinctions', 'doctrine', 'doctrines', 'framework', 'frameworks', 'idea', 'ideas', 'insight', 'insights', 'logic', 'meaning', 'metaphor', 'metaphors', 'principle', 'principles', 'theory', 'theories', 'wisdom'],
    source_note: ['archive', 'citation', 'commentary', 'quote', 'quotes', 'reference', 'references', 'research', 'source', 'sources', 'text', 'texts'],
    project_material: ['app', 'artifact', 'artifacts', 'build', 'building', 'design', 'execution', 'launch', 'material', 'materials', 'plan', 'planning', 'product', 'project', 'projects', 'roadmap', 'ship'],
    raw_capture: ['capture', 'inbox', 'misc', 'note', 'notes', 'scratch'],
};
const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim();
const truncate = (value, maxLength) => (value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : value);
const cleanField = (value) => normalizeWhitespace(value).replace(/^[,;:.\-()\[\]]+|[,;:.\-()\[\]]+$/g, '').trim();
const titleCase = (value) => value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
const deriveConfidenceBand = (confidence = 0) => {
    if (confidence >= 0.82) {
        return 'high';
    }
    if (confidence >= 0.58) {
        return 'medium';
    }
    return 'low';
};
exports.deriveConfidenceBand = deriveConfidenceBand;
const tokenize = (value) => Array.from(new Set((value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(token => !TOKEN_STOPWORDS.has(token))));
const scoreTextMatch = (tokens, values) => {
    const haystack = values.filter(Boolean).join(' ').toLowerCase();
    let score = 0;
    for (const token of tokens) {
        if (haystack.includes(token)) {
            score += token.length >= 8 ? 6 : token.length >= 5 ? 4 : 2;
        }
    }
    return score;
};
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countCueHits = (text, cues) => {
    const haystack = normalizeWhitespace(text).toLowerCase();
    if (!haystack) {
        return 0;
    }
    return cues.reduce((score, cue) => {
        const pattern = new RegExp(`\\b${escapeRegExp(cue.toLowerCase()).replace(/\\ /g, '\\s+')}\\b`, 'i');
        return score + (pattern.test(haystack) ? 1 : 0);
    }, 0);
};
const buildFunctionText = (draft) => normalizeWhitespace([
    draft.title,
    draft.content,
    draft.tags.join(' '),
    draft.source?.title ?? '',
    draft.source?.author ?? '',
    draft.source?.page ?? '',
    draft.source?.url ?? '',
    draft.source?.note ?? '',
].filter(Boolean).join(' '));
const hasStructuredSourceEvidence = (draft, text) => Boolean(draft.source?.title ||
    draft.source?.author ||
    draft.source?.url ||
    draft.source?.page ||
    draft.source?.type === 'Book' ||
    draft.source?.type === 'Article' ||
    draft.source?.type === 'Video' ||
    /\b(?:https?:\/\/|www\.|page|pages|p\.|pp\.|chapter|chap\.|section|sec\.|timestamp|minute|verse|verses|quoted|quote|citation|podcast|youtube|video|article|essay|journal|paper|newsletter|blog)\b/i.test(text) ||
    /\bfrom\s+.+?\s+by\s+[a-z]/i.test(text));
const getTopLevelRangeCategories = (categories) => categories.filter(category => {
    if (!category.range.includes('-')) {
        return false;
    }
    const parsed = (0, antinet_1.parseRange)(category.range);
    return Boolean(parsed && parsed.start % 1000 === 0 && parsed.end === parsed.start + 999);
});
const buildMasterRangeTitleCorpus = (range, allCategories) => [
    range.title,
    ...allCategories
        .filter(category => (0, antinet_1.normalizeAddress)(category.range) !== (0, antinet_1.normalizeAddress)(range.range) && topLevelRangeContains(range.range, (0, antinet_1.normalizeAddress)(category.range)))
        .map(category => category.title),
]
    .filter(Boolean)
    .join(' ');
const scoreTitleAffinity = (text, cues) => {
    const hits = countCueHits(text, cues);
    return hits === 0 ? 0 : Math.min(24, hits * 6);
};
function classifyNoteFunction(draft) {
    const text = buildFunctionText(draft).toLowerCase();
    const content = normalizeWhitespace(draft.content).toLowerCase();
    const rawWordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
    const creativeMediumReference = /\b(?:book|chapter|story|novel|essay|article|sermon|talk)\b/.test(text);
    const creativeMediumFraming = /\b(?:for|as)\s+(?:a|an|the)?\s*(?:(?:future|possible|planned|new|next|eventual|potential|later)\s+){0,2}(?:book|chapter|story|novel|essay|article|sermon|talk)\b/.test(text);
    const creativeIntentSignal = /\b(?:would make|could make|could become|might become|want to write|want to explore|write about|write this as|develop this as|this would be a good|this could be a good|structure a novel|structure the book|chapter explores)\b/.test(text);
    const explicitIdeaSeed = countCueHits(text, CREATIVE_AUTHORING_CUES) > 0 ||
        /\b(?:book|chapter|story|novel|essay|article|sermon|talk)\s+idea\b/.test(text) ||
        /\bidea\s+for\s+(?:a|an|the)?\s*(?:book|chapter|story|novel|essay|article|sermon|talk)\b/.test(text);
    const creativeFramingSignal = Boolean(/\b(?:metaphor|metaphors|analogy|analogies|analogous)\b/.test(text) &&
        (creativeMediumFraming ||
            creativeIntentSignal ||
            /\bwhere\b.+\b(?:book|chapter|story|novel|essay|article|sermon|talk)\b/.test(text)));
    const standaloneCreativeFramingSignal = Boolean(creativeMediumReference &&
        (creativeIntentSignal ||
            creativeMediumFraming ||
            /\b(?:metaphor|metaphors|analogy|analogies|analogous|premise|framing|frame)\b/.test(text)));
    const projectSignal = countCueHits(text, PROJECT_MATERIAL_CUES) > 0;
    const practicalSignal = Boolean(countCueHits(text, PRACTICAL_PROCEDURE_CUES) >= 2 ||
        countCueHits(text, HANDS_ON_NATURE_OR_HEALTH_CUES) >= 2 ||
        /\b(?:how to|recipe for|step by step|workflow to|setup for|fixing|repairing)\b/.test(text) ||
        /\b(?:spray bottle|powdery mildew|milk and water|repair|workflow|checklist|routine)\b/.test(text));
    const sourceSignal = hasStructuredSourceEvidence(draft, text);
    const rawCaptureSignal = Boolean(rawWordCount <= 4 ||
        (!draft.title.trim() && rawWordCount <= 8 && /(?:^|\s)(?:idea|note|remember|look into|maybe)(?:\s|$)/.test(content)) ||
        /(?:^|\s)(?:todo|tbd|\?\?\?|\.\.\.)/.test(content));
    if (explicitIdeaSeed || creativeFramingSignal || standaloneCreativeFramingSignal) {
        return 'idea_seed';
    }
    if (projectSignal && !practicalSignal && !sourceSignal) {
        return 'project_material';
    }
    if (practicalSignal) {
        return 'practical_method';
    }
    if (sourceSignal) {
        return 'source_note';
    }
    if (rawCaptureSignal && !content.includes('.') && !content.includes(':')) {
        return 'raw_capture';
    }
    return 'concept_note';
}
function rankMasterRangesByFunction(noteFunction, allCategories) {
    const topLevelRanges = getTopLevelRangeCategories(allCategories);
    const defaultBiasTable = new Map(FUNCTION_TO_DEFAULT_RANGE_BIAS[noteFunction].map(entry => [(0, antinet_1.normalizeAddress)(entry.range), entry.score]));
    const affinityCues = FUNCTION_TO_TITLE_AFFINITY_CUES[noteFunction];
    return topLevelRanges
        .map(rangeCategory => {
        const normalizedRange = (0, antinet_1.normalizeAddress)(rangeCategory.range);
        const corpus = buildMasterRangeTitleCorpus(rangeCategory, allCategories).toLowerCase();
        const functionBiasScore = noteFunction === 'idea_seed'
            ? scoreTitleAffinity(corpus, ['book', 'creative', 'idea', 'literary', 'story', 'writing'])
            : noteFunction === 'practical_method'
                ? scoreTitleAffinity(corpus, ['guide', 'how to', 'manual', 'method', 'practical', 'remedy', 'skill', 'workflow'])
                : noteFunction === 'source_note'
                    ? scoreTitleAffinity(corpus, ['archive', 'quote', 'reference', 'research', 'source', 'text'])
                    : noteFunction === 'project_material'
                        ? scoreTitleAffinity(corpus, ['artifact', 'build', 'design', 'product', 'project', 'roadmap'])
                        : noteFunction === 'raw_capture'
                            ? scoreTitleAffinity(corpus, ['capture', 'inbox', 'misc', 'note'])
                            : scoreTitleAffinity(corpus, ['concept', 'distinction', 'framework', 'principle', 'theory', 'wisdom']);
        const defaultBiasScore = defaultBiasTable.get(normalizedRange) ?? 0;
        const titleAffinityScore = scoreTitleAffinity(corpus, affinityCues);
        return {
            range: rangeCategory.range,
            title: rangeCategory.title,
            clue: buildCandidateClue([rangeCategory.title, corpus]),
            score: functionBiasScore + defaultBiasScore + titleAffinityScore,
            noteFunction,
            functionBiasScore,
            defaultBiasScore,
            titleAffinityScore,
        };
    })
        .sort((first, second) => second.score - first.score || first.range.localeCompare(second.range));
}
const deriveSemanticHints = (draft) => {
    const text = buildDraftText(draft);
    const hints = [];
    if (countCueHits(text, PRACTICAL_PROCEDURE_CUES) >= 2) {
        hints.push('practical_procedure');
    }
    if (countCueHits(text, EPISTEMIC_REASONING_CUES) >= 2) {
        hints.push('epistemic_reasoning');
    }
    if (countCueHits(text, HANDS_ON_NATURE_OR_HEALTH_CUES) >= 2) {
        hints.push('hands_on_nature_or_health');
    }
    if (countCueHits(text, CREATIVE_AUTHORING_CUES) >= 1 ||
        (/\b(?:book|chapter|essay|article|story|novel|sermon|talk)\b/.test(text) && /\bidea\b|\bconcept\b|\bpremise\b|\boutline\b/.test(text))) {
        hints.push('creative_authorship');
    }
    if (countCueHits(text, IDEA_SEED_CUES) >= 1 ||
        /\bidea\b|\bconcept\b|\bpremise\b|\boutline\b/.test(text)) {
        hints.push('idea_seed');
    }
    if (draft.source?.type === 'Video' || draft.source?.type === 'Web') {
        hints.push('media_note');
    }
    return hints;
};
const isShortUnsourcedOriginalNote = (draft) => {
    const content = cleanField(draft.content);
    if (!content) {
        return false;
    }
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const hasStructuredSource = Boolean(draft.source?.title ||
        draft.source?.author ||
        draft.source?.url ||
        draft.source?.page);
    const hasExplicitSourceCue = /\b(?:https?:\/\/|www\.|page|pages|chapter|chap\.|verse|verses|timestamp|podcast|youtube|quoted|quote|from\s+\S+|by\s+[A-Z][a-z]+)/i.test(content);
    const hasProcedureCue = countCueHits(content, PRACTICAL_PROCEDURE_CUES) >= 2;
    return (content.length < 280 &&
        wordCount < 45 &&
        !hasStructuredSource &&
        (!draft.source || draft.source.type === 'Other') &&
        !hasExplicitSourceCue &&
        !hasProcedureCue);
};
const isHighConfidenceReusableNewSuggestion = (suggestion, draft) => (suggestion.mode === 'new_category' &&
    (suggestion.confidence ?? 0) >= 0.76 &&
    (0, exports.isReusableShelfTitle)(suggestion.suggestedNewCategoryTitle, draft, suggestion.suggestedParentTitle));
const scoreSemanticRangeBoost = (range, draftText, semanticHints, sourceType, rangeTitle = '') => {
    let score = countCueHits(draftText, [
        ...(MASTER_RANGE_SEMANTIC_CUES[range] ?? []),
        ...(CATEGORY_SEMANTIC_CUES[range] ?? []),
    ]) * 6;
    const normalizedRangeTitle = rangeTitle.toLowerCase();
    const hasCreativeTitleCue = CREATIVE_TITLE_CUES.some(cue => normalizedRangeTitle.includes(cue));
    if (semanticHints.includes('practical_procedure')) {
        if (range === '9000-9999') {
            score += 20;
        }
        else if (range === '9900-9999') {
            score += 18;
        }
        else if (range === '9600-9699') {
            score += 10;
        }
        else if (range === '9002') {
            score += 6;
        }
    }
    if (semanticHints.includes('epistemic_reasoning')) {
        if (range === '0000-0999') {
            score += 14;
        }
        else if (range === '0102') {
            score += 14;
        }
        else if (range === '0200-0299' || range === '9400-9499') {
            score += 12;
        }
        else if (range === '9002') {
            score += 6;
        }
    }
    if (semanticHints.includes('hands_on_nature_or_health')) {
        if (range === '9000-9999') {
            score += 10;
        }
        else if (range === '9900-9999' || range === '9600-9699') {
            score += 12;
        }
        else if (range === '2000-2999' || range === '2500-2599') {
            score += 8;
        }
    }
    if (semanticHints.includes('creative_authorship')) {
        if (range === '7000-7999') {
            score += 18;
        }
        else if (range === '7400-7499') {
            score += 22;
        }
        else if (range === '9800-9899') {
            score += 12;
        }
        if (hasCreativeTitleCue) {
            score += 12;
        }
    }
    if (semanticHints.includes('idea_seed')) {
        if (range === '9800-9899') {
            score += 18;
        }
        else if (range === '7000-7999' || range === '7400-7499') {
            score += 10;
        }
        else if (range === '8000-8999') {
            score += 8;
        }
        if (hasCreativeTitleCue) {
            score += 10;
        }
    }
    if (sourceType === 'Video' || sourceType === 'Web') {
        if (range === '0102' || range === '0200-0299' || range === '9400-9499') {
            score += 3;
        }
    }
    return score;
};
const normalizeBibleSearchText = (value) => normalizeWhitespace(value
    .toLowerCase()
    .replace(/\bfirst\b/g, '1')
    .replace(/\bsecond\b/g, '2')
    .replace(/\bthird\b/g, '3')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1')
    .replace(/[^a-z0-9]+/g, ' '));
const findCanonicalBibleBook = (value) => {
    const normalized = normalizeBibleSearchText(value);
    if (!normalized) {
        return null;
    }
    return CANONICAL_BIBLE_BOOKS.find(book => normalized.includes(normalizeBibleSearchText(book))) ?? null;
};
const extractUrl = (value) => cleanField(value.match(/\b(?:https?:\/\/|www\.)\S+/i)?.[0] ?? '');
const extractLocation = (value) => {
    const explicitLocator = value.match(/\b(?:page|pages|p\.|pp\.|chapter|chap\.|section|sec\.|loc(?:ation)?|timestamp|minute|verse|verses)\s*[:#-]?\s*([A-Za-z0-9:.-]+)/i)?.[1];
    if (explicitLocator) {
        return cleanField(explicitLocator.replace(/[.]+$/, ''));
    }
    const scriptureLocator = value.match(/\b(\d{1,3}:\d{1,3}(?:-\d{1,3})?)\b/)?.[1];
    return cleanField(scriptureLocator ?? '');
};
const tokenizeWords = (value) => cleanField(value).split(/\s+/).filter(Boolean);
const deriveReusableShelfTitle = (draft, hostRange, hostTitle, semanticHints) => {
    const text = buildDraftText(draft).toLowerCase();
    const hostLabel = `${hostRange} ${hostTitle}`.toLowerCase();
    if (/\bbook idea\b|\bbook concept\b|\bbook premise\b/.test(text)) {
        return 'Book Ideas';
    }
    if (/\barticle idea\b|\bessay idea\b|\bblog idea\b|\bnewsletter idea\b/.test(text)) {
        return 'Article Ideas';
    }
    if (/\bchapter idea\b/.test(text)) {
        return 'Chapter Ideas';
    }
    if (/\bstory idea\b|\bnovel idea\b|\bsermon idea\b|\btalk idea\b/.test(text)) {
        return 'Story Ideas';
    }
    if (/\bproject idea\b|\bstartup idea\b|\bapp idea\b|\bproduct idea\b/.test(text)) {
        return 'Project Ideas';
    }
    if (/\banalogy\b|\bmetaphor\b/.test(text)) {
        if (/\bbook\b|\bchapter\b|\bessay\b|\barticle\b|\bnovel\b|\bstory\b|\bsermon\b|\btalk\b/.test(text)) {
            return 'Book Ideas';
        }
        return 'Analogies';
    }
    if (semanticHints.includes('practical_procedure') || semanticHints.includes('hands_on_nature_or_health')) {
        if (countCueHits(text, GARDENING_DOMAIN_CUES) >= 2 || /\bgarden|plant|soil\b/.test(hostLabel)) {
            return 'Gardening Remedies';
        }
        if (countCueHits(text, HEALTH_DOMAIN_CUES) >= 2) {
            return 'Health Remedies';
        }
        return 'Practical Methods';
    }
    if (/\bworkflow\b|\bprocess\b|\bchecklist\b/.test(text)) {
        return 'Workflows';
    }
    return '';
};
const tokenizeShelfSimilarity = (value) => Array.from(new Set(cleanField(value)
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g) ?? []))
    .map(token => token.endsWith('s') ? token.slice(0, -1) : token)
    .filter(token => token && !SHELF_SIMILARITY_STOPWORDS.has(token));
const shelfTitlesShareIntent = (first, second) => {
    const firstTokens = tokenizeShelfSimilarity(first);
    const secondTokens = tokenizeShelfSimilarity(second);
    if (firstTokens.length === 0 || secondTokens.length === 0) {
        return false;
    }
    return firstTokens.some(token => secondTokens.includes(token));
};
const isReusableShelfTitle = (value, draft, hostTitle = '') => {
    const cleaned = cleanField(value);
    if (!cleaned) {
        return false;
    }
    if (cleaned.length > 40 || /[!?]/.test(cleaned) || /\b(?:https?:\/\/|www\.)/i.test(cleaned)) {
        return false;
    }
    if (/\d/.test(cleaned) || /\b(?:page|pages|chapter|chap|timestamp|verse|verses)\b/i.test(cleaned)) {
        return false;
    }
    const words = tokenizeWords(cleaned);
    if (words.length === 0 || words.length > 6) {
        return false;
    }
    if (hostTitle && cleaned.toLowerCase() === cleanField(hostTitle).toLowerCase()) {
        return false;
    }
    const proseHits = words.filter(word => REUSABLE_SHELF_PROSE_CUES.includes(word.toLowerCase())).length;
    if (proseHits > Math.max(1, Math.floor(words.length / 3))) {
        return false;
    }
    const normalizedDraftText = normalizeWhitespace(buildDraftText(draft)).toLowerCase();
    if (words.length >= 3 && normalizedDraftText.includes(cleaned.toLowerCase())) {
        return false;
    }
    const titleTokens = tokenize(cleaned).filter(token => token.length >= 4);
    const draftTokenSet = new Set(tokenize(buildDraftText(draft)));
    if (titleTokens.length >= 3) {
        const overlap = titleTokens.filter(token => draftTokenSet.has(token)).length / titleTokens.length;
        if (overlap >= 0.8) {
            return false;
        }
    }
    return true;
};
exports.isReusableShelfTitle = isReusableShelfTitle;
const forceManualReviewSuggestion = (baseSuggestion, draft, reasoning, alternativeSuggestions = [], confidence = 0.42) => ({
    ...baseSuggestion,
    mode: 'manual_review',
    suggestedCategoryId: '',
    suggestedCategoryRange: '',
    suggestedCategoryTitle: '',
    suggestedParentRange: '',
    suggestedParentTitle: '',
    suggestedNewCategoryRange: '',
    suggestedNewCategoryTitle: '',
    suggestedCardAddress: '',
    suggestedTitle: draft.title.trim(),
    suggestedContent: '',
    suggestedTags: [],
    suggestedStatus: 'Seed',
    suggestedRelatedAddresses: [],
    suggestedSource: (0, antinet_1.normalizeCardSource)(draft.source),
    corrections: [],
    reasoning,
    confidence,
    confidenceBand: (0, exports.deriveConfidenceBand)(confidence),
    alternativeSuggestions: alternativeSuggestions.map(candidate => ({
        ...candidate,
        alternativeSuggestions: [],
    })),
});
exports.forceManualReviewSuggestion = forceManualReviewSuggestion;
const mergeCorrections = (first, second) => Array.from(new Set([...first, ...second].filter(Boolean)));
const topLevelRangeContains = (range, address) => {
    const parsed = (0, antinet_1.parseRange)(range);
    const numeric = Number.parseInt(address.slice(0, 4), 10);
    return Boolean(parsed && !Number.isNaN(numeric) && numeric >= parsed.start && numeric <= parsed.end);
};
const buildCandidateClue = (values) => truncate(values.filter(Boolean).join(' | '), 92);
const buildDraftText = (draft) => [
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
    .join(' ');
const getCategoryForAddress = (address, categories) => {
    const prefix = (0, antinet_1.normalizeAddress)(address).slice(0, 4);
    return categories.find(category => !category.range.includes('-') && (0, antinet_1.normalizeAddress)(category.range) === prefix) ?? null;
};
const deriveLocalTags = (draft) => {
    const tags = tokenize([
        draft.title,
        draft.content,
        draft.source?.title ?? '',
        draft.source?.author ?? '',
    ]
        .filter(Boolean)
        .join(' '))
        .filter(token => token.length >= 4 && !/^\d+$/.test(token))
        .slice(0, 3);
    return tags.map(token => titleCase(token).toLowerCase());
};
const deriveLocalStatus = (draft, relatedAddresses) => {
    const contentLength = cleanField(draft.content).length;
    if (contentLength >= 280 || relatedAddresses.length >= 2 || draft.tags.length >= 3) {
        return 'Growing';
    }
    return 'Seed';
};
const buildMinimalCaptureStructuringDraft = (capture) => ({
    suggestedTitle: cleanField(capture.title),
    suggestedContent: normalizeWhitespace(capture.content),
    suggestedSource: (0, antinet_1.normalizeCardSource)({
        type: 'Other',
        note: capture.sourceText?.trim() || undefined,
    }),
    suggestedTags: [],
    suggestedStatus: 'Seed',
    suggestedRelatedAddresses: [],
    strategy: 'local',
    confidenceBand: 'low',
});
exports.buildMinimalCaptureStructuringDraft = buildMinimalCaptureStructuringDraft;
const captureHasExplicitSourceCues = (capture) => {
    const rawSourceText = normalizeWhitespace(capture.sourceText ?? '');
    const rawContent = normalizeWhitespace(capture.content);
    const combinedText = [rawContent, rawSourceText].filter(Boolean).join(' ').trim();
    const url = extractUrl(combinedText);
    const location = extractLocation(combinedText);
    const canonicalBibleBook = findCanonicalBibleBook(combinedText);
    return Boolean(rawSourceText
        || url
        || location
        || canonicalBibleBook
        || /\b(?:book|article|essay|journal|paper|newsletter|blog|video|podcast|quote|quoted|citation|source)\b/i.test(combinedText)
        || /\bby\b/i.test(combinedText));
};
exports.captureHasExplicitSourceCues = captureHasExplicitSourceCues;
const structuringSourceHasFill = (source) => {
    if (!source) {
        return false;
    }
    const normalized = (0, antinet_1.normalizeCardSource)(source);
    if (!normalized) {
        return false;
    }
    return Boolean(normalized.title?.trim()
        || normalized.author?.trim()
        || normalized.url?.trim()
        || normalized.page?.trim()
        || (normalized.type && normalized.type !== 'Other'));
};
const restrainStructuringToCapture = (capture, result) => {
    const isAiProduced = result.strategy === 'ai' || result.strategy === 'merged';
    if (isAiProduced) {
        return {
            ...result,
            suggestedSource: (0, antinet_1.normalizeCardSource)(result.suggestedSource ?? {
                type: 'Other',
                note: capture.sourceText?.trim() || undefined,
            }),
        };
    }
    if ((0, exports.captureHasExplicitSourceCues)(capture) || structuringSourceHasFill(result.suggestedSource)) {
        return result;
    }
    return {
        ...result,
        suggestedSource: (0, antinet_1.normalizeCardSource)({
            type: 'Other',
            note: capture.sourceText?.trim() || undefined,
        }),
        corrections: (result.corrections ?? []).filter(correction => !/\b(source|author|page|url|title corrected)\b/i.test(correction)),
    };
};
exports.restrainStructuringToCapture = restrainStructuringToCapture;
const buildExistingCardSummariesForEnrichment = (cards, limit = 50) => {
    return cards.slice(0, limit).map(card => ({
        address: (0, antinet_1.normalizeAddress)(card.address),
        title: card.title.trim(),
        tags: card.tags?.slice(0, 4),
    }));
};
exports.buildExistingCardSummariesForEnrichment = buildExistingCardSummariesForEnrichment;
const buildCapturePayload = (capture, localDraft, context) => ({
    capture: {
        title: capture.title,
        content: capture.content,
        sourceText: capture.sourceText,
    },
    localDraft,
    context,
});
exports.buildCapturePayload = buildCapturePayload;
const scoreFunctionTitleMatch = (noteFunction, title) => {
    const normalizedTitle = title.toLowerCase();
    if (noteFunction === 'idea_seed') {
        const authoredWorkScore = countCueHits(normalizedTitle, ['article', 'book', 'chapter', 'essay', 'literary', 'novel', 'story', 'writing']) * 10;
        const framingScore = countCueHits(normalizedTitle, ['concept', 'concepts', 'idea', 'ideas', 'outline', 'premise']) * 6;
        const metaphorScore = countCueHits(normalizedTitle, ['analogy', 'analogies', 'metaphor', 'metaphors']) * 3;
        return Math.min(28, authoredWorkScore + framingScore + metaphorScore);
    }
    return scoreTitleAffinity(normalizedTitle, FUNCTION_TO_TITLE_AFFINITY_CUES[noteFunction]);
};
const buildExistingCategorySuggestion = (candidate, draft, confidence, reasoning) => ({
    mode: 'existing_category',
    selectedMasterRange: candidate.parentRange,
    selectedMasterRangeTitle: candidate.parentTitle,
    suggestedCategoryId: candidate.id,
    suggestedCategoryRange: candidate.range,
    suggestedCategoryTitle: candidate.title,
    suggestedParentRange: '',
    suggestedParentTitle: '',
    suggestedNewCategoryRange: '',
    suggestedNewCategoryTitle: '',
    suggestedCardAddress: candidate.nextCardAddress,
    suggestedTitle: draft.title.trim(),
    suggestedContent: '',
    suggestedTags: [],
    suggestedStatus: 'Seed',
    suggestedRelatedAddresses: [],
    suggestedSource: (0, antinet_1.normalizeCardSource)(draft.source),
    corrections: [],
    reasoning,
    confidence,
    confidenceBand: (0, exports.deriveConfidenceBand)(confidence),
    alternativeSuggestions: [],
});
const buildNewCategorySuggestion = (candidate, draft, confidence, reasoning) => ({
    mode: 'new_category',
    selectedMasterRange: candidate.parentRange,
    selectedMasterRangeTitle: candidate.parentTitle,
    suggestedCategoryId: '',
    suggestedCategoryRange: '',
    suggestedCategoryTitle: '',
    suggestedParentRange: candidate.hostRange,
    suggestedParentTitle: candidate.hostTitle,
    suggestedNewCategoryRange: candidate.suggestedRange,
    suggestedNewCategoryTitle: candidate.suggestedTitleHint,
    suggestedCardAddress: `${candidate.suggestedRange}a`,
    suggestedTitle: draft.title.trim(),
    suggestedContent: '',
    suggestedTags: [],
    suggestedStatus: 'Seed',
    suggestedRelatedAddresses: [],
    suggestedSource: (0, antinet_1.normalizeCardSource)(draft.source),
    corrections: [],
    reasoning,
    confidence,
    confidenceBand: (0, exports.deriveConfidenceBand)(confidence),
    alternativeSuggestions: [],
});
const buildManualReviewSuggestion = (selectedMaster, draft, confidence, reasoning) => ({
    mode: 'manual_review',
    selectedMasterRange: selectedMaster?.range ?? '',
    selectedMasterRangeTitle: selectedMaster?.title ?? '',
    suggestedCategoryId: '',
    suggestedCategoryRange: '',
    suggestedCategoryTitle: '',
    suggestedParentRange: '',
    suggestedParentTitle: '',
    suggestedNewCategoryRange: '',
    suggestedNewCategoryTitle: '',
    suggestedCardAddress: '',
    suggestedTitle: draft.title.trim(),
    suggestedContent: '',
    suggestedTags: [],
    suggestedStatus: 'Seed',
    suggestedRelatedAddresses: [],
    suggestedSource: (0, antinet_1.normalizeCardSource)(draft.source),
    corrections: [],
    reasoning,
    confidence,
    confidenceBand: (0, exports.deriveConfidenceBand)(confidence),
    alternativeSuggestions: [],
});
const buildFilingPlan = (input) => {
    const { draft, categories, cards, editingCardId, rejectedSuggestion } = input;
    const draftText = buildDraftText(draft);
    const draftTokens = tokenize(draftText);
    const semanticHints = deriveSemanticHints(draft);
    const candidateCards = cards.filter(card => card.id !== editingCardId);
    const rejectedMasterRange = (0, antinet_1.normalizeAddress)(rejectedSuggestion?.selectedMasterRange ?? '');
    const rejectedCategoryRange = (0, antinet_1.normalizeAddress)(rejectedSuggestion?.mode === 'new_category'
        ? rejectedSuggestion?.suggestedNewCategoryRange ?? ''
        : rejectedSuggestion?.suggestedCategoryRange ?? '');
    const topLevelRanges = categories.filter(category => {
        if (!category.range.includes('-')) {
            return false;
        }
        const parsed = (0, antinet_1.parseRange)(category.range);
        return Boolean(parsed && parsed.start % 1000 === 0 && parsed.end === parsed.start + 999);
    });
    const masterRangeCandidates = topLevelRanges
        .map(rangeCategory => {
        const childLeafs = categories.filter(category => !category.range.includes('-') && (0, antinet_1.cardBelongsToCategory)({ address: `${category.range}a` }, rangeCategory));
        const supportingCards = candidateCards.filter(card => (0, antinet_1.cardBelongsToCategory)(card, rangeCategory));
        const titleScore = scoreTextMatch(draftTokens, [rangeCategory.range, rangeCategory.title]);
        const leafScore = childLeafs
            .slice(0, 12)
            .reduce((sum, category) => sum + Math.min(8, scoreTextMatch(draftTokens, [category.title, category.range])), 0);
        const cardScore = supportingCards
            .slice(0, 12)
            .reduce((sum, card) => sum + Math.min(8, scoreTextMatch(draftTokens, [
            card.title,
            card.content.slice(0, 180),
            card.tags?.join(' ') ?? '',
            card.source?.title ?? '',
        ])), 0);
        const addressScore = draft.address && topLevelRangeContains(rangeCategory.range, (0, antinet_1.normalizeAddress)(draft.address)) ? 18 : 0;
        const semanticBoost = scoreSemanticRangeBoost(rangeCategory.range, draftText, semanticHints, draft.source?.type, rangeCategory.title);
        const rejectionPenalty = rejectedMasterRange && (0, antinet_1.normalizeAddress)(rangeCategory.range) === rejectedMasterRange ? 9 : 0;
        const clueCard = supportingCards
            .map(card => ({
            card,
            score: scoreTextMatch(draftTokens, [card.title, card.content.slice(0, 120), card.tags?.join(' ') ?? '']),
        }))
            .sort((first, second) => second.score - first.score)[0]?.card;
        return {
            range: rangeCategory.range,
            title: rangeCategory.title,
            clue: buildCandidateClue([
                clueCard ? `${clueCard.address} ${clueCard.title}` : '',
                childLeafs.find(category => scoreTextMatch(draftTokens, [category.title]) > 0)?.title ?? '',
            ]),
            score: titleScore + leafScore + cardScore + addressScore + semanticBoost - rejectionPenalty,
        };
    })
        .sort((first, second) => second.score - first.score || first.range.localeCompare(second.range))
        .slice(0, 2);
    const selectedRanges = masterRangeCandidates.length > 0 ? masterRangeCandidates : topLevelRanges.slice(0, 1).map(rangeCategory => ({
        range: rangeCategory.range,
        title: rangeCategory.title,
        clue: rangeCategory.title,
        score: 1,
    }));
    const selectedRangeSet = new Set(selectedRanges.map(range => (0, antinet_1.normalizeAddress)(range.range)));
    const leafCandidates = categories
        .filter(category => !category.range.includes('-') &&
        selectedRanges.some(range => topLevelRangeContains(range.range, (0, antinet_1.normalizeAddress)(category.range))))
        .map(category => {
        const parentRange = selectedRanges.find(range => topLevelRangeContains(range.range, (0, antinet_1.normalizeAddress)(category.range)));
        const supportingCards = candidateCards.filter(card => (0, antinet_1.normalizeAddress)(card.address).startsWith((0, antinet_1.normalizeAddress)(category.range)));
        const score = scoreTextMatch(draftTokens, [category.title, category.range]) +
            supportingCards.reduce((sum, card) => sum + Math.min(6, scoreTextMatch(draftTokens, [
                card.title,
                card.content.slice(0, 140),
                card.tags?.join(' ') ?? '',
                card.source?.title ?? '',
            ])), 0) +
            scoreSemanticRangeBoost(category.range, draftText, semanticHints, draft.source?.type, category.title) -
            (rejectedCategoryRange && (0, antinet_1.normalizeAddress)(category.range) === rejectedCategoryRange ? 10 : 0);
        const clueCard = supportingCards
            .map(card => ({
            card,
            score: scoreTextMatch(draftTokens, [card.title, card.content.slice(0, 120), card.tags?.join(' ') ?? '']),
        }))
            .sort((first, second) => second.score - first.score)[0]?.card;
        return {
            id: category.id,
            range: category.range,
            title: category.title,
            parentRange: parentRange?.range ?? '',
            parentTitle: parentRange?.title ?? '',
            nextCardAddress: (0, antinet_1.getNextCardAddress)(category.range, candidateCards),
            clue: buildCandidateClue([
                clueCard ? `${clueCard.address} ${clueCard.title}` : '',
                clueCard?.tags?.slice(0, 2).join(', ') ?? '',
            ]),
            score,
        };
    })
        .sort((first, second) => second.score - first.score || first.range.localeCompare(second.range))
        .slice(0, 8);
    const newCategoryCandidates = categories
        .filter(category => category.range.includes('-') &&
        selectedRangeSet.has((0, antinet_1.normalizeAddress)(findParentTopLevelRange(category.range, selectedRanges)?.range ?? category.range)) === false
        ? false
        : selectedRanges.some(range => (0, antinet_1.normalizeAddress)(range.range) !== (0, antinet_1.normalizeAddress)(category.range) && topLevelRangeContains(range.range, (0, antinet_1.normalizeAddress)(category.range))))
        .map(category => {
        const parentRange = selectedRanges.find(range => topLevelRangeContains(range.range, (0, antinet_1.normalizeAddress)(category.range)));
        const score = scoreTextMatch(draftTokens, [category.title, category.range]) +
            Math.min(10, (category.children ?? []).reduce((sum, child) => sum + scoreTextMatch(draftTokens, [child.title, child.range]), 0)) +
            scoreSemanticRangeBoost(category.range, draftText, semanticHints, draft.source?.type, category.title) -
            (rejectedCategoryRange && (0, antinet_1.normalizeAddress)((0, antinet_1.getNextCategoryAddress)(category)) === rejectedCategoryRange ? 8 : 0);
        return {
            parentRange: parentRange?.range ?? '',
            parentTitle: parentRange?.title ?? '',
            hostRange: category.range,
            hostTitle: category.title,
            suggestedRange: (0, antinet_1.getNextCategoryAddress)(category),
            suggestedTitleHint: deriveReusableShelfTitle(draft, category.range, category.title, semanticHints),
            clue: buildCandidateClue([category.title, category.range]),
            score,
        };
    })
        .sort((first, second) => second.score - first.score || first.suggestedRange.localeCompare(second.suggestedRange))
        .slice(0, 4);
    const bestLeaf = leafCandidates[0];
    const bestNewCategory = newCategoryCandidates[0];
    const bestNewCategoryHasReusableShelf = Boolean(bestNewCategory?.suggestedTitleHint &&
        (0, exports.isReusableShelfTitle)(bestNewCategory.suggestedTitleHint, draft, bestNewCategory.hostTitle));
    const bestExistingAlreadyCoversSuggestedShelf = Boolean(bestLeaf &&
        bestNewCategory &&
        bestNewCategoryHasReusableShelf &&
        bestLeaf.score >= 12 &&
        shelfTitlesShareIntent(bestLeaf.title, bestNewCategory.suggestedTitleHint));
    const shouldPreferExisting = Boolean(bestLeaf && (bestExistingAlreadyCoversSuggestedShelf ||
        !bestNewCategory ||
        bestLeaf.score >= bestNewCategory.score + 4 ||
        (bestLeaf.score >= 12 && bestLeaf.score >= bestNewCategory.score)));
    const selectedMaster = bestLeaf
        ? selectedRanges.find(range => (0, antinet_1.normalizeAddress)(range.range) === (0, antinet_1.normalizeAddress)(bestLeaf.parentRange)) ?? selectedRanges[0]
        : selectedRanges[0];
    const quickSuggestion = shouldPreferExisting && bestLeaf
        ? buildExistingCategorySuggestion(bestLeaf, draft, Math.min(0.9, 0.5 + bestLeaf.score / 40), 'Quick local filing guess based on the strongest category and nearby card matches.')
        : bestNewCategory && bestNewCategoryHasReusableShelf
            ? buildNewCategorySuggestion(bestNewCategory, draft, Math.min(0.82, 0.42 + bestNewCategory.score / 42), 'Quick local filing guess suggests a new leaf category inside the strongest master range.')
            : buildManualReviewSuggestion(selectedMaster, draft, 0.35, 'The draft needs a manual category check before filing.');
    const alternativeSuggestions = [
        ...leafCandidates.slice(0, 3).map((candidate, index) => buildExistingCategorySuggestion(candidate, draft, Math.max(0.38, Math.min(0.84, 0.46 + candidate.score / 42 - index * 0.05)), 'Nearby local category match.')),
        ...newCategoryCandidates
            .filter(candidate => Boolean(candidate.suggestedTitleHint &&
            (0, exports.isReusableShelfTitle)(candidate.suggestedTitleHint, draft, candidate.hostTitle)))
            .slice(0, 2)
            .map((candidate, index) => buildNewCategorySuggestion(candidate, draft, Math.max(0.34, Math.min(0.78, 0.4 + candidate.score / 44 - index * 0.05)), 'Nearby local new-category option.')),
    ]
        .filter(candidate => {
        const sameExisting = candidate.mode === 'existing_category' &&
            quickSuggestion.mode === 'existing_category' &&
            (0, antinet_1.normalizeAddress)(candidate.suggestedCategoryRange) === (0, antinet_1.normalizeAddress)(quickSuggestion.suggestedCategoryRange);
        const sameNew = candidate.mode === 'new_category' &&
            quickSuggestion.mode === 'new_category' &&
            (0, antinet_1.normalizeAddress)(candidate.suggestedParentRange) === (0, antinet_1.normalizeAddress)(quickSuggestion.suggestedParentRange) &&
            cleanField(candidate.suggestedNewCategoryTitle).toLowerCase() === cleanField(quickSuggestion.suggestedNewCategoryTitle).toLowerCase();
        return !sameExisting && !sameNew;
    })
        .sort((first, second) => (second.confidence ?? 0) - (first.confidence ?? 0))
        .slice(0, 3)
        .map(candidate => ({
        ...candidate,
        alternativeSuggestions: [],
    }));
    const meaningfulSemanticHints = semanticHints.filter(hint => hint !== 'media_note');
    const bestExistingScore = bestLeaf?.score ?? 0;
    const bestNewScore = bestNewCategory?.score ?? 0;
    const strongestLocalScore = shouldPreferExisting ? bestExistingScore : bestNewScore;
    const nextBestScore = shouldPreferExisting
        ? Math.max(leafCandidates[1]?.score ?? 0, bestNewScore)
        : Math.max(newCategoryCandidates[1]?.score ?? 0, bestExistingScore);
    const selectionGap = strongestLocalScore - nextBestScore;
    const useLocalFastPathForOriginalNote = Boolean(!rejectedSuggestion &&
        quickSuggestion.mode === 'existing_category' &&
        quickSuggestion.confidence >= 0.65 &&
        isShortUnsourcedOriginalNote(draft));
    const shouldUseAi = Boolean(rejectedSuggestion ||
        quickSuggestion.mode === 'manual_review' ||
        quickSuggestion.mode === 'new_category' ||
        (!useLocalFastPathForOriginalNote &&
            (quickSuggestion.confidence < 0.78 ||
                (meaningfulSemanticHints.length === 0 && selectionGap < 8))));
    const preview = {
        draftTitle: draft.title.trim() || truncate(cleanField(draft.content), 48),
        topMasterRange: selectedRanges[0]?.range ?? '',
        topMasterRangeTitle: selectedRanges[0]?.title ?? '',
        selectedCategory: shouldPreferExisting && bestLeaf
            ? bestLeaf.range
            : bestNewCategory?.suggestedRange ?? '',
        selectedCategoryTitle: shouldPreferExisting && bestLeaf
            ? bestLeaf.title
            : bestNewCategory?.suggestedTitleHint ?? '',
        suggestedAddress: quickSuggestion.suggestedCardAddress,
    };
    const relatedCandidates = candidateCards
        .filter(card => {
        const sameAddress = quickSuggestion.suggestedCardAddress && (0, antinet_1.normalizeAddress)(card.address) === (0, antinet_1.normalizeAddress)(quickSuggestion.suggestedCardAddress);
        if (sameAddress) {
            return false;
        }
        if (quickSuggestion.mode === 'existing_category') {
            return (0, antinet_1.normalizeAddress)(card.address).slice(0, 4) === (0, antinet_1.normalizeAddress)(quickSuggestion.suggestedCategoryRange);
        }
        return quickSuggestion.selectedMasterRange
            ? topLevelRangeContains(quickSuggestion.selectedMasterRange, (0, antinet_1.normalizeAddress)(card.address))
            : true;
    })
        .map(card => {
        const category = getCategoryForAddress(card.address, categories);
        const score = scoreTextMatch(draftTokens, [
            card.title,
            card.content.slice(0, 220),
            card.tags?.join(' ') ?? '',
            card.source?.title ?? '',
            card.source?.author ?? '',
        ]);
        return {
            address: card.address,
            title: card.title,
            categoryRange: category?.range ?? '',
            categoryTitle: category?.title ?? '',
            content: truncate(card.content, 120),
            tags: card.tags?.slice(0, 4),
            sourceTitle: card.source?.title,
            clue: buildCandidateClue([card.title, card.tags?.slice(0, 2).join(', '), card.source?.title]),
            score,
        };
    })
        .filter(card => (card.score ?? 0) > 0)
        .sort((first, second) => (second.score ?? 0) - (first.score ?? 0))
        .slice(0, 2);
    const localDetails = {
        suggestedTitle: draft.title.trim(),
        suggestedTags: deriveLocalTags(draft),
        suggestedStatus: deriveLocalStatus(draft, relatedCandidates.map(card => (0, antinet_1.normalizeAddress)(card.address))),
        suggestedRelatedAddresses: relatedCandidates.map(card => (0, antinet_1.normalizeAddress)(card.address)),
        reasoning: relatedCandidates.length > 0
            ? 'Local card matching found nearby ideas worth linking.'
            : 'Local details kept the filing sparse to avoid guessing.',
        confidence: relatedCandidates.length > 0 ? 0.64 : 0.5,
    };
    return {
        payload: {
            draft,
            rejectedSuggestion: rejectedSuggestion ?? undefined,
            semanticHints,
            masterRangeCandidates: selectedRanges,
            leafCandidates,
            newCategoryCandidates,
        },
        preview,
        quickSuggestion: {
            ...quickSuggestion,
            suggestedTags: localDetails.suggestedTags,
            suggestedStatus: localDetails.suggestedStatus,
            suggestedRelatedAddresses: localDetails.suggestedRelatedAddresses,
            alternativeSuggestions: quickSuggestion.confidenceBand === 'high' ? [] : alternativeSuggestions,
        },
        localDetails,
        shouldUseAi,
    };
};
exports.buildFilingPlan = buildFilingPlan;
const buildFilingPlanV2 = (input) => {
    const { draft, categories, cards, editingCardId, rejectedSuggestion } = input;
    const draftText = buildDraftText(draft);
    const draftTokens = tokenize(draftText);
    const noteFunction = classifyNoteFunction(draft);
    const semanticHints = Array.from(new Set(deriveSemanticHints(draft).filter(hint => {
        if (noteFunction === 'idea_seed' && (hint === 'practical_procedure' || hint === 'hands_on_nature_or_health')) {
            return false;
        }
        if (noteFunction === 'practical_method' && hint === 'creative_authorship') {
            return false;
        }
        return true;
    }).concat(`function:${noteFunction}`)));
    const candidateCards = cards.filter(card => card.id !== editingCardId);
    const rejectedMasterRange = (0, antinet_1.normalizeAddress)(rejectedSuggestion?.selectedMasterRange ?? '');
    const rejectedCategoryRange = (0, antinet_1.normalizeAddress)(rejectedSuggestion?.mode === 'new_category'
        ? rejectedSuggestion?.suggestedNewCategoryRange ?? ''
        : rejectedSuggestion?.suggestedCategoryRange ?? '');
    const topLevelRanges = getTopLevelRangeCategories(categories);
    const topLevelRangeCategoryByRange = new Map(topLevelRanges.map(category => [(0, antinet_1.normalizeAddress)(category.range), category]));
    const rankedMasterRanges = rankMasterRangesByFunction(noteFunction, categories)
        .map(rangeCategory => {
        const rangeSource = topLevelRangeCategoryByRange.get((0, antinet_1.normalizeAddress)(rangeCategory.range));
        if (!rangeSource) {
            return rangeCategory;
        }
        const childLeafs = categories.filter(category => !category.range.includes('-') && (0, antinet_1.cardBelongsToCategory)({ address: `${category.range}a` }, rangeSource));
        const supportingCards = candidateCards.filter(card => (0, antinet_1.cardBelongsToCategory)(card, rangeSource));
        const titleScore = scoreTextMatch(draftTokens, [rangeCategory.range, rangeCategory.title]);
        const leafScore = childLeafs
            .slice(0, 12)
            .reduce((sum, category) => sum + Math.min(8, scoreTextMatch(draftTokens, [category.title, category.range])), 0);
        const cardScore = supportingCards
            .slice(0, 12)
            .reduce((sum, card) => sum + Math.min(8, scoreTextMatch(draftTokens, [
            card.title,
            card.content.slice(0, 180),
            card.tags?.join(' ') ?? '',
            card.source?.title ?? '',
        ])), 0);
        const addressScore = draft.address && topLevelRangeContains(rangeCategory.range, (0, antinet_1.normalizeAddress)(draft.address)) ? 18 : 0;
        const semanticBoost = scoreSemanticRangeBoost(rangeCategory.range, draftText, semanticHints, draft.source?.type, rangeCategory.title) +
            scoreFunctionTitleMatch(noteFunction, rangeCategory.title);
        const rejectionPenalty = rejectedMasterRange && (0, antinet_1.normalizeAddress)(rangeCategory.range) === rejectedMasterRange ? 9 : 0;
        const clueCard = supportingCards
            .map(card => ({
            card,
            score: scoreTextMatch(draftTokens, [card.title, card.content.slice(0, 120), card.tags?.join(' ') ?? '']),
        }))
            .sort((first, second) => second.score - first.score)[0]?.card;
        return {
            ...rangeCategory,
            clue: buildCandidateClue([
                clueCard ? `${clueCard.address} ${clueCard.title}` : '',
                childLeafs.find(category => scoreTextMatch(draftTokens, [category.title]) > 0)?.title ?? '',
            ]),
            score: rangeCategory.score + titleScore + leafScore + cardScore + addressScore + semanticBoost - rejectionPenalty,
        };
    })
        .sort((first, second) => second.score - first.score || first.range.localeCompare(second.range));
    const pickSelectedRanges = (candidateRanges) => {
        if (candidateRanges.length === 0) {
            return topLevelRanges.slice(0, 1).map(rangeCategory => ({
                range: rangeCategory.range,
                title: rangeCategory.title,
                clue: rangeCategory.title,
                score: 1,
            }));
        }
        const bestScore = candidateRanges[0]?.score ?? 0;
        const selected = candidateRanges.filter((candidate, index) => index < 3 && (index === 0 || candidate.score >= bestScore - 18));
        return selected.length > 0 ? selected : candidateRanges.slice(0, 2);
    };
    const buildLeafCandidatesForRanges = (selectedRanges) => selectedRanges.length === 0
        ? []
        : categories
            .filter(category => !category.range.includes('-') &&
            selectedRanges.some(range => topLevelRangeContains(range.range, (0, antinet_1.normalizeAddress)(category.range))))
            .map(category => {
            const parentRange = selectedRanges.find(range => topLevelRangeContains(range.range, (0, antinet_1.normalizeAddress)(category.range)));
            const supportingCards = candidateCards.filter(card => (0, antinet_1.normalizeAddress)(card.address).startsWith((0, antinet_1.normalizeAddress)(category.range)));
            const score = scoreTextMatch(draftTokens, [category.title, category.range]) +
                supportingCards.reduce((sum, card) => sum + Math.min(6, scoreTextMatch(draftTokens, [
                    card.title,
                    card.content.slice(0, 140),
                    card.tags?.join(' ') ?? '',
                    card.source?.title ?? '',
                ])), 0) +
                scoreSemanticRangeBoost(category.range, draftText, semanticHints, draft.source?.type, category.title) +
                scoreFunctionTitleMatch(noteFunction, category.title) -
                (rejectedCategoryRange && (0, antinet_1.normalizeAddress)(category.range) === rejectedCategoryRange ? 10 : 0);
            const clueCard = supportingCards
                .map(card => ({
                card,
                score: scoreTextMatch(draftTokens, [card.title, card.content.slice(0, 120), card.tags?.join(' ') ?? '']),
            }))
                .sort((first, second) => second.score - first.score)[0]?.card;
            return {
                id: category.id,
                range: category.range,
                title: category.title,
                parentRange: parentRange?.range ?? '',
                parentTitle: parentRange?.title ?? '',
                nextCardAddress: (0, antinet_1.getNextCardAddress)(category.range, candidateCards),
                clue: buildCandidateClue([
                    clueCard ? `${clueCard.address} ${clueCard.title}` : '',
                    clueCard?.tags?.slice(0, 2).join(', ') ?? '',
                ]),
                score,
            };
        })
            .sort((first, second) => second.score - first.score || first.range.localeCompare(second.range))
            .slice(0, 8);
    const buildNewCategoryCandidatesForRanges = (selectedRanges) => {
        const selectedRangeSet = new Set(selectedRanges.map(range => (0, antinet_1.normalizeAddress)(range.range)));
        return selectedRanges.length === 0
            ? []
            : categories
                .filter(category => category.range.includes('-') &&
                selectedRangeSet.has((0, antinet_1.normalizeAddress)(findParentTopLevelRange(category.range, selectedRanges)?.range ?? category.range)) !== false &&
                selectedRanges.some(range => (0, antinet_1.normalizeAddress)(range.range) !== (0, antinet_1.normalizeAddress)(category.range) && topLevelRangeContains(range.range, (0, antinet_1.normalizeAddress)(category.range))))
                .map(category => {
                const parentRange = selectedRanges.find(range => topLevelRangeContains(range.range, (0, antinet_1.normalizeAddress)(category.range)));
                const score = scoreTextMatch(draftTokens, [category.title, category.range]) +
                    Math.min(10, (category.children ?? []).reduce((sum, child) => sum + scoreTextMatch(draftTokens, [child.title, child.range]), 0)) +
                    scoreSemanticRangeBoost(category.range, draftText, semanticHints, draft.source?.type, category.title) +
                    scoreFunctionTitleMatch(noteFunction, category.title) -
                    (rejectedCategoryRange && (0, antinet_1.normalizeAddress)((0, antinet_1.getNextCategoryAddress)(category)) === rejectedCategoryRange ? 8 : 0);
                return {
                    parentRange: parentRange?.range ?? '',
                    parentTitle: parentRange?.title ?? '',
                    hostRange: category.range,
                    hostTitle: category.title,
                    suggestedRange: (0, antinet_1.getNextCategoryAddress)(category),
                    suggestedTitleHint: deriveReusableShelfTitle(draft, category.range, category.title, semanticHints),
                    clue: buildCandidateClue([category.title, category.range]),
                    score,
                };
            })
                .sort((first, second) => second.score - first.score || first.suggestedRange.localeCompare(second.suggestedRange))
                .slice(0, 4);
    };
    let selectedRanges = pickSelectedRanges(rankedMasterRanges);
    let leafCandidates = buildLeafCandidatesForRanges(selectedRanges);
    let newCategoryCandidates = buildNewCategoryCandidatesForRanges(selectedRanges);
    const initialStrongestScore = Math.max(leafCandidates[0]?.score ?? 0, newCategoryCandidates[0]?.score ?? 0);
    if (initialStrongestScore < 18 && rankedMasterRanges.length > selectedRanges.length) {
        selectedRanges = rankedMasterRanges.slice(0, Math.min(5, rankedMasterRanges.length));
        leafCandidates = buildLeafCandidatesForRanges(selectedRanges);
        newCategoryCandidates = buildNewCategoryCandidatesForRanges(selectedRanges);
    }
    const bestLeaf = leafCandidates[0];
    const bestNewCategory = newCategoryCandidates[0];
    const bestNewCategoryHasReusableShelf = Boolean(bestNewCategory?.suggestedTitleHint &&
        (0, exports.isReusableShelfTitle)(bestNewCategory.suggestedTitleHint, draft, bestNewCategory.hostTitle));
    const bestExistingAlreadyCoversSuggestedShelf = Boolean(bestLeaf &&
        bestNewCategory &&
        bestNewCategoryHasReusableShelf &&
        bestLeaf.score >= 12 &&
        shelfTitlesShareIntent(bestLeaf.title, bestNewCategory.suggestedTitleHint));
    const shouldPreferExisting = Boolean(bestLeaf && (bestExistingAlreadyCoversSuggestedShelf ||
        !bestNewCategoryHasReusableShelf ||
        !bestNewCategory ||
        bestLeaf.score >= bestNewCategory.score + 2 ||
        (bestLeaf.score >= 12 && bestLeaf.score >= bestNewCategory.score)));
    const selectedMaster = bestLeaf
        ? selectedRanges.find(range => (0, antinet_1.normalizeAddress)(range.range) === (0, antinet_1.normalizeAddress)(bestLeaf.parentRange)) ?? selectedRanges[0]
        : selectedRanges[0];
    const quickSuggestion = shouldPreferExisting && bestLeaf
        ? buildExistingCategorySuggestion(bestLeaf, draft, Math.min(0.92, 0.54 + bestLeaf.score / 40), `V2 function-first filing prefers an existing shelf for ${noteFunction.replace(/_/g, ' ')} notes.`)
        : bestNewCategory && bestNewCategoryHasReusableShelf
            ? buildNewCategorySuggestion(bestNewCategory, draft, Math.min(0.84, 0.44 + bestNewCategory.score / 42), `V2 function-first filing suggests a reusable new shelf for ${noteFunction.replace(/_/g, ' ')} notes.`)
            : buildManualReviewSuggestion(selectedMaster, draft, 0.35, 'V2 function-first filing still needs a manual category check.');
    const alternativeSuggestions = [
        ...leafCandidates.slice(0, 3).map((candidate, index) => buildExistingCategorySuggestion(candidate, draft, Math.max(0.4, Math.min(0.86, 0.48 + candidate.score / 42 - index * 0.05)), 'Nearby V2 function-first category match.')),
        ...newCategoryCandidates
            .filter(candidate => Boolean(candidate.suggestedTitleHint &&
            (0, exports.isReusableShelfTitle)(candidate.suggestedTitleHint, draft, candidate.hostTitle)))
            .slice(0, 2)
            .map((candidate, index) => buildNewCategorySuggestion(candidate, draft, Math.max(0.36, Math.min(0.8, 0.42 + candidate.score / 44 - index * 0.05)), 'Nearby V2 function-first new-category option.')),
    ]
        .filter(candidate => {
        const sameExisting = candidate.mode === 'existing_category' &&
            quickSuggestion.mode === 'existing_category' &&
            (0, antinet_1.normalizeAddress)(candidate.suggestedCategoryRange) === (0, antinet_1.normalizeAddress)(quickSuggestion.suggestedCategoryRange);
        const sameNew = candidate.mode === 'new_category' &&
            quickSuggestion.mode === 'new_category' &&
            (0, antinet_1.normalizeAddress)(candidate.suggestedParentRange) === (0, antinet_1.normalizeAddress)(quickSuggestion.suggestedParentRange) &&
            cleanField(candidate.suggestedNewCategoryTitle).toLowerCase() === cleanField(quickSuggestion.suggestedNewCategoryTitle).toLowerCase();
        return !sameExisting && !sameNew;
    })
        .sort((first, second) => (second.confidence ?? 0) - (first.confidence ?? 0))
        .slice(0, 3)
        .map(candidate => ({
        ...candidate,
        alternativeSuggestions: [],
    }));
    const meaningfulSemanticHints = semanticHints.filter(hint => hint !== 'media_note' && !hint.startsWith('function:'));
    const bestExistingScore = bestLeaf?.score ?? 0;
    const bestNewScore = bestNewCategory?.score ?? 0;
    const strongestLocalScore = shouldPreferExisting ? bestExistingScore : bestNewScore;
    const nextBestScore = shouldPreferExisting
        ? Math.max(leafCandidates[1]?.score ?? 0, bestNewScore)
        : Math.max(newCategoryCandidates[1]?.score ?? 0, bestExistingScore);
    const selectionGap = strongestLocalScore - nextBestScore;
    const useLocalFastPathForOriginalNote = Boolean(!rejectedSuggestion &&
        quickSuggestion.mode === 'existing_category' &&
        quickSuggestion.confidence >= 0.65 &&
        isShortUnsourcedOriginalNote(draft));
    const shouldUseAi = Boolean(rejectedSuggestion ||
        quickSuggestion.mode === 'manual_review' ||
        quickSuggestion.mode === 'new_category' ||
        (!useLocalFastPathForOriginalNote &&
            (quickSuggestion.confidence < 0.8 ||
                (meaningfulSemanticHints.length === 0 && selectionGap < 8))));
    const preview = {
        draftTitle: draft.title.trim() || truncate(cleanField(draft.content), 48),
        topMasterRange: selectedRanges[0]?.range ?? '',
        topMasterRangeTitle: selectedRanges[0]?.title ?? '',
        selectedCategory: shouldPreferExisting && bestLeaf
            ? bestLeaf.range
            : bestNewCategory?.suggestedRange ?? '',
        selectedCategoryTitle: shouldPreferExisting && bestLeaf
            ? bestLeaf.title
            : bestNewCategory?.suggestedTitleHint ?? '',
        suggestedAddress: quickSuggestion.suggestedCardAddress,
    };
    const relatedCandidates = candidateCards
        .filter(card => {
        const sameAddress = quickSuggestion.suggestedCardAddress && (0, antinet_1.normalizeAddress)(card.address) === (0, antinet_1.normalizeAddress)(quickSuggestion.suggestedCardAddress);
        if (sameAddress) {
            return false;
        }
        if (quickSuggestion.mode === 'existing_category') {
            return (0, antinet_1.normalizeAddress)(card.address).slice(0, 4) === (0, antinet_1.normalizeAddress)(quickSuggestion.suggestedCategoryRange);
        }
        return quickSuggestion.selectedMasterRange
            ? topLevelRangeContains(quickSuggestion.selectedMasterRange, (0, antinet_1.normalizeAddress)(card.address))
            : true;
    })
        .map(card => {
        const category = getCategoryForAddress(card.address, categories);
        const score = scoreTextMatch(draftTokens, [
            card.title,
            card.content.slice(0, 220),
            card.tags?.join(' ') ?? '',
            card.source?.title ?? '',
            card.source?.author ?? '',
        ]);
        return {
            address: card.address,
            title: card.title,
            categoryRange: category?.range ?? '',
            categoryTitle: category?.title ?? '',
            content: truncate(card.content, 120),
            tags: card.tags?.slice(0, 4),
            sourceTitle: card.source?.title,
            clue: buildCandidateClue([card.title, card.tags?.slice(0, 2).join(', '), card.source?.title]),
            score,
        };
    })
        .filter(card => (card.score ?? 0) > 0)
        .sort((first, second) => (second.score ?? 0) - (first.score ?? 0))
        .slice(0, 2);
    const localDetails = {
        suggestedTitle: draft.title.trim(),
        suggestedTags: deriveLocalTags(draft),
        suggestedStatus: deriveLocalStatus(draft, relatedCandidates.map(card => (0, antinet_1.normalizeAddress)(card.address))),
        suggestedRelatedAddresses: relatedCandidates.map(card => (0, antinet_1.normalizeAddress)(card.address)),
        reasoning: relatedCandidates.length > 0
            ? 'V2 local card matching found nearby ideas worth linking.'
            : 'V2 local details kept the filing sparse to avoid guessing.',
        confidence: relatedCandidates.length > 0 ? 0.66 : 0.52,
    };
    return {
        payload: {
            draft,
            rejectedSuggestion: rejectedSuggestion ?? undefined,
            semanticHints,
            masterRangeCandidates: selectedRanges,
            leafCandidates,
            newCategoryCandidates,
        },
        preview,
        quickSuggestion: {
            ...quickSuggestion,
            suggestedTags: localDetails.suggestedTags,
            suggestedStatus: localDetails.suggestedStatus,
            suggestedRelatedAddresses: localDetails.suggestedRelatedAddresses,
            alternativeSuggestions: quickSuggestion.confidenceBand === 'high' ? [] : alternativeSuggestions,
        },
        localDetails,
        shouldUseAi,
    };
};
exports.buildFilingPlanV2 = buildFilingPlanV2;
const buildCapturePreview = (result, rawCapture) => ({
    rawCapture,
    title: result.suggestedTitle,
    body: result.suggestedContent,
    sourceType: result.suggestedSource?.type ?? 'Other',
    sourceTitle: result.suggestedSource?.title ?? '',
    author: result.suggestedSource?.author ?? '',
    location: result.suggestedSource?.page ?? '',
    corrections: result.corrections ?? [],
});
exports.buildCapturePreview = buildCapturePreview;
function findParentTopLevelRange(range, selectedRanges) {
    return selectedRanges.find(candidate => topLevelRangeContains(candidate.range, (0, antinet_1.normalizeAddress)(range)));
}
