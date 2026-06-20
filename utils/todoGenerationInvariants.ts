import { TodoGenerationDraft, TodoGenerationResult } from '../types';
import { normalizeActionTodoTitle } from './todoTaskTitles';

/** Stable codes for tests and contract docs — add new bugs as invariants, not capture-specific branches. */
export const TODO_GENERATION_INVARIANT_CODES = {
  PARENT_NO_INCLUDING: 'parent_no_including',
  PARENT_NOT_CAPTURE_ECHO: 'parent_not_capture_echo',
  PARENT_LENGTH_RATIO: 'parent_length_ratio',
  CHILD_IMPERATIVE: 'child_imperative',
  VALID_PARENT_REF: 'valid_parent_ref',
} as const;

export type TodoGenerationInvariantCode =
  typeof TODO_GENERATION_INVARIANT_CODES[keyof typeof TODO_GENERATION_INVARIANT_CODES];

export interface TodoGenerationCaptureContext {
  title: string;
  content: string;
}

export interface TodoGenerationInvariantViolation {
  code: TodoGenerationInvariantCode;
  message: string;
  clientId?: string;
}

export interface TodoTreeIndex {
  drafts: TodoGenerationDraft[];
  roots: TodoGenerationDraft[];
  childrenByParent: Map<string, TodoGenerationDraft[]>;
  draftsById: Map<string, TodoGenerationDraft>;
}

const INCLUDING_PATTERN = /\bincluding\b/i;
const GERUND_TITLE_PATTERN = /^[A-Za-z]+ing\b/i;
const MAX_CORRECTIONS = 6;
const PARENT_LENGTH_RATIO = 2.5;
const MIN_PARENT_LENGTH_FOR_RATIO = 48;

const normalizeComparable = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const capitalizeTitle = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const stripTrailingPunctuation = (value: string): string =>
  value.replace(/[.!?]+$/, '').trim();

export const stripParentTitleBeforeIncluding = (value: string): string | null => {
  const match = value.match(/^(.+?)\bincluding\b/i);
  if (!match) {
    return null;
  }
  const shortened = stripTrailingPunctuation(match[1]);
  return shortened || null;
};

export const buildTodoTreeIndex = (drafts: TodoGenerationDraft[]): TodoTreeIndex => {
  const draftsById = new Map(drafts.map(draft => [draft.clientId, draft]));
  const childrenByParent = new Map<string, TodoGenerationDraft[]>();
  const roots: TodoGenerationDraft[] = [];

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
};

const captureEchoes = (capture: TodoGenerationCaptureContext): Set<string> => {
  const trimmedTitle = capture.title.trim();
  const trimmedContent = capture.content.trim();
  const combined = `${trimmedTitle}\n${trimmedContent}`.trim();
  const echoes = new Set<string>();

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
};

const resolvePreferredParentTitle = (
  capture: TodoGenerationCaptureContext,
  currentTitle: string
): string | null => {
  const trimmedTitle = capture.title.trim();
  const trimmedContent = capture.content.trim();
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

  const childTitles = currentTitle.length > MIN_PARENT_LENGTH_FOR_RATIO
    ? stripParentTitleBeforeIncluding(currentTitle)
    : null;
  if (childTitles && normalizeComparable(childTitles) !== normalizedCurrent) {
    return capitalizeTitle(childTitles);
  }

  return null;
};

export const isSuspiciousParentTitle = (
  parentTitle: string,
  capture: TodoGenerationCaptureContext,
  childTitles: string[]
): boolean => {
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
};

export const detectTodoGenerationViolations = (
  capture: TodoGenerationCaptureContext,
  drafts: TodoGenerationDraft[]
): TodoGenerationInvariantViolation[] => {
  const tree = buildTodoTreeIndex(drafts);
  const violations: TodoGenerationInvariantViolation[] = [];

  for (const draft of drafts) {
    if (draft.parentClientId && !tree.draftsById.has(draft.parentClientId)) {
      violations.push({
        code: TODO_GENERATION_INVARIANT_CODES.VALID_PARENT_REF,
        message: `Todo "${draft.title}" references missing parent ${draft.parentClientId}.`,
        clientId: draft.clientId,
      });
    }

    const normalizedTitle = normalizeActionTodoTitle(draft.title);
    const isChild = Boolean(draft.parentClientId);
    const looksGerund = GERUND_TITLE_PATTERN.test(draft.title.trim());

    if (normalizedTitle !== draft.title && (isChild || looksGerund)) {
      violations.push({
        code: TODO_GENERATION_INVARIANT_CODES.CHILD_IMPERATIVE,
        message: `Todo "${draft.title}" should use an imperative action phrase.`,
        clientId: draft.clientId,
      });
    }
  }

  for (const root of tree.roots) {
    const childTitles = (tree.childrenByParent.get(root.clientId) ?? []).map(child => child.title);

    if (INCLUDING_PATTERN.test(root.title)) {
      violations.push({
        code: TODO_GENERATION_INVARIANT_CODES.PARENT_NO_INCLUDING,
        message: `Parent "${root.title}" must not contain "including".`,
        clientId: root.clientId,
      });
    }

    if (captureEchoes(capture).has(normalizeComparable(root.title))) {
      violations.push({
        code: TODO_GENERATION_INVARIANT_CODES.PARENT_NOT_CAPTURE_ECHO,
        message: `Parent "${root.title}" repeats the full capture instead of a short project name.`,
        clientId: root.clientId,
      });
    }

    if (isSuspiciousParentTitle(root.title, capture, childTitles)
      && !INCLUDING_PATTERN.test(root.title)
      && !captureEchoes(capture).has(normalizeComparable(root.title))) {
      violations.push({
        code: TODO_GENERATION_INVARIANT_CODES.PARENT_LENGTH_RATIO,
        message: `Parent "${root.title}" is too long relative to its subtasks.`,
        clientId: root.clientId,
      });
    }
  }

  return violations;
};

const repairInvalidParentRefs = (
  drafts: TodoGenerationDraft[],
  tree: TodoTreeIndex,
  corrections: string[]
): TodoGenerationDraft[] => {
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
};

const repairTitles = (
  capture: TodoGenerationCaptureContext,
  drafts: TodoGenerationDraft[],
  tree: TodoTreeIndex,
  corrections: string[]
): TodoGenerationDraft[] => {
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
};

export const applyTodoGenerationInvariants = (
  capture: TodoGenerationCaptureContext,
  result: TodoGenerationResult
): TodoGenerationResult => {
  if (result.needsClarification || result.todos.length === 0) {
    return result;
  }

  const corrections = [...(result.corrections ?? [])];
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
};

export interface TodoTreeInvariantExpectations {
  minRoots?: number;
  maxRoots?: number;
  noParentIncluding?: boolean;
  noCaptureEchoParents?: boolean;
  noGerundChildren?: boolean;
  noInvalidParentRefs?: boolean;
}

export const assertTodoTreeMeetsInvariants = (
  capture: TodoGenerationCaptureContext,
  drafts: TodoGenerationDraft[],
  expectations: TodoTreeInvariantExpectations
): string[] => {
  const failures: string[] = [];
  const tree = buildTodoTreeIndex(drafts);
  const violations = detectTodoGenerationViolations(capture, drafts);
  const echoes = captureEchoes(capture);

  if (expectations.minRoots !== undefined && tree.roots.length < expectations.minRoots) {
    failures.push(`Expected at least ${expectations.minRoots} root todos, got ${tree.roots.length}.`);
  }

  if (expectations.maxRoots !== undefined && tree.roots.length > expectations.maxRoots) {
    failures.push(`Expected at most ${expectations.maxRoots} root todos, got ${tree.roots.length}.`);
  }

  if (expectations.noParentIncluding) {
    const includingParents = tree.roots.filter(root => INCLUDING_PATTERN.test(root.title));
    if (includingParents.length > 0) {
      failures.push(`Root titles must not contain "including": ${includingParents.map(t => t.title).join(', ')}`);
    }
  }

  if (expectations.noCaptureEchoParents) {
    const echoParents = tree.roots.filter(root => echoes.has(normalizeComparable(root.title)));
    if (echoParents.length > 0) {
      failures.push(`Root titles must not echo capture text: ${echoParents.map(t => t.title).join(', ')}`);
    }
  }

  if (expectations.noGerundChildren) {
    const gerundChildren = drafts.filter(
      draft => draft.parentClientId && GERUND_TITLE_PATTERN.test(draft.title.trim())
    );
    if (gerundChildren.length > 0) {
      failures.push(`Child titles must not start with gerunds: ${gerundChildren.map(t => t.title).join(', ')}`);
    }
  }

  if (expectations.noInvalidParentRefs) {
    const invalidRefs = violations.filter(
      violation => violation.code === TODO_GENERATION_INVARIANT_CODES.VALID_PARENT_REF
    );
    if (invalidRefs.length > 0) {
      failures.push(invalidRefs.map(violation => violation.message).join(' '));
    }
  }

  return failures;
};