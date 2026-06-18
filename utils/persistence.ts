import * as FileSystem from 'expo-file-system/legacy';

import {
  Card,
  InboxCapture,
  CustomCategory,
  CategoryOverride,
  AppSettings,
} from '../types';

export const DATA_VERSION = 1;

export const CARDS_FILE = FileSystem.documentDirectory + 'antinetCards.json';
export const INBOX_FILE = FileSystem.documentDirectory + 'secondMindInboxCaptures.json';
export const CUSTOM_CATEGORIES_FILE = FileSystem.documentDirectory + 'antinetCustomCategories.json';
export const CATEGORY_OVERRIDES_FILE = FileSystem.documentDirectory + 'antinetCategoryOverrides.json';
export const DELETED_DEFAULT_CATEGORIES_FILE = FileSystem.documentDirectory + 'antinetDeletedDefaultCategories.json';
export const SETTINGS_FILE = FileSystem.documentDirectory + 'antinetSettings.json';

export const getDocumentDirectory = () => FileSystem.documentDirectory || '';

export const loadJsonFile = async <T,>(path: string, fallback: T): Promise<T> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(path);
    if (!fileInfo.exists) {
      return fallback;
    }

    const content = await FileSystem.readAsStringAsync(path);
    return JSON.parse(content) as T;
  } catch (e) {
    return fallback;
  }
};

export const saveJsonFile = async (path: string, data: any): Promise<void> => {
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2));
};

// Pure file save functions (no state updates)
export const saveCardsToFile = async (cards: Card[]) => {
  await saveJsonFile(CARDS_FILE, cards);
};

export const saveInboxCapturesToFile = async (captures: InboxCapture[]) => {
  await saveJsonFile(INBOX_FILE, captures);
};

export const saveCustomCategoriesToFile = async (categories: CustomCategory[]) => {
  await saveJsonFile(CUSTOM_CATEGORIES_FILE, categories);
};

export const saveCategoryOverridesToFile = async (overrides: CategoryOverride[]) => {
  await saveJsonFile(CATEGORY_OVERRIDES_FILE, overrides);
};

export const saveDeletedDefaultCategoryIdsToFile = async (ids: string[]) => {
  await saveJsonFile(DELETED_DEFAULT_CATEGORIES_FILE, ids);
};

export const saveSettingsToFile = async (settings: AppSettings) => {
  await saveJsonFile(SETTINGS_FILE, settings);
};

// Backup helpers
export const getBackupFiles = async (): Promise<string[]> => {
  const dir = FileSystem.documentDirectory;
  if (!dir) return [];
  try {
    const files = await FileSystem.readDirectoryAsync(dir);
    return files
      .filter((f) => f.startsWith('second-mind-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
};

export const loadLatestBackup = async () => {
  const files = await getBackupFiles();
  if (files.length === 0) return null;
  const dir = FileSystem.documentDirectory;
  return loadJsonFile(dir + files[0], null);
};

export const createBackupData = (
  cards: Card[],
  inboxCaptures: InboxCapture[],
  customCategories: CustomCategory[],
  categoryOverrides: CategoryOverride[],
  deletedDefaultCategoryIds: string[],
  settings: AppSettings
) => ({
  version: DATA_VERSION,
  exportedAt: new Date().toISOString(),
  cards,
  inboxCaptures,
  customCategories,
  categoryOverrides,
  deletedDefaultCategoryIds,
  settings,
});

export const migrateDataIfNeeded = (data: any) => {
  const currentVersion = data?.version ?? 0;
  if (currentVersion < DATA_VERSION) {
    console.log(`[Persistence] Migrating data from version ${currentVersion} to ${DATA_VERSION}`);
    // Stub for future migrations. For now, just bump version.
    // Example future: if (currentVersion < 2) { migrate v1 to v2 }
    return { ...data, version: DATA_VERSION };
  }
  return data;
};

// Note on persistence strategy:
// Current: JSON files via FileSystem for simplicity and to keep card history "immutable".

export const loadAllData = async () => {
  const [cards, inboxCaptures, customCategories, overrides, deletedIds, settings] = await Promise.all([
    loadJsonFile<Card[]>(CARDS_FILE, []),
    loadJsonFile<InboxCapture[]>(INBOX_FILE, []),
    loadJsonFile<CustomCategory[]>(CUSTOM_CATEGORIES_FILE, []),
    loadJsonFile<CategoryOverride[]>(CATEGORY_OVERRIDES_FILE, []),
    loadJsonFile<string[]>(DELETED_DEFAULT_CATEGORIES_FILE, []),
    loadJsonFile<AppSettings>(SETTINGS_FILE, { darkMode: false }),
  ]);
  return { cards, inboxCaptures, customCategories, overrides, deletedIds, settings };
};
