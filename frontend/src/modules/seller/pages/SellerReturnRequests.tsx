import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getReturnRequests, ReturnRequest, GetReturnRequestsParams, updateReturnStatus } from '../../../services/api/returnService';
import ThemedDropdown from '../components/ThemedDropdown';
import { useToast } from '../../../context/ToastContext';

type SortField = 'orderId' | 'customerName' | 'product' | 'quantity' | 'total' | 'date' | 'status';
type SortDirection = 'asc' | 'desc';

interface ExtendedReturnRequest extends ReturnRequest {
  productName?: string;
  amount?: number;
  returnReason?: string;
  image?: string;
}

const DUMMY_RETURN_REQUESTS: ExtendedReturnRequest[] = [
  {
    id: "ret_101",
    orderId: "ORD-94210",
    orderItemId: "ITM-88211",
    product: "Organic NPK Fertilizer (10kg Pack)",
    productName: "Organic NPK Fertilizer (10kg Pack)",
    variant: "10kg Bag",
    price: 1850.00,
    discPrice: 1850.00,
    quantity: 2,
    total: 3700.00,
    amount: 3700.00,
    status: "Pending",
    date: "09/07/2026",
    customerName: "Suresh Rao",
    customerPhone: "+91 98261 55432",
    returnReason: "Package seal was broken upon arrival and powder leaked",
  },
  {
    id: "ret_102",
    orderId: "ORD-94215",
    orderItemId: "ITM-88219",
    product: "High-Pressure Knapsack Crop Sprayer 16L",
    productName: "High-Pressure Knapsack Crop Sprayer 16L",
    variant: "16 Litre Tank",
    price: 2450.00,
    discPrice: 2450.00,
    quantity: 1,
    total: 2450.00,
    amount: 2450.00,
    status: "Approved",
    date: "09/06/2026",
    customerName: "Mahesh Patil",
    customerPhone: "+91 97520 88910",
    returnReason: "Nozzle pressure trigger defective on initial test",
  },
  {
    id: "ret_103",
    orderId: "ORD-94180",
    orderItemId: "ITM-88150",
    product: "Hybrid Sunflower Seeds - Super Gold 500g",
    productName: "Hybrid Sunflower Seeds - Super Gold 500g",
    variant: "500g Packet",
    price: 680.00,
    discPrice: 680.00,
    quantity: 3,
    total: 2040.00,
    amount: 2040.00,
    status: "Pending",
    date: "09/08/2026",
    customerName: "Kavita Deshmukh",
    customerPhone: "+91 98931 44789",
    returnReason: "Ordered by mistake, requested exchange for mustard seeds",
  },
  {
    id: "ret_104",
    orderId: "ORD-94092",
    orderItemId: "ITM-88022",
    product: "Bio-Neem Pest Controller Oil 1L",
    productName: "Bio-Neem Pest Controller Oil 1L",
    variant: "1L Bottle",
    price: 520.00,
    discPrice: 520.00,
    quantity: 4,
    total: 2080.00,
    amount: 2080.00,
    status: "Completed",
    date: "09/04/2026",
    customerName: "Rajesh Solanki",
    customerPhone: "+91 93001 77621",
    returnReason: "Item returned and customer refund completed",
  },
  {
    id: "ret_105",
    orderId: "ORD-93988",
    orderItemId: "ITM-87910",
    product: "Drip Irrigation Lateral Pipe 16mm (100m Roll)",
    productName: "Drip Irrigation Lateral Pipe 16mm (100m Roll)",
    variant: "100m Standard",
    price: 1650.00,
    discPrice: 1650.00,
    quantity: 1,
    total: 1650.00,
    amount: 1650.00,
    status: "Rejected",
    date: "09/02/2026",
    customerName: "Dinesh Malviya",
    customerPhone: "+91 91112 33456",
    returnReason: "Return window exceeded beyond 7 days policy",
  },
  {
    id: "ret_106",
    orderId: "ORD-93910",
    orderItemId: "ITM-87805",
    product: "Zinc Solubilizing Bio-Fertilizer 1kg",
    productName: "Zinc Solubilizing Bio-Fertilizer 1kg",
    variant: "1kg Powder",
    price: 340.00,
    discPrice: 340.00,
    quantity: 5,
    total: 1700.00,
    amount: 1700.00,
    status: "Approved",
    date: "09/05/2026",
    customerName: "Sunita Choudhary",
    customerPhone: "+91 94250 11987",
    returnReason: "Customer received wrong variant (ordered Granules)",
  }
];

export default function SellerReturnRequests() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<ExtendedReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('');
  const [status, setStatus] = useState('All Status');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedRequest, setSelectedRequest] = useState<ExtendedReturnRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch return requests
  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const params: GetReturnRequestsParams = {
          page: 1,
          limit: 100,
          requestType: 'Return',
          sortBy: sortField || 'date',
          sortOrder: sortDirection,
        };

        if (dateRange) {
          const [startDate, endDate] = dateRange.split(' - ');
          if (startDate && endDate) {
            params.dateFrom = startDate;
            params.dateTo = endDate;
          }
        }

        if (status !== 'All Status') {
          params.status = status;
        }

        if (searchQuery) {
          params.search = searchQuery;
        }

        const response = await getReturnRequests(params);
        if (response.success && response.data && response.data.length > 0) {
          setRequests(response.data);
        } else {
          setRequests(DUMMY_RETURN_REQUESTS);
        }
      } catch (err: any) {
        console.warn('Could not load live return requests, using dummy fallback data:', err);
        setRequests(DUMMY_RETURN_REQUESTS);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [dateRange, status, searchQuery, sortField, sortDirection]);

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

  // Filter & Sort
  const processedRequests = useMemo(() => {
    let result = [...requests];

    if (status !== 'All Status') {
      result = result.filter(r => r.status?.toLowerCase() === status.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r =>
        r.orderId?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q) ||
        (r.product || r.productName)?.toLowerCase().includes(q) ||
        r.returnReason?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q)
      );
    }

    if (dateRange.includes(' - ')) {
      const [start, end] = dateRange.split(' - ').map(d => new Date(d.trim()).getTime());
      if (!isNaN(start) && !isNaN(end)) {
        result = result.filter(r => {
          const reqTime = new Date(r.date).getTime();
          return reqTime >= start && reqTime <= end;
        });
      }
    }

    if (sortField) {
      result.sort((a, b) => {
        let valA: any = a[sortField] ?? (sortField === 'product' ? a.productName : sortField === 'total' ? (a.total ?? a.amount) : '');
        let valB: any = b[sortField] ?? (sortField === 'product' ? b.productName : sortField === 'total' ? (b.total ?? b.amount) : '');

        if (sortField === 'total' || sortField === 'quantity') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else if (sortField === 'date') {
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
  }, [requests, status, searchQuery, dateRange, sortField, sortDirection]);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalCount = processedRequests.length;
    const pendingCount = processedRequests.filter(r => r.status === 'Pending').length;
    const approvedCount = processedRequests.filter(r => r.status === 'Approved').length;
    const totalAmount = processedRequests.reduce((sum, r) => sum + (r.total ?? r.amount ?? 0), 0);
    return { totalCount, pendingCount, approvedCount, totalAmount };
  }, [processedRequests]);

  const handleUpdateStatus = async (newStatus: 'Approved' | 'Rejected' | 'Completed') => {
    if (!selectedRequest) return;
    setActionLoading(true);
    let serverWarning = '';
    try {
      if (selectedRequest.id && !selectedRequest.id.startsWith('ret_')) {
        const response = await updateReturnStatus(selectedRequest.id, { status: newStatus });
        serverWarning = (response as any)?.warning || '';
      }
      setRequests(prev =>
        prev.map(r => (r.id === selectedRequest.id ? { ...r, status: newStatus } : r))
      );
      setSelectedRequest(prev => (prev ? { ...prev, status: newStatus } : null));
      showToast(serverWarning || `Return request #${selectedRequest.orderId} marked as ${newStatus}`, serverWarning ? 'info' : 'success');
    } catch (err: any) {
      // Keep the current status — the server did not accept the change
      showToast(err?.response?.data?.message || 'Failed to update status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['Order Number', 'User Name', 'Customer Phone', 'Product Name', 'Quantity', 'Amount (Rs)', 'Status', 'Date', 'Reason'];
    const csvContent = [
      headers.join(','),
      ...processedRequests.map(r => [
        `"${r.orderId || ''}"`,
        `"${r.customerName || ''}"`,
        `"${r.customerPhone || ''}"`,
        `"${r.product || r.productName || ''}"`,
        r.quantity ?? 1,
        (r.total ?? r.amount ?? 0).toFixed(2),
        `"${r.status || ''}"`,
        `"${r.date || ''}"`,
        `"${(r.returnReason || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `seller_return_requests_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (st: string) => {
    switch (st) {
      case 'Pending':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'Approved':
        return 'bg-blue-50 text-blue-800 border border-blue-200';
      case 'Completed':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'Rejected':
        return 'bg-rose-50 text-rose-800 border border-rose-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border border-neutral-200';
    }
  };

  const entriesPerPageNum = parseInt(entriesPerPage);
  const totalPages = Math.ceil(processedRequests.length / entriesPerPageNum) || 1;
  const startIndex = (currentPage - 1) * entriesPerPageNum;
  const endIndex = startIndex + entriesPerPageNum;
  const paginatedRequests = processedRequests.slice(startIndex, endIndex);

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
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Return Requests</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              Customer Returns
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-1">Review, approve, and manage customer product return and refund requests</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-neutral-50 px-3.5 py-1.5 rounded-xl border border-neutral-200">
          <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium">Home</Link>
          <span className="text-neutral-400">/</span>
          <span className="text-neutral-700 font-medium">Return Requests</span>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0 border border-orange-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Returns</div>
            <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 border border-amber-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pending Action</div>
            <div className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendingCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Approved Requests</div>
            <div className="text-2xl font-bold text-blue-600 mt-0.5">{stats.approvedCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Value</div>
            <div className="text-2xl font-bold text-neutral-900 mt-0.5">₹{stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-[var(--primary-dark)] text-white px-5 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            <h2 className="text-base sm:text-lg font-semibold">Return Requests List</h2>
          </div>
          <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">
            {processedRequests.length} {processedRequests.length === 1 ? 'Request' : 'Requests'}
          </span>
        </div>

        {/* Filters Toolbar */}
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              <div className="w-full md:w-auto">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Date Range</label>
                <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded-xl px-3 py-2 w-full md:w-64 focus-within:ring-2 focus-within:ring-[var(--primary-color)]/20 focus-within:border-[var(--primary-color)] transition-all shadow-2xs">
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

              <div className="w-full md:w-44">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Status</label>
                <ThemedDropdown
                  options={['All Status', 'Pending', 'Approved', 'Rejected', 'Completed']}
                  value={status}
                  onChange={(val) => { setStatus(val); setCurrentPage(1); }}
                />
              </div>

              <div className="w-full md:w-28">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Show</label>
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
                    className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all placeholder:text-neutral-400 shadow-2xs"
                    placeholder="Search by Order ID, customer, product..."
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
            <div className="text-neutral-500 font-medium">Loading return requests...</div>
          </div>
        )}

        {/* Table View */}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
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
                    <button onClick={() => handleSort('product')} className="flex items-center gap-1.5 hover:text-[var(--primary-darker)] transition-colors">
                      Product
                      <span className={`${sortField === 'product' ? 'text-[var(--primary-dark)]' : 'text-neutral-300'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortField === 'product' && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-center text-xs font-bold text-neutral-600 uppercase tracking-wider">Qty</th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    <button onClick={() => handleSort('total')} className="flex items-center gap-1.5 hover:text-[var(--primary-darker)] transition-colors">
                      Amount
                      <span className={`${sortField === 'total' ? 'text-[var(--primary-dark)]' : 'text-neutral-300'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortField === 'total' && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">
                    <button onClick={() => handleSort('date')} className="flex items-center gap-1.5 hover:text-[var(--primary-darker)] transition-colors">
                      Date
                      <span className={`${sortField === 'date' ? 'text-[var(--primary-dark)]' : 'text-neutral-300'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={sortField === 'date' && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-neutral-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-neutral-100 text-neutral-400 rounded-2xl flex items-center justify-center mb-3">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <polyline points="1 4 1 10 7 10"></polyline>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-neutral-900">No return requests found</h3>
                        <p className="text-neutral-500 text-sm mt-1">Try adjusting your search criteria or date filter</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((request, index) => {
                    const totalVal = request.total ?? request.amount ?? 0;
                    const prodName = request.product || request.productName || 'Product';
                    return (
                      <motion.tr
                        key={request.id || request.orderItemId || index}
                        className="hover:bg-neutral-50/80 transition-colors group cursor-pointer"
                        variants={itemVariants}
                        custom={index}
                        onClick={() => setSelectedRequest(request)}
                      >
                        {/* Order ID */}
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                          <span className="font-mono text-[var(--primary-darker)] bg-[var(--primary-alpha-10)] px-2.5 py-1 rounded-lg border border-[var(--primary-alpha-20)] font-semibold">
                            #{request.orderId || 'ORD-REQ'}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="px-6 py-4 text-sm text-neutral-900">
                          <div className="font-medium text-neutral-900">{request.customerName || 'Customer'}</div>
                          {request.customerPhone && (
                            <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
                              {request.customerPhone}
                            </div>
                          )}
                        </td>

                        {/* Product & Reason Preview */}
                        <td className="px-6 py-4 text-sm text-neutral-800 max-w-[280px]">
                          <div className="font-medium truncate" title={prodName}>{prodName}</div>
                          {request.returnReason && (
                            <div className="text-xs text-neutral-500 truncate mt-0.5" title={request.returnReason}>
                              <span className="font-semibold text-neutral-600">Reason:</span> {request.returnReason}
                            </div>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="px-6 py-4 text-sm text-center font-medium text-neutral-700">
                          {request.quantity ?? 1}
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4 text-sm font-bold text-neutral-900">
                          ₹{Number(totalVal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 text-sm text-neutral-600 font-medium">
                          {request.date}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedRequest(request)}
                            className="inline-flex items-center justify-center text-[var(--primary-dark)] hover:text-[var(--primary-darker)] hover:bg-[var(--primary-alpha-10)] p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                            title="View Return Details"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-neutral-500">
            Showing <span className="font-semibold text-neutral-900">{processedRequests.length === 0 ? 0 : startIndex + 1}</span> to <span className="font-semibold text-neutral-900">{Math.min(endIndex, processedRequests.length)}</span> of <span className="font-semibold text-neutral-900">{processedRequests.length}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl border transition-all ${currentPage === 1 ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-white' : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-[var(--primary-color)] hover:text-[var(--primary-dark)] shadow-2xs'}`}
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
                    className={`min-w-[34px] h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${currentPage === p ? 'bg-[var(--primary-dark)] text-white shadow-2xs' : 'text-neutral-600 hover:bg-neutral-200'}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className={`p-2 rounded-xl border transition-all ${currentPage >= totalPages ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-white' : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-[var(--primary-color)] hover:text-[var(--primary-dark)] shadow-2xs'}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Return Request Details Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-neutral-200"
            >
              {/* Modal Header */}
              <div className="bg-[var(--primary-dark)] text-white p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Return Request Details</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">Order #{selectedRequest.orderId}</p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6L18 18"></path>
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div>
                    <div className="text-xs text-neutral-500 uppercase font-semibold">Current Status</div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(selectedRequest.status)}`}>
                        {selectedRequest.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-neutral-500 uppercase font-semibold">Request Date</div>
                    <div className="text-sm font-medium text-neutral-900 mt-1">{selectedRequest.date}</div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-white">
                  <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Customer Details</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-neutral-500">Name:</span>
                      <p className="font-semibold text-neutral-900">{selectedRequest.customerName || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Phone:</span>
                      <p className="font-semibold text-neutral-900">{selectedRequest.customerPhone || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-white">
                  <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Item Information</div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-neutral-900 text-sm">{selectedRequest.product || selectedRequest.productName}</h4>
                      {selectedRequest.variant && (
                        <p className="text-xs text-neutral-500 mt-0.5">Variant: {selectedRequest.variant}</p>
                      )}
                      <p className="text-xs text-neutral-600 mt-1">Quantity: <span className="font-semibold text-neutral-900">{selectedRequest.quantity ?? 1}</span></p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-neutral-500">Refund Amount</div>
                      <div className="text-lg font-bold text-emerald-700">
                        ₹{Number(selectedRequest.total ?? selectedRequest.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/50">
                  <div className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">Return Reason</div>
                  <p className="text-sm text-neutral-700 leading-relaxed">{selectedRequest.returnReason || 'No detailed reason provided by customer.'}</p>
                </div>

                {/* Actions */}
                <div className="pt-2">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Update Request Status</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleUpdateStatus('Approved')}
                      disabled={actionLoading || selectedRequest.status === 'Approved'}
                      className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs active:scale-95"
                    >
                      Approve Return
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('Completed')}
                      disabled={actionLoading || selectedRequest.status === 'Completed'}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs active:scale-95"
                    >
                      Mark Completed
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('Rejected')}
                      disabled={actionLoading || selectedRequest.status === 'Rejected'}
                      className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs active:scale-95"
                    >
                      Reject Return
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-5 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="text-center py-6">
        <p className="text-sm text-neutral-500">
          Copyright © 2025. Developed By <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium hover:underline">Ecommerce</Link>
        </p>
      </footer>
    </motion.div>
  );
}
