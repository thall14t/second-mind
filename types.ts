import { Category } from './data/antinetCategories';

export interface Card {
  id: string;
  address: string;
  title: string;
  content: string;
  createdAt: string;
  status?: 'Seed' | 'Growing' | 'Evergreen';
  tags?: string[];
  relatedAddresses?: string[];
  source?: CardSource;
}

export type CardSourceType = 'Web' | 'Book' | 'Article' | 'Video' | 'Other';

export interface CardSource {
  type: CardSourceType;
  title?: string;
  author?: string;
  url?: string;
  page?: string;
  note?: string;
}

export interface InboxCapture {
  id: string;
  title: string;
  content: string;
  sourceText?: string;
  createdAt: string;
}

export interface CustomCategory extends Category {
  parentId: string;
  createdAt: string;
  isCustom: true;
}

export interface CategoryOverride {
  id: string;
  title: string;
}

export interface ManagedCategory extends Category {
  parentId?: string;
  createdAt?: string;
  isCustom?: boolean;
  isDefault?: boolean;
  children?: ManagedCategory[];
}

export interface AppSettings {
  darkMode: boolean;
  aiAssistEndpoint?: string;
  cardSortMode?: CardSortMode;
}

export type CardSortMode = 'address' | 'recent';
export type AiDecisionConfidenceBand = 'high' | 'medium' | 'low';
export type FilingSuggestionStatus = 'local_preview' | 'ai_confirmed' | 'ai_revised' | 'local_fallback';

export type FilingSuggestionMode = 'existing_category' | 'new_category' | 'manual_review';

export interface FilingDraft {
  address: string;
  title: string;
  content: string;
  tags: string[];
  source?: CardSource;
}

export interface FilingDecisionBase {
  mode: FilingSuggestionMode;
  selectedMasterRange?: string;
  selectedMasterRangeTitle?: string;
  reasoning: string;
  confidence: number;
  confidenceBand?: AiDecisionConfidenceBand;
}

export interface FilingLeafDecision extends FilingDecisionBase {
  suggestedCategoryId: string;
  suggestedCategoryRange: string;
  suggestedCategoryTitle: string;
  suggestedParentRange: string;
  suggestedParentTitle: string;
  suggestedNewCategoryRange: string;
  suggestedNewCategoryTitle: string;
  suggestedCardAddress: string;
}

export interface CardFilingSuggestion extends FilingLeafDecision {
  suggestedTitle: string;
  suggestedContent: string;
  suggestedTags: string[];
  suggestedStatus: 'Seed' | 'Growing' | 'Evergreen';
  suggestedRelatedAddresses: string[];
  suggestedSource?: CardSource;
  corrections?: string[];
  alternativeSuggestions?: CardFilingSuggestion[];
}

export interface CaptureStructuringResult {
  suggestedTitle: string;
  suggestedContent: string;
  suggestedSource?: CardSource;
  corrections?: string[];
  confidence?: number;
  confidenceBand?: AiDecisionConfidenceBand;
  strategy?: 'local' | 'ai' | 'merged';
}

export interface CardFilingDetailsSuggestion {
  suggestedTitle: string;
  suggestedTags: string[];
  suggestedStatus: 'Seed' | 'Growing' | 'Evergreen';
  suggestedRelatedAddresses: string[];
  reasoning: string;
  confidence: number;
}

export interface FilingRangeCandidate {
  range: string;
  title: string;
  clue: string;
  score: number;
}

export interface FilingLeafCandidate {
  id: string;
  range: string;
  title: string;
  parentRange: string;
  parentTitle: string;
  nextCardAddress: string;
  clue: string;
  score: number;
}

export interface FilingNewCategoryCandidate {
  parentRange: string;
  parentTitle: string;
  hostRange: string;
  hostTitle: string;
  suggestedRange: string;
  suggestedTitleHint: string;
  clue: string;
  score: number;
}

export interface FilingCardCandidate {
  address: string;
  title: string;
  categoryRange: string;
  categoryTitle: string;
  content: string;
  tags?: string[];
  sourceTitle?: string;
  clue?: string;
  score?: number;
}

export interface FilingLeafDecisionPayload {
  draft: FilingDraft;
  rejectedSuggestion?: CardFilingSuggestion;
  semanticHints?: string[];
  masterRangeCandidates: FilingRangeCandidate[];
  leafCandidates: FilingLeafCandidate[];
  newCategoryCandidates: FilingNewCategoryCandidate[];
}

export interface AiAssistCategoryNode {
  id: string;
  range: string;
  title: string;
  isLeaf?: boolean;
  children?: AiAssistCategoryNode[];
}

export interface AiAssistPayload {
  draft: FilingDraft;
  rejectedSuggestion?: CardFilingSuggestion;
  semanticHints?: string[];
  topLevelCategories: AiAssistCategoryNode[];
}

export interface CaptureStructuringPayload {
  capture: {
    title: string;
    content: string;
    sourceText?: string;
  };
  localDraft: CaptureStructuringResult;
}

export type ThinkingStepState = 'pending' | 'active' | 'done';

export interface ThinkingStep {
  label: string;
  value?: string;
  state: ThinkingStepState;
}

export interface ThinkingStructurePreview {
  rawCapture: string;
  title: string;
  body: string;
  sourceType: CardSourceType;
  sourceTitle: string;
  author: string;
  location: string;
  corrections: string[];
}

export interface ThinkingFilingPreview {
  draftTitle: string;
  topMasterRange: string;
  topMasterRangeTitle: string;
  selectedCategory: string;
  selectedCategoryTitle: string;
  suggestedAddress: string;
}

export interface ThinkingState {
  kind: 'structure' | 'filing';
  title: string;
  body: string;
  steps: ThinkingStep[];
  structurePreview?: ThinkingStructurePreview;
  filingPreview?: ThinkingFilingPreview;
}

export interface AskCardsResult {
  answer: string;
  referencedAddresses: string[];
  suggestedFollowUps: string[];
  confidence: number;
}

export interface AskCardsPayload {
  question: string;
  cards: Array<{
    address: string;
    title: string;
    content: string;
    status?: 'Seed' | 'Growing' | 'Evergreen';
    tags?: string[];
    relatedAddresses?: string[];
    source?: CardSource;
  }>;
  categories: Array<{
    range: string;
    title: string;
  }>;
}

export type Screen =
  | 'home'
  | 'askCards'
  | 'cardThread'
  | 'newCard'
  | 'editCard'
  | 'newCategory'
  | 'editCategory'
  | 'categoryPicker'
  | 'cardList'
  | 'quickCapture'
  | 'inbox'
  | 'thinking'
  | 'settings'
  | 'help';
