import { useEffect, useState } from "react";
import { getSignedDocumentUrl, listPropertyDocuments } from "../../../services/documentsSupabase";
import { isPropertyImageDocument } from "./propertyMediaUtils";

export function usePropertyMainImage(propertyId: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(propertyId));

  useEffect(() => {
    if (!propertyId) {
      setImageUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const docs = (await listPropertyDocuments(propertyId)).filter(isPropertyImageDocument);
        if (!docs.length) {
          if (!cancelled) setImageUrl(null);
          return;
        }
        const { url } = await getSignedDocumentUrl(docs[0].id, 3600);
        if (!cancelled) setImageUrl(url);
      } catch {
        if (!cancelled) setImageUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return { imageUrl, loading };
}
