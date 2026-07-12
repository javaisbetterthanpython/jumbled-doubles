import { Match, PlayerId, Round } from "./types";

/**
 * Session history digested into fast lookups, rebuilt from the full rounds
 * array on every generation. All matrices are indexed by position in
 * `players` (see `index`); pairs involving removed players are skipped.
 *
 * "last*" values are measured in rounds ago (1 = the previous round) and are
 * `Infinity` when the pair has never met that way.
 */
export type Stats = {
  players: PlayerId[];
  index: Map<PlayerId, number>;
  withCount: number[][];
  lastWith: number[][];
  againstCount: number[][];
  lastAgainst: number[][];
  sitOutCount: number[];
  roundsSinceSitOut: number[];
  matchCounts: Map<string, number>;
};

export const teamKey = (a: PlayerId, b: PlayerId): string =>
  a < b ? `${a}+${b}` : `${b}+${a}`;

/** Identifies a match up to team order and player order within teams. */
export const matchKey = (match: Match): string =>
  match
    .map((team) => teamKey(team[0], team[1]))
    .sort()
    .join(" vs ");

export function buildStats(rounds: Round[], players: PlayerId[]): Stats {
  const n = players.length;
  const index = new Map(players.map((player, i) => [player, i]));
  const zeros = () => players.map(() => new Array<number>(n).fill(0));
  const never = () => players.map(() => new Array<number>(n).fill(Infinity));

  const withCount = zeros();
  const lastWith = never();
  const againstCount = zeros();
  const lastAgainst = never();
  const sitOutCount = new Array<number>(n).fill(0);
  const roundsSinceSitOut = new Array<number>(n).fill(Infinity);
  const matchCounts = new Map<string, number>();

  // Late joiners are credited with virtual sit-outs so they don't immediately
  // sit out (they just arrived) but also don't get to skip the rotation
  // forever. A player first seen after round 0 starts at one more sit-out
  // than the least-rested player seen so far. (Ported from upstream, with a
  // finite floor of 0 when nobody has sat out yet — upstream used Infinity,
  // which excluded the late joiner from sitting out for the whole session.)
  const seen = new Set<PlayerId>();
  const runningSitOuts = new Map<PlayerId, number>();
  const lateJoiners = new Set<PlayerId>();
  const see = (player: PlayerId, roundIndex: number) => {
    if (seen.has(player)) return;
    if (roundIndex > 0) {
      // Least-rested is the min over ALL players seen so far — players who
      // have never sat out count as 0, otherwise an early-session joiner
      // would be credited an extra rotation at the regulars' expense.
      const counts = [...seen].map((p) => runningSitOuts.get(p) ?? 0);
      const least = counts.length ? Math.min(...counts) : 0;
      runningSitOuts.set(player, least + 1);
      lateJoiners.add(player);
    }
    seen.add(player);
  };

  rounds.forEach((round, roundIndex) => {
    const roundsAgo = rounds.length - roundIndex;
    round.sitOuts.forEach((player) => {
      see(player, roundIndex);
      runningSitOuts.set(player, (runningSitOuts.get(player) ?? 0) + 1);
      const i = index.get(player);
      if (i === undefined) return;
      sitOutCount[i] += 1;
      roundsSinceSitOut[i] = roundsAgo;
    });
    round.matches.forEach((match) => {
      const key = matchKey(match);
      matchCounts.set(key, (matchCounts.get(key) ?? 0) + 1);
      match.forEach(([a, b]) => {
        see(a, roundIndex);
        see(b, roundIndex);
        const i = index.get(a);
        const j = index.get(b);
        if (i === undefined || j === undefined) return;
        withCount[i][j] += 1;
        withCount[j][i] += 1;
        lastWith[i][j] = roundsAgo;
        lastWith[j][i] = roundsAgo;
      });
      const [teamA, teamB] = match;
      teamA.forEach((a) => {
        teamB.forEach((b) => {
          const i = index.get(a);
          const j = index.get(b);
          if (i === undefined || j === undefined) return;
          againstCount[i][j] += 1;
          againstCount[j][i] += 1;
          lastAgainst[i][j] = roundsAgo;
          lastAgainst[j][i] = roundsAgo;
        });
      });
    });
  });

  // Players joining right now (present in the roster, absent from history)
  // are late joiners too when any rounds have been played.
  players.forEach((player) => see(player, rounds.length));
  players.forEach((player) => {
    if (!lateJoiners.has(player)) return;
    const i = index.get(player)!;
    sitOutCount[i] = runningSitOuts.get(player) ?? sitOutCount[i];
  });

  return {
    players,
    index,
    withCount,
    lastWith,
    againstCount,
    lastAgainst,
    sitOutCount,
    roundsSinceSitOut,
    matchCounts,
  };
}
