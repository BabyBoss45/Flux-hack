interface TagPillProps {
  label: string;
  muted?: boolean;
}

export function TagPill({ label, muted }: TagPillProps) {
  return (
    <span className={`chip ${muted ? "chip-muted" : ""}`}>
      {label}
    </span>
  );
}


