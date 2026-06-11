import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DataEntity } from "../shared-types";

interface CardProps {
  entity: DataEntity;
  onClick: (entity: DataEntity) => void;
}

export function Card({ entity, onClick }: CardProps) {
  const [expanded, setExpanded] = useState(false);

  const loc = `L${entity.anchor.start_line}`;

  return (
    <motion.div
      className="vr-card"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="vr-card-header"
        onClick={() => {
          onClick(entity);
          setExpanded(!expanded);
        }}
      >
        <span className="vr-card-summary">{entity.summary}</span>
        <span className="vr-card-loc">{loc}</span>
      </div>

      <AnimatePresence>
        {expanded && entity.detail && (
          <motion.div
            className="vr-card-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {typeof entity.detail.description === "string"
              ? entity.detail.description
              : JSON.stringify(entity.detail, null, 2)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
