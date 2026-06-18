import { Category } from '../data/antinetCategories';
import { Card, CardSource, CategoryOverride, CustomCategory, ManagedCategory } from '../types';

export const normalizeAddress = (value: string) => value.trim().toLowerCase();

export const compareCardAddresses = (firstAddress: string, secondAddress: string) => {
  const first = normalizeAddress(firstAddress);
  const second = normalizeAddress(secondAddress);
  const firstCategory = parseInt(first.slice(0, 4), 10);
  const secondCategory = parseInt(second.slice(0, 4), 10);

  if (!Number.isNaN(firstCategory) && !Number.isNaN(secondCategory) && firstCategory !== secondCategory) {
    return firstCategory - secondCategory;
  }

  return first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' });
};

export const compareCardsByMostRecent = (firstCard: Card, secondCard: Card) => {
  const firstTime = new Date(firstCard.createdAt).getTime();
  const secondTime = new Date(secondCard.createdAt).getTime();
  const safeFirstTime = Number.isNaN(firstTime) ? 0 : firstTime;
  const safeSecondTime = Number.isNaN(secondTime) ? 0 : secondTime;

  if (safeFirstTime !== safeSecondTime) {
    return safeSecondTime - safeFirstTime;
  }

  return compareCardAddresses(firstCard.address, secondCard.address);
};

export const parseRange = (range: string) => {
  if (!range.includes('-')) {
    const value = parseInt(range, 10);
    return Number.isNaN(value) ? null : { start: value, end: value };
  }

  const [rawStart, rawEnd] = range.split('-');
  const start = parseInt(rawStart, 10);
  const end = parseInt(rawEnd, 10);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return { start, end };
};

export const isRangeCategory = (category: Category) => category.range.includes('-');

export const isSubcategoryRange = (category: Category) => {
  const parsed = parseRange(category.range);
  return parsed ? parsed.end - parsed.start <= 99 : false;
};

export const sortCategories = (items: Category[]) => {
  return [...items].sort((a, b) => {
    const aStart = parseRange(a.range)?.start ?? Number.MAX_SAFE_INTEGER;
    const bStart = parseRange(b.range)?.start ?? Number.MAX_SAFE_INTEGER;
    return aStart - bStart;
  });
};

export const buildCategoryTree = (
  defaultCategories: Category[],
  customCategories: CustomCategory[],
  overrides: CategoryOverride[],
  deletedDefaultCategoryIds: string[]
): ManagedCategory[] => {
  const overrideMap = new Map(overrides.map(override => [override.id, override]));
  const deletedSet = new Set(deletedDefaultCategoryIds);

  const buildCustomChildren = (parentId: string): ManagedCategory[] => {
    return sortCategories(
      customCategories
        .filter(category => category.parentId === parentId)
        .map(category => ({
          ...category,
          isCustom: true,
          children: buildCustomChildren(category.id),
        }))
    ) as ManagedCategory[];
  };

  const buildDefaultNode = (category: Category): ManagedCategory | null => {
    if (deletedSet.has(category.id)) {
      return null;
    }

    const override = overrideMap.get(category.id);
    const defaultChildren = (category.children ?? [])
      .map(buildDefaultNode)
      .filter((child): child is ManagedCategory => Boolean(child));
    const customChildren = buildCustomChildren(category.id);

    return {
      ...category,
      title: override?.title ?? category.title,
      isDefault: true,
      children: sortCategories([...defaultChildren, ...customChildren]) as ManagedCategory[],
    };
  };

  return defaultCategories
    .map(buildDefaultNode)
    .filter((category): category is ManagedCategory => Boolean(category));
};

export const flattenCategories = (items: ManagedCategory[]): ManagedCategory[] => {
  return items.flatMap(category => [category, ...flattenCategories(category.children ?? [])]);
};

export const getDirectChildren = (category: ManagedCategory): ManagedCategory[] => {
  return category.children ?? [];
};

export const getNextCardAddress = (categoryAddress: string, cards: Card[]): string => {
  const prefix = normalizeAddress(categoryAddress).padStart(4, '0').slice(0, 4);
  const existingLetters = cards
    .map(card => normalizeAddress(card.address))
    .filter(address => new RegExp(`^${prefix}[a-z]$`).test(address))
    .map(address => address[prefix.length])
    .sort();

  if (existingLetters.length === 0) {
    return `${prefix}a`;
  }

  const nextCharCode = existingLetters[existingLetters.length - 1].charCodeAt(0) + 1;
  return prefix + String.fromCharCode(nextCharCode);
};

export const getNextCategoryAddress = (
  rangeCategory: ManagedCategory
): string => {
  const parsedRange = parseRange(rangeCategory.range);
  if (!parsedRange) {
    return rangeCategory.range;
  }

  const usedNumbers = new Set(
    getDirectChildren(rangeCategory)
      .map(child => normalizeAddress(child.range))
      .filter(address => /^\d{4}$/.test(address))
      .map(address => parseInt(address, 10))
  );

  const firstCandidate = parsedRange.start % 100 === 0 ? parsedRange.start + 1 : parsedRange.start;
  for (let candidate = firstCandidate; candidate <= parsedRange.end; candidate += 1) {
    if (!usedNumbers.has(candidate)) {
      return String(candidate).padStart(4, '0');
    }
  }

  return String(parsedRange.end).padStart(4, '0');
};

export const validateCardAddress = (
  address: string,
  allCategories: ManagedCategory[],
  cards: Card[],
  editingCardId?: string | null
): string | null => {
  const normalizedAddress = normalizeAddress(address);

  if (!normalizedAddress) {
    return 'Please choose a category first.';
  }

  if (!/^\d{4}[a-z]$/.test(normalizedAddress)) {
    return 'Cards should use a category plus a letter, like 0102a.';
  }

  const parentCategoryAddress = normalizedAddress.slice(0, 4);
  const parentCategoryExists = allCategories.some(
    category => normalizeAddress(category.range) === parentCategoryAddress
  );

  if (!parentCategoryExists) {
    return 'That card needs a real category first.';
  }

  const addressExists = cards.some(
    card =>
      card.id !== editingCardId &&
      normalizeAddress(card.address) === normalizedAddress
  );

  if (addressExists) {
    return 'That card address already exists. Choose a new one.';
  }

  return null;
};

export const validateCategoryAddress = (
  address: string,
  parentCategory: ManagedCategory | null,
  allCategories: ManagedCategory[],
  editingCategoryId?: string | null
): string | null => {
  const normalizedAddress = normalizeAddress(address);

  if (!parentCategory) {
    return 'Choose a parent range first.';
  }

  if (!/^\d{4}$/.test(normalizedAddress)) {
    return 'Categories should use 4 digits, like 0103.';
  }

  const parsedParentRange = parseRange(parentCategory.range);
  const numericAddress = parseInt(normalizedAddress, 10);
  if (!parsedParentRange || numericAddress < parsedParentRange.start || numericAddress > parsedParentRange.end) {
    return 'That category must stay inside the selected range.';
  }

  const categoryExists = allCategories.some(
    category =>
      category.id !== editingCategoryId &&
      normalizeAddress(category.range) === normalizedAddress
  );

  if (categoryExists) {
    return 'That category already exists in your Antinet.';
  }

  return null;
};

export const collectCategorySubtree = (category: ManagedCategory): ManagedCategory[] => {
  return [category, ...(category.children ?? []).flatMap(collectCategorySubtree)];
};

export const cardBelongsToCategory = (card: Card, category: ManagedCategory): boolean => {
  const normalizedAddress = normalizeAddress(card.address);

  if (!category.range.includes('-')) {
    return normalizedAddress.startsWith(normalizeAddress(category.range));
  }

  const parsed = parseRange(category.range);
  const numericPrefix = parseInt(normalizedAddress.slice(0, 4), 10);
  if (!parsed || Number.isNaN(numericPrefix)) {
    return false;
  }

  return numericPrefix >= parsed.start && numericPrefix <= parsed.end;
};

export const collectDefaultLeafIds = (items: Category[]): string[] => {
  return items.flatMap(category => {
    const childLeafIds = collectDefaultLeafIds(category.children ?? []);
    if (category.range.includes('-')) {
      return childLeafIds;
    }

    return [category.id, ...childLeafIds];
  });
};

export const collectDefaultRangeOverrides = (items: Category[]): CategoryOverride[] => {
  return items.flatMap(category => {
    const childOverrides = collectDefaultRangeOverrides(category.children ?? []);
    if (!category.range.includes('-')) {
      return childOverrides;
    }

    return [{ id: category.id, title: '' }, ...childOverrides];
  });
};

export const formatCategoryLabel = (range: string, title?: string) => {
  const trimmedTitle = title?.trim() ?? '';
  return trimmedTitle ? `${range} - ${trimmedTitle}` : range;
};

const trimOptionalField = (value?: string) => value?.trim() || undefined;

export const normalizeCardSource = (source?: CardSource): CardSource | undefined => {
  if (!source) {
    return undefined;
  }

  const normalizedSource: CardSource = {
    type: source.type ?? 'Other',
    title: trimOptionalField(source.title),
    author: trimOptionalField(source.author),
    url: trimOptionalField(source.url),
    page: trimOptionalField(source.page),
    note: trimOptionalField(source.note),
  };

  const hasSourceDetails = Boolean(
    normalizedSource.title ||
    normalizedSource.author ||
    normalizedSource.url ||
    normalizedSource.page ||
    normalizedSource.note
  );

  return hasSourceDetails ? normalizedSource : undefined;
};

export const normalizeCard = (card: Card): Card => ({
  ...card,
  status: card.status ?? 'Seed',
  tags: Array.isArray(card.tags) ? card.tags : [],
  relatedAddresses: Array.isArray(card.relatedAddresses) ? card.relatedAddresses : [],
  source: normalizeCardSource(card.source),
});

export const parseCommaSeparatedValues = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

export const formatCardDate = (isoDate: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
};

export const getCategoryForCard = (address: string, categories: ManagedCategory[]) => {
  const normalizedAddress = normalizeAddress(address);
  const baseAddress = normalizedAddress.slice(0, 4);
  return categories.find(category => normalizeAddress(category.range) === baseAddress) ?? null;
};

export const getTopLevelRangeForAddress = (address: string, categories: ManagedCategory[]) => {
  const normalizedAddress = normalizeAddress(address);
  const numericPrefix = parseInt(normalizedAddress.slice(0, 4), 10);
  if (Number.isNaN(numericPrefix)) {
    return null;
  }

  return categories.find(category => {
    if (!category.range.includes('-')) {
      return false;
    }

    const parsed = parseRange(category.range);
    return parsed ? numericPrefix >= parsed.start && numericPrefix <= parsed.end : false;
  }) ?? null;
};

export const getCardToneKey = (address: string) => {
  const firstDigit = normalizeAddress(address).slice(0, 1);
  return /^[0-9]$/.test(firstDigit) ? firstDigit : 'default';
};
