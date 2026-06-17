// Deployment region for all callables (doc 07 §1 — me-west1 / Tel Aviv).
//
// NOTE: this is applied PER FUNCTION (onCall({ region: FUNCTIONS_REGION }, …))
// rather than via setGlobalOptions(). In index.ts the `export … from` re-exports
// are hoisted and evaluated before any top-level statement runs, so a
// setGlobalOptions() call there would execute AFTER each onCall() has already
// been defined — too late to take effect. Per-function options avoid that trap.
export const FUNCTIONS_REGION = "me-west1";
