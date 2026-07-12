import { getNextBestRound } from "../src/matching";
import { normalizeFixedPairs } from "../src/matching/fixedPairs";
import { PlayerId, Round, Team } from "../src/matching/types";

const names = (count: number) =>
  Array.from({ length: count }, (_, i) => `p${i}`);

const generateRounds = async (
  players: PlayerId[],
  courts: number,
  count: number,
  fixedPairs: Team[]
) => {
  const rounds: Round[] = [];
  for (let i = 0; i < count; i++) {
    rounds.push(
      await getNextBestRound(rounds, players, courts, [], fixedPairs)
    );
  }
  return rounds;
};

/** Assert every round keeps each pair together: same team, or both sitting. */
const expectPairsIntact = (rounds: Round[], fixedPairs: Team[]) => {
  rounds.forEach((round) => {
    fixedPairs.forEach(([a, b]) => {
      const aSits = round.sitOuts.includes(a);
      const bSits = round.sitOuts.includes(b);
      expect(aSits).toBe(bSits);
      if (aSits) return;
      const team = round.matches
        .flatMap((match) => match)
        .find((t) => t.includes(a));
      expect(team).toBeDefined();
      expect(team).toContain(b);
    });
  });
};

const sitOutCounts = (rounds: Round[], players: PlayerId[]) => {
  const counts = new Map<PlayerId, number>(players.map((p) => [p, 0]));
  rounds.forEach(({ sitOuts }) =>
    sitOuts.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1))
  );
  return counts;
};

describe("fixed pairs", () => {
  test("normalizeFixedPairs drops stale pairs and rejects overlaps", () => {
    expect(
      normalizeFixedPairs(
        [
          ["a", "b"],
          ["c", "gone"],
          ["d", "d"],
        ],
        ["a", "b", "c", "d"]
      )
    ).toEqual([["a", "b"]]);
    expect(() =>
      normalizeFixedPairs(
        [
          ["a", "b"],
          ["b", "c"],
        ],
        ["a", "b", "c", "d"]
      )
    ).toThrow(/multiple fixed pairs/);
  });

  test("pairs never split across a long session", async () => {
    const players = names(10);
    const fixedPairs: Team[] = [
      ["p0", "p1"],
      ["p2", "p3"],
    ];
    const rounds = await generateRounds(players, 2, 12, fixedPairs);
    expectPairsIntact(rounds, fixedPairs);
    // Sit-out fairness holds for everyone, pairs included (10 players on
    // 2 courts: 2 sit per round, 24 sit-outs over 12 rounds = 2.4 average).
    const counts = [...sitOutCounts(rounds, players).values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  }, 120_000);

  test("volunteer pulls fixed partner", async () => {
    const players = names(10);
    const fixedPairs: Team[] = [["p0", "p1"]];
    const round = await getNextBestRound([], players, 2, ["p0"], fixedPairs);
    expect(round.sitOuts).toContain("p0");
    expect(round.sitOuts).toContain("p1");
  });

  test("pair skipped when a single slot remains", async () => {
    // 9 players on 2 courts: exactly one sit-out per round, so the pair can
    // never sit; singles rotate fairly among themselves.
    const players = names(9);
    const fixedPairs: Team[] = [["p0", "p1"]];
    const rounds = await generateRounds(players, 2, 9, fixedPairs);
    expectPairsIntact(rounds, fixedPairs);
    const counts = sitOutCounts(rounds, players);
    expect(counts.get("p0")).toBe(0);
    expect(counts.get("p1")).toBe(0);
    const singles = players.filter((p) => p !== "p0" && p !== "p1");
    const singleCounts = singles.map((p) => counts.get(p)!);
    expect(Math.max(...singleCounts) - Math.min(...singleCounts)).toBeLessThanOrEqual(1);
  }, 60_000);

  test("all players paired still terminates and rotates", async () => {
    // 8 players in 4 fixed pairs on 1 court: two pairs sit each round.
    const players = names(8);
    const fixedPairs: Team[] = [
      ["p0", "p1"],
      ["p2", "p3"],
      ["p4", "p5"],
      ["p6", "p7"],
    ];
    const rounds = await generateRounds(players, 1, 6, fixedPairs);
    expectPairsIntact(rounds, fixedPairs);
    const counts = [...sitOutCounts(rounds, players).values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    // With 4 pairs, 6 rounds and 2 playing per round there are 6 possible
    // pair-vs-pair matches; variety should cover most of them.
    const uniqueMatches = new Set(
      rounds.flatMap((round) =>
        round.matches.map((match) =>
          match
            .map((team) => [...team].sort().join("+"))
            .sort()
            .join(" vs ")
        )
      )
    );
    expect(uniqueMatches.size).toBeGreaterThanOrEqual(5);
  }, 60_000);

  test("two pairs only (degenerate) returns the only possible round", async () => {
    const players = names(4);
    const fixedPairs: Team[] = [
      ["p0", "p1"],
      ["p2", "p3"],
    ];
    const rounds = await generateRounds(players, 1, 3, fixedPairs);
    expectPairsIntact(rounds, fixedPairs);
    rounds.forEach((round) => {
      expect(round.matches).toHaveLength(1);
      expect(round.sitOuts).toHaveLength(0);
    });
  }, 30_000);

  test("singles' variety is not degraded by the pair", async () => {
    // 12 players, 1 pair: the 10 singles should still avoid repeating
    // partners while unpartnered singles remain.
    const players = names(12);
    const fixedPairs: Team[] = [["p0", "p1"]];
    const rounds = await generateRounds(players, 3, 9, fixedPairs);
    expectPairsIntact(rounds, fixedPairs);
    const counts = new Map<string, number>();
    rounds.forEach(({ matches }) =>
      matches.forEach((match) =>
        match.forEach((team) => {
          const key = [...team].sort().join("+");
          if (key === "p0+p1") return;
          counts.set(key, (counts.get(key) || 0) + 1);
        })
      )
    );
    // 9 rounds: each single partners ≤9 times over 9 distinct candidates.
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  }, 60_000);
});
