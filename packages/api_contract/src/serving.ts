import { z } from "zod";
import { DifficultySchema } from "./common.js";

// Served-question payload (doc 07 §2.2).
//
// ANTI-LEAK INVARIANT (doc 06 §4/§5): this is the ONLY question shape the client
// ever receives before answering. It must never gain a field that identifies the
// correct answer — the correct index lives in `servingsPrivate` (function-only).
// `.strict()` makes any extra server-side field a contract violation instead of
// silently passing through.
export const ServingSchema = z
  .object({
    servingId: z.string().min(1),
    qIx: z.number().int().min(0),
    difficulty: DifficultySchema,
    timeLimitMs: z.number().int().positive(),
    text: z.string().min(1),
    answers: z.array(z.string().min(1)).length(4),
  })
  .strict();
export type Serving = z.infer<typeof ServingSchema>;
