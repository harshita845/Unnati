import React, { useState, useEffect, useRef, useMemo } from "react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { code128DataUrl, loadJsBarcode } from "../../../components/Code128Barcode";
import { getAppSettings, updateAppSettings } from "../../../services/api/admin/adminSettingsService";
import {
  LABEL_SIZE_PRESETS,
  computeLabelLayout,
  initialLabelLayout,
  labelContentScale,
  labelPageCount,
  labelSlot,
  storeLabelLayout,
  type LabelPageLayout,
} from "../../../utils/barcodeLabelLayout";

export interface BulkBarcodeProduct {
  _id?: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string | string[];
  mrp?: number;
  valueMrp?: number;
  sellingPrice?: number;
  price?: number;
  discPrice?: number;
  stock?: number | string;
  unit?: string;
  brand?: string;
  category?: string;
  seller?: string;
  [key: string]: any;
}

interface BulkBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: BulkBarcodeProduct[];
  initialSelectedIds?: Set<string>;
  barcodeSettings?: any;
  /** Called after "Save as default" so single-barcode printing uses the new page setup right away */
  onSettingsSaved?: (barcodeSettings: any) => void;
}

const PT_TO_MM = 0.3528;
const escapeHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** One label to place on the page: the product, its barcode value and the rendered barcode image. */
interface LabelItem {
  product: BulkBarcodeProduct;
  barcodeVal: string;
  barcodeImg: string | null;
}

export default function BulkBarcodeModal({
  isOpen,
  onClose,
  products,
  initialSelectedIds,
  barcodeSettings,
  onSettingsSaved,
}: BulkBarcodeModalProps) {
  // Page setup (label size, labels per row, margins, gaps) shared by preview, PDFs and print
  const [layout, setLayout] = useState<LabelPageLayout>(() => initialLabelLayout(barcodeSettings));
  const computed = useMemo(() => computeLabelLayout(layout), [layout]);
  const [savingDefault, setSavingDefault] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const columnsCount = layout.columns;
  const setColumnsCount = (columns: number) => setLayout((l) => ({ ...l, columns }));
  const updateLayout = (patch: Partial<LabelPageLayout>) => setLayout((l) => ({ ...l, ...patch }));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showStoreName, setShowStoreName] = useState(true);
  const [storeName, setStoreName] = useState("UNNATI STORE");
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");

  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const getProductId = (p: BulkBarcodeProduct) => p.productId || p._id || p.id || "";

  // Initialize selected products and default quantities
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds && initialSelectedIds.size > 0) {
        setSelectedIds(new Set(initialSelectedIds));
      } else {
        // Select all products by default if none specified
        setSelectedIds(new Set(products.map((p) => getProductId(p)).filter(Boolean)));
      }

      const initialQty: Record<string, number> = {};
      products.forEach((p) => {
        const id = getProductId(p);
        if (id) initialQty[id] = 1;
      });
      setQuantities(initialQty);
    }
  }, [isOpen, products, initialSelectedIds, barcodeSettings]);

  // Start from the saved page setup each time the modal opens (not on every product refresh)
  useEffect(() => {
    if (isOpen) setLayout(initialLabelLayout(barcodeSettings));
  }, [isOpen, barcodeSettings]);

  // Remember the last setup used on this computer
  useEffect(() => {
    if (isOpen) storeLabelLayout(layout);
  }, [layout, isOpen]);

  // Determine preview products based on selection and columnsCount
  const selectedProductsList = products.filter((p) => selectedIds.has(getProductId(p)));
  const previewProducts = selectedProductsList.slice(0, Math.max(columnsCount, 1));

  useEffect(() => {
    if (!isOpen || previewProducts.length === 0) return;

    loadJsBarcode().then(() => {
      previewProducts.forEach((prod, index) => {
        const canvas = canvasRefs.current[index];
        if (!canvas || !prod) return;

        const rawBarcode = Array.isArray(prod.barcode) ? prod.barcode[0] : prod.barcode;
        const barcodeValue = rawBarcode || prod.sku || getProductId(prod) || "123456789";

        try {
          (window as any).JsBarcode(canvas, barcodeValue, {
            format: "CODE128",
            width: columnsCount >= 3 ? 1.4 : columnsCount === 2 ? 1.75 : 2,
            height: columnsCount >= 3 ? 36 : columnsCount === 2 ? 42 : 48,
            displayValue: showSku,
            fontSize: columnsCount >= 3 ? 10 : 11,
            margin: 2,
          });
        } catch (e) {
          console.error("JsBarcode preview error:", e);
        }
      });
    });
  }, [
    previewProducts,
    showSku,
    isOpen,
    columnsCount,
    layout,
    showStoreName,
    storeName,
    showProductName,
    showPrice,
    showMrp,
  ]);

  if (!isOpen) return null;

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isAllSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedIds.has(getProductId(p)));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => {
          const id = getProductId(p);
          if (id) next.delete(id);
        });
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => {
          const id = getProductId(p);
          if (id) next.add(id);
        });
        return next;
      });
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleQtyChange = (id: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, qty) }));
  };

  const barcodeValueOf = (product: BulkBarcodeProduct) => {
    const rawBarcode = Array.isArray(product.barcode) ? product.barcode[0] : product.barcode;
    return rawBarcode || product.sku || getProductId(product) || "123456789";
  };

  const priceTextOf = (product: BulkBarcodeProduct, rupee: string) => {
    const sp = product.sellingPrice || product.price || 0;
    const mrp = product.mrp || product.valueMrp || sp;
    return showMrp && mrp > sp ? `MRP: ${rupee}${mrp}  SP: ${rupee}${sp}` : `SP: ${rupee}${sp}`;
  };

  /** Every label to print, in order: each selected product repeated by its quantity. */
  const buildLabelItems = async (list: BulkBarcodeProduct[]): Promise<LabelItem[]> => {
    const items: LabelItem[] = [];
    for (const product of list) {
      const barcodeVal = barcodeValueOf(product);
      const barcodeImg = await code128DataUrl(barcodeVal);
      const qty = Math.max(1, quantities[getProductId(product)] || 1);
      for (let q = 0; q < qty; q++) items.push({ product, barcodeVal, barcodeImg });
    }
    return items;
  };

  /** Draw one label's content inside its box (x, y = top-left, mm), scaled to the label size. */
  const drawLabelOnPdf = (doc: jsPDF, item: LabelItem, x: number, y: number, w: number, h: number) => {
    const s = labelContentScale(w, h);
    const pad = Math.max(0.8, 1.2 * s);
    const innerW = w - pad * 2;
    const cx = x + w / 2;
    let cy = y + pad;

    if (computed.border) {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, w, h, 1, 1, "S");
    }

    const line = (text: string, size: number, font: "helvetica" | "courier") => {
      doc.setFont(font, "bold");
      doc.setFontSize(size);
      doc.setTextColor(15, 23, 42);
      const fitted = (doc.splitTextToSize(text, innerW) as string[])[0] || "";
      doc.text(fitted, cx, cy + size * PT_TO_MM * 0.85, { align: "center" });
      cy += size * PT_TO_MM * 1.15;
    };

    const storeSize = 7.5 * s;
    const nameSize = 7 * s;
    const skuSize = 6.5 * s;
    const priceSize = 7 * s;
    const bottom = (showSku ? skuSize * PT_TO_MM * 1.15 : 0) + (showPrice ? priceSize * PT_TO_MM * 1.15 : 0);

    if (showStoreName && storeName) line(storeName.toUpperCase(), storeSize, "helvetica");
    if (showProductName && item.product.name) line(item.product.name, nameSize, "helvetica");

    // The barcode gets whatever height is left between the text above and below
    const available = y + h - pad - bottom - cy - 0.6;
    if (item.barcodeImg && available > 2) {
      const imgH = Math.min(available, 16 * s);
      doc.addImage(item.barcodeImg, "PNG", x + pad, cy + 0.3, innerW, imgH);
      cy += imgH + 0.6;
    }
    if (showSku) line(item.barcodeVal, skuSize, "courier");
    if (showPrice) line(priceTextOf(item.product, "Rs. "), priceSize, "helvetica");
  };

  /** A PDF with the labels placed exactly by the page setup (roll: one row per page; A4: full sheets). */
  const buildLabelsPdf = (items: LabelItem[]) => {
    const L = computed;
    const format: any = L.paper === "a4" ? "a4" : [L.pageWidth, L.pageHeight];
    const orientation = L.pageWidth > L.pageHeight ? "landscape" : "portrait";
    const doc = new jsPDF({ unit: "mm", format, orientation });
    items.forEach((item, i) => {
      const slot = labelSlot(L, i);
      if (i > 0 && i % L.perPage === 0) doc.addPage(format, orientation);
      drawLabelOnPdf(doc, item, slot.x, slot.y, L.labelWidth, L.labelHeight);
    });
    return doc;
  };

  const selectedProducts = () => products.filter((p) => selectedIds.has(getProductId(p)));

  const blockedByLayout = () => {
    if (computed.problems.length) {
      alert(`Page setup problem:\n${computed.problems.join("\n")}`);
      return true;
    }
    return false;
  };

  // 1. ZIP with one PDF per product (each laid out with the same page setup)
  const handleDownloadZipPDFs = async () => {
    const selectedList = selectedProducts();
    if (selectedList.length === 0) {
      alert("Please select at least one product.");
      return;
    }
    if (blockedByLayout()) return;

    setIsGenerating(true);
    setGenerationProgress("Initializing ZIP archive...");
    try {
      const zip = new JSZip();
      for (let i = 0; i < selectedList.length; i++) {
        const product = selectedList[i];
        const prodId = getProductId(product);
        setGenerationProgress(`Generating PDF ${i + 1} of ${selectedList.length}: ${product.name}`);
        const pdfDoc = buildLabelsPdf(await buildLabelItems([product]));
        const sanitizedName = product.name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
        zip.file(`Barcode_${sanitizedName}_${product.sku || prodId}.pdf`, pdfDoc.output("arraybuffer"));
      }
      setGenerationProgress("Compressing ZIP file...");
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `bulk_barcodes_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      setGenerationProgress("Download complete!");
    } catch (err) {
      console.error("Failed to generate ZIP:", err);
      alert("Failed to generate bulk ZIP archive. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. One PDF with every label
  const handleDownloadSingleBulkPdf = async () => {
    const selectedList = selectedProducts();
    if (selectedList.length === 0) {
      alert("Please select at least one product.");
      return;
    }
    if (blockedByLayout()) return;

    setIsGenerating(true);
    setGenerationProgress(`Generating ${columnsCount}-column barcode PDF...`);
    try {
      const doc = buildLabelsPdf(await buildLabelItems(selectedList));
      doc.save(`bulk_barcodes_${columnsCount}col_${computed.paper}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF sheet:", err);
      alert("Failed to generate PDF sheet.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Direct print: same positions in millimetres, page size set for the printer
  const handlePrintBarcodes = async () => {
    const selectedList = selectedProducts();
    if (selectedList.length === 0) {
      alert("Please select at least one product.");
      return;
    }
    if (blockedByLayout()) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print barcodes");
      return;
    }

    const L = computed;
    const items = await buildLabelItems(selectedList);
    const s = labelContentScale(L.labelWidth, L.labelHeight);
    const pad = Math.max(0.8, 1.2 * s);

    const pages: string[][] = [];
    items.forEach((item, i) => {
      const slot = labelSlot(L, i);
      if (!pages[slot.page]) pages[slot.page] = [];
      pages[slot.page].push(`
        <div class="label" style="left:${slot.x}mm;top:${slot.y}mm">
          ${showStoreName && storeName ? `<div class="store">${escapeHtml(storeName)}</div>` : ""}
          ${showProductName ? `<div class="name">${escapeHtml(item.product.name)}</div>` : ""}
          <div class="bc">${item.barcodeImg ? `<img src="${item.barcodeImg}" />` : ""}</div>
          ${showSku ? `<div class="sku">${escapeHtml(item.barcodeVal)}</div>` : ""}
          ${showPrice ? `<div class="price">${escapeHtml(priceTextOf(item.product, "₹"))}</div>` : ""}
        </div>`);
    });

    const pageSize = L.paper === "a4" ? "210mm 297mm" : `${L.pageWidth}mm ${L.pageHeight}mm`;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print Barcodes (${L.columns} per row)</title>
  <style>
    @page { size: ${pageSize}; margin: 0; }
    *, *:before, *:after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .page { position: relative; width: ${L.pageWidth}mm; height: ${L.pageHeight}mm; overflow: hidden;
      page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .label { position: absolute; width: ${L.labelWidth}mm; height: ${L.labelHeight}mm; padding: ${pad}mm;
      display: flex; flex-direction: column; align-items: center; text-align: center; overflow: hidden;
      ${L.border ? "border: 0.2mm solid #94a3b8; border-radius: 1mm;" : ""} }
    .store { font-size: ${(7.5 * s).toFixed(1)}pt; font-weight: 800; text-transform: uppercase; line-height: 1.15; width: 100%;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name { font-size: ${(7 * s).toFixed(1)}pt; font-weight: 700; line-height: 1.15; width: 100%;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bc { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; padding: 0.3mm 0; }
    .bc img { width: 100%; height: 100%; max-height: ${(16 * s).toFixed(1)}mm; object-fit: fill; image-rendering: pixelated; }
    .sku { font-family: "Courier New", Courier, monospace; font-size: ${(6.5 * s).toFixed(1)}pt; font-weight: 700; line-height: 1.15; }
    .price { font-size: ${(7 * s).toFixed(1)}pt; font-weight: 800; line-height: 1.15; white-space: nowrap; }
  </style>
</head>
<body>
  ${pages.map((labels) => `<div class="page">${labels.join("")}</div>`).join("")}
  <script>
    window.onload = function () { setTimeout(function () { window.print(); window.close(); }, 300); };
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  /** Save this page setup (and label size) to Barcode Settings so every PC and every print uses it. */
  const saveLayoutAsDefault = async () => {
    setSavingDefault(true);
    setSaveMessage("");
    try {
      const res: any = await getAppSettings();
      const current = res?.data?.barcodeSettings || barcodeSettings || {};
      const { labelWidth, labelHeight, ...pageSetup } = layout;
      const next = { ...current, width: labelWidth, height: labelHeight, layout: pageSetup };
      const saved: any = await updateAppSettings({ barcodeSettings: next } as any);
      if (saved?.success === false) throw new Error(saved?.message || "Save failed");
      onSettingsSaved?.(next);
      setSaveMessage("Saved. Used for all barcode PDFs and prints.");
    } catch (err: any) {
      setSaveMessage(err?.response?.data?.message || err?.message || "Could not save");
    } finally {
      setSavingDefault(false);
    }
  };

  const totalLabels = Array.from(selectedIds).reduce((sum, id) => sum + (quantities[id] || 1), 0);
  const presetId = LABEL_SIZE_PRESETS.find((p) => p.width === layout.labelWidth && p.height === layout.labelHeight)?.id || "custom";
  const numberInput = (key: keyof LabelPageLayout, label: string, step = 0.1, min = 0) => (
    <label className="block">
      <span className="block text-[10px] font-semibold text-neutral-500 mb-0.5">{label}</span>
      <div className="flex items-center rounded-lg border border-neutral-300 bg-white focus-within:ring-2 focus-within:ring-[var(--primary-color)]">
        <input
          type="number"
          step={step}
          min={min}
          value={layout[key] as number}
          onChange={(e) => updateLayout({ [key]: e.target.value === "" ? 0 : Number(e.target.value) } as Partial<LabelPageLayout>)}
          className="w-full px-2 py-1.5 text-xs rounded-lg focus:outline-none"
        />
        <span className="pr-2 text-[10px] text-neutral-400">mm</span>
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[var(--primary-color)] text-white flex justify-between items-center shadow-md">
          <div className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <div>
              <h2 className="text-lg font-bold leading-tight">Bulk Barcode Export & ZIP Download</h2>
              <p className="text-xs text-white/80">Generate editable vector barcode PDFs & compressed ZIP packages in bulk</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors text-white cursor-pointer"
            title="Close Modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden bg-neutral-50">
          
          {/* Left Column: Product Selection List */}
          <div className="md:col-span-5 border-r border-neutral-200 p-4 flex flex-col overflow-hidden bg-white">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search products by name, SKU or barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                />
                <svg className="absolute left-3 top-2.5 text-neutral-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>

              <button
                onClick={toggleSelectAll}
                className="text-xs font-semibold px-3 py-1.5 border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-700 whitespace-nowrap cursor-pointer"
              >
                {isAllSelected ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-500 mb-2 px-1">
              <span>Selected: <strong className="text-[var(--primary-color)] font-bold">{selectedIds.size}</strong> of {products.length} products</span>
              <span>Total Labels: <strong className="text-neutral-800">{Array.from(selectedIds).reduce((sum, id) => sum + (quantities[id] || 1), 0)}</strong></span>
            </div>

            {/* Product Table */}
            <div className="flex-1 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">No matching products found.</div>
              ) : (
                filteredProducts.map((product) => {
                  const prodId = getProductId(product);
                  const isChecked = selectedIds.has(prodId);
                  const qty = quantities[prodId] || 1;
                  const rawBarcode = Array.isArray(product.barcode) ? product.barcode[0] : product.barcode;
                  const barcodeVal = rawBarcode || product.sku || "N/A";

                  return (
                    <div
                      key={prodId}
                      className={`p-2.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                        isChecked ? "bg-emerald-50/50 hover:bg-emerald-50" : "hover:bg-neutral-50"
                      }`}
                    >
                      <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectProduct(prodId)}
                          className="w-4 h-4 rounded text-[var(--primary-color)] focus:ring-[var(--primary-color)] cursor-pointer"
                        />
                        <div className="truncate">
                          <p className="font-semibold text-neutral-800 truncate">{product.name}</p>
                          <p className="text-[11px] text-neutral-500 font-mono">
                            SKU: {product.sku} | BC: {barcodeVal} | ₹{product.sellingPrice || product.price || 0}
                          </p>
                        </div>
                      </label>

                      {isChecked && (
                        <div className="flex items-center gap-1.5 shrink-0 bg-white border border-neutral-300 rounded px-1 py-0.5">
                          <span className="text-[10px] text-neutral-400 font-medium">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={qty}
                            onChange={(e) => handleQtyChange(prodId, parseInt(e.target.value) || 1)}
                            className="w-12 text-center text-xs font-semibold focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Settings & Live Preview */}
          <div className="md:col-span-7 p-5 flex flex-col justify-between overflow-y-auto space-y-4">
            
            {/* Label Customization Settings */}
            <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-100 pb-2 flex items-center justify-between">
                <span>Barcode Label Settings</span>
                <span className="text-[10px] text-[var(--primary-color)] lowercase font-normal bg-emerald-50 px-2 py-0.5 rounded">
                  {columnsCount} Column{columnsCount > 1 ? "s" : ""} mode
                </span>
              </h3>

              {/* Layout Columns Choice (1, 2, or 3 columns) */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1.5 flex items-center justify-between">
                  <span>Columns Layout (Per Row)</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Labels across the roll / sheet</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setColumnsCount(col)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        columnsCount === col
                          ? "bg-[var(--primary-color)] text-white border-[var(--primary-color)] shadow-sm scale-[1.02]"
                          : "bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                        columnsCount === col ? "bg-white text-[var(--primary-color)]" : "bg-neutral-200 text-neutral-700"
                      }`}>
                        {col}
                      </span>
                      <span>{col === 1 ? "1 Column" : `${col} Columns`}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1 border-t border-neutral-100">
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Store Header Text</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full text-xs border border-neutral-300 rounded-lg p-1.5 focus:ring-2 focus:ring-[var(--primary-color)]"
                  placeholder="Store / Brand Name"
                />
              </div>

              {/* Toggles */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1.5">
                  Print Content Elements
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStoreName}
                      onChange={(e) => setShowStoreName(e.target.checked)}
                      className="rounded text-[var(--primary-color)]"
                    />
                    <span>Store Name</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showProductName}
                      onChange={(e) => setShowProductName(e.target.checked)}
                      className="rounded text-[var(--primary-color)]"
                    />
                    <span>Product Title</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSku}
                      onChange={(e) => setShowSku(e.target.checked)}
                      className="rounded text-[var(--primary-color)]"
                    />
                    <span>Barcode Code / SKU</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="rounded text-[var(--primary-color)]"
                    />
                    <span>Price (SP / MRP)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Page Setup: margins, gaps and page size, used by the preview, PDFs and print */}
            <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-100 pb-2 flex items-center justify-between">
                <span>Page Setup · Margins &amp; Gaps</span>
                <span className="text-[10px] text-neutral-500 font-mono font-medium normal-case">
                  Page {computed.pageWidth} × {computed.pageHeight} mm
                </span>
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {(["roll", "a4"] as const).map((paper) => (
                  <button
                    key={paper}
                    type="button"
                    onClick={() => updateLayout({ paper })}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      layout.paper === paper
                        ? "bg-[var(--primary-color)] text-white border-[var(--primary-color)]"
                        : "bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                    }`}
                  >
                    {paper === "roll" ? "Label roll (thermal printer)" : "A4 sheet"}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2 items-end">
                <label className="col-span-2 block">
                  <span className="block text-[10px] font-semibold text-neutral-500 mb-0.5">Label size</span>
                  <select
                    value={presetId}
                    onChange={(e) => {
                      const preset = LABEL_SIZE_PRESETS.find((p) => p.id === e.target.value);
                      if (preset) updateLayout({ labelWidth: preset.width, labelHeight: preset.height });
                    }}
                    className="w-full text-xs border border-neutral-300 rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-[var(--primary-color)]"
                  >
                    {LABEL_SIZE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                    <option value="custom">Custom size</option>
                  </select>
                </label>
                {numberInput("labelWidth", "Label width", 0.1, 10)}
                {numberInput("labelHeight", "Label height", 0.1, 10)}
              </div>

              {layout.paper === "roll" && (
                <label className="block w-1/4">
                  <span className="block text-[10px] font-semibold text-neutral-500 mb-0.5">Rows per page</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={layout.rows}
                    onChange={(e) => updateLayout({ rows: Number(e.target.value) || 1 })}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                  />
                </label>
              )}

              <div>
                <p className="text-[11px] font-semibold text-neutral-600 mb-1">Page margins (4 sides)</p>
                <div className="grid grid-cols-4 gap-2">
                  {numberInput("marginTop", "Top")}
                  {numberInput("marginBottom", "Bottom")}
                  {numberInput("marginLeft", "Left")}
                  {numberInput("marginRight", "Right")}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-neutral-600 mb-1">Gap between labels</p>
                <div className="grid grid-cols-4 gap-2 items-end">
                  {numberInput("gapX", "Horizontal (side by side)")}
                  {numberInput("gapY", "Vertical (between rows)")}
                  <label className="col-span-2 flex items-center gap-2 text-xs pb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layout.border}
                      onChange={(e) => updateLayout({ border: e.target.checked })}
                      className="rounded text-[var(--primary-color)]"
                    />
                    Print a thin border around each label
                  </label>
                </div>
              </div>

              {computed.problems.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  {computed.problems.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                  <p className="mt-0.5">Reduce the columns, label width, margins or gaps.</p>
                </div>
              )}

              {/* Scaled drawing of one page: grey = page, dashed = margins, green = labels */}
              <div className="rounded-lg bg-neutral-100 p-2 flex justify-center">
                <svg
                  viewBox={`0 0 ${computed.pageWidth} ${computed.pageHeight}`}
                  className="w-full"
                  style={{ maxHeight: computed.paper === "a4" ? 240 : 110 }}
                  preserveAspectRatio="xMidYMid meet"
                >
                  <rect x={0} y={0} width={computed.pageWidth} height={computed.pageHeight} fill="#ffffff" stroke="#94a3b8" strokeWidth={computed.pageWidth / 250} />
                  <rect
                    x={computed.marginLeft}
                    y={computed.marginTop}
                    width={Math.max(0, computed.pageWidth - computed.marginLeft - computed.marginRight)}
                    height={Math.max(0, computed.pageHeight - computed.marginTop - computed.marginBottom)}
                    fill="none"
                    stroke="#f59e0b"
                    strokeDasharray={`${computed.pageWidth / 80} ${computed.pageWidth / 120}`}
                    strokeWidth={computed.pageWidth / 400}
                  />
                  {Array.from({ length: Math.min(computed.perPage, 80) }, (_, i) => labelSlot(computed, i)).map((slot, i) => (
                    <rect
                      key={i}
                      x={slot.x}
                      y={slot.y}
                      width={computed.labelWidth}
                      height={computed.labelHeight}
                      rx={Math.min(computed.labelWidth, computed.labelHeight) * 0.08}
                      fill="#ecfdf5"
                      stroke="#059669"
                      strokeWidth={computed.pageWidth / 300}
                    />
                  ))}
                </svg>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-neutral-500 font-mono">
                  Page {computed.pageWidth} × {computed.pageHeight} mm · Label {computed.labelWidth} × {computed.labelHeight} mm ·{" "}
                  {computed.columns} per row · {computed.rowsPerPage} row{computed.rowsPerPage > 1 ? "s" : ""}/page ·{" "}
                  {labelPageCount(computed, totalLabels)} page{labelPageCount(computed, totalLabels) === 1 ? "" : "s"} for {totalLabels} labels
                </p>
                <div className="flex items-center gap-2">
                  {saveMessage && <span className="text-[10px] text-neutral-600">{saveMessage}</span>}
                  <button
                    type="button"
                    onClick={saveLayoutAsDefault}
                    disabled={savingDefault}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--primary-color)] text-[var(--primary-color)] hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
                    title="Save this page setup and label size to Barcode Settings so every PC and every barcode print uses it"
                  >
                    {savingDefault ? "Saving…" : "Save as default"}
                  </button>
                </div>
              </div>
            </div>

            {/* Live Preview Card - Dynamically shows 1, 2, or 3 columns */}
            <div className="bg-neutral-100 border border-neutral-300 border-dashed rounded-xl p-3 flex flex-col items-center justify-center min-h-[170px]">
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full inline-block ${previewProducts.length > 0 ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`}></span>
                  Live Barcode Label Preview ({columnsCount} Column{columnsCount > 1 ? "s" : ""})
                </span>
                <span className="text-[10px] text-neutral-500 font-mono font-medium">
                  {columnsCount} Column{columnsCount > 1 ? "s" : ""} / Row
                </span>
              </div>

              {/* Grid of Preview Cards */}
              {previewProducts.length > 0 ? (
                <div
                  className={`grid w-full ${columnsCount === 1 ? "max-w-xs mx-auto" : ""}`}
                  style={{
                    gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))`,
                    // Follow the horizontal gap setting (1 mm ≈ 3.8 px on screen)
                    gap: `${Math.min(24, Math.max(2, layout.gapX * 3.8))}px`,
                  }}
                >
                  {previewProducts.map((p, idx) => {
                    const prodId = getProductId(p);
                    const sp = p.sellingPrice || p.price || 0;
                    const mrp = p.mrp || p.valueMrp || sp;

                    return (
                      <div
                        key={`${prodId}-${idx}`}
                        className="bg-white border border-neutral-300 shadow-xs rounded-md p-2 flex flex-col items-center text-center justify-between transition-all min-h-[135px]"
                      >
                        {showStoreName && storeName && (
                          <div className="text-[9px] font-extrabold uppercase tracking-tight text-neutral-900 border-b border-neutral-100 pb-0.5 w-full truncate">
                            {storeName}
                          </div>
                        )}

                        {showProductName && (
                          <div className="text-[10px] font-semibold leading-tight text-neutral-800 line-clamp-1 w-full my-0.5">
                            {p.name}
                          </div>
                        )}

                        <div className="my-1 flex justify-center w-full overflow-hidden">
                          <canvas
                            ref={(el) => (canvasRefs.current[idx] = el)}
                            className="max-w-full h-auto"
                          />
                        </div>

                        {showPrice && (
                          <div className="text-[9.5px] font-bold text-neutral-900 w-full pt-0.5 border-t border-neutral-100/60 flex items-center justify-center gap-1 flex-wrap">
                            {showMrp && mrp > sp ? (
                              <span className="text-[8.5px] text-neutral-400 font-normal line-through">
                                ₹{mrp}
                              </span>
                            ) : null}
                            <span>SP: ₹{sp}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center justify-center text-center text-neutral-400 space-y-1">
                  <p className="text-xs font-semibold text-neutral-600">No products selected</p>
                  <p className="text-[11px] text-neutral-400">Select one or more products on the left to preview and export barcodes</p>
                </div>
              )}
            </div>

            {/* Status / Progress Indicator */}
            {isGenerating && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-center gap-3">
                <svg className="animate-spin text-emerald-600 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <span className="font-semibold">{generationProgress}</span>
              </div>
            )}

            {/* Action Buttons Footer */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              
              {/* Option 1: ZIP Archive of PDFs */}
              <button
                onClick={handleDownloadZipPDFs}
                disabled={isGenerating || selectedIds.size === 0 || computed.problems.length > 0}
                className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Download ZIP containing editable individual PDF barcodes for selected products"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download ZIP (PDFs)
              </button>

              {/* Option 2: Single Bulk Sheet PDF */}
              <button
                onClick={handleDownloadSingleBulkPdf}
                disabled={isGenerating || selectedIds.size === 0 || computed.problems.length > 0}
                className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title={`Download single combined PDF sheet with selected barcodes in ${columnsCount} columns`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                Bulk Sheet PDF ({columnsCount} Col{columnsCount > 1 ? "s" : ""})
              </button>

              {/* Option 3: Direct Print */}
              <button
                onClick={handlePrintBarcodes}
                disabled={isGenerating || selectedIds.size === 0 || computed.problems.length > 0}
                className="bg-neutral-800 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title={`Direct print selected barcodes in ${columnsCount} columns`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Print Barcodes ({columnsCount} Col{columnsCount > 1 ? "s" : ""})
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
