import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, Download, FileCheck2, Loader2 } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { getGstReturnStores, getGstReturns, getSellerGstReturns, GstReturns, GstStoreOption } from "../../../services/api/admin/gstReturnBackupService";

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};
const dateIN = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, "-");

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";
const td = "px-3 py-2 text-sm text-gray-800";
const tdNum = "px-3 py-2 text-right text-sm tabular-nums text-gray-800";

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200" style={{ backgroundColor: "#ffffff" }}>
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

const Empty = ({ cols, text }: { cols: number; text: string }) => (
  <tr>
    <td colSpan={cols} className="px-3 py-6 text-center text-sm text-gray-400">
      {text}
    </td>
  </tr>
);

/**
 * GSTR-1 and GSTR-3B for one store and one month, worked out from Delivered orders (sales) and
 * the GST Purchase Register (input tax credit). Export to Excel for filing.
 */
export default function AdminGstReturns({ seller = false }: { seller?: boolean }) {
  const { showToast } = useToast();
  const [stores, setStores] = useState<GstStoreOption[]>([]);
  const [storeId, setStoreId] = useState("");
  const [month, setMonth] = useState(lastMonth());
  const [tab, setTab] = useState<"gstr1" | "gstr3b">("gstr1");
  const [data, setData] = useState<GstReturns | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The seller app always shows the seller's own store: no store list
    if (seller) return;
    getGstReturnStores()
      .then((list) => {
        setStores(list);
        setStoreId((id) => id || list.find((s) => s.isAdminStore)?.id || list[0]?.id || "");
      })
      .catch(() => showToast("Couldn't load the stores", "error"));
  }, [seller, showToast]);

  useEffect(() => {
    if ((!seller && !storeId) || !month) return;
    let stale = false;
    setLoading(true);
    (seller ? getSellerGstReturns(month) : getGstReturns(month, storeId))
      .then((d) => !stale && setData(d))
      .catch((e) => {
        if (stale) return;
        setData(null);
        showToast(e?.response?.data?.message || "Couldn't build the GST returns", "error");
      })
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [seller, storeId, month, showToast]);

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const add = (name: string, rows: Record<string, unknown>[]) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No entries" }]), name);
    const g1 = data.gstr1;
    const g3 = data.gstr3b;
    add("GSTR-1 B2CL", g1.b2cl.map((r) => ({ "Invoice Number": r.invoiceNumber, "Invoice date": dateIN(r.invoiceDate), "Invoice Value": r.invoiceValue, "Place Of Supply": `${r.placeOfSupply}-${r.placeOfSupplyName}`, Rate: r.rate, "Taxable Value": r.taxable, "Integrated Tax": r.igst })));
    add("GSTR-1 B2CS", g1.b2cs.map((r) => ({ Type: "OE", "Supply Type": r.supplyType, "Place Of Supply": `${r.placeOfSupply}-${r.placeOfSupplyName}`, Rate: r.rate, "Taxable Value": r.taxable, "Integrated Tax": r.igst, "Central Tax": r.cgst, "State/UT Tax": r.sgst })));
    add("GSTR-1 HSN", g1.hsn.map((r) => ({ HSN: r.hsn, Description: r.description, UQC: r.uqc, "Total Quantity": r.quantity, "Total Value": r.totalValue, Rate: r.rate, "Taxable Value": r.taxable, "Integrated Tax": r.igst, "Central Tax": r.cgst, "State/UT Tax": r.sgst })));
    add("GSTR-1 Docs", [{ "Nature of Document": "Invoices for outward supply", "Sr. No. From": g1.documents.from, "Sr. No. To": g1.documents.to, "Total Number": g1.documents.total, Cancelled: g1.documents.cancelled, "Net Issued": g1.documents.netIssued }]);
    add("GSTR-3B", [
      { Table: "3.1(a) Outward taxable supplies", "Taxable Value": g3.outwardTaxable.taxable, IGST: g3.outwardTaxable.igst, CGST: g3.outwardTaxable.cgst, SGST: g3.outwardTaxable.sgst },
      ...g3.interStateUnregistered.map((r) => ({ Table: `3.2 Unregistered: ${r.placeOfSupply}-${r.placeOfSupplyName}`, "Taxable Value": r.taxable, IGST: r.igst, CGST: "", SGST: "" })),
      { Table: "4(A)(5) All other ITC", "Taxable Value": g3.itc.purchaseTaxable, IGST: g3.itc.igst, CGST: g3.itc.cgst, SGST: g3.itc.sgst },
      { Table: "6.1 Tax payable in cash", "Taxable Value": "", IGST: g3.payable.igst, CGST: g3.payable.cgst, SGST: g3.payable.sgst },
      { Table: "ITC carried forward", "Taxable Value": "", IGST: g3.creditCarriedForward.igst, CGST: g3.creditCarriedForward.cgst, SGST: g3.creditCarriedForward.sgst },
    ]);
    XLSX.writeFile(wb, `GST-returns-${data.store.gstin || data.store.name}-${data.period}.xlsx`);
  };

  const g1 = data?.gstr1;
  const g3 = data?.gstr3b;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <FileCheck2 size={22} /> GSTR-1 &amp; GSTR-3B
          </h1>
          <p className="text-sm text-gray-500">{seller ? "Your store's monthly GST returns" : "Monthly GST returns"} from delivered orders and the GST purchase register.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {seller ? (
            data && (
              <div className="text-xs font-semibold text-gray-600">
                Store (GSTIN)
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-normal text-gray-800">
                  {data.store.name} · {data.store.gstin || "no GSTIN"}
                </div>
              </div>
            )
          ) : (
          <label className="text-xs font-semibold text-gray-600">
            Store (GSTIN)
            <select className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.gstin ? ` · ${s.gstin}` : " · no GSTIN"}
                </option>
              ))}
            </select>
          </label>
          )}
          <label className="text-xs font-semibold text-gray-600">
            Month
            <input type="month" className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm" value={month} max={new Date().toISOString().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <button type="button" onClick={exportExcel} disabled={!data || loading} className="flex items-center gap-1.5 rounded-lg bg-[var(--primary-dark)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {data?.warnings.length ? (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex gap-1 border-b border-gray-200">
        {(["gstr1", "gstr3b"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === t ? "border-[var(--primary-dark)] text-[var(--primary-dark)]" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {t === "gstr1" ? "GSTR-1 (sales)" : "GSTR-3B (summary & tax payable)"}
          </button>
        ))}
      </div>

      {loading && (
        <p className="flex items-center gap-2 py-8 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Working out {monthLabel(month)}…
        </p>
      )}

      {!loading && g1 && tab === "gstr1" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Invoices", String(g1.totals.invoices)],
              ["Taxable value", inr(g1.totals.taxable)],
              ["IGST", inr(g1.totals.igst)],
              ["CGST", inr(g1.totals.cgst)],
              ["SGST", inr(g1.totals.sgst)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-gray-200 px-4 py-3" style={{ backgroundColor: "#ffffff" }}>
                <div className="text-xs font-semibold text-gray-500">{k}</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{v}</div>
              </div>
            ))}
          </div>

          <Section title="Table 4 · B2B invoices" note="Sales to customers with a GSTIN. Customers don't enter a GSTIN at checkout, so this stays empty.">
            <table className="w-full">
              <tbody>
                <Empty cols={1} text="No B2B invoices" />
              </tbody>
            </table>
          </Section>

          <Section title="Table 5 · B2C Large" note="Inter-state invoices to unregistered customers worth more than ₹1,00,000.">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Invoice no.</th>
                  <th className={th}>Date</th>
                  <th className={th}>Place of supply</th>
                  <th className={`${th} text-right`}>Invoice value</th>
                  <th className={`${th} text-right`}>Rate</th>
                  <th className={`${th} text-right`}>Taxable</th>
                  <th className={`${th} text-right`}>IGST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {g1.b2cl.length ? (
                  g1.b2cl.map((r) => (
                    <tr key={`${r.invoiceNumber}-${r.rate}`}>
                      <td className={td}>{r.invoiceNumber}</td>
                      <td className={td}>{dateIN(r.invoiceDate)}</td>
                      <td className={td}>{r.placeOfSupply}-{r.placeOfSupplyName}</td>
                      <td className={tdNum}>{inr(r.invoiceValue)}</td>
                      <td className={tdNum}>{r.rate}%</td>
                      <td className={tdNum}>{inr(r.taxable)}</td>
                      <td className={tdNum}>{inr(r.igst)}</td>
                    </tr>
                  ))
                ) : (
                  <Empty cols={7} text="No B2C Large invoices" />
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Table 7 · B2C Small" note="All other sales to unregistered customers, by place of supply and rate.">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Supply type</th>
                  <th className={th}>Place of supply</th>
                  <th className={`${th} text-right`}>Rate</th>
                  <th className={`${th} text-right`}>Taxable</th>
                  <th className={`${th} text-right`}>IGST</th>
                  <th className={`${th} text-right`}>CGST</th>
                  <th className={`${th} text-right`}>SGST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {g1.b2cs.length ? (
                  g1.b2cs.map((r) => (
                    <tr key={`${r.supplyType}-${r.placeOfSupply}-${r.rate}`}>
                      <td className={td}>{r.supplyType}</td>
                      <td className={td}>{r.placeOfSupply ? `${r.placeOfSupply}-${r.placeOfSupplyName}` : "-"}</td>
                      <td className={tdNum}>{r.rate}%</td>
                      <td className={tdNum}>{inr(r.taxable)}</td>
                      <td className={tdNum}>{inr(r.igst)}</td>
                      <td className={tdNum}>{inr(r.cgst)}</td>
                      <td className={tdNum}>{inr(r.sgst)}</td>
                    </tr>
                  ))
                ) : (
                  <Empty cols={7} text="No B2C sales this month" />
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Table 12 · HSN summary" note="By HSN code and rate.">
            <table className="w-full min-w-[860px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>HSN</th>
                  <th className={th}>Description</th>
                  <th className={`${th} text-right`}>Qty</th>
                  <th className={`${th} text-right`}>Rate</th>
                  <th className={`${th} text-right`}>Total value</th>
                  <th className={`${th} text-right`}>Taxable</th>
                  <th className={`${th} text-right`}>IGST</th>
                  <th className={`${th} text-right`}>CGST</th>
                  <th className={`${th} text-right`}>SGST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {g1.hsn.length ? (
                  g1.hsn.map((r) => (
                    <tr key={`${r.hsn}-${r.rate}`}>
                      <td className={td}>{r.hsn || <span className="text-amber-700">missing</span>}</td>
                      <td className={td}>{r.description}</td>
                      <td className={tdNum}>{r.quantity}</td>
                      <td className={tdNum}>{r.rate}%</td>
                      <td className={tdNum}>{inr(r.totalValue)}</td>
                      <td className={tdNum}>{inr(r.taxable)}</td>
                      <td className={tdNum}>{inr(r.igst)}</td>
                      <td className={tdNum}>{inr(r.cgst)}</td>
                      <td className={tdNum}>{inr(r.sgst)}</td>
                    </tr>
                  ))
                ) : (
                  <Empty cols={9} text="No sales this month" />
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Table 13 · Documents issued">
            <table className="w-full min-w-[620px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Document</th>
                  <th className={th}>From</th>
                  <th className={th}>To</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={`${th} text-right`}>Cancelled</th>
                  <th className={`${th} text-right`}>Net issued</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={td}>Invoices for outward supply</td>
                  <td className={td}>{g1.documents.from || "-"}</td>
                  <td className={td}>{g1.documents.to || "-"}</td>
                  <td className={tdNum}>{g1.documents.total}</td>
                  <td className={tdNum}>{g1.documents.cancelled}</td>
                  <td className={tdNum}>{g1.documents.netIssued}</td>
                </tr>
              </tbody>
            </table>
          </Section>
        </div>
      )}

      {!loading && g3 && tab === "gstr3b" && (
        <div className="space-y-4">
          <Section title="3.1 (a) · Outward taxable supplies" note="Your sales this month (from GSTR-1).">
            <table className="w-full min-w-[620px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${th} text-right`}>Taxable value</th>
                  <th className={`${th} text-right`}>IGST</th>
                  <th className={`${th} text-right`}>CGST</th>
                  <th className={`${th} text-right`}>SGST</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={tdNum}>{inr(g3.outwardTaxable.taxable)}</td>
                  <td className={tdNum}>{inr(g3.outwardTaxable.igst)}</td>
                  <td className={tdNum}>{inr(g3.outwardTaxable.cgst)}</td>
                  <td className={tdNum}>{inr(g3.outwardTaxable.sgst)}</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="3.2 · Inter-state supplies to unregistered persons">
            <table className="w-full min-w-[520px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Place of supply</th>
                  <th className={`${th} text-right`}>Taxable value</th>
                  <th className={`${th} text-right`}>IGST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {g3.interStateUnregistered.length ? (
                  g3.interStateUnregistered.map((r) => (
                    <tr key={r.placeOfSupply}>
                      <td className={td}>{r.placeOfSupply}-{r.placeOfSupplyName}</td>
                      <td className={tdNum}>{inr(r.taxable)}</td>
                      <td className={tdNum}>{inr(r.igst)}</td>
                    </tr>
                  ))
                ) : (
                  <Empty cols={3} text="No inter-state sales" />
                )}
              </tbody>
            </table>
          </Section>

          <Section title="4 · Input tax credit" note={`From ${g3.itc.purchaseBills} bill(s) in the GST purchase register (Custom GST Report) dated this month.`}>
            <table className="w-full min-w-[620px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${th} text-right`}>Purchases (taxable)</th>
                  <th className={`${th} text-right`}>IGST</th>
                  <th className={`${th} text-right`}>CGST</th>
                  <th className={`${th} text-right`}>SGST</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={tdNum}>{inr(g3.itc.purchaseTaxable)}</td>
                  <td className={tdNum}>{inr(g3.itc.igst)}</td>
                  <td className={tdNum}>{inr(g3.itc.cgst)}</td>
                  <td className={tdNum}>{inr(g3.itc.sgst)}</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="6.1 · Tax payable" note="Output tax minus input tax credit (IGST credit used first, CGST and SGST never cross).">
            <table className="w-full min-w-[620px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}></th>
                  <th className={`${th} text-right`}>IGST</th>
                  <th className={`${th} text-right`}>CGST</th>
                  <th className={`${th} text-right`}>SGST</th>
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="font-semibold">
                  <td className={td}>Pay in cash</td>
                  <td className={tdNum}>{inr(g3.payable.igst)}</td>
                  <td className={tdNum}>{inr(g3.payable.cgst)}</td>
                  <td className={tdNum}>{inr(g3.payable.sgst)}</td>
                  <td className={tdNum}>{inr(g3.payable.igst + g3.payable.cgst + g3.payable.sgst)}</td>
                </tr>
                <tr>
                  <td className={td}>Credit carried forward</td>
                  <td className={tdNum}>{inr(g3.creditCarriedForward.igst)}</td>
                  <td className={tdNum}>{inr(g3.creditCarriedForward.cgst)}</td>
                  <td className={tdNum}>{inr(g3.creditCarriedForward.sgst)}</td>
                  <td className={tdNum}>{inr(g3.creditCarriedForward.igst + g3.creditCarriedForward.cgst + g3.creditCarriedForward.sgst)}</td>
                </tr>
              </tbody>
            </table>
          </Section>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Prepared from your records. Have your accountant check it before filing on the GST portal.
      </p>
    </div>
  );
}
