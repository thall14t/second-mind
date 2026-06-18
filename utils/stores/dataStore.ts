import { create } from 'zustand';
import {
  Card,
  InboxCapture,
  CustomCategory,
  CategoryOverride,
  AppSettings,
} from '../../types';

interface DataState {
  cards: Card[];
  inboxCaptures: InboxCapture[];
  customCategories: CustomCategory[];
  categoryOverrides: CategoryOverride[];
  deletedDefaultCategoryIds: string[];
  settings: AppSettings;
  setCards: (cards: Card[]) => void;
  setInboxCaptures: (captures: InboxCapture[]) => void;
  setCustomCategories: (categories: CustomCategory[]) => void;
  setCategoryOverrides: (overrides: CategoryOverride[]) => void;
  setDeletedDefaultCategoryIds: (ids: string[]) => void;
  setSettings: (settings: AppSettings) => void;
  // For future: add actions for add/update etc.
}

export const useDataStore = create<DataState>((set) => ({
  cards: [],
  inboxCaptures: [],
  customCategories: [],
  categoryOverrides: [],
  deletedDefaultCategoryIds: [],
  settings: { darkMode: false },
  setCards: (cards) => set({ cards }),
  setInboxCaptures: (inboxCaptures) => set({ inboxCaptures }),
  setCustomCategories: (customCategories) => set({ customCategories }),
  setCategoryOverrides: (categoryOverrides) => set({ categoryOverrides }),
  setDeletedDefaultCategoryIds: (deletedDefaultCategoryIds) => set({ deletedDefaultCategoryIds }),
  setSettings: (settings) => set({ settings }),
}));
