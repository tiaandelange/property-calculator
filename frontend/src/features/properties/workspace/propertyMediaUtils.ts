import type { ClientPropertyDocument } from "../../../services/documentsSupabase";

export function isPropertyImageDocument(doc: ClientPropertyDocument): boolean {
  const name = doc.fileName.toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}
