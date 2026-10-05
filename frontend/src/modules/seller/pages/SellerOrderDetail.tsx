import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { getOrderById, updateOrderStatus, OrderDetail, UpdateOrderStatusData } from '../../../services/api/orderService';
import jsPDF from 'jspdf';
import Code128Barcode, { code128DataUrl } from '../../../components/Code128Barcode';
import { useSellerOrderUpdates } from '../hooks/useSellerOrderUpdates';

// What the store sees for each order status
const STATUS_LABEL: Record<string, string> = {
  Pending: 'Payment pending',
  Received: 'New order',
  Processed: 'Accepted',
  'Ready for pickup': 'Ready for pickup',
  'Picked up': 'Picked up',
  'Out for Delivery': 'On the way',
  'Out For Delivery': 'On the way',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
  Rejected: 'Rejected',
  Returned: 'Returned',
};
const FLOW_STEPS = ['New order', 'Accepted', 'Ready for pickup', 'Picked up', 'On the way', 'Delivered'];
const FLOW_INDEX: Record<string, number> = {
  Received: 0,
  Processed: 1,
  'Ready for pickup': 2,
  'Picked up': 3,
  'Out for Delivery': 4,
  'Out For Delivery': 4,
  Delivered: 5,
};
const FINAL_STATUSES = ['Delivered', 'Cancelled', 'Rejected', 'Returned'];

export default function SellerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<string>('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Refreshes when the server reports a change to this order (rider accepted, picked up, ...)
  const updateTick = useSellerOrderUpdates(id, 15000);

  const loadOrder = useCallback(
    async (silent: boolean) => {
      if (!id) return;
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const response = await getOrderById(id);
        if (response.success && response.data) {
          setOrderDetail(response.data);
          setOrderStatus(response.data.status);
        } else if (!silent) {
          setError(response.message || 'Failed to fetch order details');
        }
      } catch (err: any) {
        if (!silent) setError(err.response?.data?.message || err.message || 'Failed to fetch order details');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadOrder(false);
  }, [loadOrder]);

  useEffect(() => {
    if (updateTick > 0) loadOrder(true);
  }, [updateTick, loadOrder]);

  // Store actions: Accept, Ready for pickup, Reject, Cancel
  const handleStatusUpdate = async (newStatus: UpdateOrderStatusData['status']) => {
    if (!orderDetail || actionBusy) return;
    if (newStatus === 'Rejected' && !window.confirm('Reject this order? The customer will be told the store could not take it.')) return;
    if (newStatus === 'Cancelled' && !window.confirm('Cancel this order? This cannot be undone.')) return;

    setActionBusy(true);
    setActionMessage(null);
    try {
      const response = await updateOrderStatus(orderDetail.id, { status: newStatus });
      if (response.success) {
        setActionMessage({ type: 'success', text: response.message || 'Order updated' });
        await loadOrder(true);
      } else {
        setActionMessage({ type: 'error', text: response.message || 'Failed to update order' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update order' });
      await loadOrder(true);
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-neutral-500">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/seller/orders')}
            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!orderDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Order Not Found</h2>
          <button
            onClick={() => navigate('/seller/orders')}
            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not delivered yet';
    const date = new Date(dateString + 'T00:00:00');
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    let suffix = 'th';
    if (day === 1 || day === 21 || day === 31) suffix = 'st';
    else if (day === 2 || day === 22) suffix = 'nd';
    else if (day === 3 || day === 23) suffix = 'rd';
    return `${day}${suffix} ${month}, ${year}`;
  };

  const store = orderDetail.store || {};
  const storeName = store.storeName || store.sellerName || '';
  const storeAddress = [store.address, store.city].filter(Boolean).join(', ');
  const storeTax = store.taxNumber ? `${store.taxName || 'GSTIN'}: ${store.taxNumber}` : '';
  const storeLines = [
    storeAddress,
    store.mobile ? `Phone: ${store.mobile}` : '',
    store.email ? `Email: ${store.email}` : '',
    storeTax,
    store.fssaiLicNo ? `FSSAI: ${store.fssaiLicNo}` : '',
  ].filter(Boolean);

  const handleExportPDF = async () => {
    if (!orderDetail) return;
    const pickupBarcode = await code128DataUrl(orderDetail.orderNumber);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPos = margin;

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredHeight: number) => {
      if (yPos + requiredHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Header - Company Info
    doc.setFillColor(22, 163, 74); // seller color
    doc.rect(margin, yPos, contentWidth, 15, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(storeName || 'Tax Invoice', margin + 5, yPos + 10);

    yPos += 20;

    // Store details (from the store's profile)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(storeName, margin, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // Keep the right-hand invoice block aligned: always reserve 4 lines
    for (let i = 0; i < 4; i++) {
      if (storeLines[i]) doc.text(storeLines[i].slice(0, 60), margin, yPos);
      yPos += 6;
    }
    yPos += 6;

    // Invoice Details (Right aligned)
    const rightX = pageWidth - margin;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${formatDate(orderDetail.orderDate)}`, rightX, yPos - 30, { align: 'right' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice #${orderDetail.invoiceNumber}`, rightX, yPos - 20, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Order ID: ${orderDetail.id}`, rightX, yPos - 14, { align: 'right' });
    doc.text(`Delivery Date: ${formatDate(orderDetail.deliveryDate)}`, rightX, yPos - 8, { align: 'right' });
    doc.text(`Time Slot: ${orderDetail.timeSlot}`, rightX, yPos - 2, { align: 'right' });

    // Status badge
    const statusText = STATUS_LABEL[orderStatus] || orderStatus;
    const statusWidth = doc.getTextWidth(statusText) + 8;
    doc.setFillColor(59, 130, 246); // Blue for status
    doc.roundedRect(rightX - statusWidth, yPos + 2, statusWidth, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(statusText, rightX - statusWidth / 2, yPos + 5.5, { align: 'center' });

    yPos += 15;
    doc.setTextColor(0, 0, 0);

    // Draw a line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Table Header
    checkPageBreak(20);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, contentWidth, 10, 'F');

      const colWidths = [
        contentWidth * 0.08,  // Sr. No.
        contentWidth * 0.40,  // Product
        contentWidth * 0.15,  // Price
        contentWidth * 0.15,  // Tax
        contentWidth * 0.10,  // Qty
        contentWidth * 0.12,  // Subtotal
      ];

      let xPos = margin;
      const headers = ['Sr. No.', 'Product', 'Price', 'Tax ₹ (%)', 'Qty', 'Subtotal'];

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);

      headers.forEach((header, index) => {
        doc.text(header, xPos + 2, yPos + 7);
        xPos += colWidths[index];
      });

      yPos += 12;

      // Table Rows
      orderDetail.items.forEach((item) => {
        checkPageBreak(15);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        xPos = margin;
        const rowData = [
          item.srNo.toString(),
          item.product,
          `₹${item.price.toFixed(2)}`,
          `${item.tax.toFixed(2)} (${item.taxPercent.toFixed(2)}%)`,
          item.qty.toString(),
          `₹${item.subtotal.toFixed(2)}`,
        ];

      rowData.forEach((data, index) => {
        // Truncate long text
        const maxWidth = colWidths[index] - 4;
        let text = data;
        if (doc.getTextWidth(text) > maxWidth && index === 1) {
          // Truncate product name if too long
          while (doc.getTextWidth(text + '...') > maxWidth && text.length > 0) {
            text = text.slice(0, -1);
          }
          text += '...';
        }
        doc.text(text, xPos + 2, yPos + 5);
        xPos += colWidths[index];
      });

      // Draw row separator
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, yPos + 8, pageWidth - margin, yPos + 8);

      yPos += 10;
    });

    // Calculate totals
    const totalSubtotal = orderDetail.items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalTax = orderDetail.items.reduce((sum, item) => sum + item.tax, 0);
    const grandTotal = totalSubtotal + totalTax;

    yPos += 5;
    checkPageBreak(30);

    // Totals Section
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', pageWidth - margin - 60, yPos, { align: 'right' });
    doc.text(`₹${totalSubtotal.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;

    doc.text('Tax:', pageWidth - margin - 60, yPos, { align: 'right' });
    doc.text(`₹${totalTax.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Grand Total:', pageWidth - margin - 60, yPos, { align: 'right' });
    doc.text(`₹${grandTotal.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 15;

    // Pickup verification: the delivery partner scans this barcode (or enters the code) at the store
    checkPageBreak(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Pickup code: ${orderDetail.orderNumber.slice(-6)}`, margin, yPos);
    if (pickupBarcode) {
      doc.addImage(pickupBarcode, 'PNG', margin, yPos + 3, 70, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`#${orderDetail.orderNumber}`, margin, yPos + 23);
      yPos += 30;
    } else {
      yPos += 8;
    }

    // Footer
    checkPageBreak(20);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(storeName ? `Bill generated by ${storeName}` : 'Computer generated bill', pageWidth / 2, yPos, { align: 'center' });

    // Save the PDF
    const fileName = `Invoice_${orderDetail.invoiceNumber}_${orderDetail.id}.pdf`;
    doc.save(fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Accepted':
      case 'Processed':
        return 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)] border border-blue-400';
      case 'On the way':
        return 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)] border border-purple-400';
      case 'Delivered':
        return 'bg-[var(--primary-alpha-20)] text-seller-800 border border-[var(--primary-alpha-50)]';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border border-red-400';
      case 'Out For Delivery':
      case 'Out for Delivery':
        return 'bg-[var(--primary-dark)] text-white border border-blue-700';
      case 'Received':
        return 'bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] border border-blue-200';
      case 'Payment Pending':
        return 'bg-orange-50 text-orange-600 border border-orange-200';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  };

  const formatUnit = (unit: string, qty: number) => {
    if (!unit || unit === 'N/A') return 'N/A';

    // improved regex to handle decimals and various spacing
    const match = unit.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
    if (match) {
      const val = parseFloat(match[1]);
      const u = match[2];
      // check if val is a valid number
      if (!isNaN(val)) {
          const total = val * qty;
          // Format to remove trailing zeros if integer (e.g. 1.0 -> 1)
          return `${parseFloat(total.toFixed(2))}${u}`;
      }
    }
    return `${unit} x ${qty}`;
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      {/* Order progress + what the store should do next */}
      <div className="bg-white mb-6 rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-[var(--primary-dark)] text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-semibold">Order #{orderDetail.orderNumber}</h2>
          <span className="text-xs sm:text-sm bg-white/15 px-3 py-1 rounded-full">{STATUS_LABEL[orderStatus] || orderStatus}</span>
        </div>
        <div className="px-4 sm:px-6 py-5 space-y-5">
          {FLOW_INDEX[orderStatus] !== undefined && (
            <ol className="grid grid-cols-6 gap-1 text-center">
              {FLOW_STEPS.map((step, index) => {
                const done = index <= FLOW_INDEX[orderStatus];
                return (
                  <li key={step} className="flex flex-col items-center gap-1">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        done ? 'bg-[var(--primary-dark)] text-white' : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                      }`}
                    >
                      {done ? '✓' : index + 1}
                    </span>
                    <span className={`text-[10px] sm:text-xs leading-tight ${done ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}>{step}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {(() => {
            const progress = orderDetail.sellerProgress;
            const accepted = !!progress?.acceptedAt || ['Processed', 'Ready for pickup'].includes(orderStatus);
            const ready = !!progress?.readyAt || orderStatus === 'Ready for pickup';
            const multiStore = (progress?.totalStores || 1) > 1;
            const rider = orderDetail.deliveryBoyName
              ? `${orderDetail.deliveryBoyName}${orderDetail.deliveryBoyPhone ? ` (${orderDetail.deliveryBoyPhone})` : ''}`
              : '';
            const primaryBtn =
              'px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] disabled:opacity-50';
            const dangerBtn =
              'px-5 py-2.5 rounded-lg text-sm font-semibold text-red-700 bg-white border border-red-300 hover:bg-red-50 disabled:opacity-50';

            if (orderStatus === 'Pending') {
              return <p className="text-sm text-orange-700">Waiting for the customer's online payment. You can accept it once it is paid.</p>;
            }
            if (FINAL_STATUSES.includes(orderStatus)) {
              return <p className="text-sm text-neutral-600">This order is {(STATUS_LABEL[orderStatus] || orderStatus).toLowerCase()}. No further action needed.</p>;
            }
            if (orderStatus === 'Received' && !accepted) {
              return (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-700">New order. Accept it to start packing; a delivery partner is assigned after you accept.</p>
                  <div className="flex flex-wrap gap-3">
                    <button disabled={actionBusy} onClick={() => handleStatusUpdate('Accepted')} className={primaryBtn}>
                      Accept order
                    </button>
                    <button disabled={actionBusy} onClick={() => handleStatusUpdate('Rejected')} className={dangerBtn}>
                      Reject
                    </button>
                  </div>
                </div>
              );
            }
            if (orderStatus === 'Received' && accepted) {
              return (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-700">
                    You accepted. Waiting for the other store(s) in this order ({progress?.storesAccepted}/{progress?.totalStores} accepted).
                  </p>
                  <button disabled={actionBusy} onClick={() => handleStatusUpdate('Cancelled')} className={dangerBtn}>
                    Cancel order
                  </button>
                </div>
              );
            }
            if (['Processed', 'Ready for pickup'].includes(orderStatus)) {
              return (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-700">
                    {ready
                      ? multiStore && orderStatus !== 'Ready for pickup'
                        ? `Packed. Waiting for the other store(s) to pack (${progress?.storesReady}/${progress?.totalStores} ready).`
                        : 'Packed and ready. Hand it over when the delivery partner shows the pickup code.'
                      : 'Accepted. Pack the items, then mark the order ready for pickup.'}
                  </p>
                  {/* Riders are only offered the order once it's Ready for pickup, not while it's being packed */}
                  {orderStatus === 'Ready for pickup' && (
                    <p className="text-sm text-neutral-500">
                      {rider ? `Delivery partner: ${rider}` : 'Finding a delivery partner near your store…'}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {!ready && (
                      <button disabled={actionBusy} onClick={() => handleStatusUpdate('Ready for pickup')} className={primaryBtn}>
                        Mark ready for pickup
                      </button>
                    )}
                    <button disabled={actionBusy} onClick={() => handleStatusUpdate('Cancelled')} className={dangerBtn}>
                      Cancel order
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <p className="text-sm text-neutral-700">
                {orderStatus === 'Picked up' ? 'Collected by the delivery partner' : 'On the way to the customer'}
                {rider ? `: ${rider}` : ''}.
              </p>
            );
          })()}

          {actionMessage && (
            <p className={`text-sm ${actionMessage.type === 'success' ? 'text-[var(--primary-dark)]' : 'text-red-600'}`}>{actionMessage.text}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-2 border-t border-neutral-100">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              Export Invoice PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              Print Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Pickup verification: shown once the store has accepted and until the rider collects the package */}
      {orderDetail.orderNumber &&
        (['Processed', 'Ready for pickup'].includes(orderStatus) || (orderStatus === 'Received' && !!orderDetail.sellerProgress?.acceptedAt)) && (
        <div className="bg-white mb-6 rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-[var(--primary-dark)] text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">Pickup Verification</h2>
          </div>
          <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="bg-white p-2 border border-neutral-200 rounded-lg overflow-x-auto">
              <Code128Barcode value={orderDetail.orderNumber} />
            </div>
            <div className="text-sm text-neutral-700">
              <p className="text-neutral-500">Pickup code</p>
              <p className="text-3xl font-bold tracking-widest text-neutral-900">{orderDetail.orderNumber.slice(-6)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                The delivery partner must scan this barcode (it is also printed on the invoice) or enter this code before taking the package.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Order Details Section */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-[var(--primary-dark)] text-white px-4 sm:px-6 py-3">
          <h2 className="text-base sm:text-lg font-semibold">View Order Details</h2>
        </div>
        <div className="bg-white px-4 sm:px-6 py-6">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row justify-between gap-6 mb-6">
            {/* Left: Company Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {store.logo ? (
                  <img src={store.logo} alt="" className="w-10 h-10 rounded object-cover border border-neutral-200" />
                ) : (
                  <div className="w-10 h-10 bg-[var(--primary-dark)] rounded flex items-center justify-center">
                    <span className="text-white text-sm font-bold">{(storeName || '?').charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">{storeName}</h1>
              </div>
              <div className="text-sm text-neutral-600 space-y-1">
                {storeLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>

            {/* Right: Invoice Details */}
            <div className="flex-1 lg:text-right">
              <div className="text-sm text-neutral-600 mb-4">
                <span className="font-medium">Date:</span> {formatDate(orderDetail.orderDate)}
              </div>
              <div className="text-lg font-semibold text-neutral-900 mb-1">Invoice #{orderDetail.invoiceNumber}</div>
              <div className="text-sm text-neutral-600 mb-1">
                <span className="font-medium">Order ID:</span> {orderDetail.id}
              </div>
              <div className="text-sm text-neutral-600 mb-1">
                <span className="font-medium">Delivery Date:</span> {formatDate(orderDetail.deliveryDate)}
              </div>
              <div className="text-sm text-neutral-600 mb-3">
                <span className="font-medium">Time Slot:</span> {orderDetail.timeSlot}
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                <span className="text-sm font-medium text-neutral-700">Order Status:</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(orderStatus)}`}>
                  {STATUS_LABEL[orderStatus] || orderStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Product Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full min-w-[800px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Sr. No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Tax ₹ (%)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Subtotal</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {orderDetail.items.map((item) => (
                  <tr key={item.srNo}>
                    <td className="px-4 py-3 text-sm text-neutral-900">{item.srNo}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      <div>{item.product}</div>
                      {item.warrantyType && item.warrantyType !== 'None' && (
                        <div className="text-xs text-blue-600 font-medium mt-1">
                          {item.warrantyType}: {item.warrantyDuration}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{formatUnit(item.unit, item.qty)}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900">₹{item.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {item.tax.toFixed(2)} ({item.taxPercent.toFixed(2)}%)
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{item.qty}</td>
                    <td className="px-4 py-3 text-sm text-neutral-900 font-medium">₹{item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bill Generation Note */}
          <div className="border-t border-dashed border-neutral-300 pt-4">
            <p className="text-sm text-neutral-600 text-center">
              Bill Generated by Ecommerce - 10 Minute App
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-6 px-4 sm:px-6 text-center py-4 bg-neutral-100 rounded-lg">
        <p className="text-xs sm:text-sm text-neutral-600">
          Copyright © 2025. Developed By{' '}
          <span className="font-semibold text-[var(--primary-dark)]">Ecommerce - 10 Minute App</span>
        </p>
      </footer>
    </div>
  );
}

