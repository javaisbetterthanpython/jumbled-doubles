import { Stats } from "./stats";
import { PlayerId, Team } from "./types";

/**
 * A unit is the atom of sit-out selection: a lone player, or a fixed pair
 * that enters and leaves the court together.
 */
export type Unit = { members: PlayerId[] };

/**
 * Drop pairs that reference absent players or pair someone with themselves
 * (stale cached state); reject rosters where one player is in two pairs.
 */
export function normalizeFixedPairs(
  fixedPairs: Team[],
  players: PlayerId[]
): Team[] {
  const present = new Set(players);
  const kept = fixedPairs.filter(
    ([a, b]) => a !== b && present.has(a) && present.has(b)
  );
  const seen = new Set<PlayerId>();
  for (const pair of kept) {
    for (const player of pair) {
      if (seen.has(player)) {
        throw new Error(`Player ${player} appears in multiple fixed pairs`);
      }
      seen.add(player);
    }
  }
  return kept;
}

export function buildUnits(players: PlayerId[], fixedPairs: Team[]): Unit[] {
  const paired = new Set(fixedPairs.flat());
  return [
    ...fixedPairs.map((pair) => ({ members: [...pair] })),
    ...players
      .filter((player) => !paired.has(player))
      .map((player) => ({ members: [player] })),
  ];
}

/**
 * Sit-out policy for fixed pairs, isolated so the product decision "pairs sit
 * out together" can be revisited in one place.
 *
 * A pair is owed a sit-out only when BOTH members are owed one (max of the
 * members' counts): sitting the pair charges both members, so using the max
 * never lets a pair member fall behind the singles' rotation.
 */
export const sitOutPolicy = {
  /** Fairness key for unit ordering (lower sits out sooner). */
  unitSitOutCount: (unit: Unit, stats: Stats): number =>
    Math.max(
      ...unit.members.map((m) => stats.sitOutCount[stats.index.get(m)!])
    ),
  /** A volunteer's fixed partner volunteers with them. */
  volunteerPullsPartner: true,
};
