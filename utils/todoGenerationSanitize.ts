import { TodoGenerationResult } from '../types';
import { applyTodoGenerationInvariants, stripParentTitleBeforeIncluding } from './todoGenerationInvariants';

export { stripParentTitleBeforeIncluding };

/** Final gate for AI and local todo trees — enforces shared invariants only. */
export function sanitizeTodoGeneration(
  capture: { title: string; content: string },
  result: TodoGenerationResult
): TodoGenerationResult {
  return applyTodoGenerationInvariants(capture, result);
}