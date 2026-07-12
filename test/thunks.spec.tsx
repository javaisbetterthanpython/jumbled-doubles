/** @jest-environment jsdom */
import {
  defaultState,
  editPlayers,
  newGame,
  newRound,
  State,
} from "../src/useShuffler";
import { getNextBestRound } from "../src/matching";
import { PlayerId, Player, Round, Team } from "../src/matching/types";

/**
 * Stub worker that mirrors src/matching/worker.ts exactly: it spreads the
 * posted tuple into getNextBestRound. If a thunk ever posts the tuple in the
 * wrong order, generation here fails or produces rounds violating the
 * assertions below — guarding the untyped postMessage contract.
 */
function makeStubWorker(record: { messages: unknown[][] }) {
  let listener: ((event: { data: Round }) => void) | null = null;
  return {
    addEventListener: (type: string, callback: (event: { data: Round }) => void) => {
      if (type === "message") listener = callback;
    },
    removeEventListener: () => {},
    postMessage: (data: [Round[], PlayerId[], number, PlayerId[], Team[]]) => {
      record.messages.push(data);
      getNextBestRound(...data).then((round) => listener?.({ data: round }));
    },
  } as unknown as Worker;
}

const recordDispatches = () => {
  const actions: any[] = [];
  return { actions, dispatch: (action: any) => actions.push(action) };
};

const rosterState = (): State => {
  const names = ["Amy", "Bob", "Cat", "Dan", "Eve", "Fay"];
  const players = names.map((name, i) => ({ name, id: `id-${i}` }));
  return {
    ...defaultState,
    players: players.map((p) => p.id),
    playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    rounds: [],
    courts: 1,
  };
};

describe("thunks and the worker tuple contract", () => {
  test("newGame resolves index pairs to ids before the roster sort", async () => {
    const { actions, dispatch } = recordDispatches();
    const record = { messages: [] as unknown[][] };
    const ok = await newGame(dispatch, defaultState, makeStubWorker(record), {
      names: ["Zoe", "Amy", "Bob", "Cat"],
      courts: 1,
      courtNames: [],
      pairs: [[0, 1]], // Zoe + Amy by entry order
    });
    expect(ok).toBe(true);

    const start = actions.find((a) => a.type === "new-game-start");
    expect(start).toBeDefined();
    const { playersById, fixedPairs } = start.payload;
    const pairNames = fixedPairs[0]
      .map((id: PlayerId) => playersById[id].name)
      .sort();
    expect(pairNames).toEqual(["Amy", "Zoe"]);

    // Tuple order: [rounds, players, courts, volunteers, fixedPairs].
    const message = record.messages[0] as any[];
    expect(message[0]).toEqual([]);
    expect(message[1]).toEqual(start.payload.players);
    expect(message[2]).toBe(1);
    expect(message[3]).toEqual([]);
    expect(message[4]).toEqual(fixedPairs);

    // The generated first round keeps the pair together.
    const game = actions.find((a) => a.type === "new-game");
    const [a, b] = fixedPairs[0];
    const together = game.payload.matches.some((match: Team[]) =>
      match.some((team) => team.includes(a) && team.includes(b))
    );
    expect(together).toBe(true);
  });

  test("newRound forwards state.fixedPairs in the tuple", async () => {
    const { dispatch } = recordDispatches();
    const record = { messages: [] as unknown[][] };
    const state = { ...rosterState(), fixedPairs: [["id-0", "id-1"]] as Team[] };
    const ok = await newRound(dispatch, state, makeStubWorker(record), {
      volunteerSitouts: ["id-2"],
    });
    expect(ok).toBe(true);
    const message = record.messages[0] as any[];
    expect(message[3]).toEqual(["id-2"]);
    expect(message[4]).toEqual([["id-0", "id-1"]]);
  });

  test("thunks refuse to run while generating", async () => {
    const { actions, dispatch } = recordDispatches();
    const record = { messages: [] as unknown[][] };
    const state = { ...rosterState(), generating: true };
    const ok = await newRound(dispatch, state, makeStubWorker(record), {
      volunteerSitouts: [],
    });
    expect(ok).toBe(false);
    expect(actions).toEqual([]);
    expect(record.messages).toEqual([]);
  });

  test("editPlayers dissolves pairs whose member was removed", async () => {
    const { actions, dispatch } = recordDispatches();
    const record = { messages: [] as unknown[][] };
    const state = {
      ...rosterState(),
      fixedPairs: [
        ["id-0", "id-1"],
        ["id-2", "id-3"],
      ] as Team[],
    };
    // Remove id-3; their pair must dissolve, the other survives.
    const remaining: Player[] = state.players
      .filter((id) => id !== "id-3")
      .map((id) => state.playersById[id]);
    const ok = await editPlayers(dispatch, state, makeStubWorker(record), {
      newPlayers: remaining,
      fixedPairs: state.fixedPairs,
      regenerate: false,
    });
    expect(ok).toBe(true);
    const start = actions.find((a) => a.type === "start-generation");
    expect(start.payload.fixedPairs).toEqual([["id-0", "id-1"]]);
    const message = record.messages[0] as any[];
    expect(message[4]).toEqual([["id-0", "id-1"]]);
  });
});
