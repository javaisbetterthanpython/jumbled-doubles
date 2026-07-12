import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spacer,
} from "@nextui-org/react";
import { useEffect, useState } from "react";
import { Court } from "./Court";
import { useShufflerDispatch, useShufflerState } from "./useShuffler";

export function CourtsModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (newCourtCount: number, regenerate: boolean) => void;
}) {
  const state = useShufflerState();
  const dispatch = useShufflerDispatch();
  const [courts, setCourts] = useState<string>(state.courts.toString());
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setCourts(state.courts.toString());
      setNames(
        Array.from(
          { length: state.courts },
          (_, i) => state.courtNames[i] || `${i + 1}`
        )
      );
    }
  }, [open]);

  const renameCourt = (index: number, name: string) => {
    const next = [...names];
    next[index] = name;
    setNames(next);
    // Names are display labels only, so valid changes save immediately —
    // no regeneration, mirroring live player renames.
    const trimmedAll = next.map((n) => n.trim());
    const valid =
      trimmedAll.every((n) => n) &&
      new Set(trimmedAll).size === trimmedAll.length;
    if (valid) {
      dispatch({ type: "set-court-names", payload: { courtNames: trimmedAll } });
    }
  };

  return (
    <Modal
      closeButton
      scrollBehavior="inside"
      aria-labelledby="courts-modal-title"
      isOpen={open}
      onClose={() => {
        onClose();
      }}
    >
      <ModalContent>
        <ModalHeader>
          <h3 id="courts-modal-title">Edit courts</h3>
        </ModalHeader>
        <ModalBody>
          <label>
            <div className="flex items-center gap-2">
              <Court />
              <p id="courts-label">How many courts are available now?</p>
            </div>
            <Spacer y={3} />
            <Input
              id="court-input"
              aria-labelledby="courts-label"
              type="number"
              min={1}
              value={courts}
              onChange={(e) => setCourts(e.target.value)}
              fullWidth
            />
          </label>
          <Spacer y={2} />
          <p className="text-sm text-neutral-500">
            Court names save immediately. Changing the number of courts takes
            effect when you redo or start a round.
          </p>
          {names.map((name, index) => {
            const trimmed = name.trim();
            const duplicate = names.some(
              (other, i) => i !== index && other.trim() === trimmed
            );
            return (
              <Input
                key={index}
                label={`Court ${index + 1} name`}
                labelPlacement="outside-left"
                size="sm"
                variant="underlined"
                value={name}
                isInvalid={!trimmed || duplicate}
                errorMessage={
                  !trimmed
                    ? "Court name required"
                    : duplicate
                    ? "Duplicate court name"
                    : undefined
                }
                onChange={(e) => renameCourt(index, e.target.value)}
              />
            );
          })}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button
            onPress={() => onSubmit(parseInt(courts), true)}
            color="danger"
            isDisabled={state.generating}
          >
            Redo round
          </Button>
          <Button
            onPress={() => onSubmit(parseInt(courts), false)}
            color="primary"
            isLoading={state.generating}
          >
            New round
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
