/** Column visibility priority — 1 = always keep visible longest; 4 = hide first when narrow. */
export type ProplyticTableColumnPriority = 1 | 2 | 3 | 4;

export function proplyticTablePriorityClass(
  priority?: ProplyticTableColumnPriority
): string | undefined {
  if (!priority) return undefined;
  return `pg-ptable-col--priority-${priority}`;
}
