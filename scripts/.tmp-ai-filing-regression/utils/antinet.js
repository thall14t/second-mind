"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCardToneKey = exports.getTopLevelRangeForAddress = exports.getCategoryForCard = exports.formatCardDate = exports.parseCommaSeparatedValues = exports.normalizeCard = exports.normalizeCardSource = exports.formatCategoryLabel = exports.collectDefaultRangeOverrides = exports.collectDefaultLeafIds = exports.cardBelongsToCategory = exports.collectCategorySubtree = exports.validateCategoryAddress = exports.validateCardAddress = exports.getNextCategoryAddress = exports.getNextCardAddress = exports.getDirectChildren = exports.flattenCategories = exports.buildCategoryTree = exports.sortCategories = exports.isSubcategoryRange = exports.isRangeCategory = exports.parseRange = exports.compareCardsByMostRecent = exports.compareCardAddresses = exports.normalizeAddress = void 0;
const normalizeAddress = (value) => value.trim().toLowerCase();
exports.normalizeAddress = normalizeAddress;
const compareCardAddresses = (firstAddress, secondAddress) => {
    const first = (0, exports.normalizeAddress)(firstAddress);
    const second = (0, exports.normalizeAddress)(secondAddress);
    const firstCategory = parseInt(first.slice(0, 4), 10);
    const secondCategory = parseInt(second.slice(0, 4), 10);
    if (!Number.isNaN(firstCategory) && !Number.isNaN(secondCategory) && firstCategory !== secondCategory) {
        return firstCategory - secondCategory;
    }
    return first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' });
};
exports.compareCardAddresses = compareCardAddresses;
const compareCardsByMostRecent = (firstCard, secondCard) => {
    const firstTime = new Date(firstCard.createdAt).getTime();
    const secondTime = new Date(secondCard.createdAt).getTime();
    const safeFirstTime = Number.isNaN(firstTime) ? 0 : firstTime;
    const safeSecondTime = Number.isNaN(secondTime) ? 0 : secondTime;
    if (safeFirstTime !== safeSecondTime) {
        return safeSecondTime - safeFirstTime;
    }
    return (0, exports.compareCardAddresses)(firstCard.address, secondCard.address);
};
exports.compareCardsByMostRecent = compareCardsByMostRecent;
const parseRange = (range) => {
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
exports.parseRange = parseRange;
const isRangeCategory = (category) => category.range.includes('-');
exports.isRangeCategory = isRangeCategory;
const isSubcategoryRange = (category) => {
    const parsed = (0, exports.parseRange)(category.range);
    return parsed ? parsed.end - parsed.start <= 99 : false;
};
exports.isSubcategoryRange = isSubcategoryRange;
const sortCategories = (items) => {
    return [...items].sort((a, b) => {
        const aStart = (0, exports.parseRange)(a.range)?.start ?? Number.MAX_SAFE_INTEGER;
        const bStart = (0, exports.parseRange)(b.range)?.start ?? Number.MAX_SAFE_INTEGER;
        return aStart - bStart;
    });
};
exports.sortCategories = sortCategories;
const buildCategoryTree = (defaultCategories, customCategories, overrides, deletedDefaultCategoryIds) => {
    const overrideMap = new Map(overrides.map(override => [override.id, override]));
    const deletedSet = new Set(deletedDefaultCategoryIds);
    const buildCustomChildren = (parentId) => {
        return (0, exports.sortCategories)(customCategories
            .filter(category => category.parentId === parentId)
            .map(category => ({
            ...category,
            isCustom: true,
            children: buildCustomChildren(category.id),
        })));
    };
    const buildDefaultNode = (category) => {
        if (deletedSet.has(category.id)) {
            return null;
        }
        const override = overrideMap.get(category.id);
        const defaultChildren = (category.children ?? [])
            .map(buildDefaultNode)
            .filter((child) => Boolean(child));
        const customChildren = buildCustomChildren(category.id);
        return {
            ...category,
            title: override?.title ?? category.title,
            isDefault: true,
            children: (0, exports.sortCategories)([...defaultChildren, ...customChildren]),
        };
    };
    return defaultCategories
        .map(buildDefaultNode)
        .filter((category) => Boolean(category));
};
exports.buildCategoryTree = buildCategoryTree;
const flattenCategories = (items) => {
    return items.flatMap(category => [category, ...(0, exports.flattenCategories)(category.children ?? [])]);
};
exports.flattenCategories = flattenCategories;
const getDirectChildren = (category) => {
    return category.children ?? [];
};
exports.getDirectChildren = getDirectChildren;
const getNextCardAddress = (categoryAddress, cards) => {
    const prefix = (0, exports.normalizeAddress)(categoryAddress).padStart(4, '0').slice(0, 4);
    const existingLetters = cards
        .map(card => (0, exports.normalizeAddress)(card.address))
        .filter(address => new RegExp(`^${prefix}[a-z]$`).test(address))
        .map(address => address[prefix.length])
        .sort();
    if (existingLetters.length === 0) {
        return `${prefix}a`;
    }
    const nextCharCode = existingLetters[existingLetters.length - 1].charCodeAt(0) + 1;
    return prefix + String.fromCharCode(nextCharCode);
};
exports.getNextCardAddress = getNextCardAddress;
const getNextCategoryAddress = (rangeCategory) => {
    const parsedRange = (0, exports.parseRange)(rangeCategory.range);
    if (!parsedRange) {
        return rangeCategory.range;
    }
    const usedNumbers = new Set((0, exports.getDirectChildren)(rangeCategory)
        .map(child => (0, exports.normalizeAddress)(child.range))
        .filter(address => /^\d{4}$/.test(address))
        .map(address => parseInt(address, 10)));
    const firstCandidate = parsedRange.start % 100 === 0 ? parsedRange.start + 1 : parsedRange.start;
    for (let candidate = firstCandidate; candidate <= parsedRange.end; candidate += 1) {
        if (!usedNumbers.has(candidate)) {
            return String(candidate).padStart(4, '0');
        }
    }
    return String(parsedRange.end).padStart(4, '0');
};
exports.getNextCategoryAddress = getNextCategoryAddress;
const validateCardAddress = (address, allCategories, cards, editingCardId) => {
    const normalizedAddress = (0, exports.normalizeAddress)(address);
    if (!normalizedAddress) {
        return 'Please choose a category first.';
    }
    if (!/^\d{4}[a-z]$/.test(normalizedAddress)) {
        return 'Cards should use a category plus a letter, like 0102a.';
    }
    const parentCategoryAddress = normalizedAddress.slice(0, 4);
    const parentCategoryExists = allCategories.some(category => (0, exports.normalizeAddress)(category.range) === parentCategoryAddress);
    if (!parentCategoryExists) {
        return 'That card needs a real category first.';
    }
    const addressExists = cards.some(card => card.id !== editingCardId &&
        (0, exports.normalizeAddress)(card.address) === normalizedAddress);
    if (addressExists) {
        return 'That card address already exists. Choose a new one.';
    }
    return null;
};
exports.validateCardAddress = validateCardAddress;
const validateCategoryAddress = (address, parentCategory, allCategories, editingCategoryId) => {
    const normalizedAddress = (0, exports.normalizeAddress)(address);
    if (!parentCategory) {
        return 'Choose a parent range first.';
    }
    if (!/^\d{4}$/.test(normalizedAddress)) {
        return 'Categories should use 4 digits, like 0103.';
    }
    const parsedParentRange = (0, exports.parseRange)(parentCategory.range);
    const numericAddress = parseInt(normalizedAddress, 10);
    if (!parsedParentRange || numericAddress < parsedParentRange.start || numericAddress > parsedParentRange.end) {
        return 'That category must stay inside the selected range.';
    }
    const categoryExists = allCategories.some(category => category.id !== editingCategoryId &&
        (0, exports.normalizeAddress)(category.range) === normalizedAddress);
    if (categoryExists) {
        return 'That category already exists in your Antinet.';
    }
    return null;
};
exports.validateCategoryAddress = validateCategoryAddress;
const collectCategorySubtree = (category) => {
    return [category, ...(category.children ?? []).flatMap(exports.collectCategorySubtree)];
};
exports.collectCategorySubtree = collectCategorySubtree;
const cardBelongsToCategory = (card, category) => {
    const normalizedAddress = (0, exports.normalizeAddress)(card.address);
    if (!category.range.includes('-')) {
        return normalizedAddress.startsWith((0, exports.normalizeAddress)(category.range));
    }
    const parsed = (0, exports.parseRange)(category.range);
    const numericPrefix = parseInt(normalizedAddress.slice(0, 4), 10);
    if (!parsed || Number.isNaN(numericPrefix)) {
        return false;
    }
    return numericPrefix >= parsed.start && numericPrefix <= parsed.end;
};
exports.cardBelongsToCategory = cardBelongsToCategory;
const collectDefaultLeafIds = (items) => {
    return items.flatMap(category => {
        const childLeafIds = (0, exports.collectDefaultLeafIds)(category.children ?? []);
        if (category.range.includes('-')) {
            return childLeafIds;
        }
        return [category.id, ...childLeafIds];
    });
};
exports.collectDefaultLeafIds = collectDefaultLeafIds;
const collectDefaultRangeOverrides = (items) => {
    return items.flatMap(category => {
        const childOverrides = (0, exports.collectDefaultRangeOverrides)(category.children ?? []);
        if (!category.range.includes('-')) {
            return childOverrides;
        }
        return [{ id: category.id, title: '' }, ...childOverrides];
    });
};
exports.collectDefaultRangeOverrides = collectDefaultRangeOverrides;
const formatCategoryLabel = (range, title) => {
    const trimmedTitle = title?.trim() ?? '';
    return trimmedTitle ? `${range} - ${trimmedTitle}` : range;
};
exports.formatCategoryLabel = formatCategoryLabel;
const trimOptionalField = (value) => value?.trim() || undefined;
const normalizeCardSource = (source) => {
    if (!source) {
        return undefined;
    }
    const normalizedSource = {
        type: source.type ?? 'Other',
        title: trimOptionalField(source.title),
        author: trimOptionalField(source.author),
        url: trimOptionalField(source.url),
        page: trimOptionalField(source.page),
        note: trimOptionalField(source.note),
    };
    const hasSourceDetails = Boolean(normalizedSource.title ||
        normalizedSource.author ||
        normalizedSource.url ||
        normalizedSource.page ||
        normalizedSource.note);
    return hasSourceDetails ? normalizedSource : undefined;
};
exports.normalizeCardSource = normalizeCardSource;
const normalizeCard = (card) => ({
    ...card,
    status: card.status ?? 'Seed',
    tags: Array.isArray(card.tags) ? card.tags : [],
    relatedAddresses: Array.isArray(card.relatedAddresses) ? card.relatedAddresses : [],
    source: (0, exports.normalizeCardSource)(card.source),
});
exports.normalizeCard = normalizeCard;
const parseCommaSeparatedValues = (value) => value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
exports.parseCommaSeparatedValues = parseCommaSeparatedValues;
const formatCardDate = (isoDate) => {
    try {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date(isoDate));
    }
    catch {
        return isoDate;
    }
};
exports.formatCardDate = formatCardDate;
const getCategoryForCard = (address, categories) => {
    const normalizedAddress = (0, exports.normalizeAddress)(address);
    const baseAddress = normalizedAddress.slice(0, 4);
    return categories.find(category => (0, exports.normalizeAddress)(category.range) === baseAddress) ?? null;
};
exports.getCategoryForCard = getCategoryForCard;
const getTopLevelRangeForAddress = (address, categories) => {
    const normalizedAddress = (0, exports.normalizeAddress)(address);
    const numericPrefix = parseInt(normalizedAddress.slice(0, 4), 10);
    if (Number.isNaN(numericPrefix)) {
        return null;
    }
    return categories.find(category => {
        if (!category.range.includes('-')) {
            return false;
        }
        const parsed = (0, exports.parseRange)(category.range);
        return parsed ? numericPrefix >= parsed.start && numericPrefix <= parsed.end : false;
    }) ?? null;
};
exports.getTopLevelRangeForAddress = getTopLevelRangeForAddress;
const getCardToneKey = (address) => {
    const firstDigit = (0, exports.normalizeAddress)(address).slice(0, 1);
    return /^[0-9]$/.test(firstDigit) ? firstDigit : 'default';
};
exports.getCardToneKey = getCardToneKey;
