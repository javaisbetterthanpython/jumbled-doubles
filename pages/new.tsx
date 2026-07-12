import {
  Button,
  ButtonGroup,
  Chip,
  Input,
  Spacer,
  Switch,
  Textarea,
} from "@nextui-org/react";
import { useRouter } from "next/router";
import { Fragment, useEffect, useRef, useState } from "react";
import { AddUser, Delete, People, User, Document } from "react-iconly";
import { Court } from "../src/Court";
import { Meta } from "../src/Meta";
import { partnerOf, removeIndexFromPairs, togglePairLink } from "../src/pairs";
import {
  newGame,
  useShufflerDispatch,
  useShufflerState,
  useShufflerWorker,
} from "../src/useShuffler";
import { ResetPlayersModal } from "../src/ResetPlayersModal";

function NewGame() {
  const router = useRouter();
  const state = useShufflerState();
  const { playersById } = state;
  const dispatch = useShufflerDispatch();
  const worker = useShufflerWorker();

  const [formStatus, setFormStatus] = useState<"edit" | "validating">("edit");
  const [modal, setModal] = useState<"none" | "reset-players">("none");

  const [playerInput, setPlayerInput] = useState("");
  const playerInputRef = useRef<HTMLTextAreaElement>(null);

  const [players, setPlayers] = useState<string[]>(state.players);
  const [courts, setCourts] = useState(state.courts.toString());
  const [customizeCourtNames, setCustomizeCourtNames] = useState(false);
  const [courtNames, setCourtNames] = useState<string[]>([]);
  // Fixed pairs as index pairs into `players` (ids are created on submit).
  const [pairs, setPairs] = useState<[number, number][]>([]);
  const [linkingIndex, setLinkingIndex] = useState<number | null>(null);

  const handleAddPlayers = () => {
    if (!playerInput) return;
    const names = Array.from(
      new Set(
        (playerInput || "")
          .split(/[\n,]+/)
          .map((x) => x.trim())
          .filter((x) => !!x)
      )
    ).filter((name) => !players.includes(name));
    setPlayers((players) => [...players, ...names]);
    setPlayerInput("");
    playerInputRef.current?.focus();
  };

  // Load last time's players, pairs, and court names.
  useEffect(() => {
    const sortedPlayers = [...state.players]
      .map((id) => playersById[id])
      .sort((a, b) => a.name.localeCompare(b.name));
    setPlayers(sortedPlayers.map(({ name }) => name));
    const indexById = new Map(sortedPlayers.map(({ id }, index) => [id, index]));
    setPairs(
      state.fixedPairs
        .filter(([a, b]) => indexById.has(a) && indexById.has(b))
        .map(([a, b]) => [indexById.get(a)!, indexById.get(b)!])
    );
    setLinkingIndex(null);
    setCourts(state.courts.toString());

    if (state.courtNames.length) {
      setCustomizeCourtNames(true);
      setCourtNames(state.courtNames);
    }
  }, [state.players, state.courts, state.courtNames, state.fixedPairs]);

  const handleNewGame = async () => {
    const names = players;
    if (names.length < 4) {
      setFormStatus("validating");
      return;
    }
    if (
      names.some((name) => !name.trim()) ||
      new Set(names.map((x) => x.trim())).size !== names.length
    ) {
      setFormStatus("validating");
      return;
    }
    const courtCount = parseInt(courts);
    if (isNaN(courtCount) || courtCount < 1) {
      setFormStatus("validating");
      return;
    }
    if (
      customizeCourtNames &&
      (new Set(courtNames.map((x) => x.trim())).size !== courtNames.length ||
        courtNames.some((x) => !x.trim()))
    ) {
      setFormStatus("validating");
      return;
    }
    await newGame(dispatch, state, worker, {
      names,
      courts: courtCount,
      courtNames: customizeCourtNames ? courtNames : [],
      pairs,
    });
    router.push("/rounds");
  };

  const handleResetPlayers = () => {
    setModal("reset-players");
  };

  const playerError = formStatus === "validating" && players.length < 4;
  const courtsError =
    formStatus === "validating" &&
    (isNaN(parseInt(courts)) || parseInt(courts) < 1);
  const courtNamesError =
    formStatus === "validating" &&
    (courtNames.some((x) => !x.trim()) ||
      new Set(courtNames.map((x) => x.trim())).size !== courtNames.length);

  return (
    <>
      <Meta
        title="New game - Jumbled Doubles"
        description="Add players"
        path="/new"
      />
      <div className="mx-auto max-w-xl">
        <ResetPlayersModal
          open={modal === "reset-players"}
          onClose={() => setModal("none")}
          onSubmit={() => {
            setPlayers([]);
            setPairs([]);
            setLinkingIndex(null);
            setModal("none");
          }}
        />
        <div className="flex justify-center items-center">
          <div className="flex flex-1 flex-col gap-2">
            <div>
              <div className="flex items-center gap-2">
                <People />
                <span id="players-label">
                  Who's playing?{" "}
                  <span className="italic text-gray-500">
                    {players.length ? `${players.length} players` : ""}
                  </span>
                </span>
                <div className="flex-1" />
                <Button
                  size="sm"
                  color="secondary"
                  variant="flat"
                  onClick={() => handleResetPlayers()}
                >
                  Reset players
                </Button>
              </div>
              <Spacer y={2} />
              <div className="flex items-end gap-2">
                <Textarea
                  name="add-players"
                  className="flex-1"
                  ref={playerInputRef}
                  autoFocus
                  value={playerInput}
                  onChange={(e) => setPlayerInput(e.target.value)}
                  minRows={1}
                  maxRows={10}
                  itemID="player-input-label"
                  placeholder="Jo Swift, Kathryn Lob"
                  variant="bordered"
                  label="Add players"
                  labelPlacement="outside"
                  color={playerError ? "danger" : "default"}
                  isInvalid={players.length < 4 && formStatus === "validating"}
                  errorMessage={
                    players.length < 4 && formStatus === "validating"
                      ? "At least 4 players are required"
                      : undefined
                  }
                />
                <Button
                  color="primary"
                  aria-label="Add players in text box"
                  isIconOnly
                  type="button"
                  onClick={() => handleAddPlayers()}
                >
                  <AddUser />
                </Button>
              </div>
              <Spacer y={2} />
              {linkingIndex !== null && (
                <p className="text-sm text-primary">
                  Select another player to pair with{" "}
                  <span className="font-semibold">
                    {players[linkingIndex]}
                  </span>
                  . Tap 🔗 again to cancel.
                </p>
              )}
              {players.map((name, index) => {
                const partnerIndex = partnerOf(index, pairs);
                const duplicateName =
                  formStatus === "validating" &&
                  players.some(
                    (other, j) => j < index && other.trim() === name.trim()
                  );
                const emptyName = formStatus === "validating" && !name.trim();
                return (
                  <Fragment key={index}>
                    <div className="flex items-center gap-1">
                      <User primaryColor="#888" size="medium" />
                      <span className="text-sm text-gray-500 w-4">
                        {index + 1}
                      </span>
                      <Input
                        className="flex-1"
                        aria-label="Player"
                        value={name}
                        size="sm"
                        type="text"
                        variant="underlined"
                        isInvalid={duplicateName || emptyName}
                        errorMessage={
                          emptyName
                            ? "Name required"
                            : duplicateName
                            ? "Duplicate name"
                            : undefined
                        }
                        onChange={(e) => {
                          const newName = e.currentTarget.value;
                          setPlayers([
                            ...players.slice(0, index),
                            newName,
                            ...players.slice(index + 1),
                          ]);
                        }}
                        fullWidth
                      />
                      <Button
                        variant={
                          partnerIndex !== undefined || linkingIndex === index
                            ? "solid"
                            : "flat"
                        }
                        color={
                          partnerIndex !== undefined
                            ? "secondary"
                            : linkingIndex === index
                            ? "primary"
                            : "default"
                        }
                        size="sm"
                        aria-label={
                          partnerIndex !== undefined
                            ? `Unpair ${name} from ${players[partnerIndex]}`
                            : `Pair ${name} with another player`
                        }
                        title={
                          partnerIndex !== undefined
                            ? "Unpair"
                            : "Pair with another player"
                        }
                        isIconOnly
                        onPress={() => {
                          const result = togglePairLink(
                            pairs,
                            linkingIndex,
                            index
                          );
                          setPairs(result.pairs);
                          setLinkingIndex(result.linking);
                        }}
                      >
                        🔗
                      </Button>
                      <Button
                        variant="flat"
                        color="default"
                        aria-label={`Remove player named ${name}`}
                        isIconOnly
                        onPress={() => {
                          // Delete this player and dissolve their pair.
                          setPairs(removeIndexFromPairs(pairs, index));
                          setLinkingIndex((linking) =>
                            linking === null || linking === index
                              ? null
                              : linking > index
                              ? linking - 1
                              : linking
                          );
                          setPlayers((players) => [
                            ...players.slice(0, index),
                            ...players.slice(index + 1),
                          ]);
                        }}
                      >
                        <Delete />
                      </Button>
                    </div>
                    {partnerIndex !== undefined && (
                      <Chip
                        size="sm"
                        variant="flat"
                        color="secondary"
                        className="ml-10"
                      >
                        🔗 Paired with {players[partnerIndex]}
                      </Chip>
                    )}
                  </Fragment>
                );
              })}
            </div>
            <Spacer y={3} />
            <label>
              <div className="flex items-center gap-2">
                <Court />
                <p
                  id="courts-label"
                  className={courtsError ? "text-danger" : ""}
                >
                  How many courts are available?{" "}
                  <span className="italic text-gray-500">
                    {Math.floor(players.length / 4) ? (
                      <>Enough players for {Math.floor(players.length / 4)}</>
                    ) : (
                      ""
                    )}
                  </span>
                </p>
              </div>
              <Spacer y={2} />
              <Input
                id="court-input"
                aria-labelledby="courts-label"
                type="number"
                variant="bordered"
                min={1}
                isInvalid={courtsError}
                errorMessage={
                  courtsError ? "Courts must be 1 or greater." : undefined
                }
                value={courts}
                onChange={(e) => setCourts(e.target.value)}
                fullWidth
              />
            </label>
            <Spacer y={3} />
            <label>
              <div className="flex gap-2">
                <Document />
                <p>Customize court names</p>
                <Spacer className="flex-1" />
                <Switch
                  isSelected={customizeCourtNames}
                  onChange={(e) => {
                    setCourtNames(
                      Array.from(
                        new Array(parseInt(courts) || 1),
                        (_, i) => `${i + 1}`
                      )
                    );
                    setCustomizeCourtNames(e.target.checked);
                  }}
                />
              </div>
            </label>
            {customizeCourtNames && (
              <>
                <div className="flex gap-2 items-center">
                  <p className="text-primary font-semibold">Quick set</p>
                  <ButtonGroup>
                    <Button
                      type="button"
                      size="sm"
                      color="secondary"
                      variant="flat"
                      onClick={() =>
                        setCourtNames(
                          Array.from(
                            new Array(Math.max(parseInt(courts) || 0, 0)),
                            (_, i) => (i + 1).toString()
                          )
                        )
                      }
                    >
                      1, 2, 3, 4…
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      color="primary"
                      variant="flat"
                      onClick={() =>
                        setCourtNames(
                          Array.from(
                            new Array(Math.max(parseInt(courts) || 0, 0)),
                            (_, i) => ((i + 1) * 2).toString()
                          )
                        )
                      }
                    >
                      2, 4, 6, 8…
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      color="secondary"
                      variant="flat"
                      onClick={() =>
                        setCourtNames(
                          Array.from(
                            new Array(Math.max(parseInt(courts) || 0, 0)),
                            (_, i) => ((i + 1) * 2 - 1).toString()
                          )
                        )
                      }
                    >
                      1, 3, 5, 7…
                    </Button>
                  </ButtonGroup>
                </div>
                {/* list-inside was causing wrapping with input, hack using ml. */}
                <ol className="list-disc ml-5">
                  {Array.from(
                    new Array(Math.max(parseInt(courts) || 0, 0)),
                    (_, i) => courtNames[i] || ""
                  ).map((courtName, index, allNames) => {
                    const duplicationError =
                      courtNamesError &&
                      allNames.some(
                        (name, j) =>
                          j < index && name.trim() === courtName.trim()
                      );
                    const emptyCourtName = courtNamesError && !courtName.trim();
                    return (
                      <li key={index} className="mt-2">
                        <Input
                          value={courtName}
                          label="Court"
                          labelPlacement="outside-left"
                          onChange={(e) => {
                            const name = e.target.value;
                            const newNames = [...courtNames];
                            newNames[index] = name;
                            setCourtNames(newNames);
                          }}
                          isInvalid={duplicationError || emptyCourtName}
                          errorMessage={
                            emptyCourtName
                              ? "Please provide a court name"
                              : duplicationError
                              ? "Duplicated court name"
                              : undefined
                          }
                        />
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            <Spacer y={4} />
            <Button
              onPress={() => {
                // Set timeout to workaround issue where event gets ignored when pressing with keyboard open on Android.
                setTimeout(() => {
                  if (playerInput.trim().length) {
                    handleAddPlayers();
                  } else {
                    handleNewGame();
                  }
                }, 0);
              }}
              className="bg-gradient-to-l from-blue-600 to-pink-600 text-white"
            >
              Let's play!
            </Button>
            <Spacer y={8} />
          </div>
        </div>
      </div>
    </>
  );
}

export default NewGame;
