import { AnimatePresence } from "motion/react";
import { Card } from "../components/Card";
import type { DataEntity } from "../shared-types";

interface Props {
  entities: DataEntity[];
  onCardClick: (entity: DataEntity) => void;
  hoveredEntity?: DataEntity | null;
  onCardHover?: (entity: DataEntity | null) => void;
}

export function JumpTab({ entities, onCardClick, hoveredEntity, onCardHover }: Props) {
  if (entities.length === 0) {
    return <div className="vr-no-cards">No jump cards for this file.</div>;
  }

  return (
    <AnimatePresence mode="popLayout">
      {entities.map((e, i) => (
        <Card
          key={`${e.anchor.start_line}-${i}`}
          entity={e}
          onClick={onCardClick}
          isHighlighted={hoveredEntity === e}
          onHover={onCardHover}
        />
      ))}
    </AnimatePresence>
  );
}
