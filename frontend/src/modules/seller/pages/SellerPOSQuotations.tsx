import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { PurchaseEntryRecord, PurchaseItem } from './SellerPOSOrders';
import { getSellerPurchaseEntries as apiGetSellerPurchaseEntries } from '../../../services/api/seller/sellerPurchaseService';

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
        mfgDate: '2026-04-01',
        expiry: '2029-04-01',
        hsn: '3105',
        batch: 'NPK-2026-19',
        packOf: 1,
        additionalOpen: false,
      },
      {
        id: 'qi-6',
        productId: 'p-6',
        baseProductId: 'bp-6',
        productName: 'Chelated Zinc EDTA 12% (1kg Pouch)',
        mrp: 420,
        retailPrice: 380,
        purchasePrice: 310,
        wholesalePrice: 325,
        qty: 25,
        currentQty: 150,
        includingGST: false,
        billDiscount: 0,
        billDiscountType: '%',
        gstPercent: 12,
        barcode: '8901234006',
        mfgDate: '2026-02-20',
        expiry: '2028-02-20',
        hsn: '3808',
        batch: 'ZN-2026-02',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 29500,
      discountAmount: 500,
      taxAmount: 1990,
      roundOff: 0,
      netAmount: 30990.00,
    },
  },
  {
    id: 'QTN-90204',
    type: 'quotation',
    supplier: {
      name: 'Sunita Sharma (Pragati Farms)',
      phone: '9876543210',
      address: 'Near Mandi Gate, Jaora, MP',
      notes: 'Pest management essentials and sprayer accessories',
      gstNumber: '',
      openingBalance: '0',
      openingBalanceType: 'Payment',
    },
    paymentMode: 'Cash',
    date: '2026-09-05',
    createdAt: '2026-09-05T16:20:00.000Z',
    items: [
      {
        id: 'qi-7',
        productId: 'p-7',
        baseProductId: 'bp-7',
        productName: 'Cold Pressed Bio-Neem Oil 10,000 PPM (1 Litre)',
        mrp: 650,
        retailPrice: 580,
        purchasePrice: 480,
        wholesalePrice: 500,
        qty: 8,
        currentQty: 40,
        includingGST: false,
        billDiscount: 100,
        billDiscountType: '₹',
        gstPercent: 12,
        barcode: '8901234007',
        mfgDate: '2026-03-15',
        expiry: '2028-03-15',
        hsn: '3808',
        batch: 'NM-2026-03',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 3840,
      discountAmount: 100,
      taxAmount: 448.80,
      roundOff: 0.20,
      netAmount: 4189.00,
    },
  },
  {
    id: 'QTN-90205',
    type: 'quotation',
    supplier: {
      name: 'Pooja Bio-Agro Tech',
      phone: '9111234567',
      address: 'Main Market, Khachrod, MP',
      notes: 'Soil health conditioning pack quote',
      gstNumber: '23AABCP9871D1Z5',
      openingBalance: '0',
      openingBalanceType: 'Payment',
    },
    paymentMode: 'Online',
    date: '2026-09-04',
    createdAt: '2026-09-04T09:45:00.000Z',
    items: [
      {
        id: 'qi-8',
        productId: 'p-8',
        baseProductId: 'bp-8',
        productName: 'Humic Acid 98% Super Potassium Fulvate (1kg)',
        mrp: 450,
        retailPrice: 380,
        purchasePrice: 310,
        wholesalePrice: 325,
        qty: 30,
        currentQty: 100,
        includingGST: false,
        billDiscount: 300,
        billDiscountType: '₹',
        gstPercent: 12,
        barcode: '8901234008',
        mfgDate: '2026-04-10',
        expiry: '2029-04-10',
        hsn: '3105',
        batch: 'HA-2026-04',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 9300,
      discountAmount: 300,
      taxAmount: 1080,
      roundOff: 0,
      netAmount: 10080.00,
    },
  },
  {
    id: 'QTN-90206',
    type: 'quotation',
    supplier: {
      name: 'Mahesh Joshi (Om Krishi Kendra)',
      phone: '9752098765',
      address: 'Station Road, Nagda, MP',
      notes: 'Micro-irrigation fittings and valves',
      gstNumber: '',
      openingBalance: '0',
      openingBalanceType: 'Payment',
    },
    paymentMode: 'Credit',
    date: '2026-09-03',
    createdAt: '2026-09-03T15:10:00.000Z',
    items: [
      {
        id: 'qi-9',
        productId: 'p-9',
        baseProductId: 'bp-9',
        productName: 'Drip Irrigation Ball Valve 16mm (Pack of 50)',
        mrp: 1200,
        retailPrice: 1050,
        purchasePrice: 920,
        wholesalePrice: 950,
        qty: 4,
        currentQty: 60,
        includingGST: false,
        billDiscount: 0,
        billDiscountType: '%',
        gstPercent: 18,
        barcode: '8901234009',
        mfgDate: '2026-01-25',
        expiry: '',
        hsn: '8481',
        batch: 'BV-2026-01',
        packOf: 1,
        additionalOpen: false,
      },
    ],
    totals: {
      grossAmount: 3680,
      discountAmount: 0,
      taxAmount: 662.40,
      roundOff: -0.40,
      netAmount: 4342.00,
    },
  },
];

const SellerPOSQuotations: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [quotations, setQuotations] = useState<PurchaseEntryRecord[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<PurchaseEntryRecord | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch saved quotations or fall back to dummy data
  useEffect(() => {
    const loadQuotations = async () => {
      try {
        const res = await apiGetSellerPurchaseEntries('quotation');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const normalized: PurchaseEntryRecord[] = res.data.map((q: any) => ({
            ...q,
            totals: {
              grossAmount: q.totals?.grossAmount ?? q.totals?.gross ?? 0,
              discountAmount: q.totals?.discountAmount ?? q.totals?.discount ?? 0,
              taxAmount: q.totals?.taxAmount ?? q.totals?.tax ?? 0,
              roundOff: q.totals?.roundOff ?? 0,
              netAmount: q.totals?.netAmount ?? q.totals?.net ?? 0,
            }
          }));
          const filtered = normalized.filter(q => q.type === 'quotation');
          if (filtered.length > 0) {
            setQuotations(filtered);
            localStorage.setItem('seller_pos_purchase_entries', JSON.stringify(res.data));
            return;
          }
        }
      } catch {
        // fallback to local cache or dummy
      }

      try {
        const raw = localStorage.getItem('seller_pos_purchase_entries');
        if (raw) {
          const parsed: any[] = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized: PurchaseEntryRecord[] = parsed.map(q => ({
              ...q,
              totals: {
                grossAmount: q.totals?.grossAmount ?? q.totals?.gross ?? 0,
                discountAmount: q.totals?.discountAmount ?? q.totals?.discount ?? 0,
                taxAmount: q.totals?.taxAmount ?? q.totals?.tax ?? 0,
                roundOff: q.totals?.roundOff ?? 0,
                netAmount: q.totals?.netAmount ?? q.totals?.net ?? 0,
              }
            }));
            const filtered = normalized.filter(q => q.type === 'quotation');
            if (filtered.length > 0) {
              setQuotations(filtered);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Failed to load quotations from storage', err);
      }

      // Default to realistic dummy quotations
      setQuotations(DUMMY_QUOTATIONS);
    };

    void loadQuotations();
  }, []);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalCount = quotations.length;
    const totalValue = quotations.reduce((acc, q) => acc + (q.totals?.netAmount ?? 0), 0);
    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;
    return { totalCount, totalValue, avgValue };
  }, [quotations]);

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
    navigate('/seller/pos/orders?mode=edit_quotation');
    closeActionSheet();
  };

  const handleConvertToBill = () => {
    if (!selectedQuote) return;
    sessionStorage.setItem('convert_quotation_data', JSON.stringify(selectedQuote));
    navigate('/seller/pos/orders?mode=convert_quotation');
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

    let shopName = 'Ecommerce Agri & Seeds';
    let shopAddress = 'Nagda, Madhya Pradesh, India - 454001';
    let shopPhone = '';
    try {
      const rawSettings = localStorage.getItem('seller_bill_settings');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed?.shopName?.trim()) shopName = parsed.shopName.trim();
        if (parsed?.address?.trim()) shopAddress = parsed.address.trim();
        if (parsed?.phone?.trim()) shopPhone = parsed.phone.trim();
      }
    } catch {}
    const shopAddressHtml = shopAddress.replace(/\n/g, '<br>');

    const billNo = entry.id.startsWith('QTN-')
      ? entry.id
      : `QTN/${new Date(entry.createdAt).getFullYear()}/${entry.id.slice(-5)}`;
    const supplierName = entry.supplier?.name || 'Customer';
    const supplierAddress = entry.supplier?.address || '-';
    const supplierPhone = entry.supplier?.phone || '-';
    const supplierGst = entry.supplier?.gstNumber || '-';

    // Group tax by GST percentage
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
        `<tr><td>CGST</td><td>${halfRate}</td><td>${data.taxable.toFixed(2)}</td><td>${data.cgst.toFixed(2)}</td></tr>`,
        `<tr><td>SGST</td><td>${halfRate}</td><td>${data.taxable.toFixed(2)}</td><td>${data.sgst.toFixed(2)}</td></tr>`
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
          <td>${item.mrp.toFixed(2)}</td>
          <td>${item.qty.toFixed(2)}</td>
          <td>${item.purchasePrice.toFixed(2)}</td>
          <td>${item.billDiscount.toFixed(2)}${item.billDiscountType}</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${(item.gstPercent / 2).toFixed(2)}</td>
          <td>${lineNet.toFixed(2)}</td>
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
            <h1>${shopName}</h1>
            <p>${shopAddressHtml}</p>
            <p>Mobile: ${shopPhone}</p>
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
              <h3 style="margin-bottom:6px;">Quotation Details</h3>
              <div class="line"><span>Quote No</span><span>${billNo}</span></div>
              <div class="line"><span>Date</span><span>${entry.date}</span></div>
              <div class="line"><span>Payment Mode</span><span>${entry.paymentMode}</span></div>
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

          <p style="margin-top:10px;">Amount in words: ₹${entry.totals.netAmount.toFixed(2)} only</p>
          <p>This quotation is valid for 15 days from issue date.</p>
          <p style="margin-top: 24px; text-align:right;">Authorised Signature</p>

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
    const itemsList = selectedQuote.items.map((i: PurchaseItem) => `• ${i.productName} (Qty: ${i.qty}) - ₹${i.retailPrice || i.purchasePrice}`).join('\n');
    const message = `Namaste,\nHere is your quotation details from our store:\n\n${itemsList}\n\n*Total Amount: ₹${selectedQuote.totals.netAmount.toFixed(2)}*\n\nThank you for choosing us!`;
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

  const filteredQuotations = quotations.filter(q =>
    q.id.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    (q.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    (q.supplier?.phone || '').includes(searchQuery.trim()) ||
    q.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase().trim()))
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-neutral-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate('/seller/pos/orders')} className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors md:hidden">
              <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">POS Quotations</h1>
          </div>
          <p className="text-neutral-500 text-sm">Create, share, and convert price estimates into completed POS sales bills</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/seller/pos/orders?mode=new_quotation')}
            className="px-5 py-2.5 bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 border border-purple-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Quotations</div>
            <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Quoted Value</div>
            <div className="text-2xl font-bold text-neutral-900 mt-0.5">₹{stats.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Avg Quote Value</div>
            <div className="text-2xl font-bold text-neutral-900 mt-0.5">₹{stats.avgValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center border border-neutral-200">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by quote ID, customer name, phone, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] outline-none transition-all"
          />
          <svg className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-200 text-neutral-700 text-xs font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>All Recent Quotations</span>
        </div>
      </div>

      {/* List of Quotation Cards */}
      <div className="space-y-3.5">
        {filteredQuotations.length === 0 ? (
          <div className="bg-white rounded-2xl py-20 shadow-sm border border-neutral-200 flex flex-col items-center justify-center text-neutral-400">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-neutral-700 text-base">No quotations found</p>
            <p className="text-xs text-neutral-400 mt-1">Try adjusting your search terms</p>
          </div>
        ) : (
          filteredQuotations.map((quote) => (
            <div
              key={quote.id}
              onClick={() => handleActionClick(quote)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200 hover:border-[var(--primary-color)]/50 active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-purple-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[var(--primary-darker)] bg-[var(--primary-alpha-10)] px-2 py-0.5 rounded border border-[var(--primary-alpha-20)]">
                        #{quote.id}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        Quotation
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-neutral-900 mt-1">{quote.supplier?.name || 'Customer Walk-in'}</h3>
                    {quote.supplier?.phone && (
                      <p className="text-xs text-neutral-500 mt-0.5">Phone: {quote.supplier.phone}</p>
                    )}
                    <p className="text-xs text-neutral-600 mt-1 line-clamp-1">
                      Items: {quote.items.map(i => `${i.productName} (x${i.qty})`).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-100">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Total Quoted</div>
                    <div className="text-2xl font-bold text-neutral-900 leading-tight">
                      ₹{(quote.totals?.netAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1 font-medium">
                    {new Date(quote.createdAt || quote.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Sheet Modal */}
      {showActionSheet && selectedQuote && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in transition-all duration-300" onClick={closeActionSheet}>
          <div
            className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
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
                  <h3 className="text-lg font-bold">Quotation #{selectedQuote.id}</h3>
                  <p className="text-xs text-white/80 font-medium">Total: ₹{selectedQuote.totals?.netAmount?.toFixed(2)}</p>
                </div>
              </div>
              <button onClick={closeActionSheet} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-2.5 pb-10 sm:pb-6">
              <ActionItem
                icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                title="Convert to Sale Bill"
                subtitle="Load items directly into POS checkout to complete the order"
                onClick={handleConvertToBill}
                iconBg="bg-emerald-50"
              />
              <ActionItem
                icon={<svg className="w-5 h-5 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                title="View & Print Quotation"
                subtitle="Preview or print thermal / A4 quotation invoice"
                onClick={handleViewBill}
                iconBg="bg-[var(--primary-alpha-10)]"
              />
              <ActionItem
                icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                title="Edit Quotation"
                subtitle="Modify rates, discounts, or quantities"
                onClick={handleEditOrder}
                iconBg="bg-blue-50"
              />
              <ActionItem
                icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                title="Share on WhatsApp"
                subtitle="Send quotation estimate text directly to customer phone"
                onClick={handleShareWhatsApp}
                iconBg="bg-emerald-50"
              />
              {selectedQuote.supplier?.phone && (
                <ActionItem
                  icon={<svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                  title={`Call Customer (${selectedQuote.supplier.phone})`}
                  subtitle="Place direct telephone call"
                  onClick={handleCall}
                  iconBg="bg-neutral-100"
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
      className="w-full bg-white rounded-2xl p-4 flex items-center justify-between hover:bg-neutral-50 active:scale-[0.98] transition-all border border-neutral-200 group"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${iconBg} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105`}>
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

export default SellerPOSQuotations;
