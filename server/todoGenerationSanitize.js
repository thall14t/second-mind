const {
  applyTodoGenerationInvariants,
  stripParentTitleBeforeIncluding,
} = require('./todoGenerationInvariants');

function sanitizeTodoGeneration(capture, result) {
  return applyTodoGenerationInvariants(capture, result);
}

module.exports = {
  sanitizeTodoGeneration,
  stripParentTitleBeforeIncluding,
};