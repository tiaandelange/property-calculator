export function Spinner({ large = false }: { large?: boolean }) {
  return (
    <span
      className={large ? "pg-spinner pg-spinner--lg" : "pg-spinner"}
      aria-label="Loading"
      role="status"
    />
  );
}
