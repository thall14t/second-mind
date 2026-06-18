import { create } from 'zustand';
import {
  Card,
  InboxCapture,
  CustomCategory,
  CategoryOverride,
  AppSettings,
  Todo,
} from '../../types';

interface DataState {
  cards: Card[];
  inboxCaptures: InboxCapture[];
  todos: Todo[];
  customCategories: CustomCategory[];
  categoryOverrides: CategoryOverride[];
  deletedDefaultCategoryIds: string[];
  settings: AppSettings;
  // UI state extracted from monolith
  searchQuery: string;
  expandedCategories: Record<string, boolean>;
  isLoadingData: boolean;
  captureTitle: string;
  captureContent: string;
  askCardsQuestion: string;
  askCardsResult: any;
  isAskingCards: boolean;
  setCards: (cards: Card[]) => void;
  setInboxCaptures: (captures: InboxCapture[]) => void;
  setTodos: (todos: Todo[]) => void;
  setCustomCategories: (categories: CustomCategory[]) => void;
  setCategoryOverrides: (overrides: CategoryOverride[]) => void;
  setDeletedDefaultCategoryIds: (ids: string[]) => void;
  setSettings: (settings: AppSettings) => void;
  setSearchQuery: (query: string) => void;
  setExpandedCategories: (expanded: Record<string, boolean>) => void;
  setIsLoadingData: (loading: boolean) => void;
  setCaptureTitle: (title: string) => void;
  setCaptureContent: (content: string) => void;
  setAskCardsQuestion: (question: string) => void;
  setAskCardsResult: (result: any) => void;
  setIsAskingCards: (asking: boolean) => void;
  toggleCategory: (id: string) => void;
  // For future: add actions for add/update etc.
}

export const useDataStore = create<DataState>((set, get) => ({
  cards: [],
  inboxCaptures: [],
  todos: [],
  customCategories: [],
  categoryOverrides: [],
  deletedDefaultCategoryIds: [],
  settings: { darkMode: false },
  searchQuery: '',
  expandedCategories: {},
  isLoadingData: true,
  // Additional UI state for cleaner monolith
  captureTitle: '',
  captureContent: '',
  askCardsQuestion: '',
  askCardsResult: null as any,
  isAskingCards: false,
  setCards: (cards) => set({ cards }),
  setInboxCaptures: (inboxCaptures) => set({ inboxCaptures }),
  setTodos: (todos) => set({ todos }),
  setCustomCategories: (customCategories) => set({ customCategories }),
  setCategoryOverrides: (categoryOverrides) => set({ categoryOverrides }),
  setDeletedDefaultCategoryIds: (deletedDefaultCategoryIds) => set({ deletedDefaultCategoryIds }),
  setSettings: (settings) => set({ settings }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setExpandedCategories: (expandedCategories) => set({ expandedCategories }),
  setIsLoadingData: (isLoadingData: boolean) => set({ isLoadingData }),
  setCaptureTitle: (captureTitle: string) => set({ captureTitle }),
  setCaptureContent: (captureContent: string) => set({ captureContent }),
  setAskCardsQuestion: (askCardsQuestion: string) => set({ askCardsQuestion }),
  setAskCardsResult: (askCardsResult: any) => set({ askCardsResult }),
  setIsAskingCards: (isAskingCards: boolean) => set({ isAskingCards }),
  toggleCategory: (id: string) => {
    const current = get().expandedCategories;
    set({ expandedCategories: { ...current, [id]: !current[id] } });
  },
}));
