import request from "supertest";
import jwt from "jsonwebtoken";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { env } from "../../src/config/env";
import { signDownloadParams, buildSignedDownloadUrl } from "../../src/utils/downloadSignatures";

jest.mock("../../src/domains/properties/property.statement.service.js", () => ({
  buildPropertyStatement: jest.fn()
}));

jest.mock("pdfmake", () => {
  return function PdfPrinterMock() {
    return {
      createPdfKitDocument: (_def: unknown) => {
        let out: any;
        return {
          pipe: (s: any) => {
            out = s;
          },
          end: () => {
            if (out?.write) out.write(Buffer.from("%PDF-1.4 test doc"));
            if (out?.end) out.end();
          }
        };
      }
    };
  };
});

const dbMock = {
  $queryRaw: jest.fn().mockResolvedValue([{ invoice_payment_details: null }]),
  storedReport: {
    create: jest.fn(),
    findFirst: jest.fn()
  },
  property: { findFirst: jest.fn() },
  invoice: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn()
  },
  propertyIncome: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  calculation: { findFirst: jest.fn() }
};

jest.mock("../../src/config/db", () => ({ db: dbMock }));

import { buildPropertyStatement } from "../../src/domains/properties/property.statement.service.js";
import { app } from "../../src/app";

const mockedStatement = buildPropertyStatement as jest.MockedFunction<typeof buildPropertyStatement>;

let reportsDir: string;

beforeAll(async () => {
  reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), "pg-reports-"));
  process.env.REPORTS_ROOT_OVERRIDE = reportsDir;
});

afterAll(async () => {
  delete process.env.REPORTS_ROOT_OVERRIDE;
});

function signToken(uid = 1) {
  return jwt.sign({ sub: String(uid), email: "user@example.com", role: "USER", subscription_status: "FREE" }, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("reports & invoice PDF API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/reports/health returns diagnostics", async () => {
    const res = await request(app).get("/api/reports/health").set("Authorization", `Bearer ${signToken(1)}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      reportsDirectoryExists: true,
      canWriteToReportsDirectory: true,
      pdfLibraryLoaded: true
    });
    expect(typeof res.body.reportsDirectoryPath).toBe("string");
  });

  test("POST generate PROPERTY_SUMMARY creates PDF file", async () => {
    dbMock.property.findFirst.mockResolvedValue({
      id: 3,
      userId: 1,
      name: "P",
      addressLine1: "a",
      city: "c",
      province: "p",
      postalCode: null,
      investmentType: "LONG_TERM_RENTAL"
    } as any);
    mockedStatement.mockResolvedValue({
      property: { id: 3, name: "P", investmentType: "LONG_TERM_RENTAL", city: "c", addressLine1: "a" },
      summary: {
        balanceDue: 0,
        expectedThisMonth: 0,
        receivedThisMonth: 0,
        expensesThisMonth: 0,
        bondThisMonth: 0,
        netCashFlow: 0,
        depositHeld: 0
      },
      statementRows: []
    } as any);
    dbMock.storedReport.create.mockImplementation(async ({ data }: { data: { fileName: string } }) => ({
      id: 77,
      fileName: data.fileName,
      userId: 1,
      reportType: "PROPERTY_SUMMARY",
      calculationId: null,
      propertyId: 3,
      invoiceId: null,
      scenarioName: null,
      createdAt: new Date()
    }));

    const token = signToken(1);
    const res = await request(app)
      .post("/api/reports/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ reportType: "PROPERTY_SUMMARY", propertyId: 3 });
    expect(res.status).toBe(201);
    expect(res.body.reportId).toBe(77);
    expect(res.body.downloadUrl).toBe("/api/reports/77/download");
    // The server-generated filename never leaks in the response; we read it
    // back from the captured `storedReport.create` argument instead.
    const captured = dbMock.storedReport.create.mock.calls.at(-1)?.[0]?.data?.fileName as string;
    expect(typeof captured).toBe("string");
    const abs = path.join(reportsDir, captured);
    const buf = await fs.readFile(abs);
    expect(buf.length).toBeGreaterThan(4);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("GET report download returns application/pdf", async () => {
    const fname = "t-report.pdf";
    await fs.writeFile(path.join(reportsDir, fname), Buffer.from("%PDF-1.4 x"));
    dbMock.storedReport.findFirst.mockResolvedValue({
      id: 9,
      userId: 1,
      fileName: fname,
      reportType: "PROPERTY_SUMMARY",
      calculationId: null,
      propertyId: 1,
      invoiceId: null,
      scenarioName: null,
      createdAt: new Date()
    });

    const res = await request(app).get("/api/reports/9/download").set("Authorization", `Bearer ${signToken(1)}`).buffer(true);
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"])).toMatch(/application\/pdf/);
  });

  test("user cannot download another user report", async () => {
    dbMock.storedReport.findFirst.mockResolvedValue(null);
    const res = await request(app).get("/api/reports/9/download").set("Authorization", `Bearer ${signToken(2)}`);
    expect(res.status).toBe(404);
  });

  test("missing PDF file returns 404 JSON", async () => {
    dbMock.storedReport.findFirst.mockResolvedValue({
      id: 9,
      userId: 1,
      fileName: "missing.pdf",
      reportType: "X",
      calculationId: null,
      propertyId: null,
      invoiceId: null,
      scenarioName: null,
      createdAt: new Date()
    });
    const res = await request(app).get("/api/reports/9/download").set("Authorization", `Bearer ${signToken(1)}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/missing/i);
  });

  test("invoice generate creates file and download returns pdf", async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: 1 } as any);
    dbMock.invoice.findMany.mockResolvedValue([]);
    dbMock.propertyIncome.findMany.mockResolvedValue([]);
    dbMock.invoice.findFirst.mockResolvedValue({
      id: 44,
      userId: 1,
      propertyId: 3,
      tenantId: 5,
      leaseId: null,
      invoiceNumber: "INV-X",
      invoiceDate: new Date(),
      dueDate: new Date(),
      status: "DRAFT",
      subtotal: 100,
      total: 100,
      notes: null,
      property: {
        name: "P",
        addressLine1: "a",
        addressLine2: null,
        suburb: null,
        city: "c",
        province: "p",
        postalCode: null
      },
      tenant: { firstName: "A", lastName: "B", email: "a@b.c", phone: null, idNumber: null },
      lease: null,
      lineItems: [{ description: "Rent", quantity: 1, unitPrice: 100, total: 100 }]
    } as any);
    dbMock.invoice.update.mockResolvedValue({ id: 44 } as any);

    const gen = await request(app).post("/api/invoices/44/generate-pdf").set("Authorization", `Bearer ${signToken(1)}`);
    expect(gen.status).toBe(200);
    expect(gen.body.hasPdf).toBe(true);
    expect(gen.body.downloadUrl).toBe("/api/invoices/44/download");
    // The internal storage path is never returned; reconstruct it from the
    // captured `invoice.update` argument instead.
    const updateCall = dbMock.invoice.update.mock.calls.at(-1)?.[0];
    const rel = updateCall?.data?.pdfPath as string;
    expect(typeof rel).toBe("string");
    const abs = path.join(reportsDir, rel);
    const buf = await fs.readFile(abs);
    expect(buf.length).toBeGreaterThan(4);

    dbMock.invoice.findFirst.mockResolvedValue({ id: 44, userId: 1, pdfPath: rel } as any);

    const dl = await request(app).get("/api/invoices/44/download").set("Authorization", `Bearer ${signToken(1)}`).buffer(true);
    expect(dl.status).toBe(200);
    expect(String(dl.headers["content-type"])).toMatch(/application\/pdf/);
    expect(String(dl.headers["content-disposition"] ?? "")).toMatch(/filename="invoice-44.pdf"/);
    expect(String(dl.headers["content-disposition"] ?? "")).toMatch(/filename\*=UTF-8''/);
  });

  test("report download refuses to serve files outside the reports root (path traversal)", async () => {
    dbMock.storedReport.findFirst.mockResolvedValue({
      id: 11,
      userId: 1,
      fileName: "../../etc/passwd",
      reportType: "PROPERTY_SUMMARY",
      calculationId: null,
      propertyId: null,
      invoiceId: null,
      scenarioName: null,
      createdAt: new Date()
    });
    const res = await request(app).get("/api/reports/11/download").set("Authorization", `Bearer ${signToken(1)}`);
    expect(res.status).toBe(404);
  });

  test("report download refuses absolute paths stored in DB (legacy rows)", async () => {
    dbMock.storedReport.findFirst.mockResolvedValue({
      id: 12,
      userId: 1,
      fileName: "/etc/passwd",
      reportType: "PROPERTY_SUMMARY",
      calculationId: null,
      propertyId: null,
      invoiceId: null,
      scenarioName: null,
      createdAt: new Date()
    });
    const res = await request(app).get("/api/reports/12/download").set("Authorization", `Bearer ${signToken(1)}`);
    expect(res.status).toBe(404);
  });

  test("signed download URL grants single-use-ish access without JWT header", async () => {
    const fname = "signed-report.pdf";
    await fs.writeFile(path.join(reportsDir, fname), Buffer.from("%PDF-1.4 x"));
    dbMock.storedReport.findFirst.mockResolvedValue({
      id: 21,
      userId: 1,
      fileName: fname,
      reportType: "PROPERTY_SUMMARY",
      calculationId: null,
      propertyId: 1,
      invoiceId: null,
      scenarioName: null,
      createdAt: new Date()
    });
    const sign = await request(app).post("/api/reports/21/sign-download").set("Authorization", `Bearer ${signToken(1)}`);
    expect(sign.status).toBe(200);
    expect(typeof sign.body.url).toBe("string");
    expect(sign.body.url).toMatch(/\?exp=\d+&uid=1&sig=/);

    // Now use the signed URL — note: NO Authorization header.
    const signedPath = sign.body.url as string;
    const dl = await request(app).get(signedPath).buffer(true);
    expect(dl.status).toBe(200);
    expect(String(dl.headers["content-type"])).toMatch(/application\/pdf/);
  });

  test("signed download URL fails when the signature targets a different resource id", async () => {
    dbMock.storedReport.findFirst.mockResolvedValue({
      id: 31,
      userId: 1,
      fileName: "x.pdf",
      reportType: "PROPERTY_SUMMARY",
      calculationId: null,
      propertyId: null,
      invoiceId: null,
      scenarioName: null,
      createdAt: new Date()
    });
    const sign = await request(app).post("/api/reports/31/sign-download").set("Authorization", `Bearer ${signToken(1)}`);
    expect(sign.status).toBe(200);
    // Replay the signature against id=99 instead of id=31 — must fail.
    const tampered = String(sign.body.url).replace("/api/reports/31/download", "/api/reports/99/download");
    const dl = await request(app).get(tampered);
    expect(dl.status).toBe(401);
  });

  test("signed download URL is rejected once expired", async () => {
    // The verifier short-circuits on `exp < now()`, so a URL whose `exp` field
    // is in the past is rejected even if the (mismatched) signature were
    // otherwise plausible. This protects against URLs leaking into logs/email
    // and being replayed later.
    const live = signDownloadParams({ userId: 1, kind: "report", resourceId: 41, ttlSeconds: 60 });
    const expired = { ...live, exp: Math.floor(Date.now() / 1000) - 60 };
    const expiredUrl = buildSignedDownloadUrl(`/api/reports/41/download`, expired);
    const dl = await request(app).get(expiredUrl);
    expect(dl.status).toBe(401);
  });
});
