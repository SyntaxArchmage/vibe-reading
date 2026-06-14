import { useState } from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export function Button({ label, onClick }: ButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={() => {
        setPressed(true);
        onClick();
      }}
    >
      {pressed ? `${label} (clicked)` : label}
    </button>
  );
}
