import React, { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { code128DataUrl, loadJsBarcode } from "../../../components/Code128Barcode";

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
}

export default function BulkBarcodeModal({
  isOpen,
  onClose,
  products,
  initialSelectedIds,
  barcodeSettings,
}: BulkBarcodeModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [labelSize, setLabelSize] = useState<"38x25" | "50x30" | "60x40" | "a4_24">("50x30");
  const [showStoreName, setShowStoreName] = useState(true);
  const [storeName, setStoreName] = useState("UNNATI STORE");
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize selected products and default quantities
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds && initialSelectedIds.size > 0) {
        setSelectedIds(new Set(initialSelectedIds));
      } else {
        // Select all products by default if none specified
        setSelectedIds(new Set(products.map((p) => p.productId)));
      }

      const initialQty: Record<string, number> = {};
      products.forEach((p) => {
        initialQty[p.productId] = 1;
      });
      setQuantities(initialQty);

      if (barcodeSettings?.width && barcodeSettings?.height) {
        const w = barcodeSettings.width;
        const h = barcodeSettings.height;
        if (w === 38 && h === 25) setLabelSize("38x25");
        else if (w === 60 && h === 40) setLabelSize("60x40");
        else setLabelSize("50x30");
      }
    }
  }, [isOpen, products, initialSelectedIds, barcodeSettings]);

  // Render live preview barcode
  const previewProduct = products.find((p) => selectedIds.has(p.productId)) || products[0];

  useEffect(() => {
    if (!previewProduct || !previewCanvasRef.current) return;

    loadJsBarcode().then(() => {
      if (!previewCanvasRef.current) return;
      const rawBarcode = Array.isArray(previewProduct.barcode)
        ? previewProduct.barcode[0]
        : previewProduct.barcode;
      const barcodeValue = rawBarcode || previewProduct.sku || previewProduct.productId || "123456789";
      
      try {
        (window as any).JsBarcode(previewCanvasRef.current, barcodeValue, {
          format: "CODE128",
          width: 2,
          height: 48,
          displayValue: showSku,
          fontSize: 12,
          margin: 4,
        });
      } catch (e) {
        console.error("JsBarcode preview error:", e);
      }
    });
  }, [previewProduct, showSku, isOpen]);

  if (!isOpen) return null;

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.productId)));
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

  // Helper to generate PDF document for a single product label
  const createProductLabelPdf = async (product: BulkBarcodeProduct, copyQty: number) => {
    let widthMm = 50;
    let heightMm = 30;

    if (labelSize === "38x25") {
      widthMm = 38;
      heightMm = 25;
    } else if (labelSize === "60x40") {
      widthMm = 60;
      heightMm = 40;
    }

    const doc = new jsPDF({
      orientation: widthMm > heightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [widthMm, heightMm],
    });

    const rawBarcode = Array.isArray(product.barcode) ? product.barcode[0] : product.barcode;
    const barcodeVal = rawBarcode || product.sku || product.productId || "123456789";
    const barcodeImg = await code128DataUrl(barcodeVal);

    for (let page = 0; page < copyQty; page++) {
      if (page > 0) doc.addPage([widthMm, heightMm], widthMm > heightMm ? "landscape" : "portrait");

      let currentY = 3;

      // Header Store Name
      if (showStoreName && storeName) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(storeName.toUpperCase(), widthMm / 2, currentY + 2, { align: "center" });
        currentY += 4;
      }

      // Product Name
      if (showProductName && product.name) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        const wrappedLines: string[] = doc.splitTextToSize(product.name, widthMm - 6);
        const linesToPrint = wrappedLines.slice(0, 1);
        doc.text(linesToPrint[0] || "", widthMm / 2, currentY + 2, { align: "center" });
        currentY += 4;
      }

      // Barcode Image
      if (barcodeImg) {
        const imgWidth = widthMm - 8;
        const imgHeight = Math.min(heightMm - currentY - 7, 14);
        doc.addImage(barcodeImg, "PNG", 4, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 1;
      }

      // Barcode / SKU text below barcode
      if (showSku) {
        doc.setFontSize(7);
        doc.setFont("courier", "bold");
        doc.text(barcodeVal, widthMm / 2, currentY + 1, { align: "center" });
        currentY += 3;
      }

      // Price / MRP / SP
      if (showPrice) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const sp = product.sellingPrice || product.price || 0;
        const mrp = product.mrp || product.valueMrp || sp;
        let priceStr = `SP: Rs. ${sp}`;
        if (showMrp && mrp > sp) {
          priceStr = `MRP: Rs. ${mrp}  SP: Rs. ${sp}`;
        }
        doc.text(priceStr, widthMm / 2, currentY + 2, { align: "center" });
      }
    }

    return doc;
  };

  // 1. Download Bulk ZIP of editable PDF files
  const handleDownloadZipPDFs = async () => {
    const selectedList = products.filter((p) => selectedIds.has(p.productId));
    if (selectedList.length === 0) {
      alert("Please select at least one product.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress("Initializing ZIP archive...");

    try {
      const zip = new JSZip();

      for (let i = 0; i < selectedList.length; i++) {
        const product = selectedList[i];
        const qty = quantities[product.productId] || 1;

        setGenerationProgress(`Generating PDF ${i + 1} of ${selectedList.length}: ${product.name}`);

        const pdfDoc = await createProductLabelPdf(product, qty);
        const pdfArrayBuffer = pdfDoc.output("arraybuffer");

        const sanitizedName = product.name
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .substring(0, 30);
        const filename = `Barcode_${sanitizedName}_${product.sku || product.productId}.pdf`;

        zip.file(filename, pdfArrayBuffer);
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

  // 2. Download single compiled Bulk PDF sheet (2 COLUMNS PER PAGE)
  const handleDownloadSingleBulkPdf = async () => {
    const selectedList = products.filter((p) => selectedIds.has(p.productId));
    if (selectedList.length === 0) {
      alert("Please select at least one product.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress("Generating 2-Column Barcode PDF sheet...");

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageMarginLeft = 10;
      const pageMarginTop = 10;
      const colWidth = 92;
      const rowHeight = 43;
      const colGap = 6;
      const rowGap = 3;

      const colsPerPage = 2;
      const rowsPerPage = 6;
      const itemsPerPage = colsPerPage * rowsPerPage; // 12 barcodes per A4 page (2 columns x 6 rows)

      let itemIndex = 0;

      for (let i = 0; i < selectedList.length; i++) {
        const product = selectedList[i];
        const qty = quantities[product.productId] || 1;
        const rawBarcode = Array.isArray(product.barcode) ? product.barcode[0] : product.barcode;
        const barcodeVal = rawBarcode || product.sku || product.productId || "123456789";
        const barcodeImg = await code128DataUrl(barcodeVal);

        for (let q = 0; q < qty; q++) {
          if (itemIndex > 0 && itemIndex % itemsPerPage === 0) {
            doc.addPage("a4", "portrait");
          }

          const positionOnPage = itemIndex % itemsPerPage;
          const col = positionOnPage % colsPerPage; // 0 or 1
          const row = Math.floor(positionOnPage / colsPerPage); // 0..5

          const x = pageMarginLeft + col * (colWidth + colGap);
          const y = pageMarginTop + row * (rowHeight + rowGap);

          // Draw clean rounded boundary box for each label
          doc.setDrawColor(209, 213, 219);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(x, y, colWidth, rowHeight, 2, 2, "FD");

          let currentY = y + 4.5;
          const centerX = x + colWidth / 2;

          // Header Store Name
          if (showStoreName && storeName) {
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(storeName.toUpperCase(), centerX, currentY, { align: "center" });
            currentY += 4.5;
          }

          // Product Name (wrapped properly without overlapping)
          if (showProductName && product.name) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 41, 59);

            const wrappedLines: string[] = doc.splitTextToSize(product.name, colWidth - 8);
            const linesToPrint = wrappedLines.slice(0, 2);
            linesToPrint.forEach((line: string) => {
              doc.text(line, centerX, currentY, { align: "center" });
              currentY += 3.8;
            });
          }

          // Barcode Image
          if (barcodeImg) {
            const imgW = colWidth - 16;
            const imgH = 14;
            const imgX = x + 8;
            doc.addImage(barcodeImg, "PNG", imgX, currentY, imgW, imgH);
            currentY += imgH + 2;
          }

          // SKU & Barcode Code Text
          if (showSku) {
            doc.setFontSize(7.5);
            doc.setFont("courier", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(barcodeVal, centerX, currentY, { align: "center" });
            currentY += 3.5;
          }

          // Price / MRP / SP
          if (showPrice) {
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            const sp = product.sellingPrice || product.price || 0;
            const mrp = product.mrp || product.valueMrp || sp;
            let priceStr = `SP: Rs. ${sp}`;
            if (showMrp && mrp > sp) {
              priceStr = `MRP: Rs. ${mrp} | SP: Rs. ${sp}`;
            }
            doc.text(priceStr, centerX, currentY, { align: "center" });
          }

          itemIndex++;
        }
      }

      doc.save(`bulk_barcodes_2col_sheet_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Failed to generate 2-Column PDF sheet:", err);
      alert("Failed to generate PDF sheet.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Print Barcodes (2 COLUMNS PER PAGE, NO TEXT BREAKING)
  const handlePrintBarcodes = async () => {
    const selectedList = products.filter((p) => selectedIds.has(p.productId));
    if (selectedList.length === 0) {
      alert("Please select at least one product.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print barcodes");
      return;
    }

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Bulk Barcodes (2 Columns)</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          *, *:before, *:after {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            color: #111827;
          }
          .print-grid {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            width: 100%;
          }
          .label-card {
            width: 48.5%;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 10px;
            margin-bottom: 6mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            text-align: center;
            background: #ffffff;
            page-break-inside: avoid;
            break-inside: avoid;
            min-height: 125px;
          }
          .store-name {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
            margin-bottom: 2px;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 2px;
          }
          .product-title {
            font-size: 11px;
            font-weight: 600;
            color: #1e293b;
            line-height: 1.25;
            margin-bottom: 4px;
            width: 100%;
            max-height: 2.5em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            word-break: break-word;
          }
          .barcode-container {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 2px 0;
          }
          .barcode-img {
            max-width: 88%;
            height: 48px;
            object-fit: contain;
          }
          .sku-code {
            font-size: 10px;
            font-family: "Courier New", Courier, monospace;
            font-weight: 700;
            color: #0f172a;
            margin-top: 2px;
            letter-spacing: 0.5px;
          }
          .price-line {
            font-size: 10px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 3px;
          }
          .mrp-strike {
            font-size: 9px;
            font-weight: 400;
            color: #64748b;
            text-decoration: line-through;
            margin-right: 4px;
          }
        </style>
      </head>
      <body>
        <div class="print-grid">
    `;

    for (const product of selectedList) {
      const qty = quantities[product.productId] || 1;
      const rawBarcode = Array.isArray(product.barcode) ? product.barcode[0] : product.barcode;
      const barcodeVal = rawBarcode || product.sku || product.productId || "123456789";
      const barcodeImg = await code128DataUrl(barcodeVal);

      const sp = product.sellingPrice || product.price || 0;
      const mrp = product.mrp || product.valueMrp || sp;

      for (let q = 0; q < qty; q++) {
        htmlContent += `
          <div class="label-card">
            ${showStoreName && storeName ? `<div class="store-name">${storeName}</div>` : ""}
            ${showProductName ? `<div class="product-title">${product.name}</div>` : ""}
            ${
              barcodeImg
                ? `<div class="barcode-container"><img class="barcode-img" src="${barcodeImg}" /></div>`
                : ""
            }
            ${showSku ? `<div class="sku-code">${barcodeVal}</div>` : ""}
            ${
              showPrice
                ? `<div class="price-line">${
                    showMrp && mrp > sp ? `<span class="mrp-strike">MRP: ₹${mrp}</span>` : ""
                  }<span>SP: ₹${sp}</span></div>`
                : ""
            }
          </div>
        `;
      }
    }

    htmlContent += `
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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
            className="p-1 rounded-full hover:bg-white/20 transition-colors text-white"
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
          <div className="md:col-span-6 border-r border-neutral-200 p-4 flex flex-col overflow-hidden bg-white">
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
                className="text-xs font-semibold px-3 py-1.5 border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-700 whitespace-nowrap"
              >
                {selectedIds.size === filteredProducts.length ? "Deselect All" : "Select All"}
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
                  const isChecked = selectedIds.has(product.productId);
                  const qty = quantities[product.productId] || 1;
                  const rawBarcode = Array.isArray(product.barcode) ? product.barcode[0] : product.barcode;
                  const barcodeVal = rawBarcode || product.sku || "N/A";

                  return (
                    <div
                      key={product.productId}
                      className={`p-2.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                        isChecked ? "bg-emerald-50/50 hover:bg-emerald-50" : "hover:bg-neutral-50"
                      }`}
                    >
                      <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectProduct(product.productId)}
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
                            onChange={(e) => handleQtyChange(product.productId, parseInt(e.target.value) || 1)}
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
          <div className="md:col-span-6 p-5 flex flex-col justify-between overflow-y-auto space-y-5">
            
            {/* Label Customization Settings */}
            <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-100 pb-2">
                Barcode Label Settings
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Label Paper Format
                  </label>
                  <select
                    value={labelSize}
                    onChange={(e) => setLabelSize(e.target.value as any)}
                    className="w-full text-xs border border-neutral-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-[var(--primary-color)]"
                  >
                    <option value="50x30">Standard Label (50mm x 30mm)</option>
                    <option value="38x25">Compact Label (38mm x 25mm)</option>
                    <option value="60x40">Large Label (60mm x 40mm)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    Store Header Text
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full text-xs border border-neutral-300 rounded-lg p-1.5 focus:ring-2 focus:ring-[var(--primary-color)]"
                    placeholder="Store / Brand Name"
                  />
                </div>
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

            {/* Live Preview Card */}
            <div className="bg-neutral-100 border border-neutral-300 border-dashed rounded-xl p-4 flex flex-col items-center justify-center">
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  Live Barcode Label Preview
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {labelSize === "38x25" ? "38mm × 25mm" : labelSize === "60x40" ? "60mm × 40mm" : "50mm × 30mm"}
                </span>
              </div>

              {/* Simulated Thermal Label Box */}
              {previewProduct ? (
                <div className="bg-white border border-neutral-400 shadow-md rounded-md p-3 w-56 flex flex-col items-center text-center space-y-1 transition-all">
                  {showStoreName && storeName && (
                    <div className="text-[10px] font-extrabold uppercase tracking-tight text-neutral-900 border-b border-neutral-200 pb-0.5 w-full">
                      {storeName}
                    </div>
                  )}

                  {showProductName && (
                    <div className="text-[11px] font-medium leading-tight text-neutral-800 line-clamp-1">
                      {previewProduct.name}
                    </div>
                  )}

                  <div className="my-1 flex justify-center w-full">
                    <canvas ref={previewCanvasRef} className="max-w-full h-12" />
                  </div>

                  {showPrice && (
                    <div className="text-[11px] font-bold text-neutral-900">
                      {showMrp && (previewProduct.mrp || previewProduct.valueMrp) ? (
                        <span className="mr-1 text-[10px] text-neutral-500 font-normal line-through">
                          MRP: ₹{previewProduct.mrp || previewProduct.valueMrp}
                        </span>
                      ) : null}
                      <span>SP: ₹{previewProduct.sellingPrice || previewProduct.price || 0}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-xs text-neutral-400">Select a product to view barcode preview</div>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              
              {/* Option 1: ZIP Archive of PDFs */}
              <button
                onClick={handleDownloadZipPDFs}
                disabled={isGenerating || selectedIds.size === 0}
                className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white font-medium text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                title="Download ZIP containing editable individual PDF barcodes for all products"
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
                disabled={isGenerating || selectedIds.size === 0}
                className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-medium text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                title="Download single combined PDF sheet with all product barcodes"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                Bulk Sheet PDF
              </button>

              {/* Option 3: Direct Print */}
              <button
                onClick={handlePrintBarcodes}
                disabled={isGenerating || selectedIds.size === 0}
                className="bg-neutral-800 hover:bg-neutral-900 disabled:opacity-50 text-white font-medium text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                title="Direct print barcodes to thermal or standard printer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Print Barcodes
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
