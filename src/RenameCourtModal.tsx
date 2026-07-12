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
import { useShufflerDispatch, useShufflerState } from "./useShuffler";

/**
 * Rename a court by tapping its title on the rounds view. Court names are
 * display labels indexed by court position, so saving never reshuffles.
 */
export function RenameCourtModal({
  courtIndex,
  onClose,
}: {
  courtIndex: number | null;
  onClose: () => void;
}) {
  const state = useShufflerState();
  const dispatch = useShufflerDispatch();
  const [name, setName] = useState("");

  const length = Math.max(state.courts, (courtIndex ?? 0) + 1);
  const currentNames = Array.from(
    { length },
    (_, i) => state.courtNames[i] || `${i + 1}`
  );

  useEffect(() => {
    if (courtIndex !== null) setName(currentNames[courtIndex]);
  }, [courtIndex]);

  const trimmed = name.trim();
  const duplicate = currentNames.some(
    (other, i) => i !== courtIndex && other.trim() === trimmed
  );
  const valid = !!trimmed && !duplicate;

  const save = () => {
    if (courtIndex === null || !valid) return;
    const next = [...currentNames];
    next[courtIndex] = trimmed;
    dispatch({ type: "set-court-names", payload: { courtNames: next } });
    onClose();
  };

  return (
    <Modal
      closeButton
      aria-labelledby="rename-court-title"
      isOpen={courtIndex !== null}
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader>
          <h3 id="rename-court-title">Rename court</h3>
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
              label="Court name"
              variant="bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              isInvalid={!valid}
              errorMessage={
                !trimmed
                  ? "Court name required"
                  : duplicate
                  ? "Duplicate court name"
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
