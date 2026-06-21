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

export interface InboxCaptureEnrichment {
  structuredDraft: CaptureStructuringResult;
  filingSuggestion?: CardFilingSuggestion;
  enrichedAt: string;
  jobId: string;
}

export interface InboxCapture {
  id: string;
  title: string;
  content: string;
  sourceText?: string;
  createdAt: string;
  intendedType?: 'card' | 'todo';
  enrichment?: InboxCaptureEnrichment;
}

export type CaptureRoute = 'card' | 'todo';

export type CaptureJobStatus =
  | 'pending'
  | 'classifying'
  | 'awaiting_clarification'
  | 'enriching'
  | 'generating_todos'
  | 'completed'
  | 'failed';

export interface CaptureClassificationAlternative {
  route: CaptureRoute;
  confidence: number;
  reasoning: string;
}

export interface CaptureClassificationResult {
  route: CaptureRoute;
  confidence: number;
  confidenceBand: AiDecisionConfidenceBand;
  reasoning: string;
  alternatives?: CaptureClassificationAlternative[];
  needsClarification: boolean;
  clarificationPrompt?: string;
}

export interface CaptureClassifyLocalSignals {
  bulletLineCount: number;
  numberedLineCount: number;
  hasSourceCues: boolean;
  looksLikeQuote: boolean;
}

export interface CaptureClassifyHints {
  userOverride?: CaptureRoute | null;
  localSignals: CaptureClassifyLocalSignals;
}

export interface CaptureClassifyPayload {
  capture: Pick<InboxCapture, 'id' | 'title' | 'content' | 'sourceText' | 'createdAt'>;
  hints: CaptureClassifyHints;
}

export interface TodoGenerationDraft {
  clientId: string;
  title: string;
  content?: string;
  parentClientId?: string | null;
  sortOrder: number;
  dueDate?: string;
  relatedAddresses?: string[];
}

export type CaptureClarificationStage = 'classify' | 'generate_todos';

export type CaptureClarificationInputType = 'route_choice' | 'free_text' | 'date';

export interface CaptureClarificationState {
  stage: CaptureClarificationStage;
  prompt: string;
  inputType: CaptureClarificationInputType;
  round: number;
}

export interface CaptureClarificationAnswer {
  stage: CaptureClarificationStage;
  prompt: string;
  answer: string;
  answeredAt: string;
}

export interface CaptureTodoClarificationContext {
  round: number;
  answers: CaptureClarificationAnswer[];
  partialTodos?: TodoGenerationDraft[];
}

export interface TodoGenerationResult {
  todos: TodoGenerationDraft[];
  corrections?: string[];
  confidence?: number;
  confidenceBand?: AiDecisionConfidenceBand;
  strategy?: 'local' | 'ai' | 'merged';
  needsClarification?: boolean;
  clarificationPrompt?: string;
  inputType?: Exclude<CaptureClarificationInputType, 'route_choice'>;
}

export interface ExistingTodoSummary {
  clientId: string;
  title: string;
  parentClientId?: string | null;
  sortOrder: number;
  completed: boolean;
}

export interface HeuristicTodoHints {
  todos: TodoGenerationDraft[];
  confidence: 'low';
  scope: 'list_shapes_only';
  note: string;
}

export interface CaptureGenerateTodosPayload {
  capture: Pick<InboxCapture, 'id' | 'title' | 'content' | 'sourceText' | 'createdAt'>;
  heuristicHints: HeuristicTodoHints;
  /** @deprecated Legacy field kept for backward compatibility with older clients. */
  localDraft?: {
    todos: TodoGenerationDraft[];
    strategy: 'local';
  };
  context?: {
    existingCardAddresses?: string[];
    existingTodos?: ExistingTodoSummary[];
  };
  clarification?: CaptureTodoClarificationContext;
}

export interface CaptureEnrichPayload {
  capture: Pick<InboxCapture, 'id' | 'title' | 'content' | 'sourceText' | 'createdAt'>;
  localDraft: CaptureStructuringResult;
}

export interface CaptureJob {
  id: string;
  captureId: string;
  status: CaptureJobStatus;
  createdAt: string;
  updatedAt: string;
  userRouteOverride?: CaptureRoute;
  classification?: CaptureClassificationResult;
  clarification?: CaptureClarificationState;
  clarificationAnswers?: CaptureClarificationAnswer[];
  enrichment?: CaptureStructuringResult;
  todoGeneration?: TodoGenerationResult;
  error?: string;
}

export interface Todo {
  id: string;
  title: string;
  content?: string;
  completed: boolean;
  parentId?: string;
  sortOrder: number;
  createdAt: string;
  dueDate?: string;
  relatedAddresses?: string[];
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
  collapsedTodoIds?: string[];
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

export interface FilingWhyContext {
  considered: string;
  notApplied: string;
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
  filingWhy?: FilingWhyContext;
}

export interface CaptureStructuringResult {
  suggestedTitle: string;
  suggestedContent: string;
  suggestedSource?: CardSource;
  suggestedTags?: string[];
  suggestedStatus?: 'Seed' | 'Growing' | 'Evergreen';
  suggestedRelatedAddresses?: string[];
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
  categories?: Array<{
    id: string;
    range: string;
    title: string;
    isLeaf: boolean;
  }>;
}

export interface ExistingCardSummary {
  address: string;
  title: string;
  tags?: string[];
}

export interface RouteAndEnrichResult {
  classification: CaptureClassificationResult;
  enrichment?: CaptureStructuringResult;
  todoGeneration?: TodoGenerationResult;
}

export interface CaptureStructuringPayload {
  capture: {
    title: string;
    content: string;
    sourceText?: string;
  };
  localDraft: CaptureStructuringResult;
  context?: {
    existingCards?: ExistingCardSummary[];
  };
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
  | 'todoList'
  | 'thinking'
  | 'settings'
  | 'help';
