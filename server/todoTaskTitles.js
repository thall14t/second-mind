const GERUND_STEM_OVERRIDES = {
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

const capitalizeTaskTitle = value => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

function gerundStemToImperative(gerundWord) {
  const lower = String(gerundWord || '').toLowerCase();
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
}

function normalizeActionTodoTitle(title) {
  const trimmed = String(title || '')
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
}

module.exports = {
  normalizeActionTodoTitle,
};