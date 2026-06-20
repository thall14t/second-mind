const GERUND_STEM_OVERRIDES: Record<string, string> = {
  putt: 'put',
  trimm: 'trim',
  plann: 'plan',
  stopp: 'stop',
  runn: 'run',
  gett: 'get',
  sett: 'set',
  swimm: 'swim',
  shopp: 'shop',
};

const capitalizeTaskTitle = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const gerundStemToImperative = (gerundWord: string): string | null => {
  const lower = gerundWord.toLowerCase();
  if (!lower.endsWith('ing') || lower.length < 4) {
    return null;
  }

  const withoutIng = lower.slice(0, -3);
  if (!withoutIng) {
    return null;
  }

  if (GERUND_STEM_OVERRIDES[withoutIng]) {
    return GERUND_STEM_OVERRIDES[withoutIng];
  }

  if (`${withoutIng}ing` === lower) {
    if (!/[aeiouy]$/i.test(withoutIng) && withoutIng.length <= 4) {
      return `${withoutIng}e`;
    }
    return withoutIng;
  }

  return null;
};

export const normalizeActionTodoTitle = (title: string): string => {
  const trimmed = title
    .trim()
    .replace(/^and\s+/i, '')
    .replace(/[.!?]+$/, '')
    .trim();

  if (!trimmed) {
    return trimmed;
  }

  const firstWordMatch = trimmed.match(/^([A-Za-z]+)(\s+.*)?$/);
  if (!firstWordMatch) {
    return capitalizeTaskTitle(trimmed);
  }

  const imperativeStem = gerundStemToImperative(firstWordMatch[1]);
  if (!imperativeStem) {
    return capitalizeTaskTitle(trimmed);
  }

  const tail = firstWordMatch[2] ?? '';
  return capitalizeTaskTitle(`${imperativeStem}${tail}`);
};