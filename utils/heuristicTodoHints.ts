import { TodoGenerationDraft } from '../types';
import { mapTodosToGenerationDrafts } from './captureJobs';
import { parseTodosFromCapture } from './todoParsing';

export interface HeuristicTodoHints {
  todos: TodoGenerationDraft[];
  confidence: 'low';
  note: string;
}

export function buildHeuristicTodoHints(
  title: string,
  content: string,
  referenceDate = new Date()
): HeuristicTodoHints {
  const todos = parseTodosFromCapture(title, content, referenceDate);

  return {
    todos: mapTodosToGenerationDrafts(todos),
    confidence: 'low',
    note: 'Machine-generated guess from local heuristics. Often wrong on parent titles and edge cases. Override freely using capture text.',
  };
}