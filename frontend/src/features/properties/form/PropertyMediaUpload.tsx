import { CloudUpload, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deletePropertyDocument,
  getSignedDocumentUrl,
  listPropertyDocuments,
  uploadPropertyDocument,
  type ClientPropertyDocument
} from "../../../services/documentsSupabase";
import {
  formatPropertyPhotosTotalLimit,
  MAX_PROPERTY_PHOTOS,
  MAX_PROPERTY_PHOTOS_TOTAL_BYTES
} from "./propertyFormConstants";

export type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

export type ExistingPhoto = ClientPropertyDocument & { previewUrl?: string };

function isImageDocument(doc: ClientPropertyDocument): boolean {
  const name = doc.fileName.toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

function existingPhotoBytes(existing: ExistingPhoto[]): number {
  return existing.reduce((sum, doc) => sum + Math.max(0, doc.fileSize || 0), 0);
}

function pendingPhotoBytes(pending: PendingPhoto[]): number {
  return pending.reduce((sum, photo) => sum + photo.file.size, 0);
}

function assertPropertyPhotoFile(file: File): void {
  if (!file || !(file instanceof File)) throw new Error("No file selected.");
  if (file.size <= 0) throw new Error("File is empty.");
  if (file.size > MAX_PROPERTY_PHOTOS_TOTAL_BYTES) {
    throw new Error(`A single image cannot exceed ${formatPropertyPhotosTotalLimit()}.`);
  }
  const mime = (file.type || "").toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    throw new Error("Only JPG, PNG, or WebP images are allowed.");
  }
}

export function PropertyMediaUpload({
  propertyId,
  pendingPhotos,
  onPendingChange,
  onCountChange
}: {
  propertyId?: string;
  pendingPhotos: PendingPhoto[];
  onPendingChange: (photos: PendingPhoto[]) => void;
  onCountChange: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [existing, setExisting] = useState<ExistingPhoto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const totalCount = existing.length + pendingPhotos.length;
  const totalBytes = useMemo(
    () => existingPhotoBytes(existing) + pendingPhotoBytes(pendingPhotos),
    [existing, pendingPhotos]
  );
  const canAddMore = totalCount < MAX_PROPERTY_PHOTOS && totalBytes < MAX_PROPERTY_PHOTOS_TOTAL_BYTES;

  useEffect(() => {
    onCountChange(totalCount);
  }, [totalCount, onCountChange]);

  const loadExisting = useCallback(async () => {
    if (!propertyId) {
      setExisting([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const docs = (await listPropertyDocuments(propertyId)).filter(isImageDocument);
      const withUrls: ExistingPhoto[] = await Promise.all(
        docs.map(async (doc) => {
          try {
            const { url } = await getSignedDocumentUrl(doc.id, 3600);
            return { ...doc, previewUrl: url };
          } catch {
            return { ...doc };
          }
        })
      );
      setExisting(withUrls);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load photos.");
      setExisting([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const addFiles = (files: FileList | File[]) => {
    setError("");
    const list = Array.from(files);
    const slots = MAX_PROPERTY_PHOTOS - totalCount;
    if (slots <= 0) {
      setError(`Maximum ${MAX_PROPERTY_PHOTOS} photos allowed.`);
      return;
    }
    if (totalBytes >= MAX_PROPERTY_PHOTOS_TOTAL_BYTES) {
      setError(`Total photo size cannot exceed ${formatPropertyPhotosTotalLimit()}.`);
      return;
    }

    const next: PendingPhoto[] = [];
    let usedBytes = totalBytes;
    for (const file of list.slice(0, slots)) {
      try {
        assertPropertyPhotoFile(file);
        if (usedBytes + file.size > MAX_PROPERTY_PHOTOS_TOTAL_BYTES) {
          setError(`Total photo size cannot exceed ${formatPropertyPhotosTotalLimit()}.`);
          break;
        }
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file)
        });
        usedBytes += file.size;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Invalid file.");
      }
    }
    if (next.length) onPendingChange([...pendingPhotos, ...next]);
  };

  const removePending = (id: string) => {
    const item = pendingPhotos.find((p) => p.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    onPendingChange(pendingPhotos.filter((p) => p.id !== id));
  };

  const removeExisting = async (docId: string) => {
    setError("");
    try {
      await deletePropertyDocument(docId);
      await loadExisting();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not remove photo.");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const filled = [
    ...existing.map((data) => ({ kind: "existing" as const, data })),
    ...pendingPhotos.map((data) => ({ kind: "pending" as const, data }))
  ];
  const slots = Array.from({ length: MAX_PROPERTY_PHOTOS }, (_, i) => filled[i] ?? { kind: "empty" as const, index: i });

  return (
    <div className="pg-prop-media">
      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
      <div className="pg-prop-media__layout">
        <button
          type="button"
          className="pg-prop-media__dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          disabled={!canAddMore}
        >
          <CloudUpload size={28} strokeWidth={1.75} aria-hidden />
          <span className="pg-prop-media__dropzone-title">Drag &amp; drop images here or click to browse</span>
          <span className="pg-prop-media__dropzone-help">
            JPG, PNG or WebP · {formatPropertyPhotosTotalLimit()} across all photos (max {MAX_PROPERTY_PHOTOS} photos)
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="pg-prop-media__file-input"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </button>
        <div className="pg-prop-media__thumbs" aria-busy={loading}>
          {slots.map((slot, idx) => {
            if (slot.kind === "existing") {
              return (
                <div key={slot.data.id} className="pg-prop-media__thumb pg-prop-media__thumb--filled">
                  {slot.data.previewUrl ? (
                    <img src={slot.data.previewUrl} alt={slot.data.fileName} />
                  ) : (
                    <span className="pg-prop-media__thumb-placeholder">{slot.data.fileName}</span>
                  )}
                  <button
                    type="button"
                    className="pg-prop-media__thumb-remove"
                    aria-label="Remove photo"
                    onClick={() => void removeExisting(slot.data.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            }
            if (slot.kind === "pending") {
              return (
                <div key={slot.data.id} className="pg-prop-media__thumb pg-prop-media__thumb--filled">
                  <img src={slot.data.previewUrl} alt={slot.data.file.name} />
                  <button
                    type="button"
                    className="pg-prop-media__thumb-remove"
                    aria-label="Remove photo"
                    onClick={() => removePending(slot.data.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            }
            return (
              <button
                key={`empty-${idx}`}
                type="button"
                className="pg-prop-media__thumb pg-prop-media__thumb--empty"
                onClick={() => inputRef.current?.click()}
                disabled={!canAddMore}
                aria-label="Add photo"
              >
                <Plus size={20} aria-hidden />
                <span>Add photo</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Upload pending photos after property create/update (uses existing document storage). */
export async function uploadPendingPropertyPhotos(propertyId: string, pending: PendingPhoto[]): Promise<void> {
  if (!pending.length) return;

  const existing = (await listPropertyDocuments(propertyId)).filter(isImageDocument);
  const existingBytes = existingPhotoBytes(existing);
  const pendingBytes = pendingPhotoBytes(pending);
  if (existingBytes + pendingBytes > MAX_PROPERTY_PHOTOS_TOTAL_BYTES) {
    throw new Error(`Total photo size cannot exceed ${formatPropertyPhotosTotalLimit()}.`);
  }

  for (const p of pending) {
    assertPropertyPhotoFile(p.file);
    await uploadPropertyDocument(propertyId, p.file, { documentType: "OTHER" });
    URL.revokeObjectURL(p.previewUrl);
  }
}
