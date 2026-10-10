import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getReturnExchangeReport, ReturnExchangeData } from "../../../services/api/admin/adminInventoryService";
import { toast } from "react-hot-toast";

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminReturnExchangeSummary = () => {
  const [data, setData] = useState<ReturnExchangeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1,
    limit: 20
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearchTerm || undefined,
      };

      const now = new Date();
      if (dateFilterType === 'today') {
        params.dateFrom = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        params.dateTo = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      } else if (dateFilterType === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        params.dateFrom = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
        params.dateTo = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();
      } else if (dateFilterType === 'last7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.dateFrom = d.toISOString();
      } else if (dateFilterType === 'last30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.dateFrom = d.toISOString();
      } else if (dateFilterType === 'custom' && customDateRange.start && customDateRange.end) {
        params.dateFrom = new Date(customDateRange.start).toISOString();
        params.dateTo = new Date(new Date(customDateRange.end).setHours(23, 59, 59, 999)).toISOString();
      }

      const response = await getReturnExchangeReport(params);
      if (response.success) {
        setData(response.data);
        if (response.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.pagination!.total,
            pages: response.pagination!.pages
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching return exchange summary:", error);
      toast.error("Failed to fetch return exchange data");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearchTerm, dateFilterType, customDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCellEdit = (id: string, field: keyof ReturnExchangeData, value: any) => {
    setData(prev => prev.map(item =>
      item._id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(data.map(item => item._id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;
    const ok = window.confirm(`Delete ${selectedRows.size} selected item(s)?`);
    if (!ok) return;

    const idSet = new Set(selectedRows);
    setData((prev) => prev.filter((row) => !idSet.has(row._id)));
    setSelectedRows(new Set());
    toast.success("Selected items deleted");
  };

  const handleDateFilterChange = (type: DateFilterType) => {
    setDateFilterType(type);
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowCustomDatePicker(type === 'custom');
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
      Date: item.date,
      "Sale Return No": item.saleReturnNo,
      "Invoice No": item.invoiceNo,
      "Customer Name": item.customerName,
      "Payment Mode": item.paymentMode,
      "No of Items": item.noOfItems,
      "Total MRP": item.totalMRP,
      "Total SP": item.totalSP,
      "Total Discount": item.totalDiscount,
      "Return Amt": item.returnAmt,
      "Sale Amt": item.saleAmt,
      "Bill Amt": item.billAmt,
      "Paid By": item.paidBy
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Return & Exchange");
    XLSX.writeFile(workbook, `Return_Exchange_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Return & Exchange Summary Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = data.map(item => [
      item.date,
      item.saleReturnNo,
      item.invoiceNo,
      item.customerName,
      item.paymentMode,
      item.noOfItems.toString(),
      item.totalMRP.toString(),
      item.totalSP.toString(),
      item.returnAmt.toString()
    ]);

    autoTable(doc, {
      head: [['Date', 'Return No', 'Invoice', 'Customer', 'Payment', 'Items', 'MRP', 'SP', 'Return Amt']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 45, 148] }
    });

    doc.save(`Return_Exchange_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Stats calculation (Client-side matching displayed page data for now, or total from metadata if available effectively)
  // For simplicity and consistency with current table view stats:
  const totalReturnAmt = data.reduce((sum, item) => sum + item.returnAmt, 0);
  const totalSaleAmt = data.reduce((sum, item) => sum + item.saleAmt, 0);
  const totalItems = data.reduce((sum, item) => sum + item.noOfItems, 0);

  return (
    <div className="p-3 sm:p-6 bg-gray-50 min-h-screen space-y-4 sm:space-y-6">
      {/* Header & Controls Panel */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Return & Exchange Summary</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">Track all return and exchange transactions</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-3 sm:px-4 py-2 bg-[var(--primary-dark)] text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-[var(--primary-darker)] transition-colors flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>{editMode ? "Done" : "Bulk Edit"}</span>
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedRows.size === 0}
              className="px-3 sm:px-4 py-2 bg-rose-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-rose-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete{selectedRows.size > 0 ? ` (${selectedRows.size})` : ""}</span>
            </button>

            <button
              onClick={downloadExcel}
              className="px-3 sm:px-4 py-2 bg-[var(--primary-dark)] text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-[var(--primary-darker)] transition-colors flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Excel</span>
            </button>

            <button
              onClick={downloadPDF}
              className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Date Filter Tabs - Horizontal Scroll on Mobile */}
        <div className="mt-4 flex items-center gap-1.5 sm:gap-2 bg-gray-50 p-1.5 sm:p-2 rounded-xl overflow-x-auto no-scrollbar">
          {(['today', 'tomorrow', 'last7days', 'last30days', 'alltime'] as DateFilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleDateFilterChange(type)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all capitalize whitespace-nowrap shrink-0 ${
                dateFilterType === type
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              {type === 'last7days' ? 'Last 7 Days' : type === 'last30days' ? 'Last 30 Days' : type === 'alltime' ? 'All Time' : type}
            </button>
          ))}
          <button
            onClick={() => handleDateFilterChange('custom')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
              dateFilterType === 'custom'
                ? 'bg-[var(--primary-dark)] text-white shadow-sm font-semibold'
                : 'text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)]'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Custom Date Range Picker */}
        {showCustomDatePicker && (
          <div className="mt-3 p-3 sm:p-4 bg-[var(--primary-alpha-10)] rounded-xl border border-teal-200 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-teal-200 outline-none transition-all bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-teal-200 outline-none transition-all bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Search and Limit Filters */}
        <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 px-0.5">Search</label>
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search invoice, return no, customer..."
                className="w-full pl-9 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-teal-100 outline-none transition-all shadow-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 px-0.5">Show per page</label>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
              className="w-full px-3 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-teal-100 outline-none transition-all bg-white"
            >
              {[10, 20, 50, 100, 500].map(val => (
                <option key={val} value={val}>{val} per page</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
          <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Total Returns</p>
          <p className="text-lg sm:text-2xl font-black text-gray-800 mt-1 sm:mt-2">
            {pagination.total}
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
          <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Return Amt (Page)</p>
          <p className="text-lg sm:text-2xl font-black text-red-600 mt-1 sm:mt-2">
            ₹{totalReturnAmt.toLocaleString()}
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
          <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Sale Amt (Page)</p>
          <p className="text-lg sm:text-2xl font-black text-[var(--primary-dark)] mt-1 sm:mt-2">
            ₹{totalSaleAmt.toLocaleString()}
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
          <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Total Items (Page)</p>
          <p className="text-lg sm:text-2xl font-black text-[var(--primary-dark)] mt-1 sm:mt-2">
            {totalItems}
          </p>
        </div>
      </div>

      {/* Data Section */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Mobile / Tablet Card View (< lg) */}
        <div className="block lg:hidden">
          {/* Mobile Select All Header */}
          {data.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRows.size === data.length && data.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 text-[var(--primary-color)] rounded border-gray-300 focus:ring-[var(--primary-color)]"
                />
                <span>Select All ({data.length} items)</span>
              </label>
              {selectedRows.size > 0 && (
                <span className="text-xs font-bold text-[var(--primary-dark)] bg-[var(--primary-alpha-10)] px-2 py-0.5 rounded-full">
                  {selectedRows.size} selected
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm italic flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
              <span>Fetching return data...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm italic">
              No return/exchange data found
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.map((item) => {
                const isSelected = selectedRows.has(item._id);
                return (
                  <div
                    key={item._id}
                    className={`p-3.5 sm:p-4 transition-colors ${
                      isSelected ? "bg-teal-50/40" : "hover:bg-gray-50/70"
                    }`}
                  >
                    {/* Top Row: Checkbox, Return No, Date & Payment Mode */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(item._id)}
                          className="w-4 h-4 text-[var(--primary-color)] rounded border-gray-300 focus:ring-[var(--primary-color)] shrink-0 mt-0.5"
                        />
                        <div>
                          {editMode ? (
                            <input
                              type="text"
                              value={item.saleReturnNo}
                              onChange={(e) => handleCellEdit(item._id, "saleReturnNo", e.target.value)}
                              placeholder="Return No"
                              className="px-2 py-1 text-xs border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none font-semibold w-28"
                            />
                          ) : (
                            <span className="text-xs sm:text-sm font-bold text-gray-900 block" title={item.saleReturnNo}>
                              #{item.saleReturnNo}
                            </span>
                          )}
                          <span className="text-[10px] sm:text-xs text-gray-500 block">
                            {editMode ? (
                              <input
                                type="date"
                                value={item.date}
                                onChange={(e) => handleCellEdit(item._id, "date", e.target.value)}
                                className="mt-1 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                              />
                            ) : (
                              item.date
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Payment Mode Badge / Edit */}
                      <div>
                        {editMode ? (
                          <select
                            value={item.paymentMode}
                            onChange={(e) => handleCellEdit(item._id, "paymentMode", e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none bg-white"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="UPI">UPI</option>
                          </select>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--primary-alpha-10)] text-[var(--primary-dark)]">
                            {item.paymentMode || "Cash"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer & Invoice Row */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-lg mb-2.5">
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Customer</span>
                        {editMode ? (
                          <input
                            type="text"
                            value={item.customerName}
                            onChange={(e) => handleCellEdit(item._id, "customerName", e.target.value)}
                            placeholder="Customer Name"
                            className="w-full mt-0.5 px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:border-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="font-semibold text-gray-800 truncate block">
                            {item.customerName || "-"}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Invoice No</span>
                        {editMode ? (
                          <input
                            type="text"
                            value={item.invoiceNo}
                            onChange={(e) => handleCellEdit(item._id, "invoiceNo", e.target.value)}
                            placeholder="Invoice No"
                            className="w-full mt-0.5 px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:border-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="font-semibold text-gray-700 truncate block">
                            {item.invoiceNo || "-"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Financial Figures Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-red-50/60 p-2 rounded-lg border border-red-100/60">
                        <span className="text-[10px] text-red-600 block font-medium">Return Amt</span>
                        {editMode ? (
                          <input
                            type="number"
                            value={item.returnAmt}
                            onChange={(e) => handleCellEdit(item._id, "returnAmt", parseFloat(e.target.value) || 0)}
                            className="w-full mt-0.5 px-1 py-0.5 text-xs text-center border border-red-200 rounded bg-white font-bold text-red-600 outline-none"
                          />
                        ) : (
                          <span className="font-black text-red-600 text-sm block">
                            ₹{item.returnAmt}
                          </span>
                        )}
                      </div>

                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <span className="text-[10px] text-gray-500 block font-medium">Sale Amt</span>
                        {editMode ? (
                          <input
                            type="number"
                            value={item.saleAmt}
                            onChange={(e) => handleCellEdit(item._id, "saleAmt", parseFloat(e.target.value) || 0)}
                            className="w-full mt-0.5 px-1 py-0.5 text-xs text-center border border-gray-200 rounded bg-white outline-none"
                          />
                        ) : (
                          <span className="font-bold text-gray-800 text-sm block">
                            ₹{item.saleAmt}
                          </span>
                        )}
                      </div>

                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <span className="text-[10px] text-gray-500 block font-medium">Bill Amt</span>
                        {editMode ? (
                          <input
                            type="number"
                            value={item.billAmt}
                            onChange={(e) => handleCellEdit(item._id, "billAmt", parseFloat(e.target.value) || 0)}
                            className="w-full mt-0.5 px-1 py-0.5 text-xs text-center border border-gray-200 rounded bg-white outline-none"
                          />
                        ) : (
                          <span className="font-bold text-gray-800 text-sm block">
                            ₹{item.billAmt}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Secondary Details (Items, MRP, SP, Discount, Paid By) */}
                    <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                      <div className="flex items-center gap-3">
                        <span>Items: <strong className="text-gray-800">{item.noOfItems}</strong></span>
                        <span>MRP: <strong className="text-gray-800">₹{item.totalMRP}</strong></span>
                        <span>SP: <strong className="text-gray-800">₹{item.totalSP}</strong></span>
                      </div>
                      {item.paidBy && (
                        <span>Paid By: <strong className="text-gray-800">{item.paidBy}</strong></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Table View (>= lg) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left min-w-[1100px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === data.length && data.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-[var(--primary-color)] rounded border-gray-300 focus:ring-[var(--primary-color)]"
                  />
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sale Return No</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice No</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer Name</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment Mode</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">No of Items</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total MRP</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total SP</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Discount</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Return Amt</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sale Amt</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bill Amt</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Paid By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center text-gray-500 italic">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
                      <span>Fetching return data...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center text-gray-400 italic">
                    No return/exchange data found
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(item._id)}
                        onChange={() => handleSelectRow(item._id)}
                        className="w-4 h-4 text-[var(--primary-color)] rounded border-gray-300 focus:ring-[var(--primary-color)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => handleCellEdit(item._id, 'date', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.date}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.saleReturnNo}
                          onChange={(e) => handleCellEdit(item._id, 'saleReturnNo', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none font-semibold"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-900" title={item.saleReturnNo}>
                          {item.saleReturnNo.substring(0, 12)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.invoiceNo}
                          onChange={(e) => handleCellEdit(item._id, 'invoiceNo', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.invoiceNo}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.customerName}
                          onChange={(e) => handleCellEdit(item._id, 'customerName', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.customerName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <select
                          value={item.paymentMode}
                          onChange={(e) => handleCellEdit(item._id, 'paymentMode', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none bg-white"
                        >
                          <option value="Cash">Cash</option>
                          <option value="Card">Card</option>
                          <option value="UPI">UPI</option>
                        </select>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[var(--primary-alpha-10)] text-[var(--primary-dark)]">
                          {item.paymentMode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.noOfItems}
                          onChange={(e) => handleCellEdit(item._id, 'noOfItems', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.noOfItems}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.totalMRP}
                          onChange={(e) => handleCellEdit(item._id, 'totalMRP', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.totalMRP}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.totalSP}
                          onChange={(e) => handleCellEdit(item._id, 'totalSP', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.totalSP}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.totalDiscount}
                          onChange={(e) => handleCellEdit(item._id, 'totalDiscount', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.totalDiscount}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.returnAmt}
                          onChange={(e) => handleCellEdit(item._id, 'returnAmt', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none font-bold text-red-600"
                        />
                      ) : (
                        <span className="text-sm font-bold text-red-600">₹{item.returnAmt}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.saleAmt}
                          onChange={(e) => handleCellEdit(item._id, 'saleAmt', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.saleAmt}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.billAmt}
                          onChange={(e) => handleCellEdit(item._id, 'billAmt', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.billAmt}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.paidBy}
                          onChange={(e) => handleCellEdit(item._id, 'paidBy', e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.paidBy}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
            <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
              Showing page <span className="font-semibold text-gray-800">{pagination.page}</span> of <span className="font-semibold text-gray-800">{pagination.pages}</span> ({pagination.total} total items)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                disabled={pagination.page === pagination.pages}
                className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReturnExchangeSummary;
