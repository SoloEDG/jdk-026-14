export function Clue({
  values,
  done,
  vertical,
  compact,
  muted,
}: {
  values: number[];
  done: boolean;
  vertical?: boolean;
  compact?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={[
        "clue",
        vertical ? "vertical" : "",
        done ? "done" : "",
        compact ? "compact" : "",
        muted ? "muted-clue" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={values.join("、") + (done ? " 已满足" : "")}
    >
      {values.map((v, i) => (
        <span key={i}>{v}</span>
      ))}
    </div>
  );
}
