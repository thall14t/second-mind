import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, PanResponder, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import antinetCategories from './data/antinetCategories';
import testCards from './data/testCards';
import testCaptures from './data/testCaptures';
import AskCardsScreen from './components/AskCardsScreen';
import CardListScreen from './components/CardListScreen';
import CardThreadView from './components/CardThreadView';
import CardViewer from './components/CardViewer';
import CategoryPickerScreen from './components/CategoryPickerScreen';
import HelpScreen from './components/HelpScreen';
import HomeScreen from './components/HomeScreen';
import InboxScreen from './components/InboxScreen';
import TodoListScreen from './components/TodoListScreen';
import NewCardScreen from './components/NewCardScreen';
import NewCategoryScreen from './components/NewCategoryScreen';
import QuickCaptureScreen from './components/QuickCaptureScreen';
import SettingsScreen from './components/SettingsScreen';
import ThinkingScreen from './components/ThinkingScreen';
import CaptureClarificationModal from './components/CaptureClarificationModal';
import ErrorBoundary from './components/ErrorBoundary';
import { useAiFiling } from './hooks/useAiFiling';
import { useCaptureStructuring } from './hooks/useCaptureStructuring';
import { useCaptureJobs } from './hooks/useCaptureJobs';
import { useCaptureRouting } from './hooks/useCaptureRouting';
import { styles } from './styles';
import {
  AiAssistPayload,
  AppSettings,
  AskCardsPayload,
  AskCardsResult,
  Card,
  CardSortMode,
  CardFilingSuggestion,
  CaptureStructuringResult,
  CardSourceType,
  CategoryOverride,
  CustomCategory,
  InboxCapture,
  ManagedCategory,
  Screen,
  ThinkingState,
  Todo,
} from './types';
import { getTheme } from './theme';
import {
  isReusableShelfTitle,
  restrainStructuringToCapture,
} from './utils/aiCataloguing';
import { applyCaptureThinkingResult, createCaptureThinkingState } from './utils/aiCaptureStructuring';
import {
  buildCardFormFieldsFromCaptureEnrichment,
  findSmallestContainingRange,
  resolveSuggestedNewCategoryRange,
} from './utils/aiFiling';
import {
  buildCategoryTree,
  cardBelongsToCategory,
  collectDefaultLeafIds,
  collectDefaultRangeOverrides,
  collectCategorySubtree,
  compareCardAddresses,
  compareCardsByMostRecent,
  flattenCategories,
  formatCategoryLabel,
  getNextCardAddress,
  getNextCategoryAddress,
  normalizeCard,
  normalizeCardSource,
  normalizeAddress,
  parseCommaSeparatedValues,
  parseRange,
  validateCardAddress,
  validateCategoryAddress,
} from './utils/antinet';
import {
  buildCaptureClarificationBannerHint,
  buildCaptureClarificationLabel,
  buildCaptureClarificationViews,
  buildCaptureProcessingJobViews,
  getInboxCaptureFilingSuggestion,
  getInboxCaptureStructuredDraft,
  pruneCaptureJobs,
} from './utils/captureJobs';
import { mergeTodoGenerationIntoExisting } from './utils/todoAppend';
import { normalizeTodoDueDateInput } from './utils/todoDates';
import {
  collectDescendantIds,
  ensureTodoSortOrders,
  FlatTodoItem,
  getNextSortOrder,
  indentTodo,
  insertSiblingTodo,
  outdentTodo,
  reorderTodosFromDrag,
  toggleTodoCompletion,
} from './utils/todoTree';
import {
  CARDS_FILE,
  INBOX_FILE,
  CUSTOM_CATEGORIES_FILE,
  CATEGORY_OVERRIDES_FILE,
  DELETED_DEFAULT_CATEGORIES_FILE,
  SETTINGS_FILE,
  DATA_VERSION,
  loadJsonFile,
  saveJsonFile,
  saveCardsToFile,
  saveInboxCapturesToFile,
  saveTodosToFile,
  saveCaptureJobsToFile,
  saveCustomCategoriesToFile,
  saveCategoryOverridesToFile,
  saveDeletedDefaultCategoryIdsToFile,
  saveSettingsToFile,
  getBackupFiles,
  loadLatestBackup,
  createBackupData,
  loadAllData,
  migrateDataIfNeeded,
  getDocumentDirectory,
} from './utils/persistence';
import { useDataStore } from './utils/stores/dataStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
// For local dev: 'http://localhost:3001' or your LAN IP
// For Render deployment (recommended for trialing): use your Render URL e.g. https://second-mind-ai.onrender.com
// Default for local development. 
// For Render trialing: replace with your deployed URL (e.g. https://second-mind-ai.onrender.com)
// Users set this in Settings > Developer Settings
const DEFAULT_AI_ASSIST_ENDPOINT = 'http://localhost:3001';
const FILING_SUGGESTION_TIMEOUT_MS = 20_000;
const CAPTURE_STRUCTURING_TIMEOUT_MS = 18_000;

type SwipeUnderlayDescriptor =
  | { type: 'none' }
  | { type: 'home' }
  | { type: 'selectedCardDetail' }
  | { type: 'screen'; screen: Screen }
  | { type: 'cardList'; selectedMasterRange: ManagedCategory | null };

const Stack = createNativeStackNavigator();

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedThreadCard, setSelectedThreadCard] = useState<Card | null>(null);
  const [cardThreadReturnScreen, setCardThreadReturnScreen] = useState<Screen>('home');
  const [cardDetailReturnScreen, setCardDetailReturnScreen] = useState<Screen | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingCategory, setEditingCategory] = useState<ManagedCategory | null>(null);
  const [categoryPickerReturnScreen, setCategoryPickerReturnScreen] = useState<Screen>('home');
  const [searchQuery, setSearchQuery] = useState('');

  const [newCardAddress, setNewCardAddress] = useState('');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardContent, setNewCardContent] = useState('');
  const [newCardStatus, setNewCardStatus] = useState<'Seed' | 'Growing' | 'Evergreen'>('Seed');
  const [newCardTagsText, setNewCardTagsText] = useState('');
  const [newCardRelatedAddressesText, setNewCardRelatedAddressesText] = useState('');
  const [newCardSourceType, setNewCardSourceType] = useState<CardSourceType>('Web');
  const [newCardSourceTitle, setNewCardSourceTitle] = useState('');
  const [newCardSourceAuthor, setNewCardSourceAuthor] = useState('');
  const [newCardSourceUrl, setNewCardSourceUrl] = useState('');
  const [newCardSourcePage, setNewCardSourcePage] = useState('');
  const [newCardSourceNote, setNewCardSourceNote] = useState('');
  const { 
    cards, setCards,
    inboxCaptures, setInboxCaptures,
    todos, setTodos,
    captureJobs, setCaptureJobs,
    customCategories, setCustomCategories,
    categoryOverrides, setCategoryOverrides,
    deletedDefaultCategoryIds, setDeletedDefaultCategoryIds,
    settings, setSettings,
  } = useDataStore();
  const [cardListRestoreAddress, setCardListRestoreAddress] = useState<string | null>(null);
  const [selectedCardListRange, setSelectedCardListRange] = useState<ManagedCategory | null>(null);
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureContent, setCaptureContent] = useState('');
  const [filingInboxCaptureId, setFilingInboxCaptureId] = useState<string | null>(null);
  const pendingInboxAutoFilingRef = useRef(false);
  const inboxAutoFilingAppliedRef = useRef<string | null>(null);
  const [clarificationModalJobId, setClarificationModalJobId] = useState<string | null>(null);
  const [dismissedClarificationJobIds, setDismissedClarificationJobIds] = useState<string[]>([]);
  const [resolvingClarificationJobIds, setResolvingClarificationJobIds] = useState<string[]>([]);
  const [askCardsQuestion, setAskCardsQuestion] = useState('');
  const [askCardsResult, setAskCardsResult] = useState<AskCardsResult | null>(null);
  const [isAskingCards, setIsAskingCards] = useState(false);
  const [thinkingState, setThinkingState] = useState<ThinkingState | null>(null);
  const [thinkingReturnScreen, setThinkingReturnScreen] = useState<Screen>('inbox');

  const [newCategoryAddress, setNewCategoryAddress] = useState('');
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [selectedParentRange, setSelectedParentRange] = useState<ManagedCategory | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [frozenSwipeUnderlay, setFrozenSwipeUnderlay] = useState<SwipeUnderlayDescriptor | null>(null);
  const [isTodoListZoomed, setIsTodoListZoomed] = useState(false);
  const swipeTriggeredRef = useRef(false);
  const swipeX = useRef(new Animated.Value(0)).current;
  const isTodoListZoomedRef = useRef(false);
  const todoListZoomOutRef = useRef<(() => void) | null>(null);
  isTodoListZoomedRef.current = isTodoListZoomed;
  const theme = getTheme(settings.darkMode);

  const categoryTree = useMemo(
    () => buildCategoryTree(antinetCategories, customCategories, categoryOverrides, deletedDefaultCategoryIds),
    [customCategories, categoryOverrides, deletedDefaultCategoryIds]
  );

  const allCategories = useMemo(() => flattenCategories(categoryTree), [categoryTree]);

  const cardSortMode = settings.cardSortMode ?? 'address';
  const sortedCards = [...cards].sort((firstCard, secondCard) =>
    cardSortMode === 'recent'
      ? compareCardsByMostRecent(firstCard, secondCard)
      : compareCardAddresses(firstCard.address, secondCard.address)
  );

  const filteredCards = sortedCards
    .filter(card => selectedCardListRange ? cardBelongsToCategory(card, selectedCardListRange) : true)
    .filter(card =>
      card.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (card.tags ?? []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      [
        card.source?.type,
        card.source?.title,
        card.source?.author,
        card.source?.url,
        card.source?.page,
        card.source?.note,
      ].some(value => value?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    let data = await loadAllData();
    data = migrateDataIfNeeded(data);
    setCards(data.cards.map(normalizeCard));
    setInboxCaptures(data.inboxCaptures);
    setTodos(ensureTodoSortOrders(data.todos));
    setCaptureJobs(pruneCaptureJobs(data.captureJobs ?? [], data.inboxCaptures));
    setCustomCategories(data.customCategories);
    setCategoryOverrides(data.overrides);
    setDeletedDefaultCategoryIds(data.deletedIds);
    setSettings(data.settings);
  };

  const saveCards = async (updatedCards: Card[]) => {
    await saveCardsToFile(updatedCards);
    setCards(updatedCards);
  };

  const saveInboxCaptures = async (updatedCaptures: InboxCapture[]) => {
    await saveInboxCapturesToFile(updatedCaptures);
    setInboxCaptures(updatedCaptures);
  };

  const saveTodos = async (updatedTodos: Todo[]) => {
    await saveTodosToFile(updatedTodos);
    setTodos(updatedTodos);
  };

  const saveCaptureJobs = async (updatedJobs: typeof captureJobs) => {
    await saveCaptureJobsToFile(updatedJobs);
    setCaptureJobs(updatedJobs);
  };

  const saveCustomCategories = async (updatedCategories: CustomCategory[]) => {
    await saveCustomCategoriesToFile(updatedCategories);
    setCustomCategories(updatedCategories);
  };

  const saveCategoryOverrides = async (updatedOverrides: CategoryOverride[]) => {
    await saveCategoryOverridesToFile(updatedOverrides);
    setCategoryOverrides(updatedOverrides);
  };

  const saveDeletedDefaultCategoryIds = async (updatedIds: string[]) => {
    await saveDeletedDefaultCategoryIdsToFile(updatedIds);
    setDeletedDefaultCategoryIds(updatedIds);
  };

  const saveSettings = async (updatedSettings: AppSettings) => {
    await saveSettingsToFile(updatedSettings);
    setSettings(updatedSettings);
  };

  const createFullBackup = async () => {
    try {
      const data = await loadAllData();
      const backup = createBackupData(
        data.cards,
        data.inboxCaptures,
        data.customCategories,
        data.overrides,
        data.deletedIds,
        data.settings,
        data.todos,
        data.captureJobs ?? []
      );

      const now = new Date();
      const timestamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const filename = `second-mind-backup-${timestamp}.json`;
      const backupPath = getDocumentDirectory() + filename;

      await saveJsonFile(backupPath, backup);

      Alert.alert(
        'Backup Created',
        `Full backup saved as:\n${filename}\n\nLocation: app documents folder.`
      );

      // Attempt to share the backup
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(backupPath);
        } else {
          Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
        }
      } catch (shareErr) {
        console.log('Share error', shareErr);
      }
    } catch (e) {
      console.log('Backup error', e);
      Alert.alert('Backup Failed', 'Could not create the backup file. Please try again.');
    }
  };

  const restoreFromBackup = async (backupData: any) => {
    if (!backupData || typeof backupData !== 'object') {
      Alert.alert('Invalid Backup', 'The backup file appears to be corrupted or invalid.');
      return;
    }

    const migratedData = migrateDataIfNeeded(backupData);
    if (migratedData.version && migratedData.version !== DATA_VERSION) {
      console.log(`Backup version ${migratedData.version} differs from current ${DATA_VERSION}`);
    }

    Alert.alert(
      'Restore from Backup?',
      'This will replace your current cards, inbox captures, todos, custom categories, and settings.\n\nThis action cannot be undone. Are you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                cards = [],
                inboxCaptures = [],
                todos: backupTodos = [],
                captureJobs: backupCaptureJobs = [],
                customCategories = [],
                categoryOverrides = [],
                deletedDefaultCategoryIds = [],
                settings: backupSettings = { darkMode: false },
              } = migratedData;

              const normalizedCards = (cards ?? []).map(normalizeCard);

              await Promise.all([
                saveCardsToFile(normalizedCards),
                saveInboxCapturesToFile(inboxCaptures ?? []),
                saveTodosToFile(backupTodos ?? []),
                saveCaptureJobsToFile(backupCaptureJobs ?? []),
                saveCustomCategoriesToFile(customCategories ?? []),
                saveCategoryOverridesToFile(categoryOverrides ?? []),
                saveDeletedDefaultCategoryIdsToFile(deletedDefaultCategoryIds ?? []),
                saveSettingsToFile(backupSettings ?? { darkMode: false }),
              ]);

              setCards(normalizedCards);
              setInboxCaptures(inboxCaptures ?? []);
              setTodos(ensureTodoSortOrders(backupTodos ?? []));
              setCaptureJobs(pruneCaptureJobs(backupCaptureJobs ?? [], inboxCaptures ?? []));
              setCustomCategories(customCategories ?? []);
              setCategoryOverrides(categoryOverrides ?? []);
              setDeletedDefaultCategoryIds(deletedDefaultCategoryIds ?? []);
              setSettings(backupSettings ?? { darkMode: false });

              setExpandedCategories({});
              Alert.alert('Restore Complete', 'Your data has been restored from the backup file.');
            } catch (e) {
              console.log('Restore error', e);
              Alert.alert('Restore Failed', 'Something went wrong while restoring the backup.');
            }
          },
        },
      ]
    );
  };

  const restoreLatestBackup = async () => {
    try {
      const backupData = await loadLatestBackup();

      if (!backupData) {
        Alert.alert('No Backups Found', 'No backup files were found in the app documents folder.');
        return;
      }

      await restoreFromBackup(backupData);
    } catch (e) {
      console.log('Restore latest error', e);
      Alert.alert('Restore Failed', 'Could not read or apply the latest backup file.');
    }
  };

  const shareLatestBackup = async () => {
    try {
      const files = await getBackupFiles();
      if (files.length === 0) {
        Alert.alert('No Backups', 'No backup files available to share.');
        return;
      }
      const latest = getDocumentDirectory() + files[0];
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(latest);
      } else {
        Alert.alert('Sharing not available');
      }
    } catch (e) {
      console.log('Share error', e);
      Alert.alert('Share Failed', 'Could not share the backup.');
    }
  };

  const syncBidirectionalRelatedCards = (
    updatedCards: Card[],
    sourceCard: Card,
    previousRelatedAddresses: string[] = []
  ) => {
    const sourceAddress = normalizeAddress(sourceCard.address);
    const nextRelatedAddresses = new Set(
      (sourceCard.relatedAddresses ?? []).map(normalizeAddress)
    );
    const previousRelatedAddressSet = new Set(previousRelatedAddresses.map(normalizeAddress));

    return updatedCards.map(card => {
      const cardAddress = normalizeAddress(card.address);
      const currentRelatedAddresses = new Set(
        (card.relatedAddresses ?? []).map(normalizeAddress)
      );

      if (nextRelatedAddresses.has(cardAddress)) {
        currentRelatedAddresses.add(sourceAddress);
      } else if (previousRelatedAddressSet.has(cardAddress)) {
        currentRelatedAddresses.delete(sourceAddress);
      }

      if (card.id === sourceCard.id) {
        currentRelatedAddresses.delete(sourceAddress);
      }

      return {
        ...card,
        relatedAddresses: Array.from(currentRelatedAddresses),
      };
    });
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openSelectedCardDetail = (card: Card) => {
    setCardDetailReturnScreen(currentScreen);
    setSelectedCard(card);
    setSelectedThreadCard(null);
  };

  const openSelectedCardThread = (card: Card) => {
    setSelectedThreadCard(card);
    setCardThreadReturnScreen(currentScreen);
    setSelectedCard(null);
    setCurrentScreen('cardThread');
  };

  const closeSelectedCard = () => {
    const returnScreen = cardDetailReturnScreen;
    setSelectedCard(null);
    setCardDetailReturnScreen(null);
    if (returnScreen) {
      setCurrentScreen(returnScreen);
    }
  };

  const returnFromCardThreadToDetail = () => {
    if (!selectedThreadCard) {
      setCurrentScreen(cardThreadReturnScreen);
      return;
    }

    setCurrentScreen(cardThreadReturnScreen);
    setSelectedCard(selectedThreadCard);
    setSelectedThreadCard(null);
  };

  const closeCardThread = () => {
    setSelectedThreadCard(null);
    setCurrentScreen(cardThreadReturnScreen);
  };

  const goBack = () => {
    if (currentScreen === 'cardThread') {
      returnFromCardThreadToDetail();
      return;
    }

    if (selectedCard) {
      closeSelectedCard();
      return;
    }

    if (currentScreen === 'editCard') {
      resetCardForm();
      setCurrentScreen('home');
      return;
    }

    if (currentScreen === 'newCard') {
      resetCardForm();
      setCurrentScreen('home');
      return;
    }

    if (currentScreen === 'editCategory' || currentScreen === 'newCategory') {
      resetCategoryForm();
      setCurrentScreen('categoryPicker');
      return;
    }

    if (currentScreen === 'categoryPicker') {
      setCurrentScreen(categoryPickerReturnScreen === 'newCard' || categoryPickerReturnScreen === 'editCard' ? categoryPickerReturnScreen : 'home');
      return;
    }

    if (currentScreen === 'cardList') {
      if (selectedCardListRange) {
        setSelectedCardListRange(null);
        setSearchQuery('');
        setCardListRestoreAddress(null);
        return;
      }

      setSearchQuery('');
      setCurrentScreen('home');
      return;
    }

    if (currentScreen === 'thinking') {
      return;
    }

    if (currentScreen === 'quickCapture') {
      resetCaptureForm();
      setCurrentScreen('home');
      return;
    }

    if (currentScreen === 'inbox') {
      setCurrentScreen('home');
      return;
    }

    if (currentScreen === 'todoList') {
      setCurrentScreen('home');
      return;
    }

    if (currentScreen === 'askCards') {
      setCurrentScreen('home');
      return;
    }

    if (currentScreen === 'settings') {
      setCurrentScreen('home');
      return;
    }

    if (currentScreen === 'help') {
      setCurrentScreen('home');
    }
  };

  const getLiveSwipeUnderlayDescriptor = (): SwipeUnderlayDescriptor => {
    if (currentScreen === 'cardThread' && selectedThreadCard) {
      return { type: 'selectedCardDetail' };
    }

    if (selectedCard) {
      if (currentScreen === 'cardList') {
        return { type: 'cardList', selectedMasterRange: selectedCardListRange };
      }

      return currentScreen === 'home' ? { type: 'home' } : { type: 'screen', screen: currentScreen };
    }

    if (currentScreen === 'cardList') {
      return selectedCardListRange ? { type: 'cardList', selectedMasterRange: null } : { type: 'home' };
    }

    if (currentScreen === 'categoryPicker') {
      return categoryPickerReturnScreen === 'newCard' || categoryPickerReturnScreen === 'editCard'
        ? { type: 'screen', screen: categoryPickerReturnScreen }
        : { type: 'home' };
    }

    if (currentScreen === 'newCategory' || currentScreen === 'editCategory') {
      return { type: 'screen', screen: 'categoryPicker' };
    }

    if (currentScreen === 'thinking') {
      return thinkingReturnScreen === 'home'
        ? { type: 'home' }
        : { type: 'screen', screen: thinkingReturnScreen };
    }

    if (currentScreen === 'todoList') {
      return isTodoListZoomed ? { type: 'screen', screen: 'todoList' } : { type: 'home' };
    }

    if (currentScreen === 'home') {
      return { type: 'none' };
    }

    return { type: 'home' };
  };

  const swipeBackResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (currentScreen === 'thinking') {
            return false;
          }
          if (currentScreen === 'todoList' && gestureState.x0 > 48) {
            return false;
          }
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
          return gestureState.dx > 24 && isHorizontalSwipe;
        },
        onPanResponderMove: (_, gestureState) => {
          if (swipeTriggeredRef.current) {
            return;
          }

          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
          if (isHorizontalSwipe) {
            swipeX.setValue(Math.max(0, gestureState.dx));
          }

          if (gestureState.dx > 120 && isHorizontalSwipe) {
            swipeTriggeredRef.current = true;
            setFrozenSwipeUnderlay(getLiveSwipeUnderlayDescriptor());
            Animated.timing(swipeX, {
              toValue: SCREEN_WIDTH,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              if (currentScreen === 'todoList' && isTodoListZoomedRef.current) {
                todoListZoomOutRef.current?.();
              } else {
                goBack();
              }
              setTimeout(() => {
                swipeX.setValue(0);
                setFrozenSwipeUnderlay(null);
                swipeTriggeredRef.current = false;
              }, 40);
            });
          }
        },
        onPanResponderRelease: () => {
          if (!swipeTriggeredRef.current) {
            Animated.spring(swipeX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 6,
            }).start();
          }
          setFrozenSwipeUnderlay(null);
          swipeTriggeredRef.current = false;
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
          setFrozenSwipeUnderlay(null);
          swipeTriggeredRef.current = false;
        },
      }),
    [currentScreen, selectedCard, selectedThreadCard, selectedCardListRange, categoryPickerReturnScreen, swipeX]
  );

  const findParentCategory = (categoryId: string, items: ManagedCategory[] = categoryTree): ManagedCategory | null => {
    for (const category of items) {
      const childCategories = category.children ?? [];
      if (childCategories.some(child => child.id === categoryId)) {
        return category;
      }

      const foundInChildren = findParentCategory(categoryId, childCategories);
      if (foundInChildren) {
        return foundInChildren;
      }
    }

    return null;
  };

  const buildCardSource = () =>
    normalizeCardSource({
      type: newCardSourceType,
      title: newCardSourceTitle,
      author: newCardSourceAuthor,
      url: newCardSourceUrl,
      page: newCardSourcePage,
      note: newCardSourceNote,
    });

  const getAiAssistEndpoint = useCallback(() => {
    const endpoint = settings.aiAssistEndpoint?.trim() || DEFAULT_AI_ASSIST_ENDPOINT;
    return `${endpoint.replace(/\/+$/, '')}/api/suggest-card-filing`;
  }, [settings.aiAssistEndpoint]);

  const getAskCardsEndpoint = () => {
    const endpoint = settings.aiAssistEndpoint?.trim() || DEFAULT_AI_ASSIST_ENDPOINT;
    return `${endpoint.replace(/\/+$/, '')}/api/ask-cards`;
  };

  const getAiBaseEndpoint = useCallback(() => (
    settings.aiAssistEndpoint?.trim() || DEFAULT_AI_ASSIST_ENDPOINT
  ), [settings.aiAssistEndpoint]);

  const getCaptureStructuringEndpoint = () => {
    return `${getAiBaseEndpoint().replace(/\/+$/, '')}/api/structure-capture`;
  };

  const showThinkingScreen = (nextState: ThinkingState, returnScreen: Screen) => {
    setThinkingState(nextState);
    setThinkingReturnScreen(returnScreen);
    setCurrentScreen('thinking');
  };

  const patchThinkingState = (updater: (previousState: ThinkingState) => ThinkingState) => {
    setThinkingState(previousState => (previousState ? updater(previousState) : previousState));
  };

  const finishThinkingScreen = (nextScreen: Screen) => {
    setCurrentScreen(nextScreen);
    setThinkingState(null);
  };

  const waitForThinkingDwell = async (startedAt: number, minimumMs = 420) => {
    const remainingMs = Math.max(0, minimumMs - (Date.now() - startedAt));
    if (remainingMs > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingMs));
    }
  };

  const clearAiProgress = () => {};

  const getCurrentFilingDraft = useCallback((draftOverride?: AiAssistPayload['draft']) => ({
    address: draftOverride?.address ?? newCardAddress,
    title: draftOverride?.title ?? newCardTitle,
    content: draftOverride?.content ?? newCardContent,
    tags: draftOverride?.tags ?? parseCommaSeparatedValues(newCardTagsText),
    source: draftOverride?.source ?? buildCardSource(),
  }), [
    newCardAddress,
    newCardTitle,
    newCardContent,
    newCardTagsText,
    newCardSourceType,
    newCardSourceTitle,
    newCardSourceAuthor,
    newCardSourceUrl,
    newCardSourcePage,
    newCardSourceNote,
  ]);

  const {
    aiSuggestion,
    aiSuggestionStatus,
    setAiSuggestion,
    setAiSuggestionStatus,
    isSuggestingFiling,
    cancelActiveFilingSuggestionWork,
    requestFilingSuggestion,
    requestDifferentFilingSuggestion,
    selectAlternativeFilingSuggestion,
  } = useAiFiling({
    allCategories,
    categoryTree,
    cards,
    editingCardId: editingCard?.id,
    getEndpoint: getAiAssistEndpoint,
    getCurrentDraft: getCurrentFilingDraft,
    setThinkingState,
    clearAiProgress,
    timeoutMs: FILING_SUGGESTION_TIMEOUT_MS,
  });

  const captureJobsApi = useCaptureJobs({
    jobs: captureJobs,
    saveCaptureJobs,
    inboxCaptures,
  });

  const { submitQuickCapture, resumeCaptureJob, resumeCaptureClarification, requestTodoGeneration } = useCaptureRouting({
    getAiBaseEndpoint,
    captureJobsApi,
    getInboxCaptures: () => useDataStore.getState().inboxCaptures,
    saveInboxCaptures,
    getTodos: () => useDataStore.getState().todos,
    saveTodos,
    getCardAddresses: () => useDataStore.getState().cards.map(card => card.address),
    getAllCategories: () => allCategories,
    getCategoryTree: () => categoryTree,
    getCards: () => useDataStore.getState().cards,
    getAiAssistEndpoint,
  });

  const {
    requestCaptureStructuring,
  } = useCaptureStructuring({
    categoryTree,
    allCategories,
    getCards: () => useDataStore.getState().cards,
    getCaptureStructuringEndpoint,
    getAiAssistEndpoint,
    captureTimeoutMs: CAPTURE_STRUCTURING_TIMEOUT_MS,
    filingFallbackTimeoutMs: FILING_SUGGESTION_TIMEOUT_MS,
  });

  const buildAskCardsPayload = (): AskCardsPayload => ({
    question: askCardsQuestion.trim(),
    cards: cards.map(card => ({
      address: card.address,
      title: card.title,
      content: card.content.slice(0, 1200),
      status: card.status,
      tags: card.tags,
      relatedAddresses: card.relatedAddresses,
      source: card.source,
    })),
    categories: allCategories.map(category => ({
      range: category.range,
      title: category.title,
    })),
  });

  const findCategoryByRange = (range: string) => {
    const normalizedRange = normalizeAddress(range);
    return allCategories.find(category => normalizeAddress(category.range) === normalizedRange) ?? null;
  };
  const resetCardForm = () => {
    cancelActiveFilingSuggestionWork();
    setEditingCard(null);
    setFilingInboxCaptureId(null);
    setNewCardAddress('');
    setNewCardTitle('');
    setNewCardContent('');
    setNewCardStatus('Seed');
    setNewCardTagsText('');
    setNewCardRelatedAddressesText('');
    setNewCardSourceType('Web');
    setNewCardSourceTitle('');
    setNewCardSourceAuthor('');
    setNewCardSourceUrl('');
    setNewCardSourcePage('');
    setNewCardSourceNote('');
    setAiSuggestion(null);
    setThinkingState(null);
  };

  const resetCaptureForm = () => {
    setCaptureTitle('');
    setCaptureContent('');
  };

  const loadCaptureIntoCardForm = (
    capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>,
    inboxCaptureId: string | null = null,
    structuredResult?: CaptureStructuringResult | null,
    filingSuggestion: CardFilingSuggestion | null = null
  ) => {
    resetCardForm();
    setFilingInboxCaptureId(inboxCaptureId);
    const restrainedResult = structuredResult
      ? restrainStructuringToCapture(capture, structuredResult)
      : null;
    let nextCardAddress = '';
    if (filingSuggestion?.suggestedCardAddress) {
      nextCardAddress = filingSuggestion.suggestedCardAddress;
    } else if (filingSuggestion?.mode === 'existing_category') {
      const category = findCategoryByRange(normalizeAddress(filingSuggestion.suggestedCategoryRange));
      if (category && !category.range.includes('-')) {
        nextCardAddress = getNextCardAddress(category.range, cards);
      }
    }

    const formFields = buildCardFormFieldsFromCaptureEnrichment({
      capture,
      enrichment: restrainedResult,
      filingSuggestion,
      cards,
      cardAddress: nextCardAddress,
    });

    setNewCardTitle(formFields.title);
    setNewCardContent(formFields.content);
    setNewCardStatus(formFields.status);
    setNewCardTagsText(formFields.tagsText);
    setNewCardRelatedAddressesText(formFields.relatedAddressesText);
    setNewCardSourceType(formFields.sourceType);
    setNewCardSourceTitle(formFields.sourceTitle);
    setNewCardSourceAuthor(formFields.sourceAuthor);
    setNewCardSourceUrl(formFields.sourceUrl);
    setNewCardSourcePage(formFields.sourcePage);
    setNewCardSourceNote(formFields.sourceNote);
    setThinkingState(null);

    if (filingSuggestion) {
      setAiSuggestion(filingSuggestion);
      setAiSuggestionStatus('ai_confirmed');
      pendingInboxAutoFilingRef.current = false;
      inboxAutoFilingAppliedRef.current = inboxCaptureId;

      if (nextCardAddress) {
        setNewCardAddress(nextCardAddress);
      }
    } else if (inboxCaptureId && restrainedResult) {
      pendingInboxAutoFilingRef.current = true;
      inboxAutoFilingAppliedRef.current = null;
    }

    setCurrentScreen('newCard');
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setSelectedParentRange(null);
    setNewCategoryAddress('');
    setNewCategoryTitle('');
  };

  const openNewCategory = (category: ManagedCategory) => {
    const suggested = getNextCategoryAddress(category);
    setEditingCategory(null);
    setSelectedParentRange(category);
    setNewCategoryAddress(suggested);
    setNewCategoryTitle('');
    setCurrentScreen('newCategory');
  };

  const selectCategory = (category: ManagedCategory) => {
    const cardsForAddressing = cards.filter(card => card.id !== editingCard?.id);
    const suggested = getNextCardAddress(category.range || category.id, cardsForAddressing);
    setNewCardAddress(suggested);
    setAiSuggestion(null);
    cancelActiveFilingSuggestionWork();
    setCurrentScreen(editingCard ? 'editCard' : 'newCard');
  };

  const startEditCard = (card: Card) => {
    const source = normalizeCardSource(card.source);
    closeSelectedCard();
    setEditingCard(card);
    setNewCardAddress(card.address);
    setNewCardTitle(card.title);
    setNewCardContent(card.content);
    setNewCardStatus(card.status ?? 'Seed');
    setNewCardTagsText((card.tags ?? []).join(', '));
    setNewCardRelatedAddressesText((card.relatedAddresses ?? []).join(', '));
    setNewCardSourceType(source?.type ?? 'Web');
    setNewCardSourceTitle(source?.title ?? '');
    setNewCardSourceAuthor(source?.author ?? '');
    setNewCardSourceUrl(source?.url ?? '');
    setNewCardSourcePage(source?.page ?? '');
    setNewCardSourceNote(source?.note ?? '');
    setAiSuggestion(null);
    cancelActiveFilingSuggestionWork();
    setCurrentScreen('editCard');
  };

  const startEditCategory = (category: ManagedCategory) => {
    setEditingCategory(category);
    setSelectedParentRange(findParentCategory(category.id));
    setNewCategoryAddress(category.range);
    setNewCategoryTitle(category.title);
    setCurrentScreen('editCategory');
  };

  const createCategory = async () => {
    if (!newCategoryTitle.trim()) {
      Alert.alert('Error', 'Please give the new category a title.');
      return;
    }

    const normalizedAddress = normalizeAddress(newCategoryAddress);
    const addressError = validateCategoryAddress(normalizedAddress, selectedParentRange, allCategories);
    if (addressError) {
      Alert.alert('Error', addressError);
      return;
    }

    if (!selectedParentRange) {
      Alert.alert('Error', 'Choose a parent range first.');
      return;
    }

    const newCategory: CustomCategory = {
      id: normalizedAddress,
      range: normalizedAddress,
      title: newCategoryTitle.trim(),
      isLeaf: true,
      parentId: selectedParentRange.id,
      createdAt: new Date().toISOString(),
      isCustom: true,
    };

    const updatedCategories = [...customCategories, newCategory];

    try {
      await saveCustomCategories(updatedCategories);
      setExpandedCategories(prev => ({ ...prev, [selectedParentRange.id]: true }));
      Alert.alert('Category Created', `${newCategory.range} - ${newCategory.title}`);
    } catch (e) {
      console.log('Category save error', e);
      Alert.alert('Save Error', 'Your new category could not be saved. Please try again.');
      return;
    }

    resetCategoryForm();
    setCurrentScreen('categoryPicker');
  };

  const updateCategory = async () => {
    if (!editingCategory) {
      return;
    }

    if (!newCategoryTitle.trim()) {
      Alert.alert('Error', 'Please give the category a title.');
      return;
    }

    if (editingCategory.isDefault) {
      const updatedOverrides = [
        ...categoryOverrides.filter(override => override.id !== editingCategory.id),
        { id: editingCategory.id, title: newCategoryTitle.trim() },
      ];

      try {
        await saveCategoryOverrides(updatedOverrides);
        Alert.alert('Category Updated', formatCategoryLabel(editingCategory.range, newCategoryTitle.trim()));
      } catch (e) {
        Alert.alert('Save Error', 'Your category changes could not be saved. Please try again.');
        return;
      }
    } else {
      const normalizedAddress = normalizeAddress(newCategoryAddress);
      const addressError = validateCategoryAddress(
        normalizedAddress,
        selectedParentRange,
        allCategories,
        editingCategory.id
      );
      if (addressError) {
        Alert.alert('Error', addressError);
        return;
      }

      const updatedCategories = customCategories.map(category =>
        category.id === editingCategory.id
          ? {
              ...category,
              id: normalizedAddress,
              range: normalizedAddress,
              title: newCategoryTitle.trim(),
            }
          : category
      );

      const updatedCards = cards.map(card =>
        normalizeAddress(card.address).startsWith(normalizeAddress(editingCategory.range))
          ? { ...card, address: normalizeAddress(card.address).replace(normalizeAddress(editingCategory.range), normalizedAddress) }
          : card
      );

      try {
        await saveCustomCategories(updatedCategories);
        await saveCards(updatedCards);
        Alert.alert('Category Updated', formatCategoryLabel(normalizedAddress, newCategoryTitle.trim()));
      } catch (e) {
        Alert.alert('Save Error', 'Your category changes could not be saved. Please try again.');
        return;
      }
    }

    resetCategoryForm();
    setCurrentScreen('categoryPicker');
  };

  const askMyCards = async () => {
    if (!askCardsQuestion.trim()) {
      Alert.alert('Ask A Question First', 'Type a question for your cards before asking Second Mind.');
      return;
    }

    if (cards.length === 0) {
      Alert.alert('No Cards Yet', 'Create or import cards before using Ask My Cards.');
      return;
    }

    console.log('[AI] Ask My Cards - question length:', askCardsQuestion.length, 'cards count:', cards.length);
    setIsAskingCards(true);

    try {
      const payload = buildAskCardsPayload();
      console.log('[AI] Sending ask-cards request');
      const response = await fetch(getAskCardsEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { result?: AskCardsResult; error?: string };

      if (!response.ok || !data.result) {
        throw new Error(data.error || 'The AI assistant did not return an answer.');
      }

      console.log('[AI] Ask My Cards success, answer length:', data.result.answer?.length);
      setAskCardsResult(data.result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The AI assistant could not be reached.';
      console.error('[AI] Ask My Cards error:', error);
      Alert.alert(
        'Ask My Cards Unavailable',
        `${message}\n\nMake sure the local AI server is running and the Settings URL points to your computer.`
      );
    } finally {
      setIsAskingCards(false);
    }
  };

  const applySuggestedDetails = (suggestion: CardFilingSuggestion | null = aiSuggestion) => {
    if (!suggestion) {
      return;
    }

    const suggestedTitle = typeof suggestion.suggestedTitle === 'string' ? suggestion.suggestedTitle.trim() : '';
    const suggestedContent = typeof suggestion.suggestedContent === 'string' ? suggestion.suggestedContent.trim() : '';

    if (suggestedTitle) {
      setNewCardTitle(suggestedTitle);
    }

    if (suggestedContent) {
      setNewCardContent(suggestedContent);
    }

    if (suggestion.suggestedTags.length > 0) {
      const currentTags = parseCommaSeparatedValues(newCardTagsText);
      const mergedTags = Array.from(new Set([...currentTags, ...suggestion.suggestedTags.map(tag => tag.trim()).filter(Boolean)]));
      setNewCardTagsText(mergedTags.join(', '));
    }

    const suggestedSource = normalizeCardSource(suggestion.suggestedSource);
    if (suggestedSource) {
      setNewCardSourceType(suggestedSource.type);
      setNewCardSourceTitle(suggestedSource.title ?? '');
      setNewCardSourceAuthor(suggestedSource.author ?? '');
      setNewCardSourceUrl(suggestedSource.url ?? '');
      setNewCardSourcePage(suggestedSource.page ?? '');
      setNewCardSourceNote(suggestedSource.note ?? '');
    }

    if (['Seed', 'Growing', 'Evergreen'].includes(suggestion.suggestedStatus)) {
      setNewCardStatus(suggestion.suggestedStatus);
    }

    if (suggestion.suggestedRelatedAddresses.length > 0) {
      const existingRelated = parseCommaSeparatedValues(newCardRelatedAddressesText);
      const existingCardAddresses = new Set(cards.map(card => normalizeAddress(card.address)));
      const safeRelated = suggestion.suggestedRelatedAddresses
        .map(normalizeAddress)
        .filter(address => existingCardAddresses.has(address))
        .filter(address => address !== normalizeAddress(newCardAddress));
      const mergedRelated = Array.from(new Set([...existingRelated, ...safeRelated]));
      setNewCardRelatedAddressesText(mergedRelated.join(', '));
    }
  };

  const createSuggestedCategoryAndApply = async (suggestion: CardFilingSuggestion) => {
    const suggestedRange = resolveSuggestedNewCategoryRange(suggestion, allCategories);
    if (!/^\d{4}$/.test(suggestedRange)) {
      Alert.alert('Review Needed', 'AI did not return a valid 4-digit category address.');
      return false;
    }

    const cardsForAddressing = cards.filter(card => card.id !== editingCard?.id);
    const existingCategory = findCategoryByRange(suggestedRange);
    if (existingCategory && !existingCategory.range.includes('-')) {
      setNewCardAddress(getNextCardAddress(existingCategory.range, cardsForAddressing));
      return true;
    }

    const parentRange = findSmallestContainingRange(suggestedRange, allCategories);
    const addressError = validateCategoryAddress(suggestedRange, parentRange, allCategories);
    if (addressError || !parentRange) {
      Alert.alert('Review Needed', addressError || 'AI could not place the new category inside a valid range.');
      return false;
    }

    const newCategory: CustomCategory = {
      id: suggestedRange,
      range: suggestedRange,
      title: suggestion.suggestedNewCategoryTitle.trim() || 'Suggested Category',
      isLeaf: true,
      parentId: parentRange.id,
      createdAt: new Date().toISOString(),
      isCustom: true,
    };

    try {
      await saveCustomCategories([...customCategories, newCategory]);
      setExpandedCategories(prev => ({ ...prev, [parentRange.id]: true }));
      setNewCardAddress(getNextCardAddress(newCategory.range, cardsForAddressing));
      Alert.alert('Category Created', `${newCategory.range} - ${newCategory.title}`);
      return true;
    } catch (e) {
      Alert.alert('Save Error', 'The suggested category could not be created. Please try again.');
      return false;
    }
  };

  const applySuggestedFiling = async (suggestion: CardFilingSuggestion | null = aiSuggestion) => {
    if (!suggestion) {
      return false;
    }

    if (suggestion.mode === 'manual_review') {
      Alert.alert('Review Needed', suggestion.reasoning || 'AI was not confident enough to choose a category.');
      return false;
    }

    if (suggestion.mode === 'new_category') {
      if (!isReusableShelfTitle(suggestion.suggestedNewCategoryTitle, {
        address: newCardAddress,
        title: newCardTitle,
        content: newCardContent,
        tags: parseCommaSeparatedValues(newCardTagsText),
        source: buildCardSource(),
      }, suggestion.suggestedParentTitle)) {
        Alert.alert('Review Needed', 'Second Mind needs a more reusable category name before creating a new shelf.');
        return false;
      }

      return createSuggestedCategoryAndApply(suggestion);
    }

    const suggestedRange = normalizeAddress(suggestion.suggestedCategoryRange);
    const category = findCategoryByRange(suggestedRange);
    if (!category || category.range.includes('-')) {
      Alert.alert('Review Needed', 'AI did not return an existing leaf category. Please browse manually or ask again.');
      return false;
    }

    const cardsForAddressing = cards.filter(card => card.id !== editingCard?.id);
    setNewCardAddress(getNextCardAddress(category.range, cardsForAddressing));
    return true;
  };

  useEffect(() => {
    if (
      currentScreen !== 'newCard'
      || !filingInboxCaptureId
      || !pendingInboxAutoFilingRef.current
      || inboxAutoFilingAppliedRef.current === filingInboxCaptureId
    ) {
      return;
    }

    void requestFilingSuggestion();
  }, [currentScreen, filingInboxCaptureId, requestFilingSuggestion]);

  useEffect(() => {
    if (
      currentScreen !== 'newCard'
      || !filingInboxCaptureId
      || !pendingInboxAutoFilingRef.current
      || !aiSuggestion
      || inboxAutoFilingAppliedRef.current === filingInboxCaptureId
    ) {
      return;
    }

    void applySuggestedFiling(aiSuggestion).then(applied => {
      if (!applied) {
        return;
      }

      inboxAutoFilingAppliedRef.current = filingInboxCaptureId;
      pendingInboxAutoFilingRef.current = false;
    });
  }, [
    aiSuggestion,
    currentScreen,
    filingInboxCaptureId,
  ]);

  const applyAllAiSuggestion = async () => {
    if (!aiSuggestion) {
      return;
    }

    const filingApplied = await applySuggestedFiling(aiSuggestion);
    if (filingApplied || aiSuggestion.mode === 'manual_review') {
      applySuggestedDetails(aiSuggestion);
    }
  };

  const createCard = async () => {
    if (!newCardContent.trim()) {
      Alert.alert('Error', 'Please write the main idea for the card.');
      return;
    }

    const normalizedAddress = normalizeAddress(newCardAddress);
    const addressError = validateCardAddress(normalizedAddress, allCategories, cards);
    if (addressError) {
      Alert.alert('Error', addressError);
      return;
    }

    const newCard: Card = {
      id: Date.now().toString(),
      address: normalizedAddress,
      title: newCardTitle.trim() || 'Untitled Idea',
      content: newCardContent.trim(),
      createdAt: new Date().toISOString(),
      status: newCardStatus,
      tags: parseCommaSeparatedValues(newCardTagsText),
      relatedAddresses: parseCommaSeparatedValues(newCardRelatedAddressesText),
      source: buildCardSource(),
    };

    try {
      const updatedCards = syncBidirectionalRelatedCards([newCard, ...cards], newCard);
      await Promise.all([
        saveCards(updatedCards),
        filingInboxCaptureId
          ? saveInboxCaptures(inboxCaptures.filter(capture => capture.id !== filingInboxCaptureId))
          : Promise.resolve(),
      ]);
      Alert.alert('Card Saved', `Address: ${newCard.address}\nTitle: ${newCard.title}`);
    } catch (e) {
      Alert.alert('Save Error', 'Your card could not be saved. Please try again.');
      return;
    }

    resetCardForm();
    setCurrentScreen('home');
  };

  const openCategoryPicker = (returnScreen: Screen = currentScreen) => {
    setCategoryPickerReturnScreen(returnScreen);
    setCurrentScreen('categoryPicker');
  };

  const updateCard = async () => {
    if (!editingCard) {
      return;
    }

    if (!newCardContent.trim()) {
      Alert.alert('Error', 'Please write the main idea for the card.');
      return;
    }

    const previousRelatedAddresses = editingCard.relatedAddresses ?? [];
    const normalizedAddress = normalizeAddress(newCardAddress);
    const addressError = validateCardAddress(normalizedAddress, allCategories, cards, editingCard.id);
    if (addressError) {
      Alert.alert('Error', addressError);
      return;
    }

    const updatedCard: Card = {
      ...editingCard,
      address: normalizedAddress,
      title: newCardTitle.trim() || 'Untitled Idea',
      content: newCardContent.trim(),
      status: newCardStatus,
      tags: parseCommaSeparatedValues(newCardTagsText),
      relatedAddresses: parseCommaSeparatedValues(newCardRelatedAddressesText),
      source: buildCardSource(),
    };

    const updatedCards = cards.map(card =>
      card.id === editingCard.id
        ? updatedCard
        : card
    );

    try {
      await saveCards(syncBidirectionalRelatedCards(updatedCards, updatedCard, previousRelatedAddresses));
      Alert.alert('Card Updated', `Address: ${normalizedAddress}\nTitle: ${newCardTitle.trim() || 'Untitled Idea'}`);
    } catch (e) {
      Alert.alert('Save Error', 'Your card changes could not be saved. Please try again.');
      return;
    }

    resetCardForm();
    setCurrentScreen('cardList');
  };

  const confirmDeleteCard = (card: Card) => {
    Alert.alert(
      'Delete Card?',
      `${card.address} - ${card.title}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedCards = cards.filter(existingCard => existingCard.id !== card.id);
            try {
              await saveCards(updatedCards);
              if (selectedCard?.id === card.id) {
                closeSelectedCard();
              }
              if (selectedThreadCard?.id === card.id) {
                closeCardThread();
              }
              if (editingCard?.id === card.id) {
                resetCardForm();
              }
              setCurrentScreen('cardList');
            } catch (e) {
              Alert.alert('Delete Error', 'The card could not be deleted. Please try again.');
            }
          },
        },
      ]
    );
  };

  const confirmDeleteCategory = (category: ManagedCategory) => {
    if (category.range.includes('-')) {
      Alert.alert('Protected Range', 'Structural ranges can be edited, but they cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Category?',
      `This removes "${category.range} - ${category.title}" and any cards inside it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const subtree = collectCategorySubtree(category);
            const defaultIdsToDelete = subtree.filter(item => item.isDefault).map(item => item.id);
            const customIdsToDelete = new Set(subtree.filter(item => item.isCustom).map(item => item.id));

            const updatedCustomCategories = customCategories.filter(item => !customIdsToDelete.has(item.id));
            const updatedOverrides = categoryOverrides.filter(
              override => !subtree.some(item => item.id === override.id)
            );
            const updatedDeletedDefaultIds = Array.from(
              new Set([...deletedDefaultCategoryIds, ...defaultIdsToDelete])
            );
            const updatedCards = cards.filter(card => !cardBelongsToCategory(card, category));

            try {
              await Promise.all([
                saveCustomCategories(updatedCustomCategories),
                saveCategoryOverrides(updatedOverrides),
                saveDeletedDefaultCategoryIds(updatedDeletedDefaultIds),
                saveCards(updatedCards),
              ]);
              if (editingCategory?.id === category.id) {
                resetCategoryForm();
              }
              setCurrentScreen('categoryPicker');
            } catch (e) {
              Alert.alert('Delete Error', 'The category could not be deleted. Please try again.');
            }
          },
        },
      ]
    );
  };

  const manageCard = (card: Card) => {
    Alert.alert(card.title, card.address, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => startEditCard(card) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteCard(card) },
    ]);
  };

  const manageCategory = (category: ManagedCategory) => {
    const actions: Array<{
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => startEditCategory(category) },
    ];

    if (!category.range.includes('-')) {
      actions.push({ text: 'Delete', style: 'destructive', onPress: () => confirmDeleteCategory(category) });
    }

    Alert.alert(formatCategoryLabel(category.range, category.title), undefined, actions);
  };

  const toggleDarkMode = async () => {
    try {
      await saveSettings({ ...settings, darkMode: !settings.darkMode });
    } catch (e) {
      Alert.alert('Save Error', 'Dark mode setting could not be saved. Please try again.');
    }
  };

  const saveAiAssistEndpoint = async (endpoint: string) => {
    try {
      await saveSettings({ ...settings, aiAssistEndpoint: endpoint.trim() || DEFAULT_AI_ASSIST_ENDPOINT });
      Alert.alert('AI Server Saved', 'Second Mind will use this server for cataloguing suggestions.');
    } catch (e) {
      Alert.alert('Save Error', 'The AI server URL could not be saved. Please try again.');
    }
  };

  const updateCardSortMode = async (nextSortMode: CardSortMode) => {
    try {
      await saveSettings({ ...settings, cardSortMode: nextSortMode });
    } catch (e) {
      Alert.alert('Save Error', 'The card sort preference could not be saved. Please try again.');
    }
  };

  const toggleTodo = async (todoId: string) => {
    const updatedTodos = toggleTodoCompletion(todos, todoId);
    await saveTodos(updatedTodos);
  };

  const deleteTodo = async (todoId: string) => {
    const idsToDelete = collectDescendantIds(todos, todoId);
    const updatedTodos = todos.filter(todo => !idsToDelete.has(todo.id));
    await saveTodos(updatedTodos);

    const prunedCollapsedIds = (settings.collapsedTodoIds ?? []).filter(id => !idsToDelete.has(id));
    if (prunedCollapsedIds.length !== (settings.collapsedTodoIds ?? []).length) {
      await saveSettings({ ...settings, collapsedTodoIds: prunedCollapsedIds });
    }
  };

  const addSubTodo = async (parentId: string, title = ''): Promise<string> => {
    const newSubTodo: Todo = {
      id: `${Date.now()}-sub`,
      title,
      completed: false,
      parentId,
      sortOrder: getNextSortOrder(todos, parentId),
      createdAt: new Date().toISOString(),
    };
    await saveTodos([newSubTodo, ...todos]);
    return newSubTodo.id;
  };

  const addSiblingTodo = async (afterTodoId: string, title = ''): Promise<string | null> => {
    const inserted = insertSiblingTodo(todos, afterTodoId, { title });
    if (!inserted) {
      return null;
    }

    await saveTodos(inserted.todos);
    return inserted.newTodoId;
  };

  const updateTodo = async (
    todoId: string,
    updates: {
      title: string;
      content?: string;
      relatedAddressesText?: string;
      dueDate?: string;
    },
    options?: { quiet?: boolean }
  ): Promise<boolean> => {
    const trimmedTitle = updates.title.trim();
    if (!trimmedTitle) {
      if (!options?.quiet) {
        Alert.alert('Title Required', 'Give this task a title before saving.');
      }
      return false;
    }

    const normalizedDueDate = updates.dueDate === undefined
      ? undefined
      : normalizeTodoDueDateInput(updates.dueDate);

    if (updates.dueDate?.trim() && !normalizedDueDate) {
      if (!options?.quiet) {
        Alert.alert('Invalid Due Date', 'Use YYYY-MM-DD or a recognizable date.');
      }
      return false;
    }

    const relatedAddresses = parseCommaSeparatedValues(updates.relatedAddressesText ?? '').map(normalizeAddress);

    const updatedTodos = todos.map(todo =>
      todo.id === todoId
        ? {
            ...todo,
            title: trimmedTitle,
            content: updates.content?.trim() ? updates.content.trim() : undefined,
            relatedAddresses: relatedAddresses.length ? relatedAddresses : undefined,
            dueDate: normalizedDueDate,
          }
        : todo
    );
    await saveTodos(updatedTodos);
    return true;
  };

  const saveCollapsedTodoIds = async (collapsedTodoIds: string[]) => {
    const validIds = new Set(todos.map(todo => todo.id));
    const pruned = collapsedTodoIds.filter(id => validIds.has(id));
    await saveSettings({ ...settings, collapsedTodoIds: pruned });
  };

  const reorderTodos = async (flat: FlatTodoItem[], from: number, to: number) => {
    const updatedTodos = reorderTodosFromDrag(todos, flat, from, to);
    await saveTodos(updatedTodos);
  };

  const indentTodoItem = async (todoId: string) => {
    const updatedTodos = indentTodo(todos, todoId);
    if (updatedTodos === todos) {
      return;
    }
    await saveTodos(updatedTodos);
  };

  const outdentTodoItem = async (todoId: string) => {
    const updatedTodos = outdentTodo(todos, todoId);
    if (updatedTodos === todos) {
      return;
    }
    await saveTodos(updatedTodos);
  };

  const openLinkedCard = (address: string) => {
    const normalizedAddress = normalizeAddress(address);
    const card = cards.find(item => normalizeAddress(item.address) === normalizedAddress);
    if (!card) {
      Alert.alert('Card Not Found', `No card found at address ${normalizedAddress}.`);
      return;
    }

    setCardThreadReturnScreen('todoList');
    openSelectedCardDetail(card);
  };

  const openCardFromList = (card: Card) => {
    setCardListRestoreAddress(card.address);
    openSelectedCardDetail(card);
  };

  const saveQuickCaptureToInbox = async () => {
    if (!captureContent.trim()) {
      Alert.alert('Add The Thought First', 'Write something before saving your capture.');
      return;
    }

    try {
      const newCapture: InboxCapture = {
        id: Date.now().toString(),
        title: captureTitle.trim(),
        content: captureContent.trim(),
        createdAt: new Date().toISOString(),
      };

      await saveInboxCaptures([newCapture, ...inboxCaptures]);
      resetCaptureForm();
      setCurrentScreen('home');
      await submitQuickCapture(newCapture);
    } catch (e) {
      Alert.alert('Save Error', 'Your capture could not be saved. Please try again.');
    }
  };

  const fileInboxCapture = (capture: InboxCapture) => {
    loadCaptureIntoCardForm(
      capture,
      capture.id,
      getInboxCaptureStructuredDraft(capture),
      getInboxCaptureFilingSuggestion(capture) ?? null
    );
  };

  const fileInboxCaptureWithAi = (capture: InboxCapture) => {
    const thinkingPreview = {
      rawCapture: [capture.title, capture.content, capture.sourceText ?? ''].filter(Boolean).join('\n'),
      title: capture.title,
      body: capture.content,
      sourceType: 'Other' as const,
      sourceTitle: '',
      author: '',
      location: '',
      corrections: [] as string[],
    };
    showThinkingScreen(createCaptureThinkingState(thinkingPreview), 'inbox');
    void (async () => {
      const thinkingStartedAt = Date.now();
      const structuredResult = await requestCaptureStructuring(capture);
      if (!structuredResult) {
        finishThinkingScreen('inbox');
        return;
      }

      patchThinkingState(previousState => applyCaptureThinkingResult(previousState, structuredResult, capture));
      await waitForThinkingDwell(thinkingStartedAt, 420);
      loadCaptureIntoCardForm(capture, capture.id, structuredResult);
    })();
  };

  const turnInboxCaptureIntoTodos = async (capture: InboxCapture) => {
    try {
      const generation = await requestTodoGeneration(capture);
      const mergedTodos = mergeTodoGenerationIntoExisting(generation, todos, capture);
      const existingTodoIds = new Set(todos.map(todo => todo.id));
      const newTodos = mergedTodos.filter(todo => !existingTodoIds.has(todo.id));
      if (newTodos.length === 0) {
        Alert.alert('Nothing to Create', 'Could not parse any tasks from this capture.');
        return;
      }

      await saveTodos(ensureTodoSortOrders(mergedTodos));
      await saveInboxCaptures(inboxCaptures.filter(item => item.id !== capture.id));

      const appendedToExisting = newTodos.every(todo => todo.parentId && todos.some(existing => existing.id === todo.parentId));
      const subCount = newTodos.filter(todo => todo.parentId).length;
      const dueCount = newTodos.filter(todo => todo.dueDate).length;
      let message = appendedToExisting && newTodos.length === 1
        ? `Added "${newTodos[0].title}" to your list.`
        : subCount > 0
          ? `Created 1 parent task with ${subCount} sub-task${subCount === 1 ? '' : 's'}.`
          : `Created ${newTodos.length} task${newTodos.length === 1 ? '' : 's'}.`;
      if (dueCount > 0) {
        message += ` ${dueCount} due date${dueCount === 1 ? '' : 's'} included.`;
      }

      Alert.alert('Todos Created', message);
    } catch (e) {
      Alert.alert('Conversion Error', 'This capture could not be turned into todos. Please try again.');
    }
  };

  const deleteInboxCapture = (capture: InboxCapture) => {
    Alert.alert(
      'Delete Capture?',
      capture.title || capture.content.slice(0, 80),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await saveInboxCaptures(inboxCaptures.filter(item => item.id !== capture.id));
            } catch (e) {
              Alert.alert('Delete Error', 'The capture could not be deleted. Please try again.');
            }
          },
        },
      ]
    );
  };

  const resetCategoriesToDefault = () => {
    Alert.alert(
      'Reset Categories To Default?',
      'This will restore the default category map and remove custom category edits.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([
                saveCustomCategories([]),
                saveCategoryOverrides([]),
                saveDeletedDefaultCategoryIds([]),
              ]);
              setExpandedCategories({});
              Alert.alert('Categories Reset', 'Your category map was restored to the default structure.');
            } catch (e) {
              Alert.alert('Reset Error', 'The categories could not be reset. Please try again.');
            }
          },
        },
      ]
    );
  };

  const resetCategoriesToBlank = () => {
    Alert.alert(
      'Reset Categories To Blank?',
      'This keeps the range structure but clears all range labels, leaf categories, and custom categories.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([
                saveCustomCategories([]),
                saveCategoryOverrides(collectDefaultRangeOverrides(antinetCategories)),
                saveDeletedDefaultCategoryIds(collectDefaultLeafIds(antinetCategories)),
              ]);
              setExpandedCategories({});
              Alert.alert('Categories Reset', 'The category map was cleared back to unlabeled numeric ranges only.');
            } catch (e) {
              Alert.alert('Reset Error', 'The categories could not be reset. Please try again.');
            }
          },
        },
      ]
    );
  };

  const seedTestCards = async () => {
    const existingAddresses = new Set(cards.map(card => normalizeAddress(card.address)));
    const cardsToAdd = testCards
      .map(normalizeCard)
      .filter(card => !existingAddresses.has(normalizeAddress(card.address)));

    if (cardsToAdd.length === 0) {
      Alert.alert('Test Cards Already Added', 'No new test cards were added because those addresses already exist.');
      return;
    }

    const mergedCards = [...cardsToAdd, ...cards];
    const syncedCards = cardsToAdd.reduce(
      (updatedCards, card) => syncBidirectionalRelatedCards(updatedCards, card),
      mergedCards
    );

    try {
      await saveCards(syncedCards);
      Alert.alert('Test Cards Added', `${cardsToAdd.length} test cards were added to your card database.`);
    } catch (e) {
      Alert.alert('Seed Error', 'The test cards could not be added. Please try again.');
    }
  };

  const seedTestCaptures = async () => {
    const buildCaptureKey = (capture: Pick<InboxCapture, 'title' | 'content' | 'sourceText'>) => (
      [
        capture.title.trim().toLowerCase(),
        capture.content.trim().toLowerCase(),
        (capture.sourceText ?? '').trim().toLowerCase(),
      ].join('||')
    );

    const existingCaptureKeys = new Set(inboxCaptures.map(buildCaptureKey));
    const capturesToAdd = testCaptures.filter(capture => !existingCaptureKeys.has(buildCaptureKey(capture)));

    if (capturesToAdd.length === 0) {
      Alert.alert('Test Captures Already Added', 'No new quick captures were added because those exact captures already exist in your inbox.');
      return;
    }

    try {
      await saveInboxCaptures([...capturesToAdd, ...inboxCaptures]);
      Alert.alert('Test Quick Captures Added', `${capturesToAdd.length} test quick captures were added to your capture inbox.`);
    } catch (e) {
      Alert.alert('Seed Error', 'The test quick captures could not be added. Please try again.');
    }
  };

  const deleteAllCards = () => {
    Alert.alert(
      'Delete All Cards?',
      'This permanently removes every card. Your categories, settings, and ranges will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await saveCards([]);
              closeSelectedCard();
              setEditingCard(null);
              setSearchQuery('');
              setCardListRestoreAddress(null);
              Alert.alert('Cards Deleted', 'All cards were removed.');
            } catch (e) {
              Alert.alert('Delete Error', 'The cards could not be deleted. Please try again.');
            }
          },
        },
      ]
    );
  };

  const openTodoCount = todos.filter(todo => !todo.completed).length;
  const processingJobs = useMemo(
    () => buildCaptureProcessingJobViews(captureJobsApi.activeProcessingJobs, inboxCaptures),
    [captureJobsApi.activeProcessingJobs, inboxCaptures]
  );
  const captureJobsByCaptureId = useMemo(() => {
    const map: Record<string, typeof captureJobs[number]> = {};
    for (const job of captureJobs) {
      if (job.status !== 'completed') {
        map[job.captureId] = job;
      }
    }
    return map;
  }, [captureJobs]);
  const clarificationJobs = useMemo(
    () => buildCaptureClarificationViews(captureJobs, inboxCaptures),
    [captureJobs, inboxCaptures]
  );
  const clarificationModalJob = useMemo(
    () => clarificationJobs.find(job => job.jobId === clarificationModalJobId) ?? null,
    [clarificationJobs, clarificationModalJobId]
  );

  const clarificationBannerHint = useMemo(() => {
    const nextJob = clarificationJobs.find(
      job => !dismissedClarificationJobIds.includes(job.jobId)
        && !resolvingClarificationJobIds.includes(job.jobId)
    ) ?? clarificationJobs[0];

    return nextJob
      ? buildCaptureClarificationBannerHint(nextJob)
      : 'Tap to answer one quick question';
  }, [clarificationJobs, dismissedClarificationJobIds, resolvingClarificationJobIds]);

  const openClarificationModal = useCallback((jobId?: string) => {
    const targetJob = jobId
      ? clarificationJobs.find(job => job.jobId === jobId)
      : clarificationJobs.find(job => !dismissedClarificationJobIds.includes(job.jobId))
        ?? clarificationJobs[0];

    if (targetJob) {
      setDismissedClarificationJobIds(previous => previous.filter(id => id !== targetJob.jobId));
      setClarificationModalJobId(targetJob.jobId);
    }
  }, [clarificationJobs, dismissedClarificationJobIds]);

  const handleChooseClarificationRoute = useCallback(async (route: 'card' | 'todo') => {
    if (!clarificationModalJobId) {
      return;
    }

    const jobId = clarificationModalJobId;
    setClarificationModalJobId(null);
    setResolvingClarificationJobIds(previous => (
      previous.includes(jobId) ? previous : [...previous, jobId]
    ));
    setDismissedClarificationJobIds(previous => (
      previous.includes(jobId) ? previous : [...previous, jobId]
    ));

    try {
      await resumeCaptureJob(jobId, route);
    } finally {
      setResolvingClarificationJobIds(previous => previous.filter(id => id !== jobId));
    }
  }, [clarificationModalJobId, resumeCaptureJob]);

  const handleSubmitClarificationAnswer = useCallback(async (answer: string) => {
    if (!clarificationModalJobId) {
      return;
    }

    const jobId = clarificationModalJobId;
    setClarificationModalJobId(null);
    setResolvingClarificationJobIds(previous => (
      previous.includes(jobId) ? previous : [...previous, jobId]
    ));
    setDismissedClarificationJobIds(previous => (
      previous.includes(jobId) ? previous : [...previous, jobId]
    ));

    try {
      await resumeCaptureClarification(jobId, answer);
    } finally {
      setResolvingClarificationJobIds(previous => previous.filter(id => id !== jobId));
    }
  }, [clarificationModalJobId, resumeCaptureClarification]);

  const handleDismissClarification = useCallback(() => {
    if (!clarificationModalJobId) {
      return;
    }

    setDismissedClarificationJobIds(previous => (
      previous.includes(clarificationModalJobId)
        ? previous
        : [...previous, clarificationModalJobId]
    ));
    setClarificationModalJobId(null);
  }, [clarificationModalJobId]);

  const openClarificationForCapture = useCallback((capture: InboxCapture) => {
    const job = clarificationJobs.find(item => item.captureId === capture.id);
    if (!job) {
      return;
    }

    setCurrentScreen('home');
    openClarificationModal(job.jobId);
  }, [clarificationJobs, openClarificationModal]);

  useEffect(() => {
    if (currentScreen !== 'home' || clarificationModalJobId !== null) {
      return;
    }

    const nextJob = clarificationJobs.find(
      job => !dismissedClarificationJobIds.includes(job.jobId)
        && !resolvingClarificationJobIds.includes(job.jobId)
    );
    if (nextJob) {
      setClarificationModalJobId(nextJob.jobId);
    }
  }, [clarificationJobs, clarificationModalJobId, currentScreen, dismissedClarificationJobIds, resolvingClarificationJobIds]);

  const renderHomeScreen = () => (
    <HomeScreen
      cardCount={cards.length}
      inboxCount={inboxCaptures.length}
      todoCount={openTodoCount}
      processingJobs={processingJobs}
      clarificationLabel={buildCaptureClarificationLabel(clarificationJobs.length)}
      clarificationHint={clarificationBannerHint}
      onOpenClarification={() => openClarificationModal()}
      darkMode={settings.darkMode}
      onAskCards={() => setCurrentScreen('askCards')}
      onQuickCapture={() => {
        resetCaptureForm();
        setCurrentScreen('quickCapture');
      }}
      onNewCard={() => {
        resetCardForm();
        setCurrentScreen('newCard');
      }}
      onViewCards={() => {
        setSelectedCardListRange(null);
        setCurrentScreen('cardList');
      }}
      onOpenInbox={() => setCurrentScreen('inbox')}
      onOpenTodos={() => setCurrentScreen('todoList')}
      onBrowseCategories={() => openCategoryPicker('home')}
      onOpenHelp={() => setCurrentScreen('help')}
      onOpenSettings={() => setCurrentScreen('settings')}
    />
  );

  const renderCardFormScreen = (screen: 'newCard' | 'editCard') => (
    <NewCardScreen
      mode={screen === 'editCard' ? 'edit' : 'create'}
      darkMode={settings.darkMode}
      allCards={cards}
      editingCardId={editingCard?.id}
      address={newCardAddress}
      title={newCardTitle}
      content={newCardContent}
      status={newCardStatus}
      tagsText={newCardTagsText}
      relatedAddressesText={newCardRelatedAddressesText}
      sourceType={newCardSourceType}
      sourceTitle={newCardSourceTitle}
      sourceAuthor={newCardSourceAuthor}
      sourceUrl={newCardSourceUrl}
      sourcePage={newCardSourcePage}
      sourceNote={newCardSourceNote}
      aiSuggestion={aiSuggestion}
      aiSuggestionStatus={aiSuggestionStatus}
      isSuggestingFiling={isSuggestingFiling}
      aiThinkingState={thinkingState?.kind === 'filing' ? thinkingState : null}
      filingFromInbox={Boolean(filingInboxCaptureId)}
      onAddressChange={setNewCardAddress}
      onTitleChange={setNewCardTitle}
      onContentChange={setNewCardContent}
      onStatusChange={setNewCardStatus}
      onTagsChange={setNewCardTagsText}
      onRelatedAddressesChange={setNewCardRelatedAddressesText}
      onSourceTypeChange={setNewCardSourceType}
      onSourceTitleChange={setNewCardSourceTitle}
      onSourceAuthorChange={setNewCardSourceAuthor}
      onSourceUrlChange={setNewCardSourceUrl}
      onSourcePageChange={setNewCardSourcePage}
      onSourceNoteChange={setNewCardSourceNote}
      onSuggestFiling={() => {
        void requestFilingSuggestion();
      }}
      onSuggestDifferentFiling={requestDifferentFilingSuggestion}
      onSelectAlternativeFiling={selectAlternativeFilingSuggestion}
      onApplySuggestedFiling={() => {
        void applySuggestedFiling();
      }}
      onApplySuggestedDetails={() => applySuggestedDetails()}
      onApplyAllAiSuggestion={() => {
        void applyAllAiSuggestion();
      }}
      onDismissAiSuggestion={() => {
        cancelActiveFilingSuggestionWork();
        setAiSuggestion(null);
      }}
      onChooseCategory={() => openCategoryPicker(screen)}
      onSave={screen === 'editCard' ? updateCard : createCard}
      onDelete={editingCard ? () => confirmDeleteCard(editingCard) : undefined}
      onCancel={() => {
        resetCardForm();
        setCurrentScreen('home');
      }}
    />
  );

  const renderCategoryFormScreen = (screen: 'newCategory' | 'editCategory') => (
    <NewCategoryScreen
      mode={screen === 'editCategory' ? 'edit' : 'create'}
      darkMode={settings.darkMode}
      parentRange={selectedParentRange}
      isDefaultCategory={Boolean(editingCategory?.isDefault)}
      canDelete={Boolean(editingCategory && !editingCategory.range.includes('-'))}
      address={newCategoryAddress}
      title={newCategoryTitle}
      onAddressChange={setNewCategoryAddress}
      onTitleChange={setNewCategoryTitle}
      onSave={screen === 'editCategory' ? updateCategory : createCategory}
      onDelete={editingCategory ? () => confirmDeleteCategory(editingCategory) : undefined}
      onCancel={() => {
        resetCategoryForm();
        setCurrentScreen('categoryPicker');
      }}
    />
  );

  const renderCategoryPickerScreen = () => (
    <CategoryPickerScreen
      darkMode={settings.darkMode}
      categories={categoryTree}
      expandedCategories={expandedCategories}
      onToggleCategory={toggleCategory}
      onSelectCategory={selectCategory}
      onCreateSubcategory={openNewCategory}
      onManageCategory={manageCategory}
      onBack={() => setCurrentScreen(categoryPickerReturnScreen === 'newCard' || categoryPickerReturnScreen === 'editCard' ? categoryPickerReturnScreen : 'home')}
    />
  );

  const getCardListCards = (masterRangeOverride: ManagedCategory | null | undefined = selectedCardListRange) => {
    const effectiveMasterRange = masterRangeOverride === undefined ? selectedCardListRange : masterRangeOverride;

    return sortedCards
      .filter(card => effectiveMasterRange ? cardBelongsToCategory(card, effectiveMasterRange) : true)
      .filter(card =>
        card.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (card.tags ?? []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        [
          card.source?.type,
          card.source?.title,
          card.source?.author,
          card.source?.url,
          card.source?.page,
          card.source?.note,
        ].some(value => value?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
  };

  const renderCardListScreen = (masterRangeOverride: ManagedCategory | null | undefined = selectedCardListRange) => {
    const effectiveMasterRange = masterRangeOverride === undefined ? selectedCardListRange : masterRangeOverride;

    return (
      <CardListScreen
        darkMode={settings.darkMode}
        cards={effectiveMasterRange === selectedCardListRange ? filteredCards : getCardListCards(effectiveMasterRange)}
        allCards={cards}
        categories={allCategories}
        masterRanges={categoryTree}
        selectedMasterRange={effectiveMasterRange}
        searchQuery={searchQuery}
        sortMode={cardSortMode}
        restoreCardAddress={effectiveMasterRange === selectedCardListRange ? cardListRestoreAddress : null}
        onSearchChange={setSearchQuery}
        onSortModeChange={(nextSortMode) => {
          setCardListRestoreAddress(null);
          void updateCardSortMode(nextSortMode);
        }}
        onSelectMasterRange={(range) => {
          setSelectedCardListRange(range);
          setSearchQuery('');
          setCardListRestoreAddress(null);
        }}
        onClearMasterRange={() => {
          setSelectedCardListRange(null);
          setSearchQuery('');
          setCardListRestoreAddress(null);
        }}
        onScrollRestored={() => setCardListRestoreAddress(null)}
        onSelectCard={openCardFromList}
        onManageCard={manageCard}
        onBack={() => {
          if (selectedCardListRange) {
            setSelectedCardListRange(null);
            setSearchQuery('');
            setCardListRestoreAddress(null);
            return;
          }

          setCurrentScreen('home');
          setSearchQuery('');
          setCardListRestoreAddress(null);
          setSelectedCardListRange(null);
        }}
      />
    );
  };

  const renderAskCardsScreen = () => (
    <AskCardsScreen
      darkMode={settings.darkMode}
      question={askCardsQuestion}
      result={askCardsResult}
      isAsking={isAskingCards}
      cards={cards}
      onQuestionChange={setAskCardsQuestion}
      onAsk={askMyCards}
      onSelectCard={openSelectedCardDetail}
      onBack={() => setCurrentScreen('home')}
    />
  );

  const renderQuickCaptureScreen = () => (
    <QuickCaptureScreen
      darkMode={settings.darkMode}
      title={captureTitle}
      content={captureContent}
      onTitleChange={setCaptureTitle}
      onContentChange={setCaptureContent}
      onSave={saveQuickCaptureToInbox}
      onCancel={() => {
        resetCaptureForm();
        setCurrentScreen('home');
      }}
    />
  );

  const renderTodoListScreen = () => (
    <TodoListScreen
      darkMode={settings.darkMode}
      todos={todos}
      collapsedTodoIds={settings.collapsedTodoIds ?? []}
      onToggleTodo={toggleTodo}
      onDeleteTodo={deleteTodo}
      onAddSubTodo={addSubTodo}
      onAddSiblingTodo={addSiblingTodo}
      onUpdateTodo={updateTodo}
      onCollapsedTodoIdsChange={saveCollapsedTodoIds}
      onReorderTodos={reorderTodos}
      onIndentTodo={indentTodoItem}
      onOutdentTodo={outdentTodoItem}
      onOpenLinkedCard={openLinkedCard}
      onZoomChange={setIsTodoListZoomed}
      onRegisterZoomOut={handler => {
        todoListZoomOutRef.current = handler;
      }}
      onBack={() => {
        setIsTodoListZoomed(false);
        setCurrentScreen('home');
      }}
    />
  );

  const renderInboxScreen = () => (
    <InboxScreen
      darkMode={settings.darkMode}
      captures={inboxCaptures}
      captureJobsByCaptureId={captureJobsByCaptureId}
      onQuickCapture={() => {
        resetCaptureForm();
        setCurrentScreen('quickCapture');
      }}
      onFileCapture={fileInboxCapture}
      onFileCaptureWithAi={fileInboxCaptureWithAi}
      onTurnIntoTodos={turnInboxCaptureIntoTodos}
      onDeleteCapture={deleteInboxCapture}
      onResolveCaptureType={openClarificationForCapture}
      onBack={() => setCurrentScreen('home')}
    />
  );

  const renderThinkingScreen = () => (
    <ThinkingScreen darkMode={settings.darkMode} thinkingState={thinkingState} />
  );

  const renderSettingsScreen = () => (
    <SettingsScreen
      darkMode={settings.darkMode}
      aiAssistEndpoint={settings.aiAssistEndpoint ?? DEFAULT_AI_ASSIST_ENDPOINT}
      onToggleDarkMode={toggleDarkMode}
      onAiAssistEndpointChange={saveAiAssistEndpoint}
      onSeedTestCards={seedTestCards}
      onSeedTestCaptures={seedTestCaptures}
      onDeleteAllCards={deleteAllCards}
      onResetDefault={resetCategoriesToDefault}
      onResetBlank={resetCategoriesToBlank}
      onCreateBackup={createFullBackup}
      onRestoreLatestBackup={restoreLatestBackup}
      onShareLatestBackup={shareLatestBackup}
      onBack={() => setCurrentScreen('home')}
    />
  );

  const renderHelpScreen = () => (
    <HelpScreen
      darkMode={settings.darkMode}
      onBack={() => setCurrentScreen('home')}
    />
  );

  const renderSelectedCardScreen = () => (
    <CardViewer
      card={normalizeCard(selectedCard!)}
      darkMode={settings.darkMode}
      cards={cards}
      categories={allCategories}
      onSelectRelatedCard={openSelectedCardDetail}
      onOpenThread={openSelectedCardThread}
      onEdit={startEditCard}
      onDelete={confirmDeleteCard}
      onClose={closeSelectedCard}
    />
  );

  const renderCardThreadScreen = () => (
    <CardThreadView
      card={normalizeCard(selectedThreadCard!)}
      darkMode={settings.darkMode}
      cards={cards}
      categories={allCategories}
      onSelectCard={setSelectedThreadCard}
      onOpenDetails={returnFromCardThreadToDetail}
      onClose={closeCardThread}
    />
  );

  const renderScreenContent = (screen: Screen) => {
    if (screen === 'cardThread') {
      return renderCardThreadScreen();
    }

    if (screen === 'newCard' || screen === 'editCard') {
      return renderCardFormScreen(screen);
    }

    if (screen === 'newCategory' || screen === 'editCategory') {
      return renderCategoryFormScreen(screen);
    }

    if (screen === 'categoryPicker') {
      return renderCategoryPickerScreen();
    }

    if (screen === 'cardList') {
      return renderCardListScreen();
    }

    if (screen === 'askCards') {
      return renderAskCardsScreen();
    }

    if (screen === 'quickCapture') {
      return renderQuickCaptureScreen();
    }

    if (screen === 'inbox') {
      return renderInboxScreen();
    }

    if (screen === 'todoList') {
      return renderTodoListScreen();
    }

    if (screen === 'thinking') {
      return renderThinkingScreen();
    }

    if (screen === 'settings') {
      return renderSettingsScreen();
    }

    if (screen === 'help') {
      return renderHelpScreen();
    }

    return renderHomeScreen();
  };

  const renderScrollShell = (content: React.ReactNode, key: string) => (
    <FlatList
      key={key}
      data={[{ key }]}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.mainContent}
      renderItem={() => <>{content}</>}
    />
  );

  const renderForegroundContent = () => {
    if (currentScreen === 'cardThread') {
      return renderCardThreadScreen();
    }

    if (selectedCard) {
      return renderSelectedCardScreen();
    }

    if (currentScreen === 'cardList') {
      return renderCardListScreen();
    }

    if (currentScreen === 'todoList') {
      return renderTodoListScreen();
    }

    return renderScrollShell(renderScreenContent(currentScreen), `foreground-${currentScreen}`);
  };

  const renderUnderlayContent = (descriptor: SwipeUnderlayDescriptor) => {
    if (descriptor.type === 'none') {
      return null;
    }

    if (descriptor.type === 'home') {
      return renderScrollShell(renderHomeScreen(), 'underlay-home');
    }

    if (descriptor.type === 'selectedCardDetail') {
      return (
        <CardViewer
          card={normalizeCard(selectedThreadCard!)}
          darkMode={settings.darkMode}
          cards={cards}
          categories={allCategories}
          onSelectRelatedCard={openSelectedCardDetail}
          onOpenThread={openSelectedCardThread}
          onEdit={startEditCard}
          onDelete={confirmDeleteCard}
          onClose={closeSelectedCard}
        />
      );
    }

    if (descriptor.type === 'cardList') {
      return renderCardListScreen(descriptor.selectedMasterRange);
    }

    if (descriptor.screen === 'categoryPicker') {
      return renderScrollShell(renderCategoryPickerScreen(), 'underlay-category-picker');
    }

    if (descriptor.screen === 'cardList') {
      return renderCardListScreen();
    }

    return renderScrollShell(renderScreenContent(descriptor.screen), `underlay-${descriptor.screen}`);
  };

  const liveSwipeUnderlayDescriptor = getLiveSwipeUnderlayDescriptor();
  const underlayContent = renderUnderlayContent(frozenSwipeUnderlay ?? liveSwipeUnderlayDescriptor);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <NavigationContainer>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar style={settings.darkMode ? 'light' : 'dark'} />
        {underlayContent ? (
          <View pointerEvents="none" style={[styles.swipeUnderlay, { backgroundColor: theme.background }]}>
            {underlayContent}
          </View>
        ) : null}
        <ErrorBoundary darkMode={settings.darkMode}>
          <Animated.View
            style={[
              styles.swipeLayer,
              {
                backgroundColor: theme.background,
                transform: [{ translateX: swipeX }],
              },
            ]}
            {...swipeBackResponder.panHandlers}
          >
            {renderForegroundContent()}
          </Animated.View>
        </ErrorBoundary>
        <CaptureClarificationModal
          darkMode={settings.darkMode}
          job={clarificationModalJob}
          visible={clarificationModalJobId !== null}
          onChooseCard={() => { void handleChooseClarificationRoute('card'); }}
          onChooseTodo={() => { void handleChooseClarificationRoute('todo'); }}
          onSubmitAnswer={(answer) => { void handleSubmitClarificationAnswer(answer); }}
          onDecideLater={handleDismissClarification}
        />
      </View>
    </NavigationContainer>
    </GestureHandlerRootView>
  );
}
