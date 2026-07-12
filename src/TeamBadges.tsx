import { BadgeGroup } from "./BadgeGroup";
import { Player, PlayerId } from "./matching/types";
import { PlayerBadge } from "./PlayerBadge";

export default function TeamBadges({
  team,
  isHome,
  pairedIds,
  onPlayerClick,
}: {
  team: Player[];
  isHome?: boolean;
  pairedIds?: Set<PlayerId>;
  onPlayerClick?: (id: PlayerId) => void;
}) {
  return (
    <BadgeGroup>
      {team.map((player) => (
        <PlayerBadge
          key={player.id}
          color={isHome ? "primary" : "secondary"}
          onPress={onPlayerClick && (() => onPlayerClick(player.id))}
        >
          {player.name}
          {pairedIds?.has(player.id) ? " 🔗" : ""}
        </PlayerBadge>
      ))}
    </BadgeGroup>
  );
}
