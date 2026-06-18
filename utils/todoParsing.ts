import { Todo } from '../types';

const BULLET_LINE_PATTERN = /^([-*•]|\d+[.)])\s+(.+)$/;

export function parseTodosFromCapture(title: string, content: string): Todo[] {
  const trimmedContent = content.trim();
  const trimmedTitle = title.trim();
  if (!trimmedContent) {
    return [];
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