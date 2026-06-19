import { Todo } from '../types';
import { resolveRelativeDueDate } from './todoDates';

const BULLET_LINE_PATTERN = /^([-*•]|\d+[.)])\s+(.+)$/;
const TASK_LIST_FRAMING_PATTERN = /\b(chores?|errands?|to-?do(?:\s+list)?|checklist|shopping\s+list|grocery\s+list|cleaning(?:\s+list)?|house(?:hold)?\s+(?:chores?|tasks?)|weekend\s+tasks?)\b/i;
const TASK_NEED_PATTERN = /\b(?:i\s+)?need\s+to\s+(.+)$/i;
const TASK_BY_DATE_PATTERN = /\bby\s+(?:this\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|next\s+\w+|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i;
const INCLUDING_TASKS_PATTERN = /\bincluding\s+(.+)$/i;

const capitalizeTaskTitle = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const splitIncludedTasks = (value: string): string[] => {
  return value
    .split(/\s+and\s+|,\s*/)
    .map(part => capitalizeTaskTitle(
      part.replace(/^and\s+/i, '').replace(/[.!?]+$/, '').trim()
    ))
    .filter(Boolean);
};

const parseStructuredTaskSentence = (
  title: string,
  content: string,
  referenceDate = new Date()
): Todo[] | null => {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return null;
  }

  let workingText = trimmedContent;
  let dueDate: string | undefined;

  const byDateMatch = workingText.match(TASK_BY_DATE_PATTERN);
  if (byDateMatch) {
    dueDate = resolveRelativeDueDate(byDateMatch[0], referenceDate);
    workingText = workingText.replace(TASK_BY_DATE_PATTERN, '').trim();
  }

  let includedTasks: string[] = [];
  const includingMatch = workingText.match(INCLUDING_TASKS_PATTERN);
  if (includingMatch) {
    includedTasks = splitIncludedTasks(includingMatch[1]);
    workingText = workingText.slice(0, includingMatch.index).trim();
  }

  const needMatch = workingText.match(TASK_NEED_PATTERN);
  if (!needMatch && includedTasks.length === 0) {
    return null;
  }

  const parentSource = needMatch?.[1]?.trim()
    || (includedTasks.length > 0 ? workingText : '')
    || title.trim()
    || trimmedContent
    || 'Todo';
  const parentTitle = capitalizeTaskTitle(parentSource.replace(/[.!?]+$/, '').trim());
  const createdAt = new Date().toISOString();
  const baseId = Date.now().toString();

  if (includedTasks.length === 0) {
    return [{
      id: baseId,
      title: parentTitle,
      completed: false,
      sortOrder: 0,
      createdAt,
      dueDate,
    }];
  }

  const parent: Todo = {
    id: baseId,
    title: parentTitle,
    completed: false,
    sortOrder: 0,
    createdAt,
    dueDate,
  };

  const children: Todo[] = includedTasks.map((subTitle, index) => ({
    id: `${baseId}-sub-${index}`,
    title: subTitle,
    completed: false,
    parentId: baseId,
    sortOrder: index,
    createdAt,
  }));

  return [parent, ...children];
};

export function parseTodosFromCapture(
  title: string,
  content: string,
  referenceDate = new Date()
): Todo[] {
  const trimmedContent = content.trim();
  const trimmedTitle = title.trim();
  if (!trimmedContent) {
    return [];
  }

  const structuredSentence = parseStructuredTaskSentence(trimmedTitle, trimmedContent, referenceDate);
  if (structuredSentence) {
    return structuredSentence;
  }

  const lines = trimmedContent.split('\n').map(line => line.trim()).filter(Boolean);
  const subTitles: string[] = [];
  const plainLines: string[] = [];

  for (const line of lines) {
    const match = line.match(BULLET_LINE_PATTERN);
    if (match) {
      subTitles.push(match[2].trim());
    } else {
      plainLines.push(line);
    }
  }

  const createdAt = new Date().toISOString();
  const baseId = Date.now().toString();

  if (subTitles.length === 0 && plainLines.length === 1) {
    const commaSegments = plainLines[0].split(/,\s+/).map(segment => segment.trim()).filter(Boolean);
    if (commaSegments.length >= 3) {
      const parentTitle = capitalizeTaskTitle(trimmedTitle || 'Tasks');
      const parent: Todo = {
        id: baseId,
        title: parentTitle,
        completed: false,
        sortOrder: 0,
        createdAt,
      };
      const children: Todo[] = commaSegments.map((subTitle, index) => ({
        id: `${baseId}-sub-${index}`,
        title: capitalizeTaskTitle(subTitle),
        completed: false,
        parentId: baseId,
        sortOrder: index,
        createdAt,
      }));
      return [parent, ...children];
    }
  }

  if (subTitles.length === 0 && plainLines.length >= 2) {
    const parentTitle = capitalizeTaskTitle(
      trimmedTitle
      || (TASK_LIST_FRAMING_PATTERN.test(trimmedContent) ? 'Tasks' : plainLines[0])
    );
    const taskLines = trimmedTitle ? plainLines : plainLines.slice(1);
    const items = (taskLines.length > 0 ? taskLines : plainLines).map(line => capitalizeTaskTitle(line));

    if (items.length >= 2) {
      const parent: Todo = {
        id: baseId,
        title: parentTitle,
        completed: false,
        sortOrder: 0,
        createdAt,
      };
      const children: Todo[] = items.map((subTitle, index) => ({
        id: `${baseId}-sub-${index}`,
        title: subTitle,
        completed: false,
        parentId: baseId,
        sortOrder: index,
        createdAt,
      }));
      return [parent, ...children];
    }
  }

  if (subTitles.length === 0) {
    const todoTitle = trimmedTitle || plainLines[0] || lines[0];
    const todoContent = trimmedTitle
      ? (plainLines.length > 0 ? plainLines.join('\n') : undefined)
      : (plainLines.length > 1 ? plainLines.slice(1).join('\n') : undefined);

    return [{
      id: baseId,
      title: todoTitle,
      content: todoContent,
      completed: false,
      sortOrder: 0,
      createdAt,
    }];
  }

  const parentTitle = trimmedTitle || plainLines[0] || 'Todo list';
  const parentContent = trimmedTitle
    ? (plainLines.length > 0 ? plainLines.join('\n') : undefined)
    : (plainLines.length > 1 ? plainLines.slice(1).join('\n') : undefined);

  const parent: Todo = {
    id: baseId,
    title: parentTitle,
    content: parentContent,
    completed: false,
    sortOrder: 0,
    createdAt,
  };

  const children: Todo[] = subTitles.map((subTitle, index) => ({
    id: `${baseId}-sub-${index}`,
    title: subTitle,
    completed: false,
    parentId: baseId,
    sortOrder: index,
    createdAt,
  }));

  return [parent, ...children];
}