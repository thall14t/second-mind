const { normalizeActionTodoTitle } = require('./todoTaskTitles');

const TODO_GENERATION_INVARIANT_CODES = {
  PARENT_NO_INCLUDING: 'parent_no_including',
  PARENT_NOT_CAPTURE_ECHO: 'parent_not_capture_echo',
  PARENT_LENGTH_RATIO: 'parent_length_ratio',
  CHILD_IMPERATIVE: 'child_imperative',
  VALID_PARENT_REF: 'valid_parent_ref',
};

const INCLUDING_PATTERN = /\bincluding\b/i;
const GERUND_TITLE_PATTERN = /^[A-Za-z]+ing\b/i;
const MAX_CORRECTIONS = 6;
const PARENT_LENGTH_RATIO = 2.5;
const MIN_PARENT_LENGTH_FOR_RATIO = 48;

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

function buildTodoTreeIndex(drafts) {
  const draftsById = new Map(drafts.map(draft => [draft.clientId, draft]));
  const childrenByParent = new Map();
  const roots = [];

  for (const draft of drafts) {
    if (draft.parentClientId) {
      const siblings = childrenByParent.get(draft.parentClientId) ?? [];
      siblings.push(draft);
      childrenByParent.set(draft.parentClientId, siblings);
      continue;
    }
    roots.push(draft);
  }

  return {
    drafts,
    roots,
    childrenByParent,
    draftsById,
  };
}

function captureEchoes(capture) {
  const trimmedTitle = String(capture?.title || '').trim();
  const trimmedContent = String(capture?.content || '').trim();
  const combined = `${trimmedTitle}\n${trimmedContent}`.trim();
  const echoes = new Set();

  if (trimmedContent) {
    echoes.add(normalizeComparable(trimmedContent));
  }
  if (combined) {
    echoes.add(normalizeComparable(combined));
  }
  if (trimmedTitle) {
    echoes.add(normalizeComparable(trimmedTitle));
  }

  return echoes;
}

function resolvePreferredParentTitle(capture, currentTitle) {
  const trimmedTitle = String(capture?.title || '').trim();
  const trimmedContent = String(capture?.content || '').trim();
  const normalizedCurrent = normalizeComparable(currentTitle);

  if (trimmedContent && normalizedCurrent === normalizeComparable(trimmedContent)) {
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

  const shortened = currentTitle.length > MIN_PARENT_LENGTH_FOR_RATIO
    ? stripParentTitleBeforeIncluding(currentTitle)
    : null;
  if (shortened && normalizeComparable(shortened) !== normalizedCurrent) {
    return capitalizeTitle(shortened);
  }

  return null;
}

function isSuspiciousParentTitle(parentTitle, capture, childTitles) {
  const normalizedParent = normalizeComparable(parentTitle);
  const echoes = captureEchoes(capture);

  if (INCLUDING_PATTERN.test(parentTitle)) {
    return true;
  }

  if (echoes.has(normalizedParent)) {
    return true;
  }

  if (childTitles.length > 0) {
    const averageChildLength = childTitles.reduce((sum, title) => sum + title.length, 0) / childTitles.length;
    if (parentTitle.length > averageChildLength * PARENT_LENGTH_RATIO && parentTitle.length > MIN_PARENT_LENGTH_FOR_RATIO) {
      return true;
    }
  }

  return false;
}

function repairInvalidParentRefs(drafts, tree, corrections) {
  let changed = false;

  const repaired = drafts.map(draft => {
    if (!draft.parentClientId || tree.draftsById.has(draft.parentClientId)) {
      return draft;
    }

    changed = true;
    corrections.push(`Detached "${draft.title}" from a missing parent.`);
    return {
      ...draft,
      parentClientId: null,
    };
  });

  return changed ? repaired : drafts;
}

function repairTitles(capture, drafts, tree, corrections) {
  let changed = false;

  const repaired = drafts.map(draft => {
    let nextTitle = normalizeActionTodoTitle(draft.title);
    const isRoot = !draft.parentClientId;

    if (isRoot) {
      const childTitles = (tree.childrenByParent.get(draft.clientId) ?? []).map(child => child.title);
      if (isSuspiciousParentTitle(nextTitle, capture, childTitles)) {
        const preferredTitle = resolvePreferredParentTitle(capture, nextTitle);
        if (preferredTitle && preferredTitle !== nextTitle) {
          corrections.push(`Shortened parent title to "${preferredTitle}".`);
          nextTitle = preferredTitle;
        }
      }
    }

    if (nextTitle === draft.title) {
      return draft;
    }

    changed = true;
    return {
      ...draft,
      title: nextTitle,
    };
  });

  return changed ? repaired : drafts;
}

function applyTodoGenerationInvariants(capture, result) {
  if (result.needsClarification || !Array.isArray(result.todos) || result.todos.length === 0) {
    return result;
  }

  const corrections = Array.isArray(result.corrections) ? [...result.corrections] : [];
  let drafts = [...result.todos];
  let tree = buildTodoTreeIndex(drafts);

  const afterRefs = repairInvalidParentRefs(drafts, tree, corrections);
  if (afterRefs !== drafts) {
    drafts = afterRefs;
    tree = buildTodoTreeIndex(drafts);
  }

  const afterTitles = repairTitles(capture, drafts, tree, corrections);
  if (afterTitles !== drafts) {
    drafts = afterTitles;
  }

  if (drafts === result.todos && corrections.length === (result.corrections ?? []).length) {
    return result;
  }

  return {
    ...result,
    todos: drafts,
    corrections: corrections.slice(0, MAX_CORRECTIONS),
  };
}

module.exports = {
  TODO_GENERATION_INVARIANT_CODES,
  stripParentTitleBeforeIncluding,
  buildTodoTreeIndex,
  isSuspiciousParentTitle,
  applyTodoGenerationInvariants,
};