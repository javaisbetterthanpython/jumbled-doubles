/**
 * Simulation harness measuring partner-variety quality of round generation.
 *
 * Metrics are computed directly from the generated rounds (implementation
 * independent), so this same harness measures any algorithm behind
 * getNextBestRound.
 *
 * BASELINE (upstream heuristics.ts algorithm, recorded 2026-07-12 before the
 * rewrite, 10 runs each) vs REWRITE (same harness, same day):
 *
 *                        worstMaxPartner   exactRematches   wall time
 *   N=8  c=2 10 rounds:  2 → 2             0.2 → 0
 *   N=9  c=2 10 rounds:  2 → 2             0.1 → 0
 *   N=10 c=2 10 rounds:  2 → 1             0   → 0
 *   N=12 c=3 10 rounds:  2 → 2             0   → 0
 *   N=16 c=4 10 rounds:  1 → 1             0   → 0
 *   N=12 c=2 10 rounds:  1 → 1             0   → 0
 *   N=16 c=3 10 rounds:  1 → 1             0   → 0
 *   N=8  c=2 20 rounds:  4 → 3 (optimal)   2.7 → 0
 *   N=9  c=2 20 rounds:  3 → 3             0.6 → 0
 *   Whole suite: 74s → 19s (~400ms → ~10ms per round at N=16).
 *
 * The long-session rows are the user-visible fix: with the old algorithm a
 * pair could partner 4 times in 20 rounds while others partnered twice, and
 * the exact same match (same four players, same teams) replayed ~2.7 times
 * per session. The rewrite is optimal on both. The old algorithm also flaked
 * its own unit tests ("no repeated partners before full cycle", 5-player
 * perfect variety); the rewrite passes them deterministically (5×33 green).
 */
import { getNextBestRound } from "../src/matching";
import { minWeightMatching } from "../src/matching/matching";
import { Match, PlayerId, Round, Team } from "../src/matching/types";

const RUNS = 10;
const ROUNDS = 10;

const teamKey = (team: Team) => [...team].sort().join("+");
const matchKey = (match: Match) =>
  match
    .map((team) => teamKey(team))
    .sort()
    .join(" vs ");

type Metrics = {
  /** Most times any single pair of players partnered. */
  maxPartnerCount: number;
  /** Total partner repeats: sum over pairs of (timesPartnered - 1). */
  repeatEvents: number;
  /** Fraction of rounds (after the first) repeating any partnership from the previous 3 rounds. */
  repeatWithin3Rate: number;
  /** Matches identical to an earlier match (same four players, same team split). */
  exactRematches: number;
  /** max - min sit-out count across players (fairness check). */
  sitOutSpread: number;
  /**
   * Repeat pairings in rounds where a zero-repeat perfect matching of the
   * same active players existed (verified with the exact matcher) — repeats
   * that better shuffling would have avoided.
   */
  prematureRepeats: number;
};

function measure(rounds: Round[], players: PlayerId[]): Metrics {
  const partnerCounts = new Map<string, number>();
  const matchCounts = new Map<string, number>();
  const sitOutCounts = new Map<string, number>(players.map((p) => [p, 0]));

  let repeatWithin3 = 0;
  let exactRematches = 0;
  let prematureRepeats = 0;

  rounds.forEach((round, index) => {
    // Premature-repeat check against history BEFORE this round.
    const active = round.matches.flatMap((match) => match.flat());
    const repeatsThisRound = round.matches
      .flatMap((match) => match.map(teamKey))
      .filter((key) => (partnerCounts.get(key) || 0) > 0).length;
    if (repeatsThisRound > 0) {
      const zeroRepeatPossible =
        minWeightMatching(active, (a, b) =>
          (partnerCounts.get(teamKey([a, b] as Team)) || 0) > 0 ? 1 : 0
        ).reduce(
          (sum, [a, b]) =>
            sum + ((partnerCounts.get(teamKey([a, b] as Team)) || 0) > 0 ? 1 : 0),
          0
        ) === 0;
      if (zeroRepeatPossible) prematureRepeats += repeatsThisRound;
    }
    const recentTeams = new Set(
      rounds
        .slice(Math.max(0, index - 3), index)
        .flatMap((r) => r.matches.flatMap((match) => match.map(teamKey)))
    );
    let roundRepeats = false;
    round.matches.forEach((match) => {
      const mKey = matchKey(match);
      exactRematches += matchCounts.get(mKey) ? 1 : 0;
      matchCounts.set(mKey, (matchCounts.get(mKey) || 0) + 1);
      match.forEach((team) => {
        const key = teamKey(team);
        if (recentTeams.has(key)) roundRepeats = true;
        partnerCounts.set(key, (partnerCounts.get(key) || 0) + 1);
      });
    });
    if (index > 0 && roundRepeats) repeatWithin3 += 1;
    round.sitOuts.forEach((p) =>
      sitOutCounts.set(p, (sitOutCounts.get(p) || 0) + 1)
    );
  });

  const counts = [...partnerCounts.values()];
  const sitCounts = [...sitOutCounts.values()];
  return {
    maxPartnerCount: Math.max(...counts),
    repeatEvents: counts.reduce((sum, c) => sum + c - 1, 0),
    repeatWithin3Rate: repeatWithin3 / (rounds.length - 1),
    exactRematches,
    sitOutSpread: Math.max(...sitCounts) - Math.min(...sitCounts),
    prematureRepeats,
  };
}

async function simulate(
  playerCount: number,
  courts: number,
  roundCount: number
): Promise<Metrics> {
  const players = Array.from({ length: playerCount }, (_, i) => `p${i}`);
  const rounds: Round[] = [];
  for (let i = 0; i < roundCount; i++) {
    rounds.push(await getNextBestRound(rounds, players, courts));
  }
  return measure(rounds, players);
}

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;
const roundTo = (value: number, places = 2) =>
  Math.round(value * 10 ** places) / 10 ** places;

describe("partner variety simulation", () => {
  const configs = [
    // Ample courts: sit-outs only from remainder.
    ...[8, 9, 10, 12, 16].map((n) => ({
      players: n,
      courts: Math.floor(n / 4),
      rounds: ROUNDS,
    })),
    // Court-constrained (typical club night): large sit-out rotations.
    { players: 12, courts: 2, rounds: ROUNDS },
    { players: 16, courts: 3, rounds: ROUNDS },
    // Long sessions: repeats are forced; quality = spacing them out.
    { players: 8, courts: 2, rounds: 20 },
    { players: 9, courts: 2, rounds: 20 },
    // Full house: 19 distinct partners exist, so even a 15-round night
    // should produce zero repeat partners (measured: worstMaxPartner 1,
    // ~9ms/round; repeats only become forced from round 20).
    { players: 20, courts: 5, rounds: 15, maxRepeatBar: 1 },
  ];

  for (const { players, courts, rounds, maxRepeatBar } of configs) {
    test(
      `${players} players, ${courts} courts, ${rounds} rounds × ${RUNS} runs`,
      async () => {
        const runs: Metrics[] = [];
        for (let i = 0; i < RUNS; i++) {
          runs.push(await simulate(players, courts, rounds));
        }
        const summary = {
          players,
          courts,
          maxPartnerCount: roundTo(mean(runs.map((r) => r.maxPartnerCount))),
          worstMaxPartnerCount: Math.max(...runs.map((r) => r.maxPartnerCount)),
          repeatEvents: roundTo(mean(runs.map((r) => r.repeatEvents))),
          repeatWithin3Rate: roundTo(
            mean(runs.map((r) => r.repeatWithin3Rate))
          ),
          exactRematches: roundTo(mean(runs.map((r) => r.exactRematches))),
          sitOutSpread: roundTo(mean(runs.map((r) => r.sitOutSpread))),
          prematureRepeats: roundTo(mean(runs.map((r) => r.prematureRepeats))),
          worstPrematureRepeats: Math.max(
            ...runs.map((r) => r.prematureRepeats)
          ),
        };
        // eslint-disable-next-line no-console
        console.log("SIMULATION", JSON.stringify(summary));

        // Fairness must hold under any algorithm.
        expect(Math.max(...runs.map((r) => r.sitOutSpread))).toBeLessThanOrEqual(
          1
        );
        // Calibrated on the rewrite (see header table): repeats stay at the
        // pigeonhole optimum and identical matches essentially never replay.
        expect(summary.worstMaxPartnerCount).toBeLessThanOrEqual(
          maxRepeatBar ?? (rounds > 10 ? 3 : 2)
        );
        expect(summary.exactRematches).toBeLessThanOrEqual(0.5);
        expect(summary.prematureRepeats).toBeLessThanOrEqual(0.5);
      },
      300_000
    );
  }
});
