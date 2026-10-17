import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Button from "../../components/ui/button";
import { useOrders } from "../../hooks/useOrders";
import { useAppContext } from "../../context/AppContext";

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const PrinterIcon = ({ className }: { className?: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

export default function Invoice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getOrderById, fetchOrderById } = useOrders();
  const { config } = useAppContext();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      if (!id) return;

      const existingOrder = getOrderById(id);
      if (existingOrder) {
        setOrder(existingOrder);
        setLoading(false);
        return;
      }

      setLoading(true);
      const fetchedOrder = await fetchOrderById(id);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
      }
      setLoading(false);
    };

    loadOrder();
  }, [id, getOrderById, fetchOrderById]);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-green,#236B34)]"></div>
          <p className="text-sm font-medium text-[var(--brand-ink-muted,#5B6B60)]">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] text-[var(--brand-ink,#1C2B20)] p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 text-center shadow-sm border border-[var(--brand-border,#E9E2D3)]">
          <h1 className="text-xl font-display font-bold mb-2 text-[var(--brand-green-deep,#14401F)]">Invoice Not Found</h1>
          <p className="text-xs text-[var(--brand-ink-muted,#5B6B60)] mb-5">We couldn't retrieve the invoice for this order.</p>
          <Link to="/orders">
            <Button className="bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white font-semibold">
              Back to Orders
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = order.subtotal || 0;
  const deliveryFee = order.fees?.deliveryFee || 0;
  const platformFee = order.fees?.platformFee || 0;
  const totalAmount = order.totalAmount || subtotal + deliveryFee + platformFee;
  const logoSrc = config?.appLogo || "/brand/unnati-logo.png";
  const orderNumber = order.orderNumber || order.id?.split("-").slice(-1)[0] || "N/A";

  return (
    <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] text-[var(--brand-ink,#1C2B20)] pb-24 sm:pb-12">
      {/* Header with actions - sticky top, hidden when printing */}
      <div className="bg-white/95 backdrop-blur-md border-b border-[var(--brand-border,#E9E2D3)] sticky top-0 z-20 print:hidden shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-[var(--brand-ink-muted,#5B6B60)] hover:text-[var(--brand-ink,#1C2B20)] font-semibold transition-colors py-1 px-2 rounded-lg hover:bg-neutral-100/70 active:scale-95"
            aria-label="Back">
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 border-[var(--brand-border,#E9E2D3)] hover:bg-[var(--brand-cream-soft,#F6EFE2)] text-[var(--brand-ink,#1C2B20)] font-semibold rounded-xl h-auto">
              <PrinterIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--brand-green,#236B34)]" />
              <span>Print</span>
            </Button>
            <Link to={`/orders/${id}`}>
              <Button
                size="sm"
                className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white font-semibold rounded-xl shadow-sm h-auto">
                View Order
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Invoice Content Card */}
      <div className="max-w-4xl mx-auto px-2.5 sm:px-4 py-3 sm:py-8 print:p-0 print:m-0">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] shadow-[0_4px_20px_rgba(35,107,52,0.06)] print:shadow-none print:border-none p-4 sm:p-8">

          {/* Invoice Header: Brand info on left, Invoice Number & Date on right */}
          <div className="border-b border-[var(--brand-border,#E9E2D3)] pb-4 sm:pb-6 mb-5 sm:mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-6">
              {/* Brand Branding */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <img
                    src={logoSrc}
                    alt="Unnati Logo"
                    className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
                    onError={(e) => {
                      // Fallback if logo fails
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--brand-green-deep,#14401F)] tracking-tight">
                    Unnati
                  </h1>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[var(--brand-orange,#F97316)]">
                  Everything You Need, All in One Place.
                </p>
                <p className="text-[10px] sm:text-xs text-[var(--brand-ink-muted,#5B6B60)] mt-1 uppercase tracking-wider font-bold">
                  Tax Invoice / Bill of Supply
                </p>
              </div>

              {/* Invoice Number & Date Block */}
              <div className="w-full sm:w-auto text-left sm:text-right pt-2.5 sm:pt-0 border-t sm:border-t-0 border-[var(--brand-border-light,#F2ECE0)] flex flex-row sm:flex-col justify-between sm:justify-start gap-3 sm:gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-semibold text-[var(--brand-ink-muted,#5B6B60)] uppercase tracking-wider">
                    Invoice Number
                  </p>
                  <p className="text-sm sm:text-base font-bold font-price text-[var(--brand-ink,#1C2B20)] break-all">
                    {orderNumber}
                  </p>
                </div>
                <div className="text-right sm:text-right flex-shrink-0">
                  <p className="text-[10px] sm:text-xs font-semibold text-[var(--brand-ink-muted,#5B6B60)] uppercase tracking-wider sm:mt-1">
                    Date
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-[var(--brand-ink,#1C2B20)]">
                    {order.createdAt ? formatDate(order.createdAt) : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer & Order Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6 mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-[var(--brand-border-light,#F2ECE0)]">
            {/* Bill To */}
            <div className="bg-[var(--brand-cream-soft,#F6EFE2)]/30 rounded-xl p-3.5 sm:p-4 border border-[var(--brand-border,#E9E2D3)]/70">
              <h2 className="text-xs font-bold text-[var(--brand-green-deep,#14401F)] uppercase tracking-wider mb-2">
                Bill To
              </h2>
              <div className="text-xs sm:text-sm text-[var(--brand-ink,#1C2B20)] space-y-0.5">
                <p className="font-bold text-sm text-[var(--brand-ink,#1C2B20)]">
                  {order.address?.name || "Customer"}
                </p>
                {order.address?.phone && (
                  <p className="text-[var(--brand-ink-muted,#5B6B60)] font-medium">
                    {order.address.phone}
                  </p>
                )}
                <p className="pt-0.5 text-[var(--brand-ink-muted,#5B6B60)] leading-relaxed">
                  {order.address?.flat && `${order.address.flat}, `}
                  {order.address?.street || order.address?.address || ""}
                </p>
                {order.address?.landmark && (
                  <p className="text-[var(--brand-ink-muted,#5B6B60)]">
                    {order.address.landmark}
                  </p>
                )}
                <p className="text-[var(--brand-ink-muted,#5B6B60)] font-medium">
                  {order.address?.city || ""}
                  {order.address?.state && `, ${order.address.state}`}
                  {order.address?.pincode && ` - ${order.address.pincode}`}
                </p>
              </div>
            </div>

            {/* Order Information */}
            <div className="bg-[var(--brand-cream-soft,#F6EFE2)]/30 rounded-xl p-3.5 sm:p-4 border border-[var(--brand-border,#E9E2D3)]/70">
              <h2 className="text-xs font-bold text-[var(--brand-green-deep,#14401F)] uppercase tracking-wider mb-2">
                Order Information
              </h2>
              <div className="text-xs sm:text-sm text-[var(--brand-ink,#1C2B20)] space-y-2">
                <p className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-medium text-[var(--brand-ink-muted,#5B6B60)]">Order ID:</span>
                  <span className="font-semibold font-price text-[var(--brand-ink,#1C2B20)] break-all">
                    {order.orderNumber || order.id || "N/A"}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--brand-ink-muted,#5B6B60)]">Status:</span>
                  <span className="inline-block px-2.5 py-0.5 bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green-dark,#1B5128)] border border-[var(--brand-leaf,#5FA82E)]/25 rounded-full text-[11px] font-bold">
                    {order.status || "Placed"}
                  </span>
                </p>
                {order.paymentMethod && (
                  <p className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[var(--brand-ink-muted,#5B6B60)]">Payment:</span>
                    <span className="font-semibold capitalize text-[var(--brand-ink,#1C2B20)]">
                      {order.paymentMethod}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Order Items Table - fully responsive without cutting off content */}
          <div className="mb-6 sm:mb-8 overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-[var(--brand-border,#E9E2D3)] text-[11px] sm:text-xs uppercase tracking-wider text-[var(--brand-ink-muted,#5B6B60)] font-bold">
                  <th className="py-2.5 px-2 sm:px-3 text-left">
                    Item
                  </th>
                  <th className="py-2.5 px-2 sm:px-3 text-center whitespace-nowrap">
                    Qty
                  </th>
                  <th className="py-2.5 px-2 sm:px-3 text-right whitespace-nowrap">
                    Unit Price
                  </th>
                  <th className="py-2.5 px-2 sm:px-3 text-right whitespace-nowrap">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item: any, index: number) => {
                  const productName =
                    item.product?.name || item.productName || item.product?.productName || "Product";
                  const unitPrice =
                    item.product?.price || item.unitPrice || item.price || 0;
                  const quantity = item.quantity || 1;
                  const itemTotal = item.total || unitPrice * quantity;
                  const itemImage = item.product?.image || item.product?.mainImage || item.image;

                  return (
                    <tr
                      key={index}
                      className="border-b border-[var(--brand-border-light,#F2ECE0)] hover:bg-[var(--brand-cream-soft,#F6EFE2)]/25 transition-colors">
                      <td className="py-2.5 sm:py-3.5 px-2 sm:px-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {itemImage ? (
                            <img
                              src={itemImage}
                              alt={productName}
                              className="w-9 h-9 sm:w-11 sm:h-11 object-cover rounded-lg sm:rounded-xl border border-[var(--brand-border,#E9E2D3)] flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs sm:text-sm text-[var(--brand-ink,#1C2B20)] line-clamp-2 leading-snug">
                              {productName}
                            </p>
                            {item.variant && (
                              <p className="text-[10px] sm:text-xs text-[var(--brand-ink-muted,#5B6B60)] font-medium mt-0.5">
                                {item.variant}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-2.5 sm:py-3.5 px-2 sm:px-3 font-price text-xs sm:text-sm text-[var(--brand-ink,#1C2B20)] font-bold">
                        {quantity}
                      </td>
                      <td className="text-right py-2.5 sm:py-3.5 px-2 sm:px-3 font-price text-xs sm:text-sm text-[var(--brand-ink-muted,#5B6B60)] whitespace-nowrap">
                        {formatCurrency(unitPrice)}
                      </td>
                      <td className="text-right py-2.5 sm:py-3.5 px-2 sm:px-3 font-price text-xs sm:text-sm font-bold text-[var(--brand-green-deep,#14401F)] whitespace-nowrap">
                        {formatCurrency(itemTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Block */}
          <div className="flex justify-end mb-6 sm:mb-8">
            <div className="w-full sm:w-80 bg-[var(--brand-cream-soft,#F6EFE2)]/35 rounded-xl p-3.5 sm:p-4 border border-[var(--brand-border,#E9E2D3)]/70 space-y-2">
              <div className="flex justify-between text-xs sm:text-sm text-[var(--brand-ink-muted,#5B6B60)]">
                <span>Subtotal</span>
                <span className="font-semibold font-price text-[var(--brand-ink,#1C2B20)]">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-[var(--brand-ink-muted,#5B6B60)]">
                  <span>Delivery Fee</span>
                  <span className="font-semibold font-price text-[var(--brand-ink,#1C2B20)]">
                    {formatCurrency(deliveryFee)}
                  </span>
                </div>
              )}
              {platformFee > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-[var(--brand-ink-muted,#5B6B60)]">
                  <span>Platform Fee</span>
                  <span className="font-semibold font-price text-[var(--brand-ink,#1C2B20)]">
                    {formatCurrency(platformFee)}
                  </span>
                </div>
              )}
              <div className="border-t border-[var(--brand-border,#E9E2D3)] pt-2.5 flex justify-between text-base sm:text-lg font-display font-bold text-[var(--brand-green-deep,#14401F)]">
                <span>Total</span>
                <span className="font-price text-[var(--brand-green,#236B34)]">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-[var(--brand-border,#E9E2D3)] pt-5 text-center text-xs text-[var(--brand-ink-muted,#5B6B60)]">
            <p className="mb-0.5 font-bold text-[var(--brand-ink,#1C2B20)]">Thank you for your order with Unnati!</p>
            <p>For any queries, please visit Help &amp; Support.</p>
          </div>
        </motion.div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            margin: 1cm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
