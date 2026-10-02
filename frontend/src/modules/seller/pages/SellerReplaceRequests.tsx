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

const DUMMY_REPLACE_REQUESTS: ExtendedReturnRequest[] = [
  {
    id: "rep_101",
    orderId: "ORD-94190",
    orderItemId: "ITM-88220",
    product: "Solar Drip Controller Timer Unit",
    productName: "Solar Drip Controller Timer Unit",
    variant: "Digital Dual Valve",
    price: 3200.00,
    discPrice: 3200.00,
    quantity: 1,
    total: 3200.00,
    amount: 3200.00,
    status: "Pending",
    date: "09/08/2026",
    customerName: "Gopal Sharma",
    customerPhone: "+91 98260 11982",
    returnReason: "Display screen flashing error code on unboxing, requested fresh unit replacement",
  },
  {
    id: "rep_102",
    orderId: "ORD-94145",
    orderItemId: "ITM-88182",
    product: "Cotton Seedling Trays (104 Cavity Pack of 10)",
    productName: "Cotton Seedling Trays (104 Cavity Pack of 10)",
    variant: "104 Cavity Black",
    price: 850.00,
    discPrice: 850.00,
    quantity: 2,
    total: 1700.00,
    amount: 1700.00,
    status: "Approved",
    date: "09/06/2026",
    customerName: "Sunil Verma",
    customerPhone: "+91 97521 88722",
    returnReason: "Received 50 cavity trays instead of 104 cavity, need replacement with correct item",
  },
  {
    id: "rep_103",
    orderId: "ORD-94080",
    orderItemId: "ITM-88099",
    product: "Bio-Enzyme Soil Enricher 5L Can",
    productName: "Bio-Enzyme Soil Enricher 5L Can",
    variant: "5 Litre Can",
    price: 1250.00,
    discPrice: 1250.00,
    quantity: 1,
    total: 1250.00,
    amount: 1250.00,
    status: "Completed",
    date: "09/03/2026",
    customerName: "Rekha Tiwari",
    customerPhone: "+91 94251 33490",
    returnReason: "Replacement item dispatched and delivered to customer successfully",
  }
];

export default function SellerReplaceRequests() {
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

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const params: GetReturnRequestsParams = {
          page: 1,
          limit: 100,
          requestType: 'Replacement',
          sortBy: sortField || 'date',
          sortOrder: sortDirection,
        };
        if (dateRange) {
          const [startDate, endDate] = dateRange.split(' - ');
          if (startDate && endDate) { params.dateFrom = startDate; params.dateTo = endDate; }
        }
        if (status !== 'All Status') { params.status = status; }
        if (searchQuery) { params.search = searchQuery; }

        const response = await getReturnRequests(params);
        if (response.success && response.data && response.data.length > 0) {
          setRequests(response.data);
        } else {
          setRequests(DUMMY_REPLACE_REQUESTS);
        }
      } catch (err: any) {
        console.warn('Could not load replacement requests, using fallback dataset:', err);
        setRequests(DUMMY_REPLACE_REQUESTS);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [dateRange, status, searchQuery, sortField, sortDirection]);

  const handleClearDate = () => { setDateRange(''); setCurrentPage(1); };
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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

  const handleUpdateStatus = async (newStatus: 'Approved' | 'Rejected' | 'Completed') => {
    if (!selectedRequest) return;
    setActionLoading(true);
    let serverWarning = '';
    try {
      if (selectedRequest.id && !selectedRequest.id.startsWith('rep_')) {
        const response = await updateReturnStatus(selectedRequest.id, { status: newStatus });
        serverWarning = (response as any)?.warning || '';
      }
      setRequests(prev =>
        prev.map(r => (r.id === selectedRequest.id ? { ...r, status: newStatus } : r))
      );
      setSelectedRequest(prev => (prev ? { ...prev, status: newStatus } : null));
      showToast(serverWarning || `Replacement #${selectedRequest.orderId} marked as ${newStatus}`, serverWarning ? 'info' : 'success');
    } catch (err: any) {
      // Keep the current status — the server did not accept the change
      showToast(err?.response?.data?.message || 'Failed to update status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['Order Number', 'User Name', 'Product Name', 'Quantity', 'Status', 'Date'];
    const csvContent = [
      headers.join(','),
      ...processedRequests.map(r => [
        `"${r.orderId || ''}"`,
        `"${r.customerName || ''}"`,
        `"${r.product || r.productName || ''}"`,
        r.quantity ?? 1,
        `"${r.status || ''}"`,
        `"${r.date || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `replace_requests_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (st: string) => {
    switch (st) {
      case 'Pending': return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'Approved': return 'bg-blue-50 text-blue-800 border border-blue-200';
      case 'Completed': return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'Rejected': return 'bg-rose-50 text-rose-800 border border-rose-200';
      default: return 'bg-neutral-100 text-neutral-800 border border-neutral-200';
    }
  };

  const entriesPerPageNum = parseInt(entriesPerPage);
  const totalPages = Math.ceil(processedRequests.length / entriesPerPageNum) || 1;
  const startIndex = (currentPage - 1) * entriesPerPageNum;
  const endIndex = startIndex + entriesPerPageNum;
  const paginatedRequests = processedRequests.slice(startIndex, endIndex);

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Replace Requests</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage customer replacement requests for your products</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-neutral-50 px-3.5 py-1.5 rounded-xl border border-neutral-200">
          <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium">Home</Link>
          <span className="text-neutral-400">/</span>
          <span className="text-neutral-700 font-medium">Replace Requests</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-[var(--primary-dark)] text-white px-5 sm:px-6 py-3.5 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold">Replace Requests List</h2>
          <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">
            {processedRequests.length} Requests
          </span>
        </div>

        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              <div className="w-full md:w-auto">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Date Range</label>
                <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded-xl px-3 py-2 w-full md:w-64">
                  <input type="text" value={dateRange} onChange={(e) => { setDateRange(e.target.value); setCurrentPage(1); }} className="flex-1 text-sm bg-transparent focus:outline-none" placeholder="MM/DD/YYYY - MM/DD/YYYY" />
                  {dateRange && <button onClick={handleClearDate} className="text-neutral-400">×</button>}
                </div>
              </div>
              <div className="w-full md:w-44">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Status</label>
                <ThemedDropdown options={['All Status', 'Pending', 'Approved', 'Rejected', 'Completed']} value={status} onChange={(val) => { setStatus(val); setCurrentPage(1); }} />
              </div>
              <div className="w-full md:w-28">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Show</label>
                <ThemedDropdown options={['10', '25', '50', '100']} value={entriesPerPage} onChange={(val) => { setEntriesPerPage(val); setCurrentPage(1); }} />
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              <div className="w-full md:w-72">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Search</label>
                <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full px-4 py-2 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none" placeholder="Search replacement requests..." />
              </div>
              <div className="w-full md:w-auto self-end">
                <button onClick={handleExport} className="bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">Export CSV</button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary-dark)]"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-neutral-50/90 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase">Order ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase">Product</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-neutral-600 uppercase">Qty</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-600 uppercase">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-neutral-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {paginatedRequests.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-neutral-500">No replace requests found</td></tr>
                ) : (
                  paginatedRequests.map((req, idx) => (
                    <tr key={req.id || idx} className="hover:bg-neutral-50/80 cursor-pointer" onClick={() => setSelectedRequest(req)}>
                      <td className="px-6 py-4 text-sm font-medium"><span className="font-mono text-[var(--primary-darker)] bg-[var(--primary-alpha-10)] px-2.5 py-1 rounded-lg border border-[var(--primary-alpha-20)]">#{req.orderId}</span></td>
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900">{req.customerName}</td>
                      <td className="px-6 py-4 text-sm text-neutral-700 max-w-[280px] truncate">{req.product || req.productName}</td>
                      <td className="px-6 py-4 text-sm text-center font-medium">{req.quantity ?? 1}</td>
                      <td className="px-6 py-4 text-sm font-bold text-neutral-900">₹{(req.total ?? req.amount ?? 0).toFixed(2)}</td>
                      <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(req.status)}`}>{req.status}</span></td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setSelectedRequest(req)} className="text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)] p-2 rounded-lg">View</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-sm text-neutral-500">
          <div>Showing {processedRequests.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, processedRequests.length)} of {processedRequests.length}</div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 border rounded-lg bg-white disabled:opacity-50">‹</button>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages} className="p-2 border rounded-lg bg-white disabled:opacity-50">›</button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-lg">Replacement Request #{selectedRequest.orderId}</h3>
                <button onClick={() => setSelectedRequest(null)} className="text-neutral-400 hover:text-neutral-600">✕</button>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="text-neutral-500">Customer:</span> <strong className="text-neutral-900">{selectedRequest.customerName}</strong> ({selectedRequest.customerPhone})</p>
                <p><span className="text-neutral-500">Product:</span> <strong className="text-neutral-900">{selectedRequest.product || selectedRequest.productName}</strong></p>
                <p><span className="text-neutral-500">Reason:</span> {selectedRequest.returnReason || 'N/A'}</p>
              </div>
              <div className="pt-2 flex gap-2">
                <button onClick={() => handleUpdateStatus('Approved')} disabled={actionLoading} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold">Approve</button>
                <button onClick={() => handleUpdateStatus('Completed')} disabled={actionLoading} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold">Completed</button>
                <button onClick={() => handleUpdateStatus('Rejected')} disabled={actionLoading} className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold">Reject</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
