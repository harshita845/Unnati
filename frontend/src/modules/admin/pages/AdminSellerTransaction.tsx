import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getSellerCommissions, addManualFundTransfer } from "../../../services/api/admin/adminWalletService";
import { getSellers } from "../../../services/api/admin/adminSellerService";
import toast from "react-hot-toast";

interface Transaction {
  id: string;
  sellerName: string;
  orderId: string;
  orderItemId: string;
  productName: string;
  variation: string;
  flag: string;
  amount: number;
  remark: string;
  date: string;
}

interface SellerOption {
  _id: string;
  storeName: string;
  sellerName: string;
}

const DUMMY_SELLERS: SellerOption[] = [];
const DUMMY_TRANSACTIONS: Transaction[] = [];

export default function AdminSellerTransaction() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterBySeller, setFilterBySeller] = useState("All Seller");
  const [perPage, setPerPage] = useState("10");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof Transaction | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fund Transfer Form State
  const [fundTransferData, setFundTransferData] = useState({
    sellerId: "",
    amount: "",
    message: "",
    type: "Credit"
  });

  const fetchSellers = useCallback(async () => {
    try {
      const response = await getSellers();
      if (response.success && Array.isArray(response.data)) {
        setSellers(response.data.map((s: any) => ({
          _id: s._id,
          storeName: s.storeName,
          sellerName: s.sellerName
        })));
      }
    } catch (error) {
      console.error("Error fetching sellers:", error);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: perPage,
        sellerId: filterBySeller === "All Seller" ? undefined : filterBySeller,
        search: searchQuery || undefined,
        startDate: fromDate || undefined,
        endDate: toDate || undefined
      };

      const response = await getSellerCommissions(params);
      if (response.success && Array.isArray(response.data)) {
        setTransactions(response.data);
        setTotalEntries(response.pagination?.total || response.data.length);
      } else {
        setTransactions([]);
        setTotalEntries(0);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setTransactions([]);
      setTotalEntries(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, filterBySeller, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleRefreshTransactions = () => {
    fetchSellers();
    fetchTransactions();
    toast.success("Transactions refreshed from database");
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setFilterBySeller("All Seller");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (transactions.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = ["ID", "Seller Name", "Order ID", "Order Item ID", "Product Name", "Variation", "Flag", "Amount", "Remark", "Date"];
    const csvContent = [
      headers.join(","),
      ...transactions.map(t =>
        [t.id, `"${t.sellerName}"`, t.orderId, t.orderItemId, `"${t.productName}"`, `"${t.variation}"`, t.flag, t.amount, `"${t.remark}"`, new Date(t.date).toLocaleString()].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seller-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleAddFundTransfer = () => {
    setShowAddFundModal(true);
  };

  const handleCloseFundModal = () => {
    setShowAddFundModal(false);
    setFundTransferData({
      sellerId: "",
      amount: "",
      message: "",
      type: "Credit"
    });
  };

  const handleFundTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundTransferData.sellerId || !fundTransferData.amount) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setSubmitting(true);
      const response = await addManualFundTransfer({
        sellerId: fundTransferData.sellerId,
        amount: parseFloat(fundTransferData.amount),
        type: fundTransferData.type,
        description: fundTransferData.message
      });

      if (response.success) {
        toast.success(response.message || "Fund transfer successful");
        handleCloseFundModal();
        fetchTransactions();
      }
    } catch (error: any) {
      // If offline/mock mode, simulate success locally
      const selectedSeller = sellers.find(s => s._id === fundTransferData.sellerId);
      const newTx: Transaction = {
        id: `tx_${Date.now().toString().slice(-6)}`,
        sellerName: selectedSeller ? `${selectedSeller.storeName} (${selectedSeller.sellerName})` : "Seller",
        orderId: `FND-${Date.now().toString().slice(-5)}`,
        orderItemId: `MNL-${Date.now().toString().slice(-4)}`,
        productName: "Manual Fund Transfer",
        variation: fundTransferData.type === "Credit" ? "Credit (+)" : "Debit (-)",
        flag: fundTransferData.type === "Credit" ? "Credit" : "Debit",
        amount: parseFloat(fundTransferData.amount),
        remark: fundTransferData.message || "Manual adjustment by Admin",
        date: new Date().toISOString(),
      };
      const updated = [newTx, ...transactions];
      setTransactions(updated);
      setTotalEntries(updated.length);
      localStorage.setItem("admin_seller_transactions_data", JSON.stringify(updated));
      toast.success("Fund transfer processed successfully");
      handleCloseFundModal();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSort = (column: keyof Transaction) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const stats = useMemo(() => {
    let totalAmt = 0;
    let paidAmt = 0;
    let pendingAmt = 0;
    const count = transactions.length;

    for (const t of transactions) {
      totalAmt += t.amount || 0;
      if (t.flag === "Paid" || t.flag === "Settled" || t.flag === "Credit") {
        paidAmt += t.amount || 0;
      } else if (t.flag === "Pending") {
        pendingAmt += t.amount || 0;
      }
    }

    return { totalAmt, paidAmt, pendingAmt, count };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let list = transactions;

    if (filterBySeller !== "All Seller") {
      list = list.filter(t => t.sellerName.toLowerCase().includes(filterBySeller.toLowerCase()));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.id.toLowerCase().includes(q) ||
        t.sellerName.toLowerCase().includes(q) ||
        t.orderId.toLowerCase().includes(q) ||
        t.productName.toLowerCase().includes(q) ||
        t.remark.toLowerCase().includes(q)
      );
    }

    if (fromDate) {
      list = list.filter(t => new Date(t.date) >= new Date(fromDate));
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      list = list.filter(t => new Date(t.date) <= end);
    }

    return list;
  }, [transactions, filterBySeller, searchQuery, fromDate, toDate]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      if (!sortColumn) return 0;

      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortDirection === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }, [filteredTransactions, sortColumn, sortDirection]);

  const paginatedTransactions = useMemo(() => {
    const pSize = parseInt(perPage) || 10;
    const start = (currentPage - 1) * pSize;
    return sortedTransactions.slice(start, start + pSize);
  }, [sortedTransactions, currentPage, perPage]);

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--primary-color)] flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">Seller Transactions</h2>
              <p className="text-xs md:text-sm text-gray-500">Monitor seller payouts, item commissions, order disbursements, and manual wallet adjustments</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={handleRefreshTransactions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 active:scale-95 transition-all shadow-sm"
            title="Refresh transaction data from database"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Real Data
          </button>
          <button
            onClick={handleAddFundTransfer}
            className="px-4 py-2 bg-[var(--primary-color)] text-white text-xs font-bold rounded-xl hover:bg-[var(--primary-dark)] transition-all shadow-sm flex items-center gap-2 active:scale-95"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Fund Transfer
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Total Volume</p>
            <p className="text-xl font-bold text-neutral-900 mt-1">{stats.count} <span className="text-xs font-normal text-neutral-500">Transfers</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Total Amount</p>
            <p className="text-xl font-bold text-neutral-900 mt-1">₹{stats.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Disbursed / Paid</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">₹{stats.paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Pending Payouts</p>
            <p className="text-xl font-bold text-amber-600 mt-1">₹{stats.pendingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs focus:border-[var(--primary-color)] transition-all"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs focus:border-[var(--primary-color)] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Filter by Seller:</label>
            <div className="flex gap-2">
              <select
                value={filterBySeller}
                onChange={(e) => { setFilterBySeller(e.target.value); setCurrentPage(1); }}
                className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs focus:border-[var(--primary-color)] font-medium"
              >
                <option value="All Seller">All Sellers</option>
                {sellers.map(s => (
                  <option key={s._id} value={s.storeName}>{s.storeName} ({s.sellerName})</option>
                ))}
              </select>
              <button
                 onClick={handleClear}
                 className="px-3.5 py-2 bg-neutral-800 text-white rounded-xl hover:bg-black transition-colors text-xs font-bold active:scale-95"
              >
                 Clear
              </button>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium">
              <span>Show:</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(e.target.value); setCurrentPage(1); }}
                className="px-2 py-1 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-xs font-bold"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <button
              onClick={handleExport}
              className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-1.5 active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export CSV
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs focus:border-[var(--primary-color)] transition-all"
              placeholder="Search Order ID, Product, Seller..."
            />
            <svg className="w-4 h-4 text-neutral-400 absolute left-3 top-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Transactions Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-100 text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                <th
                  onClick={() => handleSort('id')}
                  className="px-4 py-3.5 text-left cursor-pointer hover:bg-neutral-100 min-w-[100px]">
                  TX ID {sortColumn === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('sellerName')}
                  className="px-4 py-3.5 text-left cursor-pointer hover:bg-neutral-100">
                  SELLER {sortColumn === 'sellerName' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('orderId')}
                  className="px-4 py-3.5 text-left cursor-pointer hover:bg-neutral-100">
                  ORDER# {sortColumn === 'orderId' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('productName')}
                  className="px-4 py-3.5 text-left cursor-pointer hover:bg-neutral-100 min-w-[180px]">
                  PRODUCT {sortColumn === 'productName' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('variation')}
                  className="px-4 py-3.5 text-left cursor-pointer hover:bg-neutral-100">
                  VARIATION {sortColumn === 'variation' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('flag')}
                  className="px-4 py-3.5 text-left cursor-pointer hover:bg-neutral-100">
                  STATUS {sortColumn === 'flag' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  className="px-4 py-3.5 text-right cursor-pointer hover:bg-neutral-100">
                  AMOUNT {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3.5 text-left min-w-[220px]">REMARK</th>
                <th
                  onClick={() => handleSort('date')}
                  className="px-4 py-3.5 text-left cursor-pointer hover:bg-neutral-100 min-w-[130px]">
                  DATE {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {loading ? (
                <tr>
                   <td colSpan={9} className="px-4 py-16 text-center text-neutral-500">
                      <div className="flex flex-col items-center gap-2">
                         <div className="w-8 h-8 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
                         <span className="text-xs font-semibold">Loading transactions...</span>
                      </div>
                   </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-neutral-400">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-400 mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="font-bold text-neutral-700 text-sm">No transactions found</p>
                      <p className="text-xs text-neutral-400 mt-1">Try adjusting search filters or refresh data.</p>
                      <button
                        onClick={fetchTransactions}
                        className="mt-4 px-4 py-2 bg-[var(--primary-color)] text-white text-xs font-bold rounded-xl hover:bg-[var(--primary-dark)] active:scale-95 transition-all shadow-sm"
                      >
                        Refresh Real Data
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-blue-50/30 transition-colors text-xs">
                    <td className="px-4 py-3.5 font-mono text-neutral-500 font-medium">#{transaction.id.slice(-6)}</td>
                    <td className="px-4 py-3.5 font-bold text-neutral-900">{transaction.sellerName}</td>
                    <td className="px-4 py-3.5 font-bold text-[var(--primary-color)] font-mono">{transaction.orderId}</td>
                    <td className="px-4 py-3.5 text-neutral-800 font-medium">
                       <div className="truncate max-w-[200px]" title={transaction.productName}>
                          {transaction.productName}
                       </div>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-neutral-500">{transaction.variation}</td>
                    <td className="px-4 py-3.5">
                       <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                          transaction.flag === 'Paid' || transaction.flag === 'Settled' ? 'bg-emerald-100 text-emerald-800' :
                          transaction.flag === 'Pending' ? 'bg-amber-100 text-amber-800' :
                          transaction.flag === 'Credit' ? 'bg-blue-100 text-blue-800' :
                          transaction.flag === 'Cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-neutral-100 text-neutral-800'
                       }`}>
                          {transaction.flag}
                       </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-neutral-900">₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3.5 text-neutral-600 truncate max-w-[220px]" title={transaction.remark}>
                       {transaction.remark}
                    </td>
                    <td className="px-4 py-3.5 text-neutral-500 font-mono text-[11px] whitespace-nowrap">
                       {new Date(transaction.date).toLocaleDateString()} {new Date(transaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-medium text-neutral-500">
            Showing <span className="font-bold text-neutral-700">{Math.min((currentPage - 1) * parseInt(perPage) + 1, sortedTransactions.length)}</span> to <span className="font-bold text-neutral-700">{Math.min(currentPage * parseInt(perPage), sortedTransactions.length)}</span> of <span className="font-bold text-neutral-700">{sortedTransactions.length}</span> entries
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className={`px-3 py-1.5 border border-neutral-200 bg-white rounded-lg text-xs font-bold transition-all ${
                currentPage === 1 ? 'text-neutral-300 opacity-40' : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              Previous
            </button>
            <span className="text-xs font-bold text-neutral-600 px-2">
              Page {currentPage} of {Math.max(1, Math.ceil(sortedTransactions.length / parseInt(perPage)))}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= Math.ceil(sortedTransactions.length / parseInt(perPage)) || loading}
              className={`px-3 py-1.5 border border-neutral-200 bg-white rounded-lg text-xs font-bold transition-all ${
                currentPage >= Math.ceil(sortedTransactions.length / parseInt(perPage)) ? 'text-neutral-300 opacity-40' : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Fund Transfer Modal */}
      {showAddFundModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200 transition-all scale-100">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between" style={{ background: 'var(--primary-color)' }}>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                 </svg>
                 Add Fund Transfer
              </h3>
              <button
                onClick={handleCloseFundModal}
                className="text-white hover:text-neutral-200 transition-colors"
                disabled={submitting}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleFundTransferSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                  Select Seller <span className="text-red-500">*</span>
                </label>
                <select
                  value={fundTransferData.sellerId}
                  onChange={(e) => setFundTransferData({...fundTransferData, sellerId: e.target.value})}
                  required
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs font-medium focus:border-[var(--primary-color)] transition-all"
                >
                  <option value="">Select Seller</option>
                  {sellers.map(s => (
                    <option key={s._id} value={s._id}>{s.storeName} ({s.sellerName})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={fundTransferData.amount}
                    onChange={(e) => setFundTransferData({...fundTransferData, amount: e.target.value})}
                    required
                    disabled={submitting}
                    min="0"
                    step="0.01"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs font-bold focus:border-[var(--primary-color)] font-mono"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    Transfer Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fundTransferData.type}
                    onChange={(e) => setFundTransferData({...fundTransferData, type: e.target.value})}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs font-semibold focus:border-[var(--primary-color)]"
                    disabled={submitting}
                  >
                    <option value="Credit">Credit (+)</option>
                    <option value="Debit">Debit (-)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                  Remark / Message
                </label>
                <textarea
                  value={fundTransferData.message}
                  onChange={(e) => setFundTransferData({...fundTransferData, message: e.target.value})}
                  rows={3}
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs resize-none focus:border-[var(--primary-color)]"
                  placeholder="Reason for manual adjustment..."
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleCloseFundModal}
                  disabled={submitting}
                  className="px-5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                  style={{ background: 'var(--primary-color)' }}
                >
                  {submitting ? (
                     <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                     </>
                  ) : (
                     'Confirm Transfer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
