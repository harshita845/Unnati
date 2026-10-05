import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useAuth } from '../context/AuthContext';

// What the customer sees for each order status
const CUSTOMER_STATUS: Record<string, string> = {
  Received: 'Waiting for the store to accept',
  Processed: 'Store is packing your order',
  'Ready for pickup': 'Packed — finding a delivery partner',
  'Picked up': 'Picked up by the delivery partner',
  'Out for Delivery': 'On the way to you',
};
const DONE = ['Delivered', 'Cancelled', 'Rejected', 'Returned'];

/** Shown above the bottom nav on Home while the customer has an order in progress. */
export default function ActiveOrderBar() {
  const { isAuthenticated } = useAuth();
  const { orders, refreshOrders } = useOrders();

  // Pick up an order placed moments ago, and keep the status fresh while on Home
  useEffect(() => {
    if (!isAuthenticated) return;
    refreshOrders();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshOrders();
    }, 20000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;
  const active = (orders as any[])
    .filter((o) => !DONE.includes(o.status) && !(o.status === 'Pending' && o.paymentStatus !== 'Paid'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (!active.length) return null;
  const order = active[0];

  return (
    <Link
      to={`/orders/${order.id || order._id}`}
      className="fixed left-3 right-3 bottom-[4.75rem] z-50 md:hidden flex items-center justify-between gap-3 rounded-2xl bg-[var(--customer-primary-dark)] text-white px-4 py-3 shadow-lg"
    >
      <div className="min-w-0">
        <p className="text-xs opacity-80">
          Order #{order.orderNumber}
          {active.length > 1 ? ` · +${active.length - 1} more` : ''}
        </p>
        <p className="text-sm font-semibold truncate">{CUSTOMER_STATUS[order.status] || order.status}</p>
      </div>
      <span className="text-sm font-semibold whitespace-nowrap">Track ›</span>
    </Link>
  );
}
