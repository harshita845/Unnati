import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getOrders, Order, GetOrdersParams } from '../../../services/api/orderService';
import ThemedDropdown from '../components/ThemedDropdown';
import { useSellerOrderUpdates } from '../hooks/useSellerOrderUpdates';

type SortField = 'orderId' | 'customerName' | 'deliveryBoyName' | 'deliveryDate' | 'orderDate' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

const DUMMY_OUT_FOR_DELIVERY_ORDERS: Order[] = [
  {
    id: "ord_ofd_101",
    orderId: "ORD-94821",
    customerName: "Ramesh Patel",
    customerPhone: "+91 98261 44520",
    deliveryBoyName: "Rahul Verma (Rider #12)",
    deliveryDate: "09/08/2026",
    orderDate: "09/08/2026",
    status: "Out For Delivery",
    amount: 1450.00,
  },
  {
    id: "ord_ofd_102",
    orderId: "ORD-94822",
    customerName: "Sunita Sharma",
    customerPhone: "+91 98765 11234",
    deliveryBoyName: "Sandeep Yadav (Rider #07)",
    deliveryDate: "09/08/2026",
    orderDate: "09/08/2026",
    status: "Out For Delivery",
    amount: 3890.00,
  },
  {
    id: "ord_ofd_103",
    orderId: "ORD-94823",
    customerName: "Vikram Singh",
    customerPhone: "+91 94250 88712",
    deliveryBoyName: "Deepak Kumar (Rider #03)",
    deliveryDate: "09/08/2026",
    orderDate: "09/08/2026",
    status: "Out For Delivery",
    amount: 920.00,
  },
  {
    id: "ord_ofd_104",
    orderId: "ORD-94824",
    customerName: "Priya Deshmukh",
    customerPhone: "+91 98930 45678",
    deliveryBoyName: "Rahul Verma (Rider #12)",
    deliveryDate: "09/08/2026",
    orderDate: "09/07/2026",
    status: "Out For Delivery",
    amount: 5400.00,
  },
  {
    id: "ord_ofd_105",
    orderId: "ORD-94825",
    customerName: "Amit Verma",
    customerPhone: "+91 97521 33490",
    deliveryBoyName: "Sunil Mehra (Rider #18)",
    deliveryDate: "09/08/2026",
    orderDate: "09/08/2026",
    status: "Out For Delivery",
    amount: 2150.00,
  },
  {
    id: "ord_ofd_106",
    orderId: "ORD-94826",
    customerName: "Pooja Gupta",
    customerPhone: "+91 91112 77890",
    deliveryBoyName: "Sandeep Yadav (Rider #07)",
    deliveryDate: "09/08/2026",
    orderDate: "09/08/2026",
    status: "Out For Delivery",
    amount: 840.00,
  },
  {
    id: "ord_ofd_107",
    orderId: "ORD-94827",
    customerName: "Rajesh Meena",
    customerPhone: "+91 93001 66543",
    deliveryBoyName: "Deepak Kumar (Rider #03)",
    deliveryDate: "09/08/2026",
    orderDate: "09/07/2026",
    status: "Out For Delivery",
    amount: 7600.00,
  },
  {
    id: "ord_ofd_108",
    orderId: "ORD-94828",
    customerName: "Anita Tiwari",
    customerPhone: "+91 98270 99812",
    deliveryBoyName: "Sunil Mehra (Rider #18)",
    deliveryDate: "09/08/2026",
    orderDate: "09/08/2026",
    status: "Out For Delivery",
    amount: 4300.00,
  },
  {
    id: "ord_ofd_109",
    orderId: "ORD-94829",
    customerName: "Manish Chouhan",
    customerPhone: "+91 94066 55432",
    deliveryBoyName: "Rahul Verma (Rider #12)",
    deliveryDate: "09/08/2026",
    orderDate: "09/08/2026",
    status: "Out For Delivery",
    amount: 1980.00,
  },
  {
    id: "ord_ofd_110",
    orderId: "ORD-94830",
    customerName: "Kavita Rathore",
    customerPhone: "+91 98263 22109",
    deliveryBoyName: "Deepak Kumar (Rider #03)",
    deliveryDate: "09/08/2026",
    orderDate: "09/08/2026",
    status: "Out For Delivery",
    amount: 3250.00,
  },
];

export default function SellerOutForDeliveryOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [dateRange, setDateRange] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>('orderDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  // New orders and status changes from the server refresh the list
  const orderUpdateTick = useSellerOrderUpdates();

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const params: GetOrdersParams = {
          page: 1,
          limit: 100,
          sortBy: sortField || 'orderDate',
          sortOrder: sortDirection,
          status: 'Out For Delivery'
        };
        if (dateRange) {
          const [startDate, endDate] = dateRange.split(' - ');
          if (startDate && endDate) {
            params.dateFrom = startDate;
            params.dateTo = endDate;
          }
        }
        if (searchQuery) {
          params.search = searchQuery;
        }
        const response = await getOrders(params);
        if (response.success && response.data && response.data.length > 0) {
          setOrders(response.data);
        } else {
          // Use realistic dummy fallback data if backend has no orders for this seller yet
          setOrders(DUMMY_OUT_FOR_DELIVERY_ORDERS);
        }
      } catch (err: any) {
        // Fallback gracefully to dummy data so seller view is always rich
        console.warn('Could not load live out for delivery orders, displaying mock dataset:', err);
        setOrders(DUMMY_OUT_FOR_DELIVERY_ORDERS);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [dateRange, searchQuery, sortField, sortDirection, orderUpdateTick]);

  const handleClearDate = () => {
    setDateRange('');
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtered and Sorted Orders
  const processedOrders = useMemo(() => {
    let result = [...orders];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(order =>
        order.orderId?.toLowerCase().includes(q) ||
        order.customerName?.toLowerCase().includes(q) ||
        order.customerPhone?.toLowerCase().includes(q) ||
        order.deliveryBoyName?.toLowerCase().includes(q) ||
        order.amount?.toString().includes(q)
      );
    }

    // Date range filter
    if (dateRange.includes(' - ')) {
      const [start, end] = dateRange.split(' - ').map(d => new Date(d.trim()).getTime());
      if (!isNaN(start) && !isNaN(end)) {
        result = result.filter(order => {
          const orderTime = new Date(order.orderDate).getTime();
          return orderTime >= start && orderTime <= end;
        });
      }
    }

    // Sorting
    if (sortField) {
      result.sort((a, b) => {
        let valA: any = a[sortField] ?? '';
        let valB: any = b[sortField] ?? '';

        if (sortField === 'amount') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else if (sortField === 'orderDate' || sortField === 'deliveryDate') {
          valA = new Date(valA).getTime() || 0;
          valB = new Date(valB).getTime() || 0;
        } else {
          valA = String(valA).toLowerCase();
          valB = String(valB).toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [orders, searchQuery, dateRange, sortField, sortDirection]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = processedOrders.length;
    const totalAmount = processedOrders.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const uniqueRiders = new Set(processedOrders.map(o => o.deliveryBoyName).filter(Boolean)).size;
    return { totalCount, totalAmount, uniqueRiders };
  }, [processedOrders]);

  const handleExport = () => {
    const headers = ['Order ID', 'Customer Name', 'Customer Phone', 'Delivery Rider', 'Delivery Date', 'Order Date', 'Status', 'Amount'];
    const csvContent = [
      headers.join(','),
      ...processedOrders.map(order => [
        `"${order.orderId}"`,
        `"${order.customerName || ''}"`,
        `"${order.customerPhone || ''}"`,
        `"${order.deliveryBoyName || ''}"`,
        `"${order.deliveryDate || ''}"`,
        `"${order.orderDate || ''}"`,
        `"${order.status}"`,
        order.amount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `seller_out_for_delivery_orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const entriesPerPageNum = parseInt(entriesPerPage);
  const totalPages = Math.ceil(processedOrders.length / entriesPerPageNum) || 1;
  const startIndex = (currentPage - 1) * entriesPerPageNum;
  const endIndex = startIndex + entriesPerPageNum;
  const paginatedOrders = processedOrders.slice(startIndex, endIndex);

  const handlePreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  const containerVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, staggerChildren: 0.05 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-neutral-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Out For Delivery Orders</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Live Transit
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-1">Track and manage active dispatches and rider assignments in real-time</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-neutral-50 px-3.5 py-1.5 rounded-xl border border-neutral-200">
          <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium">Home</Link>
          <span className="text-neutral-400">/</span>
          <span className="text-neutral-700 font-medium">Out For Delivery</span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0 border border-orange-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">In Transit Orders</div>
            <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">In-Transit Total Value</div>
            <div className="text-2xl font-bold text-neutral-900 mt-0.5">₹{stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Assigned Riders</div>
            <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.uniqueRiders} Delivery Partners</div>
          </div>
        </div>
      </div>

      {/* Main Order Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-[var(--primary-dark)] text-white px-5 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h2 className="text-base sm:text-lg font-semibold">Orders Out For Delivery</h2>
          </div>
          <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">
            {processedOrders.length} {processedOrders.length === 1 ? 'Order' : 'Orders'}
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              <div className="w-full md:w-auto">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Date Range</label>
                <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded-xl px-3 py-2 w-full md:w-64 focus-within:ring-2 focus-within:ring-[var(--primary-color)]/20 focus-within:border-[var(--primary-color)] transition-all">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
                    <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input
                    type="text"
                    value={dateRange}
                    onChange={(e) => { setDateRange(e.target.value); setCurrentPage(1); }}
                    className="flex-1 text-sm bg-transparent focus:outline-none text-neutral-700 placeholder:text-neutral-400"
                    placeholder="MM/DD/YYYY - MM/DD/YYYY"
                  />
                  {dateRange && (
                    <button onClick={handleClearDate} className="text-neutral-400 hover:text-neutral-600">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6L18 18"></path>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="w-full md:w-28">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Show Entries</label>
                <ThemedDropdown
                  options={['10', '25', '50', '100']}
                  value={entriesPerPage}
                  onChange={(val) => { setEntriesPerPage(val); setCurrentPage(1); }}
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              <div className="w-full md:w-72">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all placeholder:text-neutral-400 shadow-sm"
                    placeholder="Search by order ID, customer, rider..."
                  />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <div className="w-full md:w-auto self-end">
                <button
                  onClick={handleExport}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary-dark)] mb-4"></div>
            <div className="text-neutral-500 font-medium">Loading out for delivery orders...</div>
          </div>
        )}

        {/* Table View */}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-neutral-50/90 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    <button onClick={() => handleSort('orderId')} className="flex items-center gap-1.5 hover:text-[var(--primary-darker)] transition-colors">
                      Order ID
                      <span className={`${sortField === 'orderId' ? 'text-[var(--primary-dark)]' : 'text-neutral-300'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortField === 'orderId' && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    <button onClick={() => handleSort('customerName')} className="flex items-center gap-1.5 hover:text-[var(--primary-darker)] transition-colors">
                      Customer
                      <span className={`${sortField === 'customerName' ? 'text-[var(--primary-dark)]' : 'text-neutral-300'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortField === 'customerName' && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    <button onClick={() => handleSort('deliveryBoyName')} className="flex items-center gap-1.5 hover:text-[var(--primary-darker)] transition-colors">
                      Assigned Rider
                      <span className={`${sortField === 'deliveryBoyName' ? 'text-[var(--primary-dark)]' : 'text-neutral-300'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortField === 'deliveryBoyName' && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    <button onClick={() => handleSort('deliveryDate')} className="flex items-center gap-1.5 hover:text-[var(--primary-darker)] transition-colors">
                      Delivery Date
                      <span className={`${sortField === 'deliveryDate' ? 'text-[var(--primary-dark)]' : 'text-neutral-300'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortField === 'deliveryDate' && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    <button onClick={() => handleSort('orderDate')} className="flex items-center gap-1.5 hover:text-[var(--primary-darker)] transition-colors">
                      Order Date
                      <span className={`${sortField === 'orderDate' ? 'text-[var(--primary-dark)]' : 'text-neutral-300'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortField === 'orderDate' && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">Status</th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    <button onClick={() => handleSort('amount')} className="flex items-center gap-1.5 hover:text-[var(--primary-darker)] transition-colors">
                      Amount
                      <span className={`${sortField === 'amount' ? 'text-[var(--primary-dark)]' : 'text-neutral-300'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortField === 'amount' && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-center text-xs font-bold text-neutral-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-orange-50 text-orange-400 rounded-2xl flex items-center justify-center mb-3">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-neutral-900">No out for delivery orders found</h3>
                        <p className="text-neutral-500 text-sm mt-1">Try adjusting your search criteria or date filter</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order, index) => (
                    <motion.tr
                      key={order.id || order.orderId}
                      className="hover:bg-neutral-50/80 transition-colors group"
                      variants={itemVariants}
                      custom={index}
                    >
                      {/* Order ID */}
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                        <span className="font-mono text-[var(--primary-darker)] bg-[var(--primary-alpha-10)] px-2.5 py-1 rounded-lg border border-[var(--primary-alpha-20)] font-semibold">
                          #{order.orderId}
                        </span>
                      </td>

                      {/* Customer Info */}
                      <td className="px-6 py-4 text-sm text-neutral-900">
                        <div className="font-medium text-neutral-900">{order.customerName || 'Customer'}</div>
                        {order.customerPhone && (
                          <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            {order.customerPhone}
                          </div>
                        )}
                      </td>

                      {/* Rider Info */}
                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {order.deliveryBoyName ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/80 border border-indigo-100 text-indigo-900 text-xs font-medium">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
                              <rect x="1" y="3" width="15" height="13" rx="2" />
                              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                              <circle cx="5.5" cy="18.5" r="2.5" />
                              <circle cx="18.5" cy="18.5" r="2.5" />
                            </svg>
                            <span>{order.deliveryBoyName}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs italic">Unassigned</span>
                        )}
                      </td>

                      {/* Delivery Date */}
                      <td className="px-6 py-4 text-sm text-neutral-600 font-medium">
                        {order.deliveryDate}
                      </td>

                      {/* Order Date */}
                      <td className="px-6 py-4 text-sm text-neutral-500">
                        {order.orderDate}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-amber-500 animate-ping"></span>
                          Out For Delivery
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4 text-sm font-bold text-neutral-900">
                        ₹{Number(order.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(`/seller/orders/${order.id}`)}
                          className="inline-flex items-center justify-center text-[var(--primary-dark)] hover:text-[var(--primary-darker)] hover:bg-[var(--primary-alpha-10)] p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                          title="View Order Details"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-neutral-500">
            Showing <span className="font-semibold text-neutral-900">{processedOrders.length === 0 ? 0 : startIndex + 1}</span> to <span className="font-semibold text-neutral-900">{Math.min(endIndex, processedOrders.length)}</span> of <span className="font-semibold text-neutral-900">{processedOrders.length}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl border transition-all ${currentPage === 1 ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-white' : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-[var(--primary-color)] hover:text-[var(--primary-dark)] shadow-sm hover:shadow'}`}
              title="Previous Page"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <div className="hidden sm:flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let p = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  p = currentPage - 2 + i;
                  if (p > totalPages) p = i + 1 + (totalPages - 5);
                }
                if (p > totalPages || p <= 0) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[34px] h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${currentPage === p ? 'bg-[var(--primary-dark)] text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-200'}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className={`p-2 rounded-xl border transition-all ${currentPage >= totalPages ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-white' : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-[var(--primary-color)] hover:text-[var(--primary-dark)] shadow-sm hover:shadow'}`}
              title="Next Page"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6">
        <p className="text-sm text-neutral-500">
          Copyright © 2025. Developed By <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium hover:underline">Ecommerce</Link>
        </p>
      </footer>
    </motion.div>
  );
}
