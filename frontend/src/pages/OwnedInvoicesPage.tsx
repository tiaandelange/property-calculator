import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { fetchPdfBlob, triggerPdfFileDownload } from "../api/pdfBlob";
import {
  generateInvoicePdf,
  getProperties,
  getPropertyTenants,
  listPropertyInvoices,
  createPropertyInvoice,
  markInvoicePaid,
  sendInvoiceEmail
} from "../api/ownedProperties";
import { invalidatePropertyWorkspace } from "../features/properties/invalidate";
import { usePropertyWorkspaceRefresh } from "../features/properties/usePropertyWorkspaceRefresh";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function OwnedInvoicesPage() {
  const [invoicePdfBusyId, setInvoicePdfBusyId] = useState<string | number | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<string | number | "">("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    tenantId: "",
    invoiceDate: "",
    dueDate: "",
    notes: "",
    lineItems: [{ description: "Monthly Rent", quantity: 1, unitPrice: 0, total: 0 }]
  });

  async function loadProperties() {
    const rows = await getProperties();
    setProperties(rows);
    if (!propertyId && rows[0]) setPropertyId(rows[0].id as string | number);
  }
  async function loadData(pid: string | number) {
    const [t, i] = await Promise.all([
      getPropertyTenants(pid),
      listPropertyInvoices(pid)
    ]);
    setTenants(Array.isArray(t) ? t : []);
    setInvoices(Array.isArray(i) ? i : []);
  }
  useEffect(() => { void loadProperties(); }, []);
  useEffect(() => { if (propertyId) void loadData(propertyId); }, [propertyId]);

  usePropertyWorkspaceRefresh({
    propertyId: propertyId || undefined,
    onRefresh: () => {
      void loadProperties();
      if (propertyId) void loadData(propertyId);
    }
  });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    await createPropertyInvoice(propertyId, form);
    await loadData(propertyId);
    invalidatePropertyWorkspace(propertyId);
  };
  const generatePdf = async (id: string | number) => {
    setInvoicePdfBusyId(id);
    try {
      await generateInvoicePdf(id);
      if (propertyId) await loadData(propertyId);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Failed to generate invoice PDF.");
    } finally {
      setInvoicePdfBusyId(null);
    }
  };

  const downloadPdf = async (inv: { id: string | number; invoiceNumber: string; downloadUrl?: string | null }) => {
    setInvoicePdfBusyId(inv.id);
    try {
      let url = inv.downloadUrl;
      if (!url) {
        const gen = await generateInvoicePdf(inv.id);
        url = gen.downloadUrl ?? null;
      }
      if (!url) throw new Error("No download URL. Generate the PDF first.");
      const blob = await fetchPdfBlob(url);
      triggerPdfFileDownload(blob, `${String(inv.invoiceNumber).replace(/\s+/g, "_")}.pdf`);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Download failed. Generate the PDF first.");
    } finally {
      setInvoicePdfBusyId(null);
    }
  };
  const markPaid = async (id: string | number) => {
    await markInvoicePaid(id);
    if (propertyId) await loadData(propertyId);
    invalidatePropertyWorkspace(propertyId);
  };
  const sendEmail = async (id: string | number) => {
    await sendInvoiceEmail(id);
    if (propertyId) await loadData(propertyId);
  };

  return (
    <Section>
      <Helmet><title>Invoices | The Property Guy</title></Helmet>
      <Container>
        <h1 className="pg-h2">Invoices</h1>
        <Card>
          <Field label="Property"><select className="pg-input" value={propertyId} onChange={(e) => setPropertyId(e.target.value === "" ? "" : e.target.value)}>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <form onSubmit={create}>
            <Field label="Tenant"><select className="pg-input" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</select></Field>
            <Field label="Invoice date"><Input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} required /></Field>
            <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></Field>
            <Field label="Description"><Input value={form.lineItems[0].description} onChange={(e) => setForm({ ...form, lineItems: [{ ...form.lineItems[0], description: e.target.value }] })} /></Field>
            <Field label="Amount"><Input type="number" value={form.lineItems[0].unitPrice} onChange={(e) => setForm({ ...form, lineItems: [{ ...form.lineItems[0], unitPrice: Number(e.target.value), total: Number(e.target.value) }] })} required /></Field>
            <Button type="submit">Create Invoice</Button>
          </form>
        </Card>
        <Card title="Invoice list">
          <div className="pg-workspace-inset-list">
            {invoices.map((inv) => (
              <div key={inv.id} className="pg-workspace-inset">
                <div>{inv.invoiceNumber} - {inv.status} - Total: {inv.total}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <Button variant="ghost" loading={invoicePdfBusyId === inv.id} onClick={() => void generatePdf(inv.id)}>
                    Generate PDF
                  </Button>
                  <Button
                    variant="ghost"
                    loading={invoicePdfBusyId === inv.id}
                    disabled={!inv.hasPdf}
                    onClick={() => void downloadPdf(inv)}
                  >
                    Download PDF
                  </Button>
                  <Button variant="ghost" onClick={() => markPaid(inv.id)}>Mark Paid</Button>
                  <Button variant="ghost" onClick={() => sendEmail(inv.id)}>Send Email</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Container>
    </Section>
  );
}
