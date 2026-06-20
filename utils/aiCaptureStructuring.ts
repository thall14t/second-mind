import {
  CardFilingSuggestion,
  CardSource,
  CardSourceType,
  CaptureStructuringResult,
  InboxCapture,
  ThinkingState,
} from '../types';
import { buildCapturePreview } from './aiCataloguing';
import { normalizeCardSource } from './antinet';

const clipThinkingValue = (value: string, maxLength = 52) => (
  value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : value
);

export const createCaptureThinkingState = (preview: ThinkingState['structurePreview']): ThinkingState => ({
  kind: 'structure',
  title: 'Structuring capture',
  body: 'Second Mind is splitting the rough capture into a card body and source fields.',
  steps: [
    { label: 'Read capture', value: 'Captured', state: 'done' },
    { label: 'Extract body', value: clipThinkingValue(preview?.body || 'Reading body'), state: 'active' },
    {
      label: 'Normalize source',
      value: preview?.sourceTitle || preview?.author || preview?.location
        ? [preview.sourceTitle, preview.author, preview.location].filter(Boolean).join(' | ')
        : 'Looking for source clues',
      state: 'pending',
    },
    { label: 'Finalize card', value: preview?.title || 'Working title', state: 'pending' },
  ],
  structurePreview: preview,
});

export const applyCaptureThinkingResult = (
  previousState: ThinkingState,
  result: CaptureStructuringResult,
  capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>
): ThinkingState => {
  const preview = buildCapturePreview(
    result,
    [capture.title, capture.content, capture.sourceText ?? ''].filter(Boolean).join('\n')
  );

  return {
    ...previousState,
    body: (result.corrections?.length ?? 0) > 0
      ? 'Second Mind cleaned the capture and found a stronger split between note body and source.'
      : previousState.body,
    steps: [
      { label: 'Read capture', value: 'Captured', state: 'done' },
      { label: 'Extract body', value: clipThinkingValue(preview.body, 52), state: 'done' },
      {
        label: 'Normalize source',
        value: preview.sourceTitle || preview.author || preview.location
          ? [preview.sourceTitle, preview.author, preview.location].filter(Boolean).join(' | ')
          : 'No source detected',
        state: 'done',
      },
      {
        label: 'Finalize card',
        value: preview.title || 'Card fields ready',
        state: 'done',
      },
    ],
    structurePreview: preview,
  };
};

const normalizeWhitespaceForCapture = (value: string) => value.replace(/\s+/g, ' ').trim();
const cleanCapturedSourceField = (value: string) =>
  normalizeWhitespaceForCapture(value).replace(/^[,;:.\-]+|[,;:.\-]+$/g, '').trim();

const SOURCE_TITLE_CONNECTOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'for',
  'from',
  'in',
  'of',
  'on',
  'the',
  'to',
  'with',
]);

const SOURCE_AUTHOR_PARTICLES = new Set([
  'al',
  'bin',
  'da',
  'de',
  'del',
  'der',
  'di',
  'du',
  'ibn',
  'la',
  'le',
  'van',
  'von',
]);

const SOURCE_TEXT_DISQUALIFIERS = new Set([
  'am',
  'are',
  'as',
  'be',
  'been',
  'being',
  'did',
  'do',
  'does',
  'had',
  'has',
  'have',
  'i',
  'is',
  'it',
  'my',
  'our',
  'that',
  'their',
  'they',
  'this',
  'was',
  'we',
  'were',
  'what',
  'which',
  'who',
  'why',
  'will',
  'would',
  'you',
  'your',
]);

const tokenizeSourceSegment = (value: string) =>
  cleanCapturedSourceField(value)
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);

const isLikelyAuthorToken = (token: string) =>
  /^[A-Z][A-Za-z.'-]*$/.test(token) ||
  /^[A-Z]{2,}$/.test(token) ||
  /^[A-Z]\.?[A-Z]\.?$/.test(token);

const isLikelySourceTitleSegment = (value: string) => {
  const cleaned = cleanCapturedSourceField(value);
  if (!cleaned || /[.!?]$/.test(cleaned) || cleaned.length > 80) {
    return false;
  }

  if (findCanonicalBibleBook(cleaned)) {
    return true;
  }

  const tokens = tokenizeSourceSegment(cleaned);
  if (tokens.length === 0 || tokens.length > 8) {
    return false;
  }

  const loweredTokens = tokens.map(token => token.toLowerCase());
  if (loweredTokens.some(token => SOURCE_TEXT_DISQUALIFIERS.has(token))) {
    return false;
  }

  const significantTokens = tokens.filter(token => !SOURCE_TITLE_CONNECTOR_WORDS.has(token.toLowerCase()));
  if (significantTokens.length === 0) {
    return false;
  }

  const titleishTokens = significantTokens.filter(token =>
    isLikelyAuthorToken(token) ||
    /^\d+(?:st|nd|rd|th)?$/i.test(token) ||
    /^[ivxlcdm]+$/i.test(token)
  );

  return titleishTokens.length / significantTokens.length >= 0.6 || tokens.length <= 4;
};

const isLikelyAuthorSegment = (value: string) => {
  const cleaned = cleanCapturedSourceField(value);
  if (!cleaned || /[.!?]/.test(cleaned) || cleaned.length > 50) {
    return false;
  }

  const tokens = tokenizeSourceSegment(cleaned);
  if (tokens.length === 0 || tokens.length > 5) {
    return false;
  }

  const significantTokens = tokens.filter(token => !SOURCE_AUTHOR_PARTICLES.has(token.toLowerCase()));
  return significantTokens.length > 0 && significantTokens.every(isLikelyAuthorToken);
};

const hasValidBySourcePattern = (value: string) => {
  const byMatch = cleanCapturedSourceField(value).match(/^(.+?)\s+by\s+(.+)$/i);
  if (!byMatch) {
    return false;
  }

  return isLikelySourceTitleSegment(byMatch[1]) && isLikelyAuthorSegment(byMatch[2]);
};

const CANONICAL_BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke',
  'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
] as const;

const PAULINE_BIBLE_BOOK_AUTHORS: Partial<Record<(typeof CANONICAL_BIBLE_BOOKS)[number], string>> = {
  Romans: 'Paul',
  '1 Corinthians': 'Paul',
  '2 Corinthians': 'Paul',
  Galatians: 'Paul',
  Ephesians: 'Paul',
  Philippians: 'Paul',
  Colossians: 'Paul',
  '1 Thessalonians': 'Paul',
  '2 Thessalonians': 'Paul',
  '1 Timothy': 'Paul',
  '2 Timothy': 'Paul',
  Titus: 'Paul',
  Philemon: 'Paul',
};

const normalizeBibleSearchText = (value: string) =>
  normalizeWhitespaceForCapture(
    value
      .toLowerCase()
      .replace(/\bfirst\b/g, '1')
      .replace(/\bsecond\b/g, '2')
      .replace(/\bthird\b/g, '3')
      .replace(/\biii\b/g, '3')
      .replace(/\bii\b/g, '2')
      .replace(/\bi\b/g, '1')
      .replace(/[^a-z0-9]+/g, ' ')
  );

const findCanonicalBibleBook = (value: string) => {
  const normalizedValue = normalizeBibleSearchText(value);
  if (!normalizedValue) {
    return null;
  }

  return CANONICAL_BIBLE_BOOKS.find(book =>
    normalizedValue.includes(normalizeBibleSearchText(book))
  ) ?? null;
};

const normalizeBiblicalSource = (source: CardSource | undefined, rawText: string) => {
  const normalizedSource = normalizeCardSource(source);
  const canonicalBook = findCanonicalBibleBook([normalizedSource?.title ?? '', rawText].join(' '));
  if (!canonicalBook) {
    return normalizedSource;
  }

  const authorLooksGeneric = /^(?:the\s+)?(?:holy\s+)?bible|scriptures?$/i.test(
    normalizedSource?.author ?? ''
  );
  const explicitVerseReference =
    rawText.match(/\b(\d{1,3}:\d{1,3}(?:-\d{1,3})?)\b/)?.[1] ?? '';

  return normalizeCardSource({
    type: 'Book',
    title: canonicalBook,
    author: authorLooksGeneric || !normalizedSource?.author
      ? (PAULINE_BIBLE_BOOK_AUTHORS[canonicalBook] ?? '')
      : normalizedSource.author,
    url: normalizedSource?.url,
    page: normalizedSource?.page || explicitVerseReference,
    note: normalizedSource?.note,
  });
};

const inferSourceLeadFields = (value: string) => {
  const normalizedLead = normalizeWhitespaceForCapture(value.replace(/^[,;:|\-]+|[,;:|\-]+$/g, ''));
  if (!normalizedLead) {
    return { author: '', title: '' };
  }

  const explicitByMatch = normalizedLead.match(/^(.+?)\s+by\s+(.+)$/i);
  if (
    explicitByMatch &&
    isLikelySourceTitleSegment(explicitByMatch[1]) &&
    isLikelyAuthorSegment(explicitByMatch[2])
  ) {
    return {
      title: explicitByMatch[1].trim(),
      author: explicitByMatch[2].trim(),
    };
  }

  const tokens = normalizedLead.split(' ').filter(Boolean);

  let splitIndex = 0;
  while (splitIndex < tokens.length && isLikelyAuthorToken(tokens[splitIndex])) {
    splitIndex += 1;
  }

  if (splitIndex >= 1 && splitIndex < tokens.length) {
    const authorCandidate = tokens.slice(0, splitIndex).join(' ');
    const titleCandidate = tokens.slice(splitIndex).join(' ');
    if (isLikelyAuthorSegment(authorCandidate) && isLikelySourceTitleSegment(titleCandidate)) {
      return {
        author: authorCandidate,
        title: titleCandidate,
      };
    }
  }

  if (isLikelySourceTitleSegment(normalizedLead)) {
    return {
      author: '',
      title: normalizedLead,
    };
  }

  return { author: '', title: '' };
};

const captureIndicatesSource = (capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>) => {
  const combinedText = [capture.title, capture.content, capture.sourceText ?? ''].filter(Boolean).join(' ').trim();
  if (!combinedText) {
    return false;
  }

  return Boolean(
    capture.sourceText?.trim() ||
    /\b(?:https?:\/\/|www\.)\S+/i.test(combinedText) ||
    /\b(?:page|pages|p\.|pp\.|loc(?:ation)?|timestamp|chapter|verse|section)\b/i.test(combinedText) ||
    /\b\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/.test(combinedText) ||
    /\b(?:book|article|essay|video|podcast|source|quote|quoted|citation)\b/i.test(combinedText) ||
    Boolean(findCanonicalBibleBook(combinedText)) ||
    hasValidBySourcePattern(combinedText)
  );
};

const buildHeuristicCaptureStructuringV2 = (
  capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>
): CaptureStructuringResult => {
  const rawTitle = capture.title.trim();
  const rawContent = capture.content.trim();
  const rawSourceText = capture.sourceText?.trim() ?? '';
  const combinedText = [rawContent, rawSourceText].filter(Boolean).join(' ').trim();

  const doubleQuoteMatch = combinedText.match(/[\u201c"]([^"\u201c\u201d]{3,})[\u201d"]/s);
  const singleQuoteMatch = combinedText.match(/'([^']{3,})'/s);
  const quoteMatch = doubleQuoteMatch ?? singleQuoteMatch;
  const quotedContent = quoteMatch?.[1]?.trim() ?? '';

  const separatorMatch = rawContent.match(/^(.+?)\s+(?:-|--|\u2014)\s+(.+)$/s);
  const trailingSourceText = separatorMatch?.[2]?.trim() ?? '';
  const separatorLooksLikeSource = /\b(by|from|page|pages|p\.|pp\.|www\.|https?:\/\/|book|article|video)\b/i.test(trailingSourceText);
  const bodyAfterLocationMatch = rawContent.match(
    /^(?:.+?\b(?:page|pages|p\.|pp\.|loc(?:ation)?|timestamp)\s*[:#-]?\s*[A-Za-z0-9\-:.]+)\s*[,;:\-]?\s+(.+)$/i
  );
  const extractedBodyAfterLocation = bodyAfterLocationMatch?.[1]?.trim() ?? '';

  const urlMatch = combinedText.match(/\b(?:https?:\/\/|www\.)\S+/i);
  const pageMatch = combinedText.match(/\b(?:page|pages|p\.|pp\.|loc(?:ation)?|timestamp)\s*[:#-]?\s*([A-Za-z0-9\-:.]+)/i);
  const fromByMatch = combinedText.match(/\bfrom\s+(.+?)\s+by\s+([^,.;\n]+?)(?=(?:\s+(?:page|pages|p\.|pp\.|loc(?:ation)?|timestamp)\b|[,.;\n]|$))/i);
  const byInMatch = combinedText.match(/\bby\s+([^,.;\n]+?)\s+in\s+(.+?)(?=(?:\s+(?:page|pages|p\.|pp\.|loc(?:ation)?|timestamp)\b|[,.;\n]|$))/i);
  const bookMatch = combinedText.match(/\b(?:book|title)\s*[:\-]?\s*([^,.;\n]+?)(?=(?:\s+(?:by|page|pages|p\.|pp\.|loc(?:ation)?|timestamp)\b|[,.;\n]|$))/i);
  const authorMatch = combinedText.match(/\bauthor\s*[:\-]?\s*([^,.;\n]+?)(?=(?:\s+(?:page|pages|p\.|pp\.|loc(?:ation)?|timestamp)\b|[,.;\n]|$))/i);
  const sourceLead = normalizeWhitespaceForCapture(
    combinedText
      .replace(quoteMatch?.[0] ?? '', ' ')
      .replace(extractedBodyAfterLocation, ' ')
      .replace(/\b(?:page|pages|p\.|pp\.|loc(?:ation)?|timestamp)\s*[:#-]?\s*[A-Za-z0-9\-:.]+/gi, ' ')
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ')
      .replace(/["'\u201c\u201d]/g, ' ')
  );
  const inferredSource = inferSourceLeadFields(sourceLead);

  const sourceTitle = cleanCapturedSourceField(fromByMatch?.[1] ?? byInMatch?.[2] ?? bookMatch?.[1] ?? inferredSource.title ?? '');
  const sourceAuthor = cleanCapturedSourceField(fromByMatch?.[2] ?? byInMatch?.[1] ?? authorMatch?.[1] ?? inferredSource.author ?? '');
  const sourceUrl = (urlMatch?.[0] ?? '').trim();
  const sourcePage = cleanCapturedSourceField(pageMatch?.[1] ?? '');

  const sourceType: CardSourceType =
    /\b(video|youtube|timestamp)\b/i.test(combinedText) ? 'Video'
      : /\b(article|essay|journal|magazine)\b/i.test(combinedText) ? 'Article'
      : sourceUrl ? 'Web'
      : sourceTitle || sourceAuthor || sourcePage || /\b(book|chapter)\b/i.test(combinedText) ? 'Book'
      : 'Other';

  const heuristicContent = quotedContent
    || extractedBodyAfterLocation
    || (separatorLooksLikeSource ? separatorMatch?.[1]?.trim() ?? rawContent : rawContent);

  const normalizedSource = normalizeBiblicalSource(
    {
      type: sourceType,
      title: sourceTitle,
      author: sourceAuthor,
      url: sourceUrl,
      page: sourcePage,
      note: rawSourceText,
    },
    combinedText
  );

  return {
    suggestedTitle: rawTitle,
    suggestedContent: heuristicContent,
    suggestedSource: normalizedSource,
  };
};

export const mergeCaptureStructuringResultV2 = (
  capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>,
  result?: Partial<CaptureStructuringResult> | null
): CaptureStructuringResult => {
  const heuristic = buildHeuristicCaptureStructuringV2(capture);
  const captureHasSourceCues = captureIndicatesSource(capture);
  const rawContent = capture.content.trim();
  const aiTitle = typeof result?.suggestedTitle === 'string' ? result.suggestedTitle.trim() : '';
  const aiContent = typeof result?.suggestedContent === 'string' ? result.suggestedContent.trim() : '';
  const aiSource = result?.suggestedSource;
  const heuristicSource = heuristic.suggestedSource;
  const mergedSource = captureHasSourceCues
    ? normalizeBiblicalSource({
        type: aiSource?.type ?? heuristicSource?.type ?? 'Other',
        title: aiSource?.title || heuristicSource?.title,
        author: aiSource?.author || heuristicSource?.author,
        url: aiSource?.url || heuristicSource?.url,
        page: aiSource?.page || heuristicSource?.page,
        note: aiSource?.note || heuristicSource?.note,
      }, [capture.content, capture.sourceText ?? ''].filter(Boolean).join(' '))
    : undefined;
  const normalizedRawContent = normalizeWhitespaceForCapture(rawContent);
  const normalizedAiContent = normalizeWhitespaceForCapture(aiContent);
  const normalizedHeuristicContent = normalizeWhitespaceForCapture(heuristic.suggestedContent);
  const heuristicChangedBody = Boolean(normalizedHeuristicContent) && normalizedHeuristicContent !== normalizedRawContent;
  const sourceWasStructured = Boolean(mergedSource?.title || mergedSource?.author || mergedSource?.url || mergedSource?.page);
  const shouldPreferHeuristicContent =
    !normalizedAiContent ||
    (heuristicChangedBody && normalizedAiContent === normalizedRawContent) ||
    (heuristicChangedBody && sourceWasStructured);

  return {
    suggestedTitle: aiTitle || heuristic.suggestedTitle,
    suggestedContent: shouldPreferHeuristicContent ? heuristic.suggestedContent : aiContent,
    suggestedSource: mergedSource,
  };
};


