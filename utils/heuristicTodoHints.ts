import { HeuristicTodoHints } from '../types';
import { mapTodosToGenerationDrafts } from './captureJobs';
import { parseTodosFromCapture } from './todoParsing';

export function buildHeuristicTodoHints(
  title: string,
  content: string,
  referenceDate = new Date()
): HeuristicTodoHints {
  const todos = parseTodosFromCapture(title, content, referenceDate);

  return {
    todos: mapTodosToGenerationDrafts(todos),
    confidence: 'low',
    scope: 'list_shapes_only',
    note:
      'Narrow offline parser only: bullets, numbered lines, comma lists, and simple '
      + '"need to X including Y, Z" clauses. Prose grouping and multi-project interpretation '
      + 'are AI responsibilities. Override freely using capture text.',
  };
}