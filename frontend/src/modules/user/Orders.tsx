import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { duration, staggerContainer, staggerItem, tapSoft } from '../../lib/motion';

const MotionLink = motion(Link);
import { useOrders } from '../../hooks/useOrders';
import { formatAmount } from '../../utils/priceUtils';


const getCustomerStatusInfo = (status: string) => {
  switch (status) {
    case 'Received':
    case 'Placed':
    case 'Pending':
      return {
        label: 'Order Placed',
        className: 'bg-amber-50 text-amber-800 border border-amber-200/60',
      };
    case 'Accepted':
    case 'Processed':
      return {
        label: 'Preparing',
        className: 'bg-blue-50 text-blue-800 border border-blue-200/60',
      };
    case 'Shipped':
    case 'Picked up':
    case 'Out for Delivery':
    case 'On the way':
      return {
        label: 'Out for Delivery',
        className: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60',
      };
    case 'Delivered':
      return {
        label: 'Delivered',
        className: 'bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] border border-[var(--brand-leaf,#5FA82E)]/30',
      };
    case 'Cancelled':
    case 'Rejected':
      return {
        label: 'Cancelled',
        className: 'bg-red-50 text-red-700 border border-red-200/60',
      };
    case 'Returned':
    case 'Return Requested':
      return {
        label: 'Returned',
        className: 'bg-neutral-100 text-neutral-800 border border-neutral-200/60',
      };
    default:
      return {
        label: status || 'Order Placed',
        className: 'bg-neutral-100 text-neutral-800 border border-neutral-200/60',
      };
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Orders() {
  const { orders } = useOrders();

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] px-4 md:px-6 lg:px-8 py-16 text-center">
        <motion.div
          className="text-6xl md:text-8xl mb-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
          transition={{ opacity: { duration: duration.base }, scale: { duration: duration.base }, y: { duration: 2.4, ease: 'easeInOut', repeat: Infinity } }}
        >
          📦
        </motion.div>
        <h2 className="text-xl md:text-2xl font-display font-bold text-[var(--brand-green-deep,#14401F)] mb-2">No orders yet</h2>
        <p className="text-[var(--brand-ink-muted,#5B6B60)] mb-6 md:mb-8 md:text-lg">Start shopping to see your orders here!</p>
        <Link
          to="/"
          className="inline-block bg-[var(--brand-green,#236B34)] text-white px-6 md:px-8 py-3 md:py-3.5 rounded-xl font-bold hover:bg-[var(--brand-green-dark,#1B5128)] transition-colors shadow-sm md:text-base"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] pb-24 md:pb-16">
      <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 bg-white border-b border-[var(--brand-border,#E9E2D3)] mb-4 md:mb-6 sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl md:text-2xl font-display font-bold text-[var(--brand-green-deep,#14401F)]">My Orders</h1>
      </div>

      <motion.div
        className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 space-y-4 md:space-y-6"
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="show"
      >
        {orders.map((order) => {
          const shortId = order.orderNumber || order.id.split('-').slice(-1)[0];
          const statusInfo = getCustomerStatusInfo(order.status);
          return (
            <MotionLink
              key={order.id}
              to={`/orders/${order.id}`}
              variants={staggerItem}
              whileTap={tapSoft}
              className="block bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] p-4 shadow-[0_4px_16px_rgba(35,107,52,0.05)] hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--brand-ink,#1C2B20)] mb-1">
                    Order #{shortId}
                  </div>
                  <div className="text-xs text-[var(--brand-ink-muted,#5B6B60)]">{formatDate(order.createdAt)}</div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}
                >
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--brand-ink-muted,#5B6B60)]">
                  {order.totalItems} {order.totalItems === 1 ? 'item' : 'items'}
                </div>
                <div className="text-lg font-display font-price font-bold text-[var(--brand-green,#236B34)]">
                  ₹{formatAmount(order.totalAmount)}
                </div>
              </div>
            </MotionLink>
          );
        })}
      </motion.div>
    </div>
  );
}
