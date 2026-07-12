import { getNextBestRound } from "../src/matching";
import { buildStats } from "../src/matching/stats";
import { PlayerId, Round } from "../src/matching/types";

const sampleRounds: Round[] = [
  {
    matches: [
      [
        ["a", "b"],
        ["c", "d"],
      ],
    ],
    sitOuts: ["e", "f"],
  },
  {
    matches: [
      [
        ["a", "e"],
        ["f", "d"],
      ],
    ],
    sitOuts: ["b", "c"],
  },
  {
    matches: [
      [
        ["b", "e"],
        ["c", "f"],
      ],
    ],
    sitOuts: ["a", "d"],
  },
];

const samplePlayers = ["a", "b", "c", "d", "e", "f"];

const sampleNames = [
  "Tedd",
  "Tan",
  "Adom",
  "Gret",
  "Roland",
  "Lewis",
  "Veronica",
  "Paul",
  "Dan",
  "Frank",
  "Pier",
  "David",
  "Francis",
];

/** partner-count map "a+b" -> times partnered, computed from rounds. */
const partnerCounts = (rounds: Round[]) => {
  const counts = new Map<string, number>();
  rounds.forEach(({ matches }) =>
    matches.forEach((match) =>
      match.forEach((team) => {
        const key = [...team].sort().join("+");
        counts.set(key, (counts.get(key) || 0) + 1);
      })
    )
  );
  return counts;
};

const sitOutCounts = (rounds: Round[], players: PlayerId[]) => {
  const counts = new Map<PlayerId, number>(players.map((p) => [p, 0]));
  rounds.forEach(({ sitOuts }) =>
    sitOuts.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1))
  );
  return counts;
};

const generateRounds = async (
  players: PlayerId[],
  courts: number,
  count: number
) => {
  const rounds: Round[] = [];
  for (let i = 0; i < count; i++) {
    rounds.push(await getNextBestRound(rounds, players, courts));
  }
  return rounds;
};

describe("getNextBestRound()", () => {
  test("next round, strict solution", async () => {
    // a and d are the only players who haven't sat out: fairness forces them.
    const round = await getNextBestRound(
      sampleRounds.slice(0, 2),
      samplePlayers,
      1
    );
    expect(round.sitOuts).toEqual(["a", "d"]);
  });

  test("late player does not sit out first", async () => {
    const everyoneSatOutOnceOrTwice = [...sampleRounds, sampleRounds[0]];
    const newPlayers = [...samplePlayers, "late"];
    const round = await getNextBestRound(everyoneSatOutOnceOrTwice, newPlayers, 1);
    expect(round.sitOuts).not.toContain("late");
    expect(round.sitOuts).toHaveLength(3); // 7 players % 4
  });

  test("random sitouts", async () => {
    // Anyone can sit out when everyone has sat out equally.
    const playersSelectedForSitout = new Set<string>();
    let attempts = 0;
    while (playersSelectedForSitout.size < 6 && attempts < 1000) {
      attempts += 1;
      const round = await getNextBestRound(sampleRounds, samplePlayers, 1);
      round.sitOuts.forEach((sitOut) => playersSelectedForSitout.add(sitOut));
    }
    expect(playersSelectedForSitout).toEqual(new Set(samplePlayers));
  });

  test("no repeated partners before full cycle", async () => {
    // 9 players over 9 rounds: 36 pairings = C(9,2); a perfect schedule with
    // zero repeats exists and must be found.
    const players = sampleNames.slice(0, 9);
    const rounds = await generateRounds(players, 3, 9);
    const repeats = [...partnerCounts(rounds).values()].filter((c) => c > 1);
    expect(repeats).toEqual([]);
  }, 60_000);

  test("low repeated partners after many iterations", async () => {
    const players = sampleNames.slice(0, 9);
    const rounds = await generateRounds(players, 3, 90);
    const counts = partnerCounts(rounds);
    const maxPerPlayer = players.map((player) =>
      Math.max(
        ...players
          .filter((p) => p !== player)
          .map((other) => counts.get([player, other].sort().join("+")) || 0)
      )
    );
    const upperHalf = maxPerPlayer
      .sort((a, b) => a - b)
      .slice(Math.floor(players.length / 2));
    const mean = upperHalf.reduce((a, b) => a + b, 0) / upperHalf.length;
    // 90 rounds × 4 teams = 360 pairings over 36 pairs = 10 each if perfect.
    expect(mean).toBeLessThanOrEqual(12);
  }, 120_000);

  test("low time to see all players", async () => {
    const players = sampleNames.slice(0, 12);
    const rounds: Round[] = [];
    const seen = new Map<PlayerId, Set<PlayerId>>(
      players.map((p) => [p, new Set([p])])
    );
    const everyoneSeenEveryone = () =>
      players.every((p) => seen.get(p)!.size === players.length);
    while (!everyoneSeenEveryone() && rounds.length < 20) {
      const round = await getNextBestRound(rounds, players, 3);
      rounds.push(round);
      round.matches.forEach((match) => {
        const all = match.flat();
        all.forEach((p) => all.forEach((q) => seen.get(p)!.add(q)));
      });
    }
    expect(rounds.length).toBeLessThanOrEqual(players.length * 0.75);
  }, 60_000);

  test("5 players, 5 games", async () => {
    const players = sampleNames.slice(0, 5);
    const rounds = await generateRounds(players, 1, 5);
    const uniqueTeams = new Set<string>();
    const uniqueSits = new Set<string>();
    rounds.forEach(({ matches, sitOuts }) => {
      matches.forEach((match) =>
        match.forEach((team) => uniqueTeams.add([...team].sort().toString()))
      );
      sitOuts.forEach((sit) => uniqueSits.add(sit));
    });
    expect(uniqueSits.size).toEqual(5);
    expect(uniqueTeams.size).toEqual(10);
  }, 60_000);

  test("5 players, 15 games", async () => {
    // The strictest variety case: all 15 possible matches must appear across
    // 15 rounds, every time, across 50 sessions.
    const results = [];
    for (let generation = 0; generation < 50; generation++) {
      const players = sampleNames.slice(0, 5);
      const rounds = await generateRounds(players, 1, 15);
      const uniqueMatches = new Set<string>();
      rounds.forEach(({ matches }) => {
        matches.forEach((match) => {
          const teams = match.map((team) => [...team].sort().join(" "));
          uniqueMatches.add(teams.sort().join(" vs "));
        });
      });
      results.push(uniqueMatches.size);
    }
    expect(Math.min(...results)).toEqual(15);
  }, 240_000);

  test("volunteer 1/2 sit outs", async () => {
    const players = sampleNames.slice(0, 6);
    const sitOut = players[0];
    const round = await getNextBestRound([], players, 1, [sitOut]);
    expect(round.sitOuts).toContain(sitOut);
    expect(round.sitOuts).toHaveLength(2);
    expect(round.sitOuts[0]).not.toEqual(round.sitOuts[1]);
  });

  test("volunteer entire court sit out", async () => {
    const players = sampleNames.slice(0, 13);
    const volunteers = players.slice(0, 4);
    const round = await getNextBestRound([], players, 3, volunteers);
    expect(round.matches).toHaveLength(2);
    expect(round.sitOuts).toHaveLength(5);
    expect(round.sitOuts).toEqual(expect.arrayContaining(volunteers));
  });

  test("sit-out fairness stays within one", async () => {
    for (const playerCount of [5, 6, 7, 9, 10, 13]) {
      const players = sampleNames.slice(0, playerCount);
      const courts = Math.max(1, Math.floor(playerCount / 4));
      const rounds = await generateRounds(players, courts, 20);
      const counts = [...sitOutCounts(rounds, players).values()];
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  }, 240_000);

  test("regenerating gives different rounds", async () => {
    const players = sampleNames.slice(0, 8);
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const round = await getNextBestRound([], players, 2);
      seen.add(JSON.stringify(round.matches.map((m) => m.map((t) => [...t].sort()).sort())));
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  test("court-constrained sessions stay fair and varied", async () => {
    const players = sampleNames.slice(0, 12);
    const rounds = await generateRounds(players, 2, 12);
    const sitCounts = [...sitOutCounts(rounds, players).values()];
    expect(Math.max(...sitCounts) - Math.min(...sitCounts)).toBeLessThanOrEqual(1);
    // 12 rounds × 4 pairings on 2 courts = 48 pairings over 66 pairs: no pair
    // should ever be forced to repeat more than twice.
    const counts = partnerCounts(rounds);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  }, 60_000);

  test("performance: full night at scale", async () => {
    // 40 players, 10 courts, 30 rounds of history: generation must stay fast.
    const players = Array.from({ length: 40 }, (_, i) => `p${i}`);
    const rounds: Round[] = [];
    for (let i = 0; i < 30; i++) {
      rounds.push(await getNextBestRound(rounds, players, 10));
    }
    const start = Date.now();
    await getNextBestRound(rounds, players, 10);
    expect(Date.now() - start).toBeLessThan(2000);
  }, 240_000);

  test("stats after generated rounds keep late-joiner credit", async () => {
    const everyoneSatOutOnceOrTwice = [...sampleRounds, sampleRounds[0]];
    const newPlayers = [...samplePlayers, "late"];
    const round = await getNextBestRound(everyoneSatOutOnceOrTwice, newPlayers, 1);
    const stats = buildStats(
      [...everyoneSatOutOnceOrTwice, round],
      newPlayers
    );
    expect(stats.sitOutCount[stats.index.get("late")!]).toBe(2);
  });
});
