import { PlayerId, Team } from "./matching/types";

/**
 * Pure helpers for managing fixed pairs (two players linked as permanent
 * partners for a session). Pairs are stored as [a, b] tuples; a player can be
 * in at most one pair. The generic helpers work both for id-based pairs
 * (in-game) and index-based pairs (the new-game form, where players have no
 * ids yet).
 */

/**
 * Drop pairs that reference absent players, pair someone with themselves, or
 * would put a player in two pairs (first pair wins).
 */
export function sanitizePairs(pairs: Team[], players: PlayerId[]): Team[] {
  const present = new Set(players);
  const seen = new Set<PlayerId>();
  const result: Team[] = [];
  for (const [a, b] of pairs) {
    if (a === b || !present.has(a) || !present.has(b)) continue;
    if (seen.has(a) || seen.has(b)) continue;
    seen.add(a);
    seen.add(b);
    result.push([a, b]);
  }
  return result;
}

export function partnerOf<T>(item: T, pairs: [T, T][]): T | undefined {
  for (const [a, b] of pairs) {
    if (a === item) return b;
    if (b === item) return a;
  }
  return undefined;
}

/**
 * State machine behind the link (🔗) button:
 * - clicking a paired item breaks its pair;
 * - clicking an unpaired item starts linking (or cancels, when it was already
 *   the pending selection);
 * - clicking a second unpaired item completes the pair.
 */
export function togglePairLink<T>(
  pairs: [T, T][],
  linking: T | null,
  clicked: T
): { pairs: [T, T][]; linking: T | null } {
  if (pairs.some((pair) => pair.includes(clicked))) {
    return {
      pairs: pairs.filter((pair) => !pair.includes(clicked)),
      linking,
    };
  }
  if (linking === null) return { pairs, linking: clicked };
  if (linking === clicked) return { pairs, linking: null };
  return {
    pairs: [
      ...pairs.filter((pair) => !pair.includes(linking)),
      [linking, clicked],
    ],
    linking: null,
  };
}

/**
 * For index-based pairs: remove pairs containing the deleted index and shift
 * higher indices down by one.
 */
export function removeIndexFromPairs(
  pairs: [number, number][],
  index: number
): [number, number][] {
  return pairs
    .filter((pair) => !pair.includes(index))
    .map(
      ([a, b]) =>
        [a > index ? a - 1 : a, b > index ? b - 1 : b] as [number, number]
    );
}

/**
 * Keep a checkbox selection consistent with "pairs sit out together": when a
 * paired player is (de)selected, their partner follows.
 */
export function syncPairSelection(
  previous: PlayerId[],
  next: PlayerId[],
  pairs: Team[]
): PlayerId[] {
  const result = new Set(next);
  const previousSet = new Set(previous);
  for (const id of next) {
    if (!previousSet.has(id)) {
      const partner = partnerOf(id, pairs);
      if (partner) result.add(partner);
    }
  }
  for (const id of previous) {
    if (!next.includes(id)) {
      const partner = partnerOf(id, pairs);
      if (partner) result.delete(partner);
    }
  }
  return [...result];
}
