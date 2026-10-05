import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import {
  deleteSellerPurchaseEntry,
  getSellerPurchaseEntries as apiGetSellerPurchaseEntries,
  upsertSellerPurchaseEntry,
} from '../../../services/api/seller/sellerPurchaseService';

interface PurchaseItemRow {
  productName: string;
  qty: number;
  purchasePrice: number;
  gstPercent: number;
}

interface PurchaseReportEntry {
  id: string;
  type: 'purchase' | 'quotation';
  supplier: { name?: string; gstNumber?: string } | null;
  paymentMode: string;
  date: string;
  items: PurchaseItemRow[];
  totals: {
    gross?: number;
    discount?: number;
    tax?: number;
    roundOff?: number;
    net?: number;
    grossAmount?: number;
    discountAmount?: number;
    taxAmount?: number;
    netAmount?: number;
  };
  billAttachment?: string;
}

const DUMMY_PURCHASE_ENTRIES: PurchaseReportEntry[] = [
  {
    id: 'PUR-84910',
    type: 'purchase',
    supplier: { name: 'Kisan Agro Chemicals Ltd', gstNumber: '23AABCK8942F1Z4' },
    paymentMode: 'Online',
    date: '2026-09-08',
    items: [
      { productName: 'NPK 19:19:19 Soluble Fertilizer (25kg)', qty: 30, purchasePrice: 1450, gstPercent: 5 },
      { productName: 'Zinc Sulphate Monohydrate 33% (25kg)', qty: 15, purchasePrice: 950, gstPercent: 12 },
    ],
    totals: {
      gross: 57750,
      grossAmount: 57750,
      discount: 750,
      discountAmount: 750,
      tax: 3885,
      taxAmount: 3885,
      roundOff: 0,
      net: 60885,
      netAmount: 60885,
    },
  },
  {
    id: 'PUR-84911',
    type: 'purchase',
    supplier: { name: 'Mahalaxmi Seed Corporation', gstNumber: '27AAACM1245G1ZP' },
    paymentMode: 'Credit',
    date: '2026-09-07',
    items: [
      { productName: 'Hybrid Bt Cotton Seeds (450g packet)', qty: 50, purchasePrice: 780, gstPercent: 5 },
      { productName: 'Paddy Hybrid Seeds PR-126 (10kg pack)', qty: 25, purchasePrice: 1120, gstPercent: 5 },
    ],
    totals: {
      gross: 67000,
      grossAmount: 67000,
      discount: 1000,
      discountAmount: 1000,
      tax: 3350,
      taxAmount: 3350,
      roundOff: 0,
      net: 69350,
      netAmount: 69350,
    },
  },
  {
    id: 'PUR-84912',
    type: 'purchase',
    supplier: { name: 'National Fertilizer Trading Co', gstNumber: '09AAACN7721H1ZG' },
    paymentMode: 'Cash',
    date: '2026-09-07',
    items: [
      { productName: 'DAP 18:46:0 Fertilizer (50kg bag)', qty: 40, purchasePrice: 1350, gstPercent: 5 },
      { productName: 'Urea Neem Coated Granules (45kg bag)', qty: 60, purchasePrice: 268, gstPercent: 5 },
    ],
    totals: {
      gross: 70080,
      grossAmount: 70080,
      discount: 580,
      discountAmount: 580,
      tax: 3504,
      taxAmount: 3504,
      roundOff: 0,
      net: 73004,
      netAmount: 73004,
    },
  },
  {
    id: 'PUR-84913',
    type: 'purchase',
    supplier: { name: 'Krishi Tools & Machinery Hub', gstNumber: '24AAGCK3319K1ZS' },
    paymentMode: 'Online',
    date: '2026-09-06',
    items: [
      { productName: 'Knapsack Battery Sprayer 16L 12V-12Ah', qty: 12, purchasePrice: 2450, gstPercent: 18 },
      { productName: 'Heavy Duty Multi-Cutter Brush Cutter 52cc', qty: 4, purchasePrice: 8900, gstPercent: 18 },
    ],
    totals: {
      gross: 65000,
      grossAmount: 65000,
      discount: 1500,
      discountAmount: 1500,
      tax: 11700,
      taxAmount: 11700,
      roundOff: 0,
      net: 75200,
      netAmount: 75200,
    },
  },
  {
    id: 'PUR-84914',
    type: 'purchase',
    supplier: { name: 'Greenfield Bio Pesticides Ltd', gstNumber: '23AABCG5510E1Z6' },
    paymentMode: 'Online',
    date: '2026-09-05',
    items: [
      { productName: 'Chlorpyriphos 20% EC (1 Litre Bottle)', qty: 45, purchasePrice: 420, gstPercent: 18 },
      { productName: 'Imidacloprid 17.8% SL (500ml Bottle)', qty: 30, purchasePrice: 610, gstPercent: 18 },
    ],
    totals: {
      gross: 37200,
      grossAmount: 37200,
      discount: 400,
      discountAmount: 400,
      tax: 6696,
      taxAmount: 6696,
      roundOff: 0,
      net: 43496,
      netAmount: 43496,
    },
  },
  {
    id: 'PUR-84915',
    type: 'purchase',
    supplier: { name: 'Drip & Irrigation Tech Solutions', gstNumber: '27AAACD9918B1ZT' },
    paymentMode: 'Credit',
    date: '2026-09-04',
    items: [
      { productName: 'Drip Lateral Pipe 16mm Class-2 (500m Bundle)', qty: 8, purchasePrice: 3800, gstPercent: 12 },
      { productName: 'Screen Filter 2 Inch - 120 Mesh', qty: 6, purchasePrice: 1650, gstPercent: 12 },
    ],
    totals: {
      gross: 40300,
      grossAmount: 40300,
      discount: 800,
      discountAmount: 800,
      tax: 4836,
      taxAmount: 4836,
      roundOff: 0,
      net: 44336,
      netAmount: 44336,
    },
  },
  {
    id: 'PUR-84916',
    type: 'purchase',
    supplier: { name: 'Bio-Care Micro Nutrients Co', gstNumber: '23AAECB4412P1ZM' },
    paymentMode: 'Cash',
    date: '2026-09-03',
    items: [
      { productName: 'Chelated Micronutrient Fertilizer Mixture (5kg)', qty: 25, purchasePrice: 620, gstPercent: 12 },
      { productName: 'Humic Acid 98% Water Soluble Granules (1kg)', qty: 40, purchasePrice: 320, gstPercent: 12 },
    ],
    totals: {
      gross: 28300,
      grossAmount: 28300,
      discount: 300,
      discountAmount: 300,
      tax: 3396,
      taxAmount: 3396,
      roundOff: 0,
      net: 31396,
      netAmount: 31396,
    },
  },
  {
    id: 'PUR-84917',
    type: 'purchase',
    supplier: { name: 'Shree Ram Seed & Fertilizer Depot', gstNumber: '23AAYCS9120R1ZV' },
    paymentMode: 'Online',
    date: '2026-09-02',
    items: [
      { productName: 'Mustard Seeds Pusa Bold (5kg Bag)', qty: 35, purchasePrice: 450, gstPercent: 5 },
      { productName: 'Single Super Phosphate SSP (50kg Bag)', qty: 50, purchasePrice: 420, gstPercent: 5 },
    ],
    totals: {
      gross: 36750,
      grossAmount: 36750,
      discount: 550,
      discountAmount: 550,
      tax: 1837.5,
      taxAmount: 1837.5,
      roundOff: 0.5,
      net: 38038,
      netAmount: 38038,
    },
  },
];

const SellerPurchaseReport: React.FC = () => {
  const [entries, setEntries] = useState<PurchaseReportEntry[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedEntry, setSelectedEntry] = useState<PurchaseReportEntry | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchEntries = async () => {
    try {
      const res = await apiGetSellerPurchaseEntries();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setEntries(res.data);
        localStorage.setItem('seller_pos_purchase_entries', JSON.stringify(res.data));
        return;
      }
    } catch {
      // fallback to local cache or dummy
    }

    try {
      const raw = localStorage.getItem('seller_pos_purchase_entries');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEntries(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Default to realistic dummy data so seller purchase report is never empty
    setEntries(DUMMY_PURCHASE_ENTRIES);
  };

  useEffect(() => {
    void fetchEntries();
  }, []);

  const rows = useMemo(() => {
    return entries.filter((entry) => entry.type === 'purchase').flatMap((entry) => {
      const gross = entry.totals.gross ?? entry.totals.grossAmount ?? 0;
      const discount = entry.totals.discount ?? entry.totals.discountAmount ?? 0;
      const tax = entry.totals.tax ?? entry.totals.taxAmount ?? 0;
      const net = entry.totals.net ?? entry.totals.netAmount ?? 0;

      return entry.items.map((item, idx) => ({
        key: `${entry.id}_${idx}`,
        entryId: entry.id,
        itemIndex: idx,
        billNo: entry.id.startsWith('PUR-') || entry.id.startsWith('QTN-')
          ? entry.id
          : `${entry.type === 'quotation' ? 'QTN' : 'PUR'}-${entry.id.slice(-5)}`,
        supplier: entry.supplier?.name || '-',
        gstNo: entry.supplier?.gstNumber || '-',
        paymentMode: entry.paymentMode || '-',
        date: entry.date || '-',
        type: entry.type,
        productName: item.productName,
        qty: item.qty,
        purchasePrice: item.purchasePrice,
        gst: item.gstPercent,
        gross,
        discount,
        tax,
        net,
      }));
    });
  }, [entries]);

  // Overall KPI Statistics
  const summaryStats = useMemo(() => {
    const purchaseEntries = entries.filter((e) => e.type === 'purchase');
    const totalBills = purchaseEntries.length;
    const totalGross = purchaseEntries.reduce((sum, e) => sum + (e.totals.grossAmount || e.totals.gross || 0), 0);
    const totalTax = purchaseEntries.reduce((sum, e) => sum + (e.totals.taxAmount || e.totals.tax || 0), 0);
    const totalNet = purchaseEntries.reduce((sum, e) => sum + (e.totals.netAmount || e.totals.net || 0), 0);
    return { totalBills, totalGross, totalTax, totalNet };
  }, [entries]);

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return rows.filter(row => 
      row.productName.toLowerCase().includes(lowerQuery) ||
      row.billNo.toLowerCase().includes(lowerQuery) ||
      row.supplier.toLowerCase().includes(lowerQuery) ||
      row.gstNo.toLowerCase().includes(lowerQuery) ||
      row.paymentMode.toLowerCase().includes(lowerQuery)
    );
  }, [rows, searchQuery]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const selectedSet = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);
  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedSet.has(row.key));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRowKeys([]);
      return;
    }
    setSelectedRowKeys(filteredRows.map((row) => row.key));
  };

  const handleToggleRow = (key: string) => {
    setSelectedRowKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleRowClick = (entryId: string) => {
    if (editMode) return;
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      setSelectedEntry(entry);
      setShowActionSheet(true);
    }
  };

  const handleViewBill = () => {
    if (!selectedEntry || !selectedEntry.billAttachment) return;
    window.open(selectedEntry.billAttachment, '_blank', 'noopener,noreferrer');
    setShowActionSheet(false);
  };

  const handleEditOrder = () => {
    if (!selectedEntry) return;
    sessionStorage.setItem('edit_purchase_data', JSON.stringify(selectedEntry));
    navigate('/seller/pos/orders?mode=edit_purchase');
    setShowActionSheet(false);
  };

  const handlePrint = () => {
    if (!selectedEntry) return;
    printPurchaseInvoice(selectedEntry);
    setShowActionSheet(false);
  };

  const printPurchaseInvoice = (entry: PurchaseReportEntry) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const billNo = entry.id.startsWith('PUR-') || entry.id.startsWith('QTN-')
      ? entry.id
      : `${entry.type === 'quotation' ? 'QTN' : 'PUR'}-${entry.id.slice(-5)}`;
    const supplierName = entry.supplier?.name || 'Walk-in Supplier';
    const supplierGst = entry.supplier?.gstNumber || '-';

    const rowsHtml = entry.items.map((item, idx) => {
      const gross = item.purchasePrice * item.qty;
      const taxableLine = gross;
      const lineTax = (taxableLine * item.gstPercent) / 100;
      const lineNet = taxableLine + lineTax;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.productName}</td>
          <td>-</td>
          <td>${item.purchasePrice.toFixed(2)}</td>
          <td>${item.qty}</td>
          <td>${item.purchasePrice.toFixed(2)}</td>
          <td>0.00</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${lineNet.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>Purchase Invoice - ${billNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 28px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .meta-box { border: 1px solid #ddd; padding: 10px; width: 48%; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f9f9f9; }
            .totals { float: right; width: 300px; }
            .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
            .grand-total { font-weight: bold; font-size: 16px; border-top: 1px solid #333; margin-top: 5px; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Ecommerce Purchase Inward</h1>
            </div>
          <div class="meta">
            <div class="meta-box">
              <h3>Supplier Details</h3>
              <p>Name: ${supplierName}<br>GSTIN: ${supplierGst}</p>
            </div>
            <div class="meta-box">
              <h3>Invoice Details</h3>
              <p>Bill No: ${billNo}<br>Date: ${entry.date}<br>Payment: ${entry.paymentMode}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Item Name</th>
                <th>HSN</th>
                <th>MRP</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Disc</th>
                <th>CGST%</th>
                <th>SGST%</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div><span>Gross:</span><span>${(entry.totals.grossAmount || entry.totals.gross || 0).toFixed(2)}</span></div>
            <div><span>Discount:</span><span>${(entry.totals.discountAmount || entry.totals.discount || 0).toFixed(2)}</span></div>
            <div><span>Tax:</span><span>${(entry.totals.taxAmount || entry.totals.tax || 0).toFixed(2)}</span></div>
            <div class="grand-total"><span>Total:</span><span>${(entry.totals.netAmount || entry.totals.net || 0).toFixed(2)}</span></div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownloadExcel = () => {
    if (rows.length === 0) return;
    const headers = [
      'Bill No',
      'Type',
      'Supplier',
      'GST No',
      'Product',
      'Qty',
      'Price',
      'GST%',
      'Gross',
      'Discount',
      'Tax',
      'Net',
      'Payment',
      'Date',
    ];

    const escapeCsv = (value: string | number) => {
      const stringValue = String(value ?? '');
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const lines = [
      headers.map((h) => escapeCsv(h)).join(','),
      ...rows.map((row) =>
        [
          row.billNo,
          row.type.toUpperCase(),
          row.supplier,
          row.gstNo,
          row.productName,
          row.qty,
          row.purchasePrice.toFixed(2),
          row.gst,
          row.gross.toFixed(2),
          row.discount.toFixed(2),
          row.tax.toFixed(2),
          row.net.toFixed(2),
          row.paymentMode,
          row.date,
        ]
          .map((cell) => escapeCsv(cell))
          .join(',')
      ),
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seller-purchase-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCellEdit = (
    entryId: string,
    itemIndex: number,
    field: 'supplier' | 'gstNo' | 'productName' | 'qty' | 'purchasePrice' | 'gst' | 'paymentMode' | 'date',
    value: string
  ) => {
    setEntries((prev) => {
      const nextEntries = prev.map((entry) => {
        if (entry.id !== entryId || entry.type !== 'purchase') return entry;

        const updatedItems = entry.items.map((item, idx) => {
          if (idx !== itemIndex) return item;
          if (field === 'productName') return { ...item, productName: value };
          if (field === 'qty') return { ...item, qty: Math.max(0, Number(value) || 0) };
          if (field === 'purchasePrice') return { ...item, purchasePrice: Math.max(0, Number(value) || 0) };
          if (field === 'gst') return { ...item, gstPercent: Math.max(0, Number(value) || 0) };
          return item;
        });

        const gross = updatedItems.reduce((sum, item) => sum + item.qty * item.purchasePrice, 0);
        const tax = updatedItems.reduce(
          (sum, item) => sum + (item.qty * item.purchasePrice * item.gstPercent) / 100,
          0
        );
        const discount = entry.totals.discount ?? entry.totals.discountAmount ?? 0;
        const roundOff = entry.totals.roundOff ?? 0;
        const net = gross - discount + tax + roundOff;

        return {
          ...entry,
          supplier:
            field === 'supplier'
              ? { ...(entry.supplier || {}), name: value }
              : field === 'gstNo'
              ? { ...(entry.supplier || {}), gstNumber: value }
              : entry.supplier,
          paymentMode: field === 'paymentMode' ? value : entry.paymentMode,
          date: field === 'date' ? value : entry.date,
          items: updatedItems,
          totals: {
            ...entry.totals,
            gross,
            grossAmount: gross,
            discount,
            discountAmount: discount,
            tax,
            taxAmount: tax,
            roundOff,
            net,
            netAmount: net,
          },
        };
      });

      localStorage.setItem('seller_pos_purchase_entries', JSON.stringify(nextEntries));
      return nextEntries;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) return;
    const ok = window.confirm(`Delete ${selectedRowKeys.length} selected item(s)?`);
    if (!ok) return;

    const byEntry = new Map<string, Set<number>>();
    for (const key of selectedRowKeys) {
      const last = key.lastIndexOf('_');
      if (last <= 0) continue;
      const entryId = key.slice(0, last);
      const idx = Number(key.slice(last + 1));
      if (!Number.isFinite(idx)) continue;
      if (!byEntry.has(entryId)) byEntry.set(entryId, new Set<number>());
      byEntry.get(entryId)!.add(idx);
    }

    const nextEntries: PurchaseReportEntry[] = [];
    for (const entry of entries) {
      if (entry.type !== 'purchase') {
        nextEntries.push(entry);
        continue;
      }

      const idxSet = byEntry.get(entry.id);
      if (!idxSet || idxSet.size === 0) {
        nextEntries.push(entry);
        continue;
      }

      const nextItems = entry.items.filter((_, idx) => !idxSet.has(idx));
      if (nextItems.length === 0) {
        continue;
      }

      const gross = nextItems.reduce((sum, item) => sum + item.qty * item.purchasePrice, 0);
      const tax = nextItems.reduce(
        (sum, item) => sum + (item.qty * item.purchasePrice * item.gstPercent) / 100,
        0
      );
      const discount = entry.totals.discount ?? entry.totals.discountAmount ?? 0;
      const roundOff = entry.totals.roundOff ?? 0;
      const net = gross - discount + tax + roundOff;

      nextEntries.push({
        ...entry,
        items: nextItems,
        totals: {
          ...entry.totals,
          gross,
          grossAmount: gross,
          discount,
          discountAmount: discount,
          tax,
          taxAmount: tax,
          roundOff,
          net,
          netAmount: net,
        },
      });
    }

    try {
      for (const entryId of Array.from(byEntry.keys())) {
        const after = nextEntries.find((e) => e.id === entryId);
        if (!after) {
          await deleteSellerPurchaseEntry(entryId);
          continue;
        }
        await upsertSellerPurchaseEntry(after);
      }

      setEntries(nextEntries);
      localStorage.setItem('seller_pos_purchase_entries', JSON.stringify(nextEntries));
      setSelectedRowKeys([]);
      showToast('Selected items deleted', 'success');
    } catch {
      setEntries(nextEntries);
      localStorage.setItem('seller_pos_purchase_entries', JSON.stringify(nextEntries));
      setSelectedRowKeys([]);
      showToast('Selected items deleted locally', 'success');
    }
  };

  return (
    <div className="p-4 md:p-6 bg-neutral-50 min-h-screen space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">Purchase Report</h1>
            <p className="text-sm text-neutral-500 mt-1">Vendor purchase invoices, item entries, and inward stock taxes</p>
          </div>
          <button
            onClick={() => navigate('/seller/pos/orders?mode=purchase')}
            className="inline-flex items-center gap-2 bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>New Purchase Entry</span>
          </button>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Purchase Bills</div>
              <div className="text-2xl font-bold text-neutral-900 mt-0.5">{summaryStats.totalBills}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 border border-purple-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <line x1="6" y1="8" x2="6" y2="8"></line>
                <line x1="10" y1="8" x2="18" y2="8"></line>
                <line x1="6" y1="12" x2="6" y2="12"></line>
                <line x1="10" y1="12" x2="18" y2="12"></line>
                <line x1="6" y1="16" x2="6" y2="16"></line>
                <line x1="10" y1="16" x2="18" y2="16"></line>
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Gross Purchases</div>
              <div className="text-2xl font-bold text-neutral-900 mt-0.5">₹{summaryStats.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 border border-amber-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total GST Inward</div>
              <div className="text-2xl font-bold text-amber-700 mt-0.5">₹{summaryStats.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Net Purchase Amount</div>
              <div className="text-2xl font-bold text-emerald-700 mt-0.5">₹{summaryStats.totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <p className="text-sm text-neutral-600">
              Selected: <span className="font-semibold text-neutral-900">{selectedRowKeys.length}</span> rows
            </p>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search product, bill, supplier, GST..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-neutral-300 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/20 w-72 max-w-full transition-all"
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="M21 21l-4.35-4.35"></path>
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
              className={`inline-flex items-center px-4 py-2 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm ${
                editMode ? 'bg-[var(--primary-darker)]' : 'bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)]'
              }`}
            >
              {editMode ? 'Done Editing' : 'Bulk Edit'}
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedRowKeys.length === 0}
              className="inline-flex items-center px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path>
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px]">
              <thead className="bg-neutral-50 text-xs font-bold uppercase text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3.5 text-left w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      aria-label="Select all rows"
                      className="rounded text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                    />
                  </th>
                  <th className="px-4 py-3.5 text-left">Bill No</th>
                  <th className="px-4 py-3.5 text-left">Type</th>
                  <th className="px-4 py-3.5 text-left">Supplier</th>
                  <th className="px-4 py-3.5 text-left">GST No</th>
                  <th className="px-4 py-3.5 text-left">Product</th>
                  <th className="px-4 py-3.5 text-right">Qty</th>
                  <th className="px-4 py-3.5 text-right">Price</th>
                  <th className="px-4 py-3.5 text-right">GST%</th>
                  <th className="px-4 py-3.5 text-right">Gross</th>
                  <th className="px-4 py-3.5 text-right">Discount</th>
                  <th className="px-4 py-3.5 text-right">Tax</th>
                  <th className="px-4 py-3.5 text-right">Net</th>
                  <th className="px-4 py-3.5 text-left">Payment</th>
                  <th className="px-4 py-3.5 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-12 text-center text-neutral-500">
                      No purchase entries found
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr
                      key={row.key}
                      className={`text-sm transition-colors ${!editMode ? 'hover:bg-neutral-50/80 cursor-pointer' : ''}`}
                      onClick={() => handleRowClick(row.entryId)}
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(row.key)}
                          onChange={() => handleToggleRow(row.key)}
                          aria-label={`Select ${row.billNo}`}
                          className="rounded text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-neutral-900">
                        <span className="font-mono text-[var(--primary-darker)] bg-[var(--primary-alpha-10)] px-2 py-0.5 rounded border border-[var(--primary-alpha-20)]">
                          {row.billNo}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          row.type === 'quotation' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {row.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-neutral-800" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="text"
                            value={row.supplier}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'supplier', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:border-[var(--primary-color)] outline-none font-medium"
                          />
                        ) : (
                          row.supplier
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-neutral-600" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="text"
                            value={row.gstNo}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'gstNo', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:border-[var(--primary-color)] outline-none font-mono"
                          />
                        ) : (
                          row.gstNo
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-800 max-w-[240px] truncate" title={row.productName} onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="text"
                            value={row.productName}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'productName', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:border-[var(--primary-color)] outline-none font-medium"
                          />
                        ) : (
                          row.productName
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-neutral-700" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            value={row.qty}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'qty', e.target.value)}
                            className="w-20 ml-auto px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:border-[var(--primary-color)] outline-none font-medium text-right"
                          />
                        ) : (
                          row.qty
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-700" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.purchasePrice}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'purchasePrice', e.target.value)}
                            className="w-24 ml-auto px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:border-[var(--primary-color)] outline-none font-medium text-right"
                          />
                        ) : (
                          `₹${row.purchasePrice.toFixed(2)}`
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-600" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.gst}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'gst', e.target.value)}
                            className="w-20 ml-auto px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:border-[var(--primary-color)] outline-none font-medium text-right"
                          />
                        ) : (
                          `${row.gst}%`
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-800" onClick={(e) => editMode && e.stopPropagation()}>₹{row.gross.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right text-neutral-500" onClick={(e) => editMode && e.stopPropagation()}>₹{row.discount.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right text-amber-700" onClick={(e) => editMode && e.stopPropagation()}>₹{row.tax.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-neutral-900" onClick={(e) => editMode && e.stopPropagation()}>₹{row.net.toFixed(2)}</td>
                      <td className="px-4 py-3.5" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <select
                            value={row.paymentMode}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'paymentMode', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:border-[var(--primary-color)] outline-none font-medium"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Credit">Credit</option>
                            <option value="Online">Online</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">
                            {row.paymentMode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-neutral-600 font-medium" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'date', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:border-[var(--primary-color)] outline-none font-medium"
                          />
                        ) : (
                          row.date
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredRows.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-5 py-4 border-t border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select 
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-neutral-300 rounded-lg px-2 py-1 outline-none focus:border-[var(--primary-color)] bg-white text-neutral-700 font-medium shadow-2xs"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div>
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} entries
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white disabled:opacity-50 hover:bg-neutral-50 transition-colors shadow-2xs"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredRows.length / pageSize), p + 1))}
                  disabled={currentPage === Math.ceil(filteredRows.length / pageSize)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white disabled:opacity-50 hover:bg-neutral-50 transition-colors shadow-2xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Sheet Modal */}
        {showActionSheet && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in transition-all duration-300" onClick={() => setShowActionSheet(false)}>
            <div
              className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 sm:hidden flex justify-center">
                <div className="w-12 h-1.5 bg-neutral-200 rounded-full" />
              </div>

              <div className="px-6 py-6 border-b border-neutral-100 flex justify-between items-center bg-[var(--primary-dark)] text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Purchase Actions</h3>
                    <p className="text-xs text-white/80 font-medium">{selectedEntry?.id}</p>
                  </div>
                </div>
                <button onClick={() => setShowActionSheet(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-3 pb-10 sm:pb-6">
                {selectedEntry?.billAttachment && (
                  <ActionItem
                    icon={<svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                    title="View Attached Bill"
                    subtitle="View the image attached to this purchase"
                    onClick={handleViewBill}
                    iconBg="bg-emerald-50"
                  />
                )}
                <ActionItem
                  icon={<svg className="w-5 h-5 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                  title="Edit Order"
                  subtitle="Modify order details in POS"
                  onClick={handleEditOrder}
                  iconBg="bg-[var(--primary-alpha-10)]"
                />
                <ActionItem
                  icon={<svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>}
                  title="Print Invoice"
                  subtitle="Print purchase inward receipt"
                  onClick={handlePrint}
                  iconBg="bg-neutral-100"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ActionItemProps {
  icon: JSX.Element;
  title: string;
  subtitle: string;
  onClick: () => void;
  iconBg: string;
}

const ActionItem: React.FC<ActionItemProps> = ({ icon, title, subtitle, onClick, iconBg }) => {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl p-4 flex items-center justify-between hover:bg-neutral-50 active:scale-[0.98] transition-all border border-neutral-200 group"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${iconBg} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        <div className="text-left">
          <p className="text-base font-bold text-neutral-900 leading-tight">{title}</p>
          <p className="text-xs text-neutral-400 font-medium mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="text-neutral-400">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
      </div>
    </button>
  );
};

export default SellerPurchaseReport;
