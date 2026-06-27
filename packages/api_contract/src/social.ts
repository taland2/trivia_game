import { z } from "zod";
import { IdempotencyKeySchema } from "./common.js";

// Account & social callable shapes (doc 07 §2.1, GDD §10.1). The social graph
// (friendships, usernames, requests, invites, blocks) is integrity data —
// EVERY mutation goes through a Cloud Function (guardrail #1); clients only ever
// READ the projections these callables write. Phase 8a covers the emulator-first
// graph; Google/Apple sign-in + guest merge + invite deep-link delivery are 8b.

// @username (GDD §10.1): lowercase, 3–20 chars, [a-z0-9_]. The display @ is a UI
// affordance; the stored handle is bare. Server normalizes the claim request
// before validating against this (so the request schema is looser, below).
export const UsernameSchema = z.string().regex(/^[a-z0-9_]{3,20}$/);

// --- username claim / search ---------------------------------------------------

export const ClaimUsernameRequestSchema = z
  .object({
    // Looser than UsernameSchema: the server lowercases/trims then validates, so a
    // mixed-case input isn't a contract failure. Bounded to block blob abuse.
    username: z.string().min(1).max(40),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
export type ClaimUsernameRequest = z.infer<typeof ClaimUsernameRequestSchema>;

export const ClaimUsernameResponseSchema = z
  .object({ ok: z.literal(true), username: UsernameSchema })
  .strict();
export type ClaimUsernameResponse = z.infer<typeof ClaimUsernameResponseSchema>;

export const SearchUsernameRequestSchema = z
  .object({ query: z.string().min(1).max(20) })
  .strict();
export type SearchUsernameRequest = z.infer<typeof SearchUsernameRequestSchema>;

// A search hit — the public subset of a profile (no xp/stats/blocked). Returned
// through the callable response, so a non-friend's profile never reaches the
// client via a Firestore listener (rules only widen reads to friends).
export const UserSearchResultSchema = z
  .object({
    uid: z.string().min(1),
    username: UsernameSchema,
    displayName: z.string(),
    avatarId: z.number().int().min(0),
  })
  .strict();
export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;

export const SearchUsernameResponseSchema = z
  .object({ results: z.array(UserSearchResultSchema).max(10) })
  .strict();
export type SearchUsernameResponse = z.infer<typeof SearchUsernameResponseSchema>;

// --- friend requests -----------------------------------------------------------

export const FriendRequestStateSchema = z.enum(["pending", "accepted", "declined"]);
export type FriendRequestState = z.infer<typeof FriendRequestStateSchema>;

export const SendFriendRequestRequestSchema = z
  .object({ toUid: z.string().min(1), idempotencyKey: IdempotencyKeySchema })
  .strict();
export type SendFriendRequestRequest = z.infer<typeof SendFriendRequestRequestSchema>;

export const SendFriendRequestResponseSchema = z
  .object({
    ok: z.literal(true),
    // "pending" normally; "accepted" when a reverse request existed (auto-accept).
    state: FriendRequestStateSchema,
  })
  .strict();
export type SendFriendRequestResponse = z.infer<typeof SendFriendRequestResponseSchema>;

export const RespondFriendRequestRequestSchema = z
  .object({
    requestId: z.string().min(1),
    accept: z.boolean(),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
export type RespondFriendRequestRequest = z.infer<
  typeof RespondFriendRequestRequestSchema
>;

export const RespondFriendRequestResponseSchema = z
  .object({ ok: z.literal(true), state: FriendRequestStateSchema })
  .strict();
export type RespondFriendRequestResponse = z.infer<
  typeof RespondFriendRequestResponseSchema
>;

// --- invite codes (callables; deep-link delivery is Phase 8b) -------------------

export const IssueInviteCodeRequestSchema = z
  .object({ idempotencyKey: IdempotencyKeySchema })
  .strict();
export type IssueInviteCodeRequest = z.infer<typeof IssueInviteCodeRequestSchema>;

export const IssueInviteCodeResponseSchema = z
  .object({ code: z.string().length(8), link: z.string().url() })
  .strict();
export type IssueInviteCodeResponse = z.infer<typeof IssueInviteCodeResponseSchema>;

export const RedeemInviteCodeRequestSchema = z
  .object({ code: z.string().length(8), idempotencyKey: IdempotencyKeySchema })
  .strict();
export type RedeemInviteCodeRequest = z.infer<typeof RedeemInviteCodeRequestSchema>;

export const RedeemInviteCodeResponseSchema = z
  .object({
    friendUid: z.string().min(1),
    // Present when an auto-duel vs the inviter was created (same language + under
    // caps, doc 05 §5). Absent if skipped — the friendship is created regardless.
    autoMatchId: z.string().min(1).optional(),
  })
  .strict();
export type RedeemInviteCodeResponse = z.infer<typeof RedeemInviteCodeResponseSchema>;

// --- uid-target mutations: unfriend / block / unblock --------------------------

export const UidTargetRequestSchema = z
  .object({ uid: z.string().min(1), idempotencyKey: IdempotencyKeySchema })
  .strict();
export type UidTargetRequest = z.infer<typeof UidTargetRequestSchema>;

export const OkResponseSchema = z.object({ ok: z.literal(true) }).strict();
export type OkResponse = z.infer<typeof OkResponseSchema>;

// --- onboarding / account deletion ---------------------------------------------

export const CompleteOnboardingRequestSchema = z
  .object({
    displayName: z.string().min(1).max(24).optional(),
    avatarId: z.number().int().min(1).max(24).optional(),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
export type CompleteOnboardingRequest = z.infer<
  typeof CompleteOnboardingRequestSchema
>;

export const CompleteOnboardingResponseSchema = z
  .object({
    displayName: z.string(),
    avatarId: z.number().int().min(0),
    username: UsernameSchema.nullable(),
  })
  .strict();
export type CompleteOnboardingResponse = z.infer<
  typeof CompleteOnboardingResponseSchema
>;

// The fixed confirmation token the client sends after a localized confirm dialog.
// A constant gate (not a ⚖️ balance value); the full deletion/PII flow is Gate C.
export const DELETE_ACCOUNT_CONFIRM = "DELETE";

export const DeleteAccountRequestSchema = z
  .object({
    confirmPhrase: z.literal(DELETE_ACCOUNT_CONFIRM),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
