import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  assertAllowedPropertyDocumentFile,
  buildPropertyDocumentStorageKey,
  sanitizeFilenameForStorage,
  uploadPropertyDocument
} from "./documentsSupabase";

const upload = vi.fn();
const remove = vi.fn();
const from = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
        error: null
      })
    },
    storage: {
      from: () => ({
        upload,
        remove
      })
    },
    from
  })
}));

describe("documentsSupabase", () => {
  beforeEach(() => {
    upload.mockReset();
    remove.mockReset();
    from.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sanitizeFilenameForStorage strips path segments", () => {
    expect(sanitizeFilenameForStorage("../../etc/passwd")).toBe("passwd");
  });

  it("buildPropertyDocumentStorageKey follows convention", () => {
    const k = buildPropertyDocumentStorageKey(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "Lease.pdf"
    );
    expect(k).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/properties/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc-Lease.pdf"
    );
  });

  it("assertAllowedPropertyDocumentFile rejects oversize", () => {
    const f = new File([new Uint8Array(11 * 1024 * 1024)], "x.pdf", { type: "application/pdf" });
    expect(() => assertAllowedPropertyDocumentFile(f)).toThrow(/10 MB/);
  });

  it("uploadPropertyDocument uploads then inserts", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

    upload.mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        property_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        lease_id: null,
        document_type: "OTHER",
        file_name: "Lease.pdf",
        file_size: 1,
        size_bytes: 1,
        created_at: "2026-01-01T00:00:00Z",
        storage_bucket: "property-documents",
        storage_key:
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/properties/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc-Lease.pdf"
      },
      error: null
    });
    const select = vi.fn(() => ({ single }));
    from.mockReturnValue({
      insert: vi.fn(() => ({ select }))
    });

    const file = new File([new Uint8Array([1])], "Lease.pdf", { type: "application/pdf" });
    const out = await uploadPropertyDocument("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", file, {
      documentType: "OTHER"
    });

    expect(upload).toHaveBeenCalledWith(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/properties/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc-Lease.pdf",
      file,
      expect.objectContaining({ upsert: false })
    );
    expect(from).toHaveBeenCalledWith("property_documents");
    expect(out.id).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(out.storageKey).toContain("properties/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/");
  });
});
