import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spacer,
} from "@nextui-org/react";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useRef, useState } from "react";
import { AddUser, Delete } from "react-iconly";
import { Player, PlayerId, Team } from "./matching/types";
import { partnerOf, sanitizePairs, togglePairLink } from "./pairs";
import { useShufflerDispatch, useShufflerState } from "./useShuffler";
import clsx from "clsx";

type PlayerRow = Player & { delete: boolean; new: boolean };

export function PlayersModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    newPlayers: Player[],
    fixedPairs: Team[],
    regenerate: boolean
  ) => void;
}) {
  const state = useShufflerState();
  const dispatch = useShufflerDispatch();
  const [newPlayer, setNewPlayer] = useState("");
  const newPlayerRef = useRef<HTMLInputElement>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [pairs, setPairs] = useState<Team[]>([]);
  const [linkingId, setLinkingId] = useState<PlayerId | null>(null);

  const handleSubmit =
    (regenerate: boolean = false) =>
    () => {
      const newPlayers = players
        .filter((x) => !x.delete)
        .map(({ id, name }) => ({ id, name: name.trim() }))
        .sort((a, b) => a.name.localeCompare(b.name));
      // TODO: error handling for too few players.
      if (newPlayers.length < 4) return;
      if (newPlayers.some(({ name }) => !name)) return;
      onSubmit(
        newPlayers,
        sanitizePairs(
          pairs,
          newPlayers.map(({ id }) => id)
        ),
        regenerate
      );
    };

  useEffect(() => {
    if (open) {
      const allPlayers = Object.values(state.playersById);

      setPlayers(
        allPlayers
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(({ name, id }) => ({
            id,
            name,
            delete: !state.players.includes(id),
            new: false,
          }))
      );
      setPairs(state.fixedPairs);
      setLinkingId(null);
      setNewPlayer("");
    }
  }, [open]);

  const renameRow = (row: PlayerRow, name: string) => {
    setPlayers((players) =>
      players.map((x) => (x.id === row.id ? { ...x, name } : x))
    );
    // Existing players save live (ids and history are untouched); rows added
    // in this dialog stay local until a footer button submits them.
    const trimmed = name.trim();
    const duplicate = players.some(
      (other) => other.id !== row.id && other.name.trim() === trimmed
    );
    if (!row.new && trimmed && !duplicate) {
      dispatch({ type: "rename-player", payload: { id: row.id, name } });
    }
  };

  const toggleDelete = (row: PlayerRow) => {
    if (!row.delete) {
      // Removing a player dissolves their pair.
      setPairs((pairs) => pairs.filter((pair) => !pair.includes(row.id)));
      setLinkingId((linking) => (linking === row.id ? null : linking));
    }
    setPlayers((players) =>
      players.map((x) => (x.id === row.id ? { ...x, delete: !x.delete } : x))
    );
  };

  const linkingName = linkingId
    ? players.find((x) => x.id === linkingId)?.name
    : null;

  return (
    <Modal
      closeButton
      aria-labelledby="players-modal-title"
      isOpen={open}
      scrollBehavior="inside"
      onClose={() => {
        onClose();
      }}
    >
      <ModalContent>
        <ModalHeader>
          <h3 id="players-modal-title">Edit players</h3>
        </ModalHeader>
        <ModalBody>
          <p className="text-lg">
            Add, remove, rename, or pair players. You can either{" "}
            <span className="font-bold">redo the current round</span> (because
            you haven't played yet) or{" "}
            <span className="font-bold">start a new round</span> with the
            updated roster.
          </p>
          <p className="text-sm text-neutral-500">
            Name changes save immediately. Paired players (🔗) always play as
            partners.
          </p>
          <form
            name="new-player"
            onSubmit={(e) => {
              e.preventDefault();
              const playerName = newPlayer.trim();
              // No empty input.
              if (!playerName) return;
              // No duplicate names.
              if (players.some((player) => player.name.trim() === playerName))
                return;
              // Update list and clear form.
              setPlayers((players) => [
                { name: playerName, id: uuidv4(), delete: false, new: true },
                ...players,
              ]);
              setNewPlayer("");
              newPlayerRef.current?.focus();
            }}
          >
            <div className="flex gap-2 items-end">
              <Input
                variant="bordered"
                label="Add player"
                labelPlacement="outside"
                placeholder="Enter player name"
                color="primary"
                className="flex-1"
                value={newPlayer}
                onChange={(e) => setNewPlayer(e.target.value)}
                ref={newPlayerRef}
              />
              <Button
                color="primary"
                aria-label="Submit add player"
                isIconOnly
                type="submit"
              >
                <AddUser />
              </Button>
            </div>
          </form>
          {linkingName && (
            <p className="text-sm text-primary">
              Select another player to pair with{" "}
              <span className="font-semibold">{linkingName}</span>. Tap 🔗
              again to cancel.
            </p>
          )}
          {players.map((player) => {
            const partnerId = partnerOf(player.id, pairs);
            const partnerName = partnerId
              ? players.find((x) => x.id === partnerId)?.name
              : null;
            const trimmed = player.name.trim();
            const duplicate = players.some(
              (other) =>
                other.id !== player.id && other.name.trim() === trimmed
            );
            return (
              <div
                className="flex flex-col border-b-1 pb-3 gap-1"
                key={player.id}
              >
                <div className="flex items-center">
                  <span className="text-large">
                    {player.new ? "🆕 " : ""}
                    {player.delete ? "❌ " : ""}
                  </span>
                  <Input
                    aria-label={`Player name for ${player.name}`}
                    className={clsx("flex-1", {
                      "line-through opacity-50": player.delete,
                    })}
                    size="sm"
                    type="text"
                    variant="underlined"
                    value={player.name}
                    isDisabled={player.delete}
                    isInvalid={!trimmed || duplicate}
                    errorMessage={
                      !trimmed
                        ? "Name required"
                        : duplicate
                        ? "Duplicate name"
                        : undefined
                    }
                    onChange={(e) => renameRow(player, e.currentTarget.value)}
                  />
                  <Spacer x={0.5} />
                  {!player.delete && (
                    <Button
                      variant={
                        partnerId || linkingId === player.id ? "solid" : "flat"
                      }
                      color={
                        partnerId
                          ? "secondary"
                          : linkingId === player.id
                          ? "primary"
                          : "default"
                      }
                      size="sm"
                      isIconOnly
                      aria-label={
                        partnerId
                          ? `Unpair ${player.name}`
                          : `Pair ${player.name} with another player`
                      }
                      title={partnerId ? "Unpair" : "Pair with another player"}
                      onPress={() => {
                        const result = togglePairLink(
                          pairs,
                          linkingId,
                          player.id
                        );
                        setPairs(result.pairs);
                        setLinkingId(result.linking);
                      }}
                    >
                      🔗
                    </Button>
                  )}
                  <Spacer x={0.5} />
                  <Button
                    variant="flat"
                    size="sm"
                    color={player.delete ? "success" : "default"}
                    aria-label={
                      player.delete
                        ? `Restore player named ${player.name}`
                        : `Remove player named ${player.name}`
                    }
                    endContent={player.delete ? <AddUser /> : <Delete />}
                    title={player.delete ? "Restore player" : "Remove player"}
                    onPress={() => toggleDelete(player)}
                  >
                    {player.delete ? "Re-add" : "Remove"}
                  </Button>
                </div>
                {partnerName && (
                  <Chip size="sm" variant="flat" color="secondary">
                    🔗 Paired with {partnerName}
                  </Chip>
                )}
              </div>
            );
          })}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={handleSubmit(true)} color="danger">
            Redo round
          </Button>
          <Button onPress={handleSubmit()} color="primary">
            New round
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
