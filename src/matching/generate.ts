import { compareScores, makeMatchCost, makePartnerCost, scoreRound } from "./cost";
import { buildUnits, normalizeFixedPairs } from "./fixedPairs";
import { minWeightMatching, shuffle } from "./matching";
import { buildStats, teamKey } from "./stats";
import { pickSitOuts } from "./sitouts";
import { Match, PlayerId, Round, Team } from "./types";

/**
 * Generate the next round: sample candidate rounds (each = fair sit-outs →
 * min-cost partner matching → min-cost opponent matching), keep the
 * lexicographically best. Candidate sampling explores sit-out tie-breaks and
 * matching ties; when the best round still contains a partner repeat or an
 * exact rematch, sampling escalates because a luckier sit-out split may avoid
 * it entirely.
 *
 * Candidate score = scoreRound's tuple with one extra key spliced in after
 * the partner terms: 1 when a zero-repeat candidate leads to a next round
 * where no zero-repeat matching exists for any sampled sit-out choice (a
 * greedy dead-end), 0 otherwise. It only ever separates otherwise-perfect
 * candidates, steering tight schedules (e.g. 9 players × 9 rounds needing a
 * flawless partner cycle) away from dead-ends one round before they happen.
 */
const MIN_CANDIDATES = 16;
const MAX_CANDIDATES = 32;
const MAX_ESCALATED_CANDIDATES = 200;
const TIME_BUDGET_MS = 800;
const YIELD_EVERY = 8;
const PROBE_SAMPLES = 8;
/** Exact feasibility probing is limited to matcher-exact sizes. */
const PROBE_LIMIT = 16;

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export async function getNextBestRound(
  rounds: Round[],
  players: PlayerId[],
  courts: number,
  volunteerSitouts: PlayerId[] = [],
  fixedPairs: Team[] = []
): Promise<Round> {
  const stats = buildStats(rounds, players);
  const pairs = normalizeFixedPairs(fixedPairs, players);
  const units = buildUnits(players, pairs);
  const fixedKeys = new Set(pairs.map(([a, b]) => teamKey(a, b)));
  const partnerCost = makePartnerCost(stats);
  const jitteredPartnerCost = makePartnerCost(stats, true);
  const matchCost = makeMatchCost(stats);

  /**
   * Would accepting this round leave tomorrow solvable without repeats?
   * Samples a few fairness-valid sit-out choices for the following round and
   * checks each for a zero-repeat perfect matching (exact for ≤16 singles).
   */
  const nextRoundStaysFeasible = (round: Round): boolean => {
    const playedPairs = new Set(
      round.matches.flatMap((match) =>
        match.map(([a, b]) => teamKey(a, b))
      )
    );
    const sitOutCount = [...stats.sitOutCount];
    round.sitOuts.forEach((player) => {
      const i = stats.index.get(player);
      if (i !== undefined) sitOutCount[i] += 1;
    });
    const probeStats = { ...stats, sitOutCount };
    const repeatCost = (a: PlayerId, b: PlayerId) => {
      const i = stats.index.get(a)!;
      const j = stats.index.get(b)!;
      return stats.withCount[i][j] > 0 || playedPairs.has(teamKey(a, b))
        ? 1
        : 0;
    };
    for (let sample = 0; sample < PROBE_SAMPLES; sample++) {
      const { activeUnits } = pickSitOuts(units, probeStats, courts, []);
      const singles = activeUnits
        .filter((unit) => unit.members.length === 1)
        .map((unit) => unit.members[0]);
      if (singles.length > PROBE_LIMIT) return true;
      const matching = minWeightMatching(singles, repeatCost);
      const total = matching.reduce((sum, [a, b]) => sum + repeatCost(a, b), 0);
      if (total === 0) return true;
    }
    return false;
  };

  let best: { round: Round; score: number[] } | null = null;
  const deadline = now() + TIME_BUDGET_MS;

  for (let candidate = 1; ; candidate++) {
    if (candidate % YIELD_EVERY === 0) {
      // A real macrotask yield, so a busy worker can still receive messages.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const { sitOuts, activeUnits } = pickSitOuts(
      units,
      stats,
      courts,
      volunteerSitouts
    );
    const fixedTeams: Team[] = [];
    const singles: PlayerId[] = [];
    for (const unit of activeUnits) {
      if (unit.members.length === 2) {
        fixedTeams.push([unit.members[0], unit.members[1]]);
      } else {
        singles.push(unit.members[0]);
      }
    }

    // Every third candidate explores alternative repeat structures.
    const matchedTeams = minWeightMatching(
      singles,
      candidate % 3 === 0 ? jitteredPartnerCost : partnerCost
    );
    const teams = shuffle([...fixedTeams, ...matchedTeams]);
    const matches: Match[] = minWeightMatching(teams, matchCost);
    const round: Round = { matches, sitOuts };

    const [rematches, partnerRepeats, partnerRecency, spread, oppRecency] =
      scoreRound(teams, matches, stats, fixedKeys);
    const deadEnd =
      partnerRepeats === 0 && !nextRoundStaysFeasible(round) ? 1 : 0;
    const score = [
      rematches,
      partnerRepeats,
      partnerRecency,
      deadEnd,
      spread,
      oppRecency,
    ];

    const comparison = best === null ? -1 : compareScores(score, best.score);
    if (comparison < 0 || (comparison === 0 && Math.random() < 0.5)) {
      best = { round, score };
    }

    const perfect = best!.score
      .slice(0, 4)
      .every((component) => component === 0);
    const escalated = best!.score[0] > 0 || best!.score[1] > 0;
    if (perfect && candidate >= MIN_CANDIDATES) break;
    if (!escalated && candidate >= MAX_CANDIDATES) break;
    if (candidate >= MAX_ESCALATED_CANDIDATES) break;
    if (now() > deadline) break;
  }

  return best!.round;
}
