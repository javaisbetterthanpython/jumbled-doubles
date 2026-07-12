import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import { useEffect, useState } from "react";
import { PlayerId } from "./matching/types";
import { useShufflerDispatch, useShufflerState } from "./useShuffler";

/**
 * Small rename dialog opened by tapping a player's name badge in the rounds
 * view. Renaming keeps the player's id, so their whole match history follows
 * the new name; no round regeneration is needed.
 */
export function RenamePlayerModal({
  playerId,
  onClose,
}: {
  playerId: PlayerId | null;
  onClose: () => void;
}) {
  const state = useShufflerState();
  const dispatch = useShufflerDispatch();
  const [name, setName] = useState("");

  useEffect(() => {
    if (playerId) setName(state.playersById[playerId]?.name ?? "");
  }, [playerId]);

  const trimmed = name.trim();
  const duplicate = Object.values(state.playersById).some(
    (player) => player.id !== playerId && player.name === trimmed
  );
  const valid = !!trimmed && !duplicate;

  const save = () => {
    if (!playerId || !valid) return;
    dispatch({ type: "rename-player", payload: { id: playerId, name } });
    onClose();
  };

  return (
    <Modal
      closeButton
      aria-labelledby="rename-player-title"
      isOpen={!!playerId}
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader>
          <h3 id="rename-player-title">Rename player</h3>
        </ModalHeader>
        <ModalBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Input
              autoFocus
              label="Name"
              variant="bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              isInvalid={!valid}
              errorMessage={
                !trimmed
                  ? "Name required"
                  : duplicate
                  ? "Duplicate name"
                  : undefined
              }
            />
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" isDisabled={!valid} onPress={save}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
