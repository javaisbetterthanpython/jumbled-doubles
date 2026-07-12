import { buildStats, matchKey, teamKey } from "../src/matching/stats";
import { Round } from "../src/matching/types";

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
    sitOuts: ["a", "d"], // All players have sat out.
  },
];

const samplePlayers = ["a", "b", "c", "d", "e", "f"];

const at = (stats: ReturnType<typeof buildStats>, a: string, b: string) => ({
  withCount: stats.withCount[stats.index.get(a)!][stats.index.get(b)!],
  lastWith: stats.lastWith[stats.index.get(a)!][stats.index.get(b)!],
  againstCount: stats.againstCount[stats.index.get(a)!][stats.index.get(b)!],
  lastAgainst: stats.lastAgainst[stats.index.get(a)!][stats.index.get(b)!],
});

describe("buildStats()", () => {
  test("simple example", () => {
    const stats = buildStats(sampleRounds.slice(0, 2), samplePlayers);
    expect(at(stats, "a", "b").lastWith).toBe(2);
    expect(at(stats, "a", "b").withCount).toBe(1);
    expect(at(stats, "d", "f").lastWith).toBe(1);
    expect(at(stats, "f", "e").lastAgainst).toBe(1);
    expect(at(stats, "a", "d").againstCount).toBe(2);
    expect(at(stats, "b", "e").lastWith).toBe(Infinity);
    expect(stats.roundsSinceSitOut[stats.index.get("e")!]).toBe(2);
    expect(stats.roundsSinceSitOut[stats.index.get("b")!]).toBe(1);
    expect(stats.roundsSinceSitOut[stats.index.get("a")!]).toBe(Infinity);
    expect(stats.sitOutCount[stats.index.get("e")!]).toBe(1);
    expect(stats.sitOutCount[stats.index.get("a")!]).toBe(0);
  });

  test("match counts identify matches regardless of order", () => {
    expect(
      matchKey([
        ["b", "a"],
        ["d", "c"],
      ])
    ).toEqual(
      matchKey([
        ["c", "d"],
        ["a", "b"],
      ])
    );
    const stats = buildStats(sampleRounds, samplePlayers);
    expect(
      stats.matchCounts.get(
        matchKey([
          ["d", "c"],
          ["b", "a"],
        ])
      )
    ).toBe(1);
    expect(teamKey("b", "a")).toEqual(teamKey("a", "b"));
  });

  test("late joiners get virtual sit-out credit", () => {
    // After 4 rounds where e/f sat twice and everyone else once, a brand-new
    // player starts one sit-out above the least-rested (1 + 1 = 2).
    const everyoneSatOutOnceOrTwice = [...sampleRounds, sampleRounds[0]];
    const newPlayers = [...samplePlayers, "late"];
    const stats = buildStats(everyoneSatOutOnceOrTwice, newPlayers);
    const late = stats.index.get("late")!;
    expect(stats.sitOutCount[late]).toBe(2);
    expect(stats.roundsSinceSitOut[late]).toBe(Infinity);
  });

  test("late joiner credit counts never-sat players as least-rested", () => {
    // One round in, only "a" has sat out; b–e are at zero. A new player must
    // be credited 0 + 1 = 1, not min-of-sitters + 1 = 2 (which would exempt
    // them from a whole rotation at the regulars' expense).
    const rounds: Round[] = [
      {
        matches: [
          [
            ["b", "c"],
            ["d", "e"],
          ],
        ],
        sitOuts: ["a"],
      },
    ];
    const stats = buildStats(rounds, ["a", "b", "c", "d", "e", "f"]);
    expect(stats.sitOutCount[stats.index.get("f")!]).toBe(1);
  });

  test("late joiner credit persists once they play", () => {
    const everyoneSatOutOnceOrTwice = [...sampleRounds, sampleRounds[0]];
    const newPlayers = [...samplePlayers, "late"];
    const withLatePlaying: Round[] = [
      ...everyoneSatOutOnceOrTwice,
      {
        matches: [
          [
            ["late", "a"],
            ["b", "c"],
          ],
        ],
        sitOuts: ["d", "e"],
      },
    ];
    const stats = buildStats(withLatePlaying, newPlayers);
    expect(stats.sitOutCount[stats.index.get("late")!]).toBe(2);
    expect(at(stats, "late", "a").withCount).toBe(1);
  });

  test("removed players in history are skipped without errors", () => {
    // "b" left the session; their matches remain in history.
    const remaining = samplePlayers.filter((p) => p !== "b");
    const stats = buildStats(sampleRounds, remaining);
    expect(stats.players).toEqual(remaining);
    expect(at(stats, "a", "c").againstCount).toBe(1);
  });
});
