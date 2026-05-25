import { getProperty } from "../../api/ownedProperties";

/** Property workspace bundle — uses Supabase `getProperty` when configured (Express aggregate retired). */
export async function fetchPropertyAggregate(id: string | number) {
  return getProperty(id);
}
