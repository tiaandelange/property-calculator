import { api, authHeader } from "../../api/client";

/** Full canonical envelope (use when you need alerts, counts, or historical lease summaries). */
export async function fetchPropertyAggregate(id: string | number) {
  const res = await api.get(`/properties/${id}/aggregate`, { headers: authHeader() });
  return res.data;
}
