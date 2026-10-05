import { Link } from 'react-router-dom';
import { useOrders } from '../../hooks/useOrders';
import { formatAmount } from '../../utils/priceUtils';


const getCustomerStatusInfo = (status: string) => {
  switch (status) {
    case 'Received':
    case 'Placed':
    case 'Pending':
      return {
        label: 'Order Placed',
        className: 'bg-amber-100 text-amber-800 border border-amber-200/60',
      };
    case 'Accepted':
    case 'Processed':
      return {
        label: 'Preparing',
        className: 'bg-blue-100 text-blue-800 border border-blue-200/60',
      };
    case 'Shipped':
    case 'Picked up':
    case 'Out for Delivery':
    case 'On the way':
      return {
        label: 'Out for Delivery',
        className: 'bg-indigo-100 text-indigo-800 border border-indigo-200/60',
      };
    case 'Delivered':
      return {
        label: 'Delivered',
        className: 'bg-emerald-100 text-emerald-800 border border-emerald-200/60',
      };
    case 'Cancelled':
    case 'Rejected':
      return {
        label: 'Cancelled',
        className: 'bg-rose-100 text-rose-800 border border-rose-200/60',
      };
    case 'Returned':
    case 'Return Requested':
      return {
        label: 'Returned',
        className: 'bg-gray-100 text-gray-800 border border-gray-200/60',
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
      <div className="px-4 md:px-6 lg:px-8 py-12 md:py-16 text-center">
        <div className="text-6xl md:text-8xl mb-4">📦</div>
        <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mb-2">No orders yet</h2>
        <p className="text-neutral-600 mb-6 md:mb-8 md:text-lg">Start shopping to see your orders here!</p>
        <Link
          to="/"
          className="inline-block bg-[var(--customer-primary-dark)] text-white px-6 md:px-8 py-3 md:py-4 rounded-lg font-semibold hover:bg-[var(--customer-primary-darker)] transition-colors md:text-lg"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-4 md:pb-8">
      <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 bg-white border-b border-neutral-200 mb-4 md:mb-6 sticky top-0 z-10">
        <h1 className="text-xl md:text-2xl font-bold text-neutral-900">My Orders</h1>
      </div>

      <div className="px-4 md:px-6 lg:px-8 space-y-4 md:space-y-6">
        {orders.map((order) => {
          const shortId = order.orderNumber || order.id.split('-').slice(-1)[0];
          const statusInfo = getCustomerStatusInfo(order.status);
          return (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="block bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900 mb-1">
                    Order #{shortId}
                  </div>
                  <div className="text-xs text-neutral-500">{formatDate(order.createdAt)}</div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}
                >
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-600">
                  {order.totalItems} {order.totalItems === 1 ? 'item' : 'items'}
                </div>
                <div className="text-lg font-bold text-neutral-900">
                  ₹{formatAmount(order.totalAmount)}
                </div>

              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
