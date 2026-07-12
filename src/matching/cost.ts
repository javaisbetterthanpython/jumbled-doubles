import { matchKey, Stats, teamKey } from "./stats";
import { Match, PlayerId, Team } from "./types";

/**
 * Cost design. Each matching phase minimizes a scalar whose terms live on
 * separated scales, so higher-priority terms can never be outvoted by
 * lower-priority ones:
 *
 * Partner phase (per pair of players):
 *   1000 · withCount²  +  recency(lastWith)          — recency sums to at most
 *   ~20 across a whole round (≤20 teams × ≤1), far below the 1000 quantum of a
 *   single extra repeat. A never-repeated matching always beats any repeat.
 *   withCount² is convex: a pair partnering a 2nd time (Δ4) costs more than
 *   two pairs partnering a 1st repeat each (Δ1+Δ1), so unavoidable repeats
 *   spread out instead of clustering on one pair.
 *
 * Opponent phase (per pair of teams):
 *   1,000,000 · rematch²  +  100 · Σ againstCount²  +  Σ recency(lastAgainst)
 *   — exact rematches (same four players, same split) dominate; opponent
 *   spread dominates opponent recency (max cross term 4·30²·100 = 360,000 <
 *   1,000,000; max recency term 4 < 100).
 */
const RECENCY_WINDOW = 8;
const COUNT_CAP = 30;
const REMATCH_CAP = 10;

/** 1.0 when it happened last round, fading linearly to 0 beyond the window. */
export const recency = (roundsAgo: number): number =>
  roundsAgo === Infinity
    ? 0
    : Math.max(0, (RECENCY_WINDOW + 1 - roundsAgo) / RECENCY_WINDOW);

/**
 * With `jitter`, every repeated pair costs a uniformly random amount
 * regardless of how often it repeated, while fresh pairs stay at (near) zero
 * cost. Jittered candidates therefore sample uniformly among repeat
 * structures without ever displacing a fresh partnership. The round-level
 * lexicographic score is the gatekeeper: it only accepts a jittered candidate
 * when it genuinely ranks better (e.g., trading a less balanced split for
 * avoiding an exact rematch once repeats are unavoidable — a candidate the
 * strictly optimal matching would never emit).
 */
export const makePartnerCost =
  (stats: Stats, jitter = false) =>
  (a: PlayerId, b: PlayerId): number => {
    const i = stats.index.get(a)!;
    const j = stats.index.get(b)!;
    const count = Math.min(stats.withCount[i][j], COUNT_CAP);
    // Prefer partnering someone never (or least recently) seen at all —
    // partner or opponent. Capped at 0.1, below the 1/8 recency quantum, so
    // it only breaks ties between otherwise equivalent partners; it is what
    // lets a group meet everyone quickly (partnering is a way of meeting).
    const lastSeen = Math.min(stats.lastWith[i][j], stats.lastAgainst[i][j]);
    const seenCost =
      lastSeen === Infinity ? 0 : 0.02 + 0.08 * recency(lastSeen);
    if (jitter) {
      return count > 0
        ? 1000 * Math.random() + recency(stats.lastWith[i][j]) + seenCost
        : recency(stats.lastWith[i][j]) + seenCost;
    }
    return 1000 * count * count + recency(stats.lastWith[i][j]) + seenCost;
  };

export const makeMatchCost =
  (stats: Stats) =>
  (teamA: Team, teamB: Team): number => {
    const rematches = Math.min(
      stats.matchCounts.get(matchKey([teamA, teamB])) ?? 0,
      REMATCH_CAP
    );
    let spread = 0;
    let recent = 0;
    for (const a of teamA) {
      for (const b of teamB) {
        const i = stats.index.get(a)!;
        const j = stats.index.get(b)!;
        const against = Math.min(stats.againstCount[i][j], COUNT_CAP);
        spread += against * against;
        recent += recency(stats.lastAgainst[i][j]);
      }
    }
    return 1_000_000 * rematches * rematches + 100 * spread + recent;
  };

/**
 * Whole-round quality as a lexicographic tuple — the priority order in one
 * place, immune to weight arithmetic:
 *   [exact rematches, partner repeats, partner recency, opponent spread,
 *    opponent recency]
 *
 * Rematches lead, but this does NOT demote partner variety: a match whose two
 * teams are both first-time pairings cannot be an exact rematch, so whenever
 * zero-repeat rounds exist (the common case) the first two keys agree. The
 * orderings only diverge once partner repeats are mathematically forced
 * (small groups, long sessions) — and there, replaying an identical game is
 * the most noticeable duplicate of all, worse than an imperfectly balanced
 * fresh match. Ranking anything above rematches in that regime makes the
 * generator deterministically replay the oldest game (observed: 5 players /
 * 15 rounds collapsing to 5 unique matches).
 *
 * Sit-out fairness never appears here: it is enforced upstream as a hard
 * constraint. Fixed pairs are exempt from the partner terms.
 */
export type RoundScore = [number, number, number, number, number];

export const scoreRound = (
  teams: Team[],
  matches: Match[],
  stats: Stats,
  fixedKeys: Set<string>
): RoundScore => {
  let partnerRepeats = 0;
  let partnerRecency = 0;
  for (const [a, b] of teams) {
    if (fixedKeys.has(teamKey(a, b))) continue;
    const i = stats.index.get(a)!;
    const j = stats.index.get(b)!;
    partnerRepeats += stats.withCount[i][j] ** 2;
    partnerRecency += recency(stats.lastWith[i][j]);
  }
  let rematches = 0;
  let opponentSpread = 0;
  let opponentRecency = 0;
  for (const [teamA, teamB] of matches) {
    const count = stats.matchCounts.get(matchKey([teamA, teamB])) ?? 0;
    rematches += count * count;
    for (const a of teamA) {
      for (const b of teamB) {
        const i = stats.index.get(a)!;
        const j = stats.index.get(b)!;
        opponentSpread += stats.againstCount[i][j] ** 2;
        opponentRecency += recency(stats.lastAgainst[i][j]);
      }
    }
  }
  return [
    rematches,
    partnerRepeats,
    partnerRecency,
    opponentSpread,
    opponentRecency,
  ];
};

/** Negative when a is better (lower) than b, lexicographically. */
export const compareScores = (a: number[], b: number[]): number => {
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) return a[k] - b[k];
  }
  return 0;
};
