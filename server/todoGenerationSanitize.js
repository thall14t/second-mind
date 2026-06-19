const INCLUDING_PATTERN = /\bincluding\b/i;

const normalizeComparable = value =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const capitalizeTitle = value => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const stripTrailingPunctuation = value =>
  String(value || '').replace(/[.!?]+$/, '').trim();

function stripParentTitleBeforeIncluding(value) {
  const match = String(value || '').match(/^(.+?)\bincluding\b/i);
  if (!match) {
    return null;
  }
  const shortened = stripTrailingPunctuation(match[1]);
  return shortened || null;
}

function resolvePreferredParentTitle(captureTitle, captureContent, currentTitle) {
  const trimmedTitle = String(captureTitle || '').trim();
  const trimmedContent = String(captureContent || '').trim();
  const combined = `${trimmedTitle}\n${trimmedContent}`.trim();
  const normalizedCurrent = normalizeComparable(currentTitle);

  if (
    trimmedContent
    && (
      normalizedCurrent === normalizeComparable(trimmedContent)
      || (combined && normalizedCurrent === normalizeComparable(combined))
    )
  ) {
    const fromContent = stripParentTitleBeforeIncluding(trimmedContent);
    if (fromContent) {
      return capitalizeTitle(fromContent);
    }
    if (trimmedTitle) {
      return trimmedTitle;
    }
  }

  if (INCLUDING_PATTERN.test(currentTitle)) {
    const fromTitle = stripParentTitleBeforeIncluding(currentTitle);
    if (fromTitle) {
      return capitalizeTitle(fromTitle);
    }
  }

  return null;
}

function isSuspiciousParentTitle(parentTitle, captureTitle, captureContent, childTitles) {
  const trimmedContent = String(captureContent || '').trim();
  const combined = `${captureTitle || ''}\n${captureContent || ''}`.trim();
  const normalizedParent = normalizeComparable(parentTitle);

  if (INCLUDING_PATTERN.test(parentTitle)) {
    return true;
  }

  if (trimmedContent && normalizedParent === normalizeComparable(trimmedContent)) {
    return true;
  }

  if (combined && normalizedParent === normalizeComparable(combined)) {
    return true;
  }

  if (childTitles.length > 0) {
    const averageChildLength = childTitles.reduce((sum, title) => sum + title.length, 0) / childTitles.length;
    if (parentTitle.length > averageChildLength * 2.5 && parentTitle.length > 48) {
      return true;
    }
  }

  return false;
}

function sanitizeTodoGeneration(capture, result) {
  if (result.needsClarification || !Array.isArray(result.todos) || result.todos.length === 0) {
    return result;
  }

  const childTitlesByParent = new Map();

  for (const draft of result.todos) {
    if (!draft.parentClientId) {
      continue;
    }
    const siblings = childTitlesByParent.get(draft.parentClientId) ?? [];
    siblings.push(draft.title);
    childTitlesByParent.set(draft.parentClientId, siblings);
  }

  const corrections = Array.isArray(result.corrections) ? [...result.corrections] : [];
  let changed = false;

  const sanitizedTodos = result.todos.map(draft => {
    if (draft.parentClientId) {
      return draft;
    }

    const childTitles = childTitlesByParent.get(draft.clientId) ?? [];
    if (!isSuspiciousParentTitle(draft.title, capture?.title, capture?.content, childTitles)) {
      return draft;
    }

    const preferredTitle = resolvePreferredParentTitle(capture?.title, capture?.content, draft.title);
    if (!preferredTitle || preferredTitle === draft.title) {
      return draft;
    }

    changed = true;
    corrections.push(`Shortened parent title to "${preferredTitle}".`);
    return {
      ...draft,
      title: preferredTitle,
    };
  });

  if (!changed) {
    return result;
  }

  return {
    ...result,
    todos: sanitizedTodos,
    corrections: corrections.slice(0, 6),
  };
}

module.exports = {
  sanitizeTodoGeneration,
  stripParentTitleBeforeIncluding,
};