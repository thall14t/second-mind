const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const formatIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const resolveRelativeDueDate = (
  phrase: string,
  referenceDate = new Date()
): string | undefined => {
  const normalized = phrase.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (/\btomorrow\b/.test(normalized)) {
    const nextDay = new Date(referenceDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return formatIsoDate(nextDay);
  }

  if (/\btoday\b/.test(normalized)) {
    return formatIsoDate(referenceDate);
  }

  const dayMatch = normalized.match(
    /\b(?:this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
  );
  if (dayMatch) {
    const targetDay = WEEKDAY_NAMES.indexOf(dayMatch[1] as typeof WEEKDAY_NAMES[number]);
    if (targetDay === -1) {
      return undefined;
    }

    const dueDate = new Date(referenceDate);
    const currentDay = dueDate.getDay();
    let daysUntil = (targetDay - currentDay + 7) % 7;

    if (daysUntil === 0 && !/\bthis\s+/.test(normalized)) {
      daysUntil = 7;
    }

    dueDate.setDate(dueDate.getDate() + daysUntil);
    return formatIsoDate(dueDate);
  }

  return undefined;
};

export const formatTodoDueDate = (dueDate?: string): string | null => {
  if (!dueDate?.trim()) {
    return null;
  }

  const parsed = new Date(`${dueDate.trim()}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dueDate.trim();
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const normalizeTodoDueDateInput = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return formatIsoDate(parsed);
};