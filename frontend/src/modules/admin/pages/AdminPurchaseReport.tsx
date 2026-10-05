import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import {
  deleteAdminPurchaseEntry,
  getAdminPurchaseEntries,
  upsertAdminPurchaseEntry,
} from '../../../services/api/admin/adminPosPurchaseEntryService';

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
    supplier: { name: 'Greenfield Bio Agro Organics', gstNumber: '23AAPCG5561J1ZL' },
    paymentMode: 'Cash',
    date: '2026-09-05',
    items: [
      { productName: 'Organic Vermicompost Premium Grade (50kg)', qty: 80, purchasePrice: 340, gstPercent: 5 },
      { productName: 'Neem Bio-Fertilizer Cake (25kg)', qty: 35, purchasePrice: 480, gstPercent: 5 },
    ],
    totals: {
      gross: 44000,
      grossAmount: 44000,
      discount: 400,
      discountAmount: 400,
      tax: 2200,
      taxAmount: 2200,
      roundOff: 0,
      net: 45800,
      netAmount: 45800,
    },
  },
  {
    id: 'PUR-84915',
    type: 'purchase',
    supplier: { name: 'Apex Agro Tech & Irrigation', gstNumber: '27AABCA9012D1ZT' },
    paymentMode: 'Credit',
    date: '2026-09-04',
    items: [
      { productName: 'Drip Irrigation Inline Lateral 16mm (500m)', qty: 10, purchasePrice: 3850, gstPercent: 12 },
      { productName: 'Screen Filter 2 Inch Heavy Plastic', qty: 6, purchasePrice: 1650, gstPercent: 18 },
      { productName: 'Venturi Injector 1.5 Inch with Suction Tube', qty: 8, purchasePrice: 750, gstPercent: 18 },
    ],
    totals: {
      gross: 54400,
      grossAmount: 54400,
      discount: 1200,
      discountAmount: 1200,
      tax: 7482,
      taxAmount: 7482,
      roundOff: 0,
      net: 60682,
      netAmount: 60682,
    },
  },
  {
    id: 'PUR-84916',
    type: 'purchase',
    supplier: { name: 'Shree Ram Pesticides & Seeds', gstNumber: '08AAGCS4432N1ZR' },
    paymentMode: 'Online',
    date: '2026-09-03',
    items: [
      { productName: 'Chlorpyrifos 50% + Cypermethrin 5% EC (5L)', qty: 10, purchasePrice: 2200, gstPercent: 18 },
      { productName: 'Hexaconazole 5% SC Systemic Fungicide (1L)', qty: 20, purchasePrice: 580, gstPercent: 18 },
    ],
    totals: {
      gross: 33600,
      grossAmount: 33600,
      discount: 600,
      discountAmount: 600,
      tax: 6048,
      taxAmount: 6048,
      roundOff: 0,
      net: 39048,
      netAmount: 39048,
    },
  },
  {
    id: 'PUR-84917',
    type: 'purchase',
    supplier: { name: 'Bharat Agro Industries', gstNumber: '24AAACB6781M1ZV' },
    paymentMode: 'Cash',
    date: '2026-09-02',
    items: [
      { productName: 'Waterproof Tarpaulin Sheet 250 GSM 24x18ft', qty: 15, purchasePrice: 1750, gstPercent: 18 },
      { productName: 'Shade Net 75% Green (3m x 50m Roll)', qty: 5, purchasePrice: 2800, gstPercent: 18 },
    ],
    totals: {
      gross: 40250,
      grossAmount: 40250,
      discount: 850,
      discountAmount: 850,
      tax: 7245,
      taxAmount: 7245,
      roundOff: 0,
      net: 46645,
      netAmount: 46645,
    },
  },
  {
    id: 'PUR-84918',
    type: 'purchase',
    supplier: { name: 'Swastik Solar Energy Pvt Ltd', gstNumber: '23AAECS9124P1ZX' },
    paymentMode: 'Credit',
    date: '2026-08-30',
    items: [
      { productName: 'Solar Insect Trap Automatic LED (Complete Set)', qty: 18, purchasePrice: 1350, gstPercent: 12 },
    ],
    totals: {
      gross: 24300,
      grossAmount: 24300,
      discount: 300,
      discountAmount: 300,
      tax: 2916,
      taxAmount: 2916,
      roundOff: 0,
      net: 26916,
      netAmount: 26916,
    },
  },
  {
    id: 'PUR-84919',
    type: 'purchase',
    supplier: { name: 'Universal Agro Biochem Solution', gstNumber: '27AABCU6543K1ZM' },
    paymentMode: 'Online',
    date: '2026-08-28',
    items: [
      { productName: 'Bio-stimulant Amino Acid Plant Tonic (1 Litre)', qty: 30, purchasePrice: 620, gstPercent: 12 },
      { productName: 'Humic Acid 98% Water Soluble Flakes (1kg)', qty: 40, purchasePrice: 380, gstPercent: 12 },
    ],
    totals: {
      gross: 33800,
      grossAmount: 33800,
      discount: 500,
      discountAmount: 500,
      tax: 4056,
      taxAmount: 4056,
      roundOff: 0,
      net: 37356,
      netAmount: 37356,
    },
  },
];

const AdminPurchaseReport: React.FC = () => {
  const [entries, setEntries] = useState<PurchaseReportEntry[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Cash' | 'Credit' | 'Online'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedEntry, setSelectedEntry] = useState<PurchaseReportEntry | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchEntries = async () => {
    try {
      const res = await getAdminPurchaseEntries('purchase');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const normalized = res.data.map(e => ({
          ...e,
          totals: {
            gross: e.totals?.gross ?? e.totals?.grossAmount ?? 0,
            discount: e.totals?.discount ?? e.totals?.discountAmount ?? 0,
            tax: e.totals?.tax ?? e.totals?.taxAmount ?? 0,
            net: e.totals?.net ?? e.totals?.netAmount ?? 0,
            grossAmount: e.totals?.grossAmount ?? e.totals?.gross ?? 0,
            discountAmount: e.totals?.discountAmount ?? e.totals?.discount ?? 0,
            taxAmount: e.totals?.taxAmount ?? e.totals?.tax ?? 0,
            netAmount: e.totals?.netAmount ?? e.totals?.net ?? 0,
          }
        }));
        setEntries(normalized);
        localStorage.setItem('admin_pos_purchase_entries', JSON.stringify(normalized));
        return;
      }
    } catch (e) {
      console.error("Failed to fetch from API", e);
    }

    try {
      const raw = localStorage.getItem('admin_pos_purchase_entries');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEntries(parsed);
          return;
        }
      }
    } catch {
      // ignore JSON parse error
    }

    // Default to dummy data if no purchase entries exist yet
    setEntries(DUMMY_PURCHASE_ENTRIES);
    localStorage.setItem('admin_pos_purchase_entries', JSON.stringify(DUMMY_PURCHASE_ENTRIES));
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleLoadDemoData = () => {
    setEntries(DUMMY_PURCHASE_ENTRIES);
    localStorage.setItem('admin_pos_purchase_entries', JSON.stringify(DUMMY_PURCHASE_ENTRIES));
    setSelectedRowKeys([]);
    setCurrentPage(1);
    showToast('Demo purchase entries loaded successfully', 'success');
  };

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
        billNo: `${entry.type === 'quotation' ? 'QTN' : 'PUR'}-${entry.id.slice(-5)}`,
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

  const stats = useMemo(() => {
    const purchaseEntries = entries.filter((e) => e.type === 'purchase');
    let totalGross = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalNet = 0;
    let totalQty = 0;
    let cashNet = 0;
    let creditNet = 0;
    let onlineNet = 0;

    for (const entry of purchaseEntries) {
      const g = entry.totals.gross ?? entry.totals.grossAmount ?? 0;
      const d = entry.totals.discount ?? entry.totals.discountAmount ?? 0;
      const t = entry.totals.tax ?? entry.totals.taxAmount ?? 0;
      const n = entry.totals.net ?? entry.totals.netAmount ?? 0;
      totalGross += g;
      totalDiscount += d;
      totalTax += t;
      totalNet += n;

      if (entry.paymentMode === 'Cash') cashNet += n;
      else if (entry.paymentMode === 'Credit') creditNet += n;
      else if (entry.paymentMode === 'Online') onlineNet += n;

      for (const itm of entry.items) {
        totalQty += itm.qty || 0;
      }
    }

    return {
      billCount: purchaseEntries.length,
      itemCount: rows.length,
      totalQty,
      totalGross,
      totalDiscount,
      totalTax,
      totalNet,
      cashNet,
      creditNet,
      onlineNet,
    };
  }, [entries, rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (paymentFilter !== 'All') {
      result = result.filter(row => row.paymentMode.toLowerCase() === paymentFilter.toLowerCase());
    }
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(row => 
        row.productName.toLowerCase().includes(lowerQuery) ||
        row.billNo.toLowerCase().includes(lowerQuery) ||
        row.supplier.toLowerCase().includes(lowerQuery) ||
        row.gstNo.toLowerCase().includes(lowerQuery)
      );
    }
    return result;
  }, [rows, searchQuery, paymentFilter]);

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
    navigate('/admin/pos/orders?mode=edit_purchase');
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

    const billNoPrefix = entry.type === 'quotation' ? 'QTN' : 'PUR';
    const billNo = `${billNoPrefix}-${entry.id.slice(-5)}`;
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
            <h1>Unnati</h1>
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
            <div><span>Gross:</span><span>₹${(entry.totals.grossAmount || entry.totals.gross || 0).toFixed(2)}</span></div>
            <div><span>Discount:</span><span>₹${(entry.totals.discountAmount || entry.totals.discount || 0).toFixed(2)}</span></div>
            <div><span>Tax:</span><span>₹${(entry.totals.taxAmount || entry.totals.tax || 0).toFixed(2)}</span></div>
            <div class="grand-total"><span>Total:</span><span>₹${(entry.totals.netAmount || entry.totals.net || 0).toFixed(2)}</span></div>
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
    a.download = `purchase-report-${new Date().toISOString().slice(0, 10)}.csv`;
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

      localStorage.setItem('admin_pos_purchase_entries', JSON.stringify(nextEntries));
      
      // Persist change to server
      const updatedEntry = nextEntries.find(e => e.id === entryId);
      if (updatedEntry) {
          upsertAdminPurchaseEntry(updatedEntry).catch(e => console.error("Sync failed", e));
      }

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
          try {
            await deleteAdminPurchaseEntry(entryId);
          } catch (e: any) {
            if (e?.response?.status !== 404) throw e;
          }
          continue;
        }
        await upsertAdminPurchaseEntry(after);
      }

      setEntries(nextEntries);
      localStorage.setItem('admin_pos_purchase_entries', JSON.stringify(nextEntries));
      setSelectedRowKeys([]);
      showToast('Selected items deleted', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e?.response?.data?.message || 'Failed to delete from server', 'error');
    }
  };

  const formatCurrency = (amount: number) => {
    return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--primary-color)] flex items-center justify-center font-black">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Purchase Report</h1>
                <p className="text-xs md:text-sm text-gray-500">Track and manage all purchase invoices, supplier entries and inventory acquisitions</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-stretch md:self-auto">
            <button
              type="button"
              onClick={handleLoadDemoData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 active:scale-95 transition-all shadow-sm"
              title="Reset and reload dummy sample data"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reload Dummy Data
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/pos/orders')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] rounded-xl active:scale-95 transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New Purchase Entry
            </button>
          </div>
        </div>

        {/* Stats / Metric Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Purchases</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{stats.billCount} <span className="text-xs font-normal text-gray-500">Bills ({stats.itemCount} items)</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Net Spend</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalNet)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total GST (Tax)</p>
              <p className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(stats.totalTax)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Payment Split</p>
            <div className="flex items-center justify-between text-xs text-gray-600 font-semibold gap-2">
              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Cash: ₹{stats.cashNet.toLocaleString('en-IN')}</span>
              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Online: ₹{stats.onlineNet.toLocaleString('en-IN')}</span>
              <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">Credit: ₹{stats.creditNet.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search product, bill, supplier, GST..." 
                value={searchQuery}
                onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                }}
                className="border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-sm outline-none focus:border-[var(--primary-color)] w-72 max-w-full bg-gray-50/50 focus:bg-white transition-all"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Payment Filter Tabs */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              {(['All', 'Cash', 'Online', 'Credit'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPaymentFilter(mode);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    paymentFilter === mode
                      ? 'bg-white text-gray-800 shadow-sm font-bold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-500 font-medium hidden sm:inline">
              Selected: <span className="font-bold text-gray-800">{selectedRowKeys.length}</span> / {filteredRows.length} rows
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm ${
                editMode 
                  ? 'bg-amber-600 text-white hover:bg-amber-700' 
                  : 'bg-gray-800 text-white hover:bg-black'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {editMode ? 'Done Editing' : 'Bulk Edit'}
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedRowKeys.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px]">
              <thead className="bg-gray-50/80 text-[11px] uppercase tracking-wider text-gray-600 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3.5 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      aria-label="Select all rows"
                      className="rounded border-gray-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
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
              <tbody className="divide-y divide-gray-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-16 text-center text-gray-500">
                      <div className="max-w-xs mx-auto flex flex-col items-center">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-base font-bold text-gray-700">No purchase entries found</p>
                        <p className="text-xs text-gray-400 mt-1">Try adjusting your search query or load sample dummy data.</p>
                        <button
                          type="button"
                          onClick={handleLoadDemoData}
                          className="mt-4 px-4 py-2 bg-[var(--primary-color)] text-white text-xs font-bold rounded-xl hover:bg-[var(--primary-dark)] active:scale-95 transition-all shadow-sm"
                        >
                          Load Sample Data
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr
                      key={row.key}
                      className={`text-sm transition-colors ${!editMode ? 'hover:bg-blue-50/40 cursor-pointer' : 'hover:bg-gray-50/50'}`}
                      onClick={() => handleRowClick(row.entryId)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(row.key)}
                          onChange={() => handleToggleRow(row.key)}
                          aria-label={`Select ${row.billNo}`}
                          className="rounded border-gray-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-800 font-mono text-xs">{row.billNo}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${
                          row.type === 'quotation' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="text"
                            value={row.supplier}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'supplier', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-[var(--primary-color)] outline-none font-bold"
                          />
                        ) : (
                          row.supplier
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="text"
                            value={row.gstNo}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'gstNo', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-[var(--primary-color)] outline-none font-mono"
                          />
                        ) : (
                          row.gstNo
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="text"
                            value={row.productName}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'productName', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-[var(--primary-color)] outline-none font-bold"
                          />
                        ) : (
                          row.productName
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            value={row.qty}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'qty', e.target.value)}
                            className="w-20 ml-auto px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-[var(--primary-color)] outline-none font-bold text-right"
                          />
                        ) : (
                          row.qty
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.purchasePrice}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'purchasePrice', e.target.value)}
                            className="w-24 ml-auto px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-[var(--primary-color)] outline-none font-bold text-right"
                          />
                        ) : (
                          `₹${row.purchasePrice.toFixed(2)}`
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 font-medium" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.gst}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'gst', e.target.value)}
                            className="w-20 ml-auto px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-[var(--primary-color)] outline-none font-bold text-right"
                          />
                        ) : (
                          `${row.gst}%`
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600" onClick={(e) => editMode && e.stopPropagation()}>₹{row.gross.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-rose-600" onClick={(e) => editMode && e.stopPropagation()}>-₹{row.discount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-amber-600 font-medium" onClick={(e) => editMode && e.stopPropagation()}>₹{row.tax.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--primary-color)]" onClick={(e) => editMode && e.stopPropagation()}>₹{row.net.toFixed(2)}</td>
                      <td className="px-4 py-3" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <select
                            value={row.paymentMode}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'paymentMode', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-[var(--primary-color)] outline-none font-bold"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Credit">Credit</option>
                            <option value="Online">Online</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.paymentMode === 'Cash' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : row.paymentMode === 'Credit' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {row.paymentMode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap" onClick={(e) => editMode && e.stopPropagation()}>
                        {editMode ? (
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handleCellEdit(row.entryId, row.itemIndex, 'date', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-[var(--primary-color)] outline-none font-bold"
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
            <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-3.5 border-t border-gray-100 bg-gray-50/60 gap-3">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center">
                        Rows per page:
                        <select 
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="ml-2 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[var(--primary-color)] bg-white text-gray-700 font-medium"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <div>
                        Showing <span className="font-bold text-gray-700">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-gray-700">{Math.min(currentPage * pageSize, filteredRows.length)}</span> of <span className="font-bold text-gray-700">{filteredRows.length}</span> entries
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700"
                    >
                        Previous
                    </button>
                    <span className="text-xs font-bold text-gray-600 px-2">
                      Page {currentPage} of {Math.max(1, Math.ceil(filteredRows.length / pageSize))}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredRows.length / pageSize), p + 1))}
                        disabled={currentPage === Math.ceil(filteredRows.length / pageSize)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700"
                    >
                        Next
                    </button>
                </div>
            </div>
          )}
        </div>

        {/* Action Sheet Modal */}
        {showActionSheet && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in transition-all duration-300" onClick={() => setShowActionSheet(false)}>
            <div
              className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 sm:hidden flex justify-center">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
              </div>

              <div className="px-6 py-6 border-b border-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-[var(--primary-color)] rounded-2xl flex items-center justify-center font-black">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                      </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800">Order Actions</h3>
                    <p className="text-xs text-gray-400 font-medium">Choose an action for bill {selectedEntry ? `PUR-${selectedEntry.id.slice(-5)}` : ''}</p>
                  </div>
                </div>
                <button onClick={() => setShowActionSheet(false)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-3 pb-10 sm:pb-6">
                {selectedEntry?.billAttachment && (
                  <ActionItem
                    icon={<svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                    title="View Attached Bill"
                    subtitle="View the invoice image attached to this purchase"
                    onClick={handleViewBill}
                    iconBg="bg-emerald-50"
                  />
                )}
                <ActionItem
                  icon={<svg className="w-5 h-5 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                  title="Edit Order in POS"
                  subtitle="Load order into POS purchase entry editor"
                  onClick={handleEditOrder}
                  iconBg="bg-blue-50"
                />
                <ActionItem
                  icon={<svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>}
                  title="Print Purchase Invoice"
                  subtitle="Generate printable PDF/Invoice view"
                  onClick={handlePrint}
                  iconBg="bg-gray-100"
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
      className="w-full bg-white rounded-2xl p-4 flex items-center justify-between hover:bg-gray-50 active:scale-[0.98] transition-all border border-transparent hover:border-gray-100 group"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${iconBg} rounded-[20px] flex items-center justify-center transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        <div className="text-left">
          <p className="text-base font-bold text-gray-800 leading-tight">{title}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="text-gray-300">
         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
      </div>
    </button>
  );
};

export default AdminPurchaseReport;
