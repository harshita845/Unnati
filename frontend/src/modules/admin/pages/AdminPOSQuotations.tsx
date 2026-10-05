import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { PurchaseEntryRecord, PurchaseItem } from './AdminPOSOrders';
import { getAdminPurchaseEntries } from '../../../services/api/admin/adminPosPurchaseEntryService';

const DUMMY_QUOTATIONS: PurchaseEntryRecord[] = [
  {
    id: 'QTN-90201',
    type: 'quotation',
    supplier: {
      name: 'Ramesh Patel (Kisan Vikas Kendra)',
      phone: '9826012345',
      address: 'Village Badnagar, Ujjain, MP',
      notes: 'Bulk quotation for Kharif season drip system and seeds',
      gstNumber: '23AABCR1234F1Z9',
      openingBalance: '0',
      openingBalanceType: 'Payment',
    },
    paymentMode: 'Online',
    date: '2026-09-08',
    createdAt: '2026-09-08T10:15:00.000Z',
    items: [
      {
        id: 'qi-1',
        productId: 'p-1',
        baseProductId: 'bp-1',
        productName: 'Drip Irrigation Inline Lateral 16mm (500m)',
        mrp: 4500,
        retailPrice: 4200,
        purchasePrice: 3850,
        wholesalePrice: 3900,
        qty: 5,
        currentQty: 50,
        includingGST: false,
        billDiscount: 5,
        billDiscountType: '%',
        gstPercent: 12,
        barcode: '8901234001',
        mfgDate: '2026-01-10',
        expiry: '',
        hsn: '8424',
        batch: 'BT-2026-01',
        packOf: 1,
        additionalOpen: false,
      },
      {
        id: 'qi-2',
        productId: 'p-2',
        baseProductId: 'bp-2',
        productName: 'Hybrid Bt Cotton Seeds (450g packet)',
        mrp: 950,
        retailPrice: 850,
        purchasePrice: 780,
        wholesalePrice: 800,
        qty: 20,
        currentQty: 200,
        includingGST: false,
        billDiscount: 0,
        billDiscountType: '₹',
        gstPercent: 5,
        barcode: '8901234002',
        mfgDate: '2026-02-15',
        expiry: '2027-02-15',
        hsn: '1209',
        batch: 'SD-2026-09',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 34850,
      discountAmount: 962.50,
      taxAmount: 2974.50,
      roundOff: 0,
      netAmount: 36862.00,
    },
  },
  {
    id: 'QTN-90202',
    type: 'quotation',
    supplier: {
      name: 'Vikram Singh Solanki',
      phone: '9425178901',
      address: 'Ring Road, Ratlam, MP',
      notes: 'Battery sprayer and bio-fertilizer requirement',
      gstNumber: '',
      openingBalance: '0',
      openingBalanceType: 'Payment',
    },
    paymentMode: 'Cash',
    date: '2026-09-07',
    createdAt: '2026-09-07T14:30:00.000Z',
    items: [
      {
        id: 'qi-3',
        productId: 'p-3',
        baseProductId: 'bp-3',
        productName: 'Knapsack Battery Sprayer 16L Dual Motor',
        mrp: 3200,
        retailPrice: 2800,
        purchasePrice: 2450,
        wholesalePrice: 2500,
        qty: 2,
        currentQty: 30,
        includingGST: false,
        billDiscount: 200,
        billDiscountType: '₹',
        gstPercent: 18,
        barcode: '8901234003',
        mfgDate: '2026-03-01',
        expiry: '',
        hsn: '8424',
        batch: 'SP-2026-11',
        packOf: 1,
        additionalOpen: false,
      },
      {
        id: 'qi-4',
        productId: 'p-4',
        baseProductId: 'bp-4',
        productName: 'Organic Vermicompost Premium Grade (50kg)',
        mrp: 450,
        retailPrice: 400,
        purchasePrice: 340,
        wholesalePrice: 350,
        qty: 10,
        currentQty: 120,
        includingGST: false,
        billDiscount: 0,
        billDiscountType: '%',
        gstPercent: 5,
        barcode: '8901234004',
        mfgDate: '2026-05-10',
        expiry: '',
        hsn: '3101',
        batch: 'VC-2026-04',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 8300,
      discountAmount: 200,
      taxAmount: 1016,
      roundOff: 0,
      netAmount: 9116.00,
    },
  },
  {
    id: 'QTN-90203',
    type: 'quotation',
    supplier: {
      name: 'Greenfields Agri Solutions Pvt Ltd',
      phone: '9893456789',
      address: 'Industrial Area, Nagda, MP',
      notes: 'Soluble fertilizers and biostimulants quotation',
      gstNumber: '23AAACG5561L1Z2',
      openingBalance: '0',
      openingBalanceType: 'Payment',
    },
    paymentMode: 'Online',
    date: '2026-09-06',
    createdAt: '2026-09-06T11:00:00.000Z',
    items: [
      {
        id: 'qi-5',
        productId: 'p-5',
        baseProductId: 'bp-5',
        productName: 'NPK 19:19:19 100% Water Soluble (25kg)',
        mrp: 1800,
        retailPrice: 1650,
        purchasePrice: 1450,
        wholesalePrice: 1500,
        qty: 15,
        currentQty: 80,
        includingGST: false,
        billDiscount: 500,
        billDiscountType: '₹',
        gstPercent: 5,
        barcode: '8901234005',
        mfgDate: '2026-04-12',
        expiry: '2028-04-12',
        hsn: '3105',
        batch: 'NPK-26-88',
        packOf: 1,
        additionalOpen: false,
      },
      {
        id: 'qi-6',
        productId: 'p-6',
        baseProductId: 'bp-6',
        productName: 'Bio-stimulant Plant Growth Tonic (1L)',
        mrp: 850,
        retailPrice: 750,
        purchasePrice: 620,
        wholesalePrice: 650,
        qty: 12,
        currentQty: 60,
        includingGST: false,
        billDiscount: 5,
        billDiscountType: '%',
        gstPercent: 12,
        barcode: '8901234006',
        mfgDate: '2026-06-01',
        expiry: '2028-06-01',
        hsn: '3808',
        batch: 'BST-26-02',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 29190,
      discountAmount: 872,
      taxAmount: 1910.66,
      roundOff: 0.34,
      netAmount: 30229.00,
    },
  },
  {
    id: 'QTN-90204',
    type: 'quotation',
    supplier: {
      name: 'Manoj Patidar (Adarsh Krishi Farm)',
      phone: '9754123456',
      address: 'Bhatpachlana Road, Nagda',
      notes: 'Solar insect traps and pest control chemical quote',
      gstNumber: '',
      openingBalance: '0',
      openingBalanceType: 'Payment',
    },
    paymentMode: 'Credit',
    date: '2026-09-05',
    createdAt: '2026-09-05T16:20:00.000Z',
    items: [
      {
        id: 'qi-7',
        productId: 'p-7',
        baseProductId: 'bp-7',
        productName: 'Solar Insect Trap Automatic LED Set',
        mrp: 1800,
        retailPrice: 1550,
        purchasePrice: 1350,
        wholesalePrice: 1400,
        qty: 6,
        currentQty: 25,
        includingGST: false,
        billDiscount: 300,
        billDiscountType: '₹',
        gstPercent: 12,
        barcode: '8901234007',
        mfgDate: '2026-03-20',
        expiry: '',
        hsn: '8543',
        batch: 'SLR-2026-3',
        packOf: 1,
        additionalOpen: false,
      },
      {
        id: 'qi-8',
        productId: 'p-8',
        baseProductId: 'bp-8',
        productName: 'Chlorpyrifos 20% EC Insecticide (5L)',
        mrp: 1600,
        retailPrice: 1400,
        purchasePrice: 1200,
        wholesalePrice: 1250,
        qty: 4,
        currentQty: 40,
        includingGST: false,
        billDiscount: 0,
        billDiscountType: '%',
        gstPercent: 18,
        barcode: '8901234008',
        mfgDate: '2026-02-18',
        expiry: '2028-02-18',
        hsn: '3808',
        batch: 'CHP-2026-1',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 12900,
      discountAmount: 300,
      taxAmount: 1800,
      roundOff: 0,
      netAmount: 14400.00,
    },
  },
  {
    id: 'QTN-90205',
    type: 'quotation',
    supplier: {
      name: 'Shree Krishna Agro Traders',
      phone: '9179888999',
      address: 'Station Road, Khachrod, MP',
      notes: 'Tarpaulin and shade net wholesale estimation',
      gstNumber: '23AABCS8891P1ZX',
      openingBalance: '0',
      openingBalanceType: 'Payment',
    },
    paymentMode: 'Online',
    date: '2026-09-04',
    createdAt: '2026-09-04T09:45:00.000Z',
    items: [
      {
        id: 'qi-9',
        productId: 'p-9',
        baseProductId: 'bp-9',
        productName: 'Waterproof Tarpaulin Sheet 250 GSM 24x18ft',
        mrp: 2400,
        retailPrice: 2100,
        purchasePrice: 1750,
        wholesalePrice: 1800,
        qty: 8,
        currentQty: 45,
        includingGST: false,
        billDiscount: 600,
        billDiscountType: '₹',
        gstPercent: 18,
        barcode: '8901234009',
        mfgDate: '2026-01-25',
        expiry: '',
        hsn: '3926',
        batch: 'TRP-2026-09',
        packOf: 1,
        additionalOpen: false,
      },
      {
        id: 'qi-10',
        productId: 'p-10',
        baseProductId: 'bp-10',
        productName: 'Shade Net 75% Green (3m x 50m Roll)',
        mrp: 3600,
        retailPrice: 3200,
        purchasePrice: 2800,
        wholesalePrice: 2900,
        qty: 3,
        currentQty: 20,
        includingGST: false,
        billDiscount: 400,
        billDiscountType: '₹',
        gstPercent: 18,
        barcode: '8901234010',
        mfgDate: '2026-02-10',
        expiry: '',
        hsn: '5608',
        batch: 'SHD-2026-02',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 22400,
      discountAmount: 1000,
      taxAmount: 3852,
      roundOff: 0,
      netAmount: 25252.00,
    },
  },
  {
    id: 'QTN-90206',
    type: 'quotation',
    supplier: {
      name: 'Devendra Choudhary',
      phone: '9926451230',
      address: 'Ingoriya Road, Unhel, MP',
      notes: 'Brush cutter and accessories quotation',
      gstNumber: '',
      openingBalance: '0',
      openingBalanceType: 'Payment',
    },
    paymentMode: 'Cash',
    date: '2026-09-02',
    createdAt: '2026-09-02T15:10:00.000Z',
    items: [
      {
        id: 'qi-11',
        productId: 'p-11',
        baseProductId: 'bp-11',
        productName: 'Heavy Duty Multi-Cutter Brush Cutter 52cc',
        mrp: 11500,
        retailPrice: 10200,
        purchasePrice: 8900,
        wholesalePrice: 9100,
        qty: 1,
        currentQty: 8,
        includingGST: false,
        billDiscount: 400,
        billDiscountType: '₹',
        gstPercent: 18,
        barcode: '8901234011',
        mfgDate: '2026-03-15',
        expiry: '',
        hsn: '8433',
        batch: 'BC-2026-52',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 8900,
      discountAmount: 400,
      taxAmount: 1530,
      roundOff: 0,
      netAmount: 10030.00,
    },
  },
];

const AdminPOSQuotations: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [quotations, setQuotations] = useState<PurchaseEntryRecord[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<PurchaseEntryRecord | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch saved quotations from server/localStorage or fallback to dummy
  const loadQuotations = async () => {
    try {
      const res = await getAdminPurchaseEntries('quotation');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
         const normalized: PurchaseEntryRecord[] = res.data.map(q => ({
            ...q,
            totals: {
              grossAmount: q.totals?.grossAmount ?? q.totals?.gross ?? 0,
              discountAmount: q.totals?.discountAmount ?? q.totals?.discount ?? 0,
              taxAmount: q.totals?.taxAmount ?? q.totals?.tax ?? 0,
              roundOff: q.totals?.roundOff ?? 0,
              netAmount: q.totals?.netAmount ?? q.totals?.net ?? 0,
            }
          }));
          setQuotations(normalized);
          localStorage.setItem('admin_pos_purchase_entries_quotes', JSON.stringify(normalized));
          return;
      }
    } catch (err) {
      console.error('Failed to fetch from API', err);
    }

    try {
      const raw = localStorage.getItem('admin_pos_purchase_entries_quotes') || localStorage.getItem('admin_pos_purchase_entries');
      if (raw) {
        const parsed: any[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const quotesOnly = parsed.filter(q => q.type === 'quotation');
          if (quotesOnly.length > 0) {
            const normalized: PurchaseEntryRecord[] = quotesOnly.map(q => ({
              ...q,
              totals: {
                grossAmount: q.totals?.grossAmount ?? q.totals?.gross ?? 0,
                discountAmount: q.totals?.discountAmount ?? q.totals?.discount ?? 0,
                taxAmount: q.totals?.taxAmount ?? q.totals?.tax ?? 0,
                roundOff: q.totals?.roundOff ?? 0,
                netAmount: q.totals?.netAmount ?? q.totals?.net ?? 0,
              }
            }));
            setQuotations(normalized);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load quotations', err);
    }

    // Default to dummy quotation data
    setQuotations(DUMMY_QUOTATIONS);
    localStorage.setItem('admin_pos_purchase_entries_quotes', JSON.stringify(DUMMY_QUOTATIONS));
  };

  useEffect(() => {
    loadQuotations();
  }, []);

  const handleReloadDemoQuotations = () => {
    setQuotations(DUMMY_QUOTATIONS);
    localStorage.setItem('admin_pos_purchase_entries_quotes', JSON.stringify(DUMMY_QUOTATIONS));
    showToast('Demo quotations loaded successfully', 'success');
  };

  const handleActionClick = (quote: PurchaseEntryRecord) => {
    setSelectedQuote(quote);
    setShowActionSheet(true);
  };

  const closeActionSheet = () => {
    setShowActionSheet(false);
    setSelectedQuote(null);
  };

  const handleEditOrder = () => {
    if (!selectedQuote) return;
    sessionStorage.setItem('edit_quotation_data', JSON.stringify(selectedQuote));
    navigate('/admin/pos/orders?mode=edit_quotation');
    closeActionSheet();
  };

  const handleConvertToBill = () => {
    if (!selectedQuote) return;
    sessionStorage.setItem('convert_quotation_data', JSON.stringify(selectedQuote));
    navigate('/admin/pos/orders?mode=convert_quotation');
    closeActionSheet();
  };

  const handleViewBill = () => {
    if (!selectedQuote) return;
    printQuotation(selectedQuote);
    closeActionSheet();
  };

  const handlePrint = () => {
    if (!selectedQuote) return;
    printQuotation(selectedQuote);
    closeActionSheet();
  };

  const printQuotation = (entry: PurchaseEntryRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const billNoPrefix = entry.type === 'quotation' ? 'QTN' : 'BILL';
    const billNo = `${billNoPrefix}/${new Date(entry.createdAt).getFullYear()}/${entry.id.slice(-5)}`;
    const supplierName = entry.supplier?.name || 'Walk-in Supplier';
    const supplierAddress = entry.supplier?.address || '-';
    const supplierPhone = entry.supplier?.phone || '-';
    const supplierGst = entry.supplier?.gstNumber || '-';

    const taxGroups: { [percent: number]: { taxable: number; cgst: number; sgst: number } } = {};
    entry.items.forEach(item => {
      const gross = item.purchasePrice * item.qty;
      const discount = item.billDiscountType === '%' ? (gross * item.billDiscount) / 100 : item.billDiscount;
      const netBeforeTax = Math.max(gross - discount, 0);

      let lineTax = 0;
      let lineTaxable = 0;

      if (item.includingGST) {
        lineTax = (netBeforeTax * item.gstPercent) / (100 + item.gstPercent);
        lineTaxable = netBeforeTax - lineTax;
      } else {
        lineTax = (netBeforeTax * item.gstPercent) / 100;
        lineTaxable = netBeforeTax;
      }

      const rate = item.gstPercent;
      if (!taxGroups[rate]) {
        taxGroups[rate] = { taxable: 0, cgst: 0, sgst: 0 };
      }
      taxGroups[rate].taxable += lineTaxable;
      taxGroups[rate].cgst += lineTax / 2;
      taxGroups[rate].sgst += lineTax / 2;
    });

    const gstRowsHtml = Object.entries(taxGroups).flatMap(([rateStr, data]) => {
      const rate = Number(rateStr);
      const halfRate = (rate / 2).toFixed(1) + '%';
      return [
        `<tr><td>CGST</td><td>${halfRate}</td><td>₹${data.taxable.toFixed(2)}</td><td>₹${data.cgst.toFixed(2)}</td></tr>`,
        `<tr><td>SGST</td><td>${halfRate}</td><td>₹${data.taxable.toFixed(2)}</td><td>₹${data.sgst.toFixed(2)}</td></tr>`
      ];
    }).join('');

    const rows = entry.items.map((item, idx) => {
      const gross = item.purchasePrice * item.qty;
      const discount = item.billDiscountType === '%' ? (gross * item.billDiscount) / 100 : item.billDiscount;
      const taxableLine = Math.max(gross - discount, 0);
      const lineTax = item.includingGST ? 0 : (taxableLine * item.gstPercent) / 100;
      const lineNet = taxableLine + lineTax;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.productName}</td>
          <td>${item.hsn || '-'}</td>
          <td>₹${item.mrp.toFixed(2)}</td>
          <td>${item.qty.toFixed(2)}</td>
          <td>₹${item.purchasePrice.toFixed(2)}</td>
          <td>${item.billDiscount.toFixed(2)}${item.billDiscountType}</td>
          <td>${(item.gstPercent / 2).toFixed(2)}%</td>
          <td>${(item.gstPercent / 2).toFixed(2)}%</td>
          <td>₹${lineNet.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>Quotation - ${billNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 22px; color: #111; }
            h1, h2, h3, p { margin: 0; }
            .top { text-align: center; margin-bottom: 10px; }
            .top h1 { font-size: 34px; letter-spacing: 1px; }
            .top p { font-size: 18px; margin-top: 3px; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 12px 0; font-size: 16px; }
            .meta .box { border: 1px solid #d9d9d9; padding: 10px; min-height: 90px; }
            .meta .line { display: flex; justify-content: space-between; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #d9d9d9; padding: 7px 6px; font-size: 14px; text-align: left; }
            th { background: #f6f6f6; font-weight: 700; }
            td:last-child, th:last-child { text-align: right; }
            .summary-wrap { display: grid; grid-template-columns: 1fr 320px; gap: 16px; margin-top: 12px; }
            .gst-box, .totals-box { border: 1px solid #d9d9d9; padding: 8px; }
            .totals-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 15px; }
            .net-total { font-size: 20px; font-weight: 800; margin-top: 6px; border-top: 1px dashed #999; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="top">
            <h1>Unnati</h1>
            </div>

          <div class="meta">
            <div class="box">
              <h3 style="margin-bottom:6px;">Customer Details</h3>
              <div class="line"><span>Name</span><strong>${supplierName}</strong></div>
              <div class="line"><span>Address</span><span>${supplierAddress}</span></div>
              <div class="line"><span>Phone</span><span>${supplierPhone}</span></div>
              <div class="line"><span>GSTIN</span><span>${supplierGst}</span></div>
            </div>
            <div class="box">
              <h3 style="margin-bottom:6px;">Quotation</h3>
              <div class="line"><span>Bill No</span><span>${billNo}</span></div>
              <div class="line"><span>Date</span><span>${entry.date}</span></div>
              <div class="line"><span>Payment</span><span>${entry.paymentMode}</span></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S No</th>
                <th>Item Name</th>
                <th>HSN Code</th>
                <th>MRP</th>
                <th>Quantity</th>
                <th>Rate/P</th>
                <th>Disc</th>
                <th>CGST %</th>
                <th>SGST %</th>
                <th>Net Amt.</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="summary-wrap">
            <div class="gst-box">
              <h3 style="margin-bottom:6px;">GST Summary</h3>
              <table>
                <thead>
                  <tr><th>Type of Tax</th><th>%</th><th>Taxable</th><th>Tax Amount</th></tr>
                </thead>
                <tbody>
                  ${gstRowsHtml}
                </tbody>
              </table>
            </div>
            <div class="totals-box">
              <div class="totals-row"><span>Gross Amt.</span><strong>₹${entry.totals.grossAmount.toFixed(2)}</strong></div>
              <div class="totals-row"><span>Total Deduction</span><strong>₹${entry.totals.discountAmount.toFixed(2)}</strong></div>
              <div class="totals-row"><span>GST Amt.</span><strong>₹${entry.totals.taxAmount.toFixed(2)}</strong></div>
              <div class="totals-row"><span>Round Off</span><strong>₹${entry.totals.roundOff.toFixed(2)}</strong></div>
              <div class="totals-row net-total"><span>Total Amount</span><strong>₹${entry.totals.netAmount.toFixed(2)}</strong></div>
            </div>
          </div>

          <p style="margin-top:14px; font-size:13px;">Amt in words: Rupees ${entry.totals.netAmount.toFixed(2)} only</p>
          <p style="font-size:12px; color:#666;">Quotation is valid for 15 days from issue date.</p>
          <p style="margin-top: 24px; text-align:right; font-weight:bold;">Authorised Signature</p>

          <script>
            setTimeout(function() { window.print(); }, 400);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleShareWhatsApp = () => {
    if (!selectedQuote) return;
    const itemsList = selectedQuote.items.map((i: PurchaseItem) => `${i.productName} (x${i.qty}) - ₹${i.retailPrice}`).join('\n');
    const message = `Hello,\nHere is your quotation details:\n\n${itemsList}\n\nTotal Amount: ₹${selectedQuote.totals.netAmount}\n\nThank you for shopping with us!`;
    const phone = selectedQuote.supplier?.phone || '';
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    closeActionSheet();
  };

  const handleCall = () => {
    if (!selectedQuote) return;
    const phone = selectedQuote.supplier?.phone || '';
    if (phone) {
        window.location.href = `tel:${phone}`;
    } else {
        showToast('Phone number not available', 'error');
    }
    closeActionSheet();
  };

  const stats = useMemo(() => {
    const totalAmount = quotations.reduce((acc, q) => acc + (q.totals?.netAmount ?? 0), 0);
    const totalItems = quotations.reduce((acc, q) => acc + q.items.length, 0);
    const avgAmount = quotations.length > 0 ? totalAmount / quotations.length : 0;
    return {
      count: quotations.length,
      totalAmount,
      totalItems,
      avgAmount,
    };
  }, [quotations]);

  const filteredQuotations = quotations.filter(q =>
    q.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <button onClick={() => navigate('/admin/pos/orders')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors md:hidden">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
             </button>
             <h1 className="text-xl md:text-2xl font-bold text-gray-800">POS Quotations</h1>
          </div>
          <p className="text-gray-500 text-xs md:text-sm">Track and manage customer price estimations, quotation bills and convert to orders</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleReloadDemoQuotations}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-pink-700 bg-pink-50 border border-pink-200 rounded-xl hover:bg-pink-100 active:scale-95 transition-all shadow-sm"
              title="Reset and reload dummy quotations"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reload Dummy Quotes
            </button>
            <button
              onClick={() => navigate('/admin/pos/orders?mode=new_quotation')}
              className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-dark)] transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              New Quote
            </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Quotes</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{stats.count} <span className="text-xs font-normal text-gray-500">Estimates</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-pink-50 text-[var(--primary-color)] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Estimated Value</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">₹{stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Avg Quote Size</p>
            <p className="text-xl font-bold text-blue-600 mt-1">₹{stats.avgAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Products</p>
            <p className="text-xl font-bold text-purple-600 mt-1">{stats.totalItems} <span className="text-xs font-normal text-gray-500">Lines</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>
      </div>

      {/* Date Filter Bar & Search */}
      <div className="space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center border border-gray-100">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by quote ID, customer name, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[var(--primary-alpha-10)] focus:border-[var(--primary-color)] outline-none transition-all"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex justify-between items-center bg-[#fff1f7] p-2 pl-4 rounded-xl border border-[var(--primary-color)]">
            <div className="flex items-center gap-3">
               <div>
                 <p className="text-[10px] font-bold text-[var(--primary-color)] uppercase tracking-wider">Date Range</p>
                 <p className="text-pink-700 text-xs font-medium">Last 30 Days</p>
               </div>
            </div>
            <button className="p-2 text-[var(--primary-color)] hover:text-[var(--primary-dark)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M4 11h16M5 21h14a1 1 0 001-1V8a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="pb-24 space-y-3">
        {filteredQuotations.length === 0 ? (
          <div className="bg-white rounded-2xl py-20 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="font-bold text-gray-700">No quotations found</p>
            <p className="text-xs text-gray-400 mt-1">Try searching with a different ID or customer name</p>
            <button
              onClick={handleReloadDemoQuotations}
              className="mt-4 px-4 py-2 bg-[var(--primary-color)] text-white text-xs font-bold rounded-xl hover:bg-[var(--primary-dark)] active:scale-95 transition-all shadow-sm"
            >
              Load Demo Quotations
            </button>
          </div>
        ) : (
          filteredQuotations.map((quote, idx) => (
            <div
              key={quote.id}
              onClick={() => handleActionClick(quote)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-pink-300 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-[#fff1f7] rounded-2xl flex items-center justify-center text-[var(--primary-color)] shrink-0 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900 font-mono">{quote.id}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        ESTIMATE
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold mt-0.5">{quote.supplier?.name || 'Walk-in Customer'}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {quote.items.map(i => i.productName).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-50">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Total Estimate</p>
                    <p className="text-xl font-black text-gray-900 leading-tight">₹{(quote.totals?.netAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-right">
                    <div className="bg-gray-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 text-[11px] font-bold text-gray-700">
                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1 5h12" />
                      </svg>
                      {quote.items.length} {quote.items.length === 1 ? 'item' : 'items'}
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium mt-1">
                      {new Date(quote.createdAt || quote.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Sheet Modal */}
      {showActionSheet && selectedQuote && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in transition-all duration-300" onClick={closeActionSheet}>
          <div
            className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Grab Handle */}
            <div className="p-2 sm:hidden flex justify-center">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>

            <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-pink-50 text-[var(--primary-color)] rounded-2xl flex items-center justify-center font-black">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                    </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-800">{selectedQuote.id}</h3>
                  <p className="text-xs text-gray-500 font-medium">{selectedQuote.supplier?.name || 'Customer Quotation'} • ₹{(selectedQuote.totals?.netAmount ?? 0).toFixed(2)}</p>
                </div>
              </div>
              <button onClick={closeActionSheet} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-2.5 pb-10 sm:pb-6">
              <ActionItem
                icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                title="Convert to Bill / Invoice"
                subtitle="Load quote directly into POS register for checkout"
                onClick={handleConvertToBill}
                iconBg="bg-emerald-50"
              />
              <ActionItem
                icon={<svg className="w-5 h-5 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                title="Edit Quotation in POS"
                subtitle="Modify items, prices or customer details"
                onClick={handleEditOrder}
                iconBg="bg-pink-50"
              />
              <ActionItem
                icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>}
                title="Print Quotation PDF"
                subtitle="Generate clean formatted estimate printout"
                onClick={handlePrint}
                iconBg="bg-blue-50"
              />
              {selectedQuote.supplier?.phone && (
                <ActionItem
                  icon={<svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                  title="Share via WhatsApp"
                  subtitle={`Send quotation directly to +91 ${selectedQuote.supplier.phone}`}
                  onClick={handleShareWhatsApp}
                  iconBg="bg-emerald-50"
                />
              )}
            </div>
          </div>
        </div>
      )}
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
      className="w-full bg-white rounded-2xl p-3.5 flex items-center justify-between hover:bg-gray-50 active:scale-[0.98] transition-all border border-gray-100 group shadow-xs"
    >
      <div className="flex items-center gap-3.5">
        <div className={`w-11 h-11 ${iconBg} rounded-[18px] flex items-center justify-center transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-gray-800 leading-tight">{title}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="text-gray-300">
         <svg className="w-4 h-4 leading-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
      </div>
    </button>
  );
};

export default AdminPOSQuotations;
