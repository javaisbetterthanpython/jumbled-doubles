import * as React from "react";
import { Player, PlayerId, Round, Team } from "./matching/types";
import { sanitizePairs } from "./pairs";
import { v4 as uuidv4 } from "uuid";

type NewRoundOptions = {
  volunteerSitouts: PlayerId[];
  regenerate?: boolean;
  players?: PlayerId[];
  playersById?: Record<PlayerId, Player>;
  fixedPairs?: Team[];
};

type NewGameOptions = {
  names: string[];
  courts: number;
  courtNames: string[];
  /** Fixed pairs as index pairs into `names` (ids don't exist yet). */
  pairs: Array<[number, number]>;
};

type EditCourts = {
  courts: number;
  regenerate: boolean;
};
type EditPlayers = {
  newPlayers: Player[];
  fixedPairs: Team[];
  regenerate: boolean;
};

type Action =
  | {
      type: "load-from-cache";
      payload: null;
    }
  | {
      type: "new-game-start";
      payload: {
        players: PlayerId[];
        playersById: Record<PlayerId, Player>;
        courts: number;
        courtNames: string[];
        fixedPairs: Team[];
      };
    }
  | {
      type: "rename-player";
      payload: { id: PlayerId; name: string };
    }
  | {
      type: "set-court-names";
      payload: { courtNames: string[] };
    }
  | {
      type: "new-game";
      payload: Round;
    }
  | {
      type: "new-game-fail";
      payload: { error: Error };
    }
  | {
      type: "new-round";
      payload: {
        round: Round;
        courts?: number;
        volunteerSitouts: PlayerId[];
      };
    }
  | {
      type: "start-generation";
      payload: NewRoundOptions;
    }
  | {
      type: "new-round-fail";
      payload: { error: Error };
    };
type Dispatch = (action: Action) => void;
type State = {
  players: PlayerId[];
  rounds: Round[];
  courts: number;
  courtNames: string[];
  volunteerSitoutsByRound: PlayerId[][];
  playersById: Record<PlayerId, Player>;
  fixedPairs: Team[];
  generating: boolean;
  cacheLoaded: boolean;
};
type ShufflerProviderProps = { children: React.ReactNode };

const defaultState: State = {
  players: [],
  volunteerSitoutsByRound: [],
  playersById: {},
  rounds: [],
  courts: 2,
  courtNames: [],
  fixedPairs: [],
  generating: false,
  cacheLoaded: false,
};

const ShufflerStateContext = React.createContext<State | undefined>(undefined);
const ShufflerDispatchContext = React.createContext<Dispatch | undefined>(
  undefined
);
const ShufflerWorkerContext = React.createContext<Worker | null | undefined>(
  undefined
);

function createPlayers(names: string[]) {
  return names.map((name) => {
    return { name, id: uuidv4() };
  });
}

function getPlayersById(previous: Record<PlayerId, Player>, players: Player[]) {
  const byId = { ...previous };
  players.forEach((player) => {
    byId[player.id] = player;
  });
  return byId;
}

function loadFromCache(previousState: State): State {
  const existingState = previousState || defaultState;
  if (typeof window === "undefined") return existingState;
  const storageState = window.localStorage.getItem("state");
  if (storageState === null) {
    return existingState;
  }
  try {
    const {
      players,
      rounds,
      courts,
      volunteerSitoutsByRound,
      playersById,
      courtNames = [],
      fixedPairs = [],
    } = JSON.parse(storageState);
    if (
      !Array.isArray(players) ||
      !Array.isArray(rounds) ||
      isNaN(courts) ||
      !playersById
    )
      return existingState;

    return {
      players,
      playersById,
      volunteerSitoutsByRound,
      rounds,
      courts,
      courtNames,
      fixedPairs: Array.isArray(fixedPairs)
        ? sanitizePairs(fixedPairs, players)
        : [],
      cacheLoaded: true,
      generating: false,
    };
  } catch (e) {
    return existingState;
  }
}

function cacheState(state: State): State {
  if (typeof window === "undefined") return state;
  window.setTimeout(() => {
    const {
      players,
      courts,
      courtNames,
      rounds,
      volunteerSitoutsByRound,
      playersById,
      fixedPairs,
    } = state;
    window.localStorage.setItem(
      "state",
      JSON.stringify({
        players,
        courts,
        courtNames,
        rounds,
        volunteerSitoutsByRound,
        playersById,
        fixedPairs,
      })
    );
  }, 0);
  return state;
}

function shufflerReducer(state: State, action: Action): State {
  switch (action.type) {
    case "new-game-start": {
      const { payload } = action;
      const { players, playersById, courts, courtNames, fixedPairs } = payload;

      return cacheState({
        ...state,
        players,
        playersById,
        courts,
        courtNames,
        fixedPairs,
        rounds: [],
        volunteerSitoutsByRound: [],
        generating: true,
      });
    }
    case "rename-player": {
      const { id, name } = action.payload;
      const trimmed = name.trim();
      if (!trimmed || !state.playersById[id]) return state;
      // Rounds reference players by id, so history follows the new name
      // everywhere; no regeneration needed.
      return cacheState({
        ...state,
        playersById: {
          ...state.playersById,
          [id]: { ...state.playersById[id], name: trimmed },
        },
      });
    }
    case "set-court-names": {
      // Court names are display labels only (matches are indexed by court
      // position), so renaming never requires regeneration.
      return cacheState({
        ...state,
        courtNames: action.payload.courtNames.map((name) => name.trim()),
      });
    }
    case "new-game": {
      const { payload } = action;

      return cacheState({
        ...state,
        rounds: [payload],
        volunteerSitoutsByRound: [[]],
        generating: false,
      });
    }
    case "load-from-cache": {
      return loadFromCache(state);
    }
    case "start-generation":
      const { regenerate } = action.payload;
      return {
        ...state,
        generating: true,
        rounds: regenerate ? state.rounds.slice(0, -1) : state.rounds,
        volunteerSitoutsByRound: regenerate
          ? state.volunteerSitoutsByRound.slice(0, -1)
          : state.volunteerSitoutsByRound,
        players: action.payload.players || state.players,
        playersById: action.payload.playersById || state.playersById,
        fixedPairs: action.payload.fixedPairs ?? state.fixedPairs,
      };
    case "new-game-fail":
    case "new-round-fail": {
      return cacheState({ ...state, generating: false });
    }
    case "new-round": {
      return cacheState({
        ...state,
        generating: false,
        rounds: [...state.rounds, action.payload.round],
        courts: action.payload.courts || state.courts,
        volunteerSitoutsByRound: [
          ...state.volunteerSitoutsByRound,
          action.payload.volunteerSitouts,
        ],
      });
    }
  }
  return state;
}

async function newRound(
  dispatch: Dispatch,
  state: State,
  worker: Worker | null,
  payload: NewRoundOptions
): Promise<boolean> {
  if (!worker) return false;
  if (state.generating) return false;
  dispatch({ type: "start-generation", payload });
  const rounds = payload.regenerate ? state.rounds.slice(0, -1) : state.rounds;

  try {
    const nextRound = await generateRound(
      worker,
      rounds,
      state.players,
      state.courts,
      payload.volunteerSitouts,
      payload.fixedPairs ?? state.fixedPairs
    );
    dispatch({
      type: "new-round",
      payload: { round: nextRound, volunteerSitouts: payload.volunteerSitouts },
    });
    return true;
  } catch (error) {
    dispatch({ type: "new-round-fail", payload: { error: error as Error } });
    return false;
  }
}

async function newGame(
  dispatch: Dispatch,
  state: State,
  worker: Worker | null,
  payload: NewGameOptions
): Promise<boolean> {
  if (!worker) return false;
  if (state.generating) return false;
  const { courts, names, courtNames, pairs } = payload;
  // Resolve index pairs to ids before sorting reorders the players.
  const created = createPlayers(names);
  const fixedPairs: Team[] = pairs
    .filter(([a, b]) => created[a] && created[b] && a !== b)
    .map(([a, b]) => [created[a].id, created[b].id]);
  const players = [...created].sort((a, b) => a.name.localeCompare(b.name));
  const playerIds = players.map(({ id }) => id);
  const playersById = getPlayersById({}, players);
  dispatch({
    type: "new-game-start",
    payload: {
      players: playerIds,
      playersById,
      courts,
      courtNames,
      fixedPairs,
    },
  });
  try {
    const nextRound = await generateRound(
      worker,
      [],
      playerIds,
      courts,
      [],
      fixedPairs
    );
    dispatch({ type: "new-game", payload: nextRound });
    return true;
  } catch (error) {
    dispatch({ type: "new-game-fail", payload: { error: error as Error } });
    return false;
  }
}

async function generateRound(
  worker: Worker,
  rounds: Round[],
  players: PlayerId[],
  courts: number,
  volunteerSitouts: PlayerId[],
  fixedPairs: Team[]
): Promise<Round> {
  return new Promise((resolve, reject) => {
    const messageCallback = (event: MessageEvent<Round>) => {
      resolve(event.data);
      worker.removeEventListener("message", messageCallback);
    };
    worker.addEventListener("message", messageCallback);

    const errorCallback = (error: ErrorEvent) => {
      reject(error);
      worker.removeEventListener("error", errorCallback);
    };
    worker.addEventListener("error", errorCallback);

    worker.postMessage([rounds, players, courts, volunteerSitouts, fixedPairs]);
  });
}

async function editCourts(
  dispatch: Dispatch,
  state: State,
  worker: Worker | null,
  payload: EditCourts
): Promise<boolean> {
  if (!worker) return false;
  if (state.generating) return false;
  const { courts, regenerate } = payload;
  const volunteerSitouts = regenerate
    ? state.volunteerSitoutsByRound.slice(-1)[0]
    : [];
  const rounds = regenerate ? state.rounds.slice(0, -1) : state.rounds;
  dispatch({
    type: "start-generation",
    payload: { volunteerSitouts, regenerate },
  });

  try {
    const round = await generateRound(
      worker,
      rounds,
      state.players,
      courts,
      volunteerSitouts,
      state.fixedPairs
    );
    dispatch({
      type: "new-round",
      payload: {
        round,
        volunteerSitouts,
        courts,
      },
    });
    return true;
  } catch (error) {
    dispatch({ type: "new-round-fail", payload: { error: error as Error } });
    return false;
  }
}

async function editPlayers(
  dispatch: Dispatch,
  state: State,
  worker: Worker | null,
  payload: EditPlayers
): Promise<boolean> {
  if (!worker) return false;
  if (state.generating) return false;
  const { newPlayers, regenerate } = payload;
  const volunteerSitouts = regenerate
    ? state.volunteerSitoutsByRound.slice(-1)[0]
    : [];
  const rounds = regenerate ? state.rounds.slice(0, -1) : state.rounds;

  const playerIds = newPlayers.map(({ id }) => id);
  const playersById = getPlayersById(state.playersById, newPlayers);
  // Pairs whose members were removed dissolve automatically.
  const fixedPairs = sanitizePairs(payload.fixedPairs, playerIds);

  dispatch({
    type: "start-generation",
    payload: {
      volunteerSitouts,
      regenerate,
      playersById,
      players: playerIds,
      fixedPairs,
    },
  });
  try {
    const nextRound = await generateRound(
      worker,
      rounds,
      playerIds,
      state.courts,
      volunteerSitouts,
      fixedPairs
    );
    dispatch({
      type: "new-round",
      payload: {
        round: nextRound,
        volunteerSitouts,
      },
    });
    return true;
  } catch (error) {
    dispatch({ type: "new-round-fail", payload: { error: error as Error } });
    return false;
  }
}

function ShufflerProvider({ children }: ShufflerProviderProps) {
  const [state, dispatch] = React.useReducer(shufflerReducer, defaultState);
  const [worker, setWorker] = React.useState<Worker | null>(null);

  React.useEffect(() => {
    const worker = new Worker(new URL("./matching/worker.ts", import.meta.url));
    setWorker(worker);
    return () => {
      worker.terminate();
      setWorker(null);
    };
  }, []);
  return (
    <ShufflerStateContext.Provider value={state}>
      <ShufflerDispatchContext.Provider value={dispatch}>
        <ShufflerWorkerContext.Provider value={worker ?? null}>
          {children}
        </ShufflerWorkerContext.Provider>
      </ShufflerDispatchContext.Provider>
    </ShufflerStateContext.Provider>
  );
}

function useShufflerState() {
  const state = React.useContext(ShufflerStateContext);

  if (state === undefined) {
    throw new Error("useShuffler must be used within a ShufflerProvider");
  }
  return state;
}

function useShufflerDispatch(): Dispatch {
  const dispatch = React.useContext(ShufflerDispatchContext);

  if (dispatch === undefined) {
    throw new Error("useShuffler must be used within a ShufflerProvider");
  }

  return dispatch;
}

function useShufflerWorker(): Worker | null {
  const worker = React.useContext(ShufflerWorkerContext);

  if (worker === undefined) {
    throw new Error(
      "useShufflerWorker must be used within a ShufflerWorkerProvider"
    );
  }

  return worker;
}

function useLoadState() {
  const state = useShufflerState();
  const dispatch = useShufflerDispatch();
  React.useEffect(() => {
    if (!state) return;
    if (state.cacheLoaded === false) {
      dispatch({ type: "load-from-cache", payload: null });
    }
  }, [state?.cacheLoaded]);
}

export {
  ShufflerProvider,
  useShufflerState,
  useShufflerDispatch,
  useShufflerWorker,
  useLoadState,
  newRound,
  newGame,
  editCourts,
  editPlayers,
  // Exported for tests.
  shufflerReducer,
  defaultState,
};
export type { State };
