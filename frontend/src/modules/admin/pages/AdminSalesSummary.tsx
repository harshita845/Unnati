import { useState, useEffect } from "react";
import {
  getSalesSummary,
  type SalesSummaryData
} from "../../../services/api/admin/adminDashboardService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import SalesSummaryChart from "../components/SalesSummaryChart";
import TopInsightsButtons from "../components/TopInsightsButtons";

const FiCalendar = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const FiDollarSign = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
);

const FiShoppingBag = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path>
  </svg>
);

const FiCreditCard = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>
  </svg>
);

const FiCheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const FiFilter = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

const FiTrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>
  </svg>
);

const FiTrendingDown = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>
  </svg>
);

const FiLoader = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
  </svg>
);

const AdminSalesSummary = () => {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesSummaryData | null>(null);
  const [filter, setFilter] = useState("7days");
  const [prevFilter, setPrevFilter] = useState("7days");
  const [customRange, setCustomRange] = useState({
    startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [showCustomModal, setShowCustomModal] = useState(false);

  const fetchSummary = async (start: string, end: string) => {
    try {
      setLoading(true);
      const res = await getSalesSummary(start, end);
      if (res.success) {
        setData(res.data);
      } else {
        showToast(res.message || "Failed to fetch sales summary", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading sales summary", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (val: string) => {
    if (val === "custom") {
      setPrevFilter(filter);
      setFilter("custom");
      setShowCustomModal(true);
      return;
    }
    setPrevFilter(val);
    setFilter(val);
    const end = new Date();
    let start = new Date();

    if (val === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (val === "tomorrow") {
      start.setDate(end.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      end.setHours(23, 59, 59, 999);
    } else if (val === "7days") {
      start.setDate(end.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (val === "30days") {
      start.setDate(end.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (val === "all") {
      start = new Date(2020, 0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    fetchSummary(start.toISOString(), end.toISOString());
  };

  const applyCustomFilter = () => {
    if (!customRange.startDate || !customRange.endDate) {
      showToast("Please select both dates", "error");
      return;
    }
    const s = new Date(customRange.startDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(customRange.endDate);
    e.setHours(23, 59, 59, 999);

    if (s.getTime() > e.getTime()) {
      showToast("Start date cannot be after end date", "error");
      return;
    }

    setShowCustomModal(false);
    fetchSummary(s.toISOString(), e.toISOString());
  };

  const handleCancelCustom = () => {
    setShowCustomModal(false);
    if (filter === "custom") {
      setFilter(prevFilter);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      handleFilterChange("7days");
    }
  }, [isAuthenticated, token]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <FiLoader className="w-10 h-10 text-[var(--primary-color)] animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Fetching sales analytics...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pt-2 sm:pt-3 space-y-4 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sales & Summary</h1>
          <p className="text-gray-500 text-sm mt-1">Track your business growth and revenue</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-gray-100 p-1 rounded-xl flex overflow-x-auto no-scrollbar">
            {[
              { id: "today", label: "Today" },
              { id: "tomorrow", label: "Tomorrow" },
              { id: "7days", label: "Last 7 Days" },
              { id: "30days", label: "Last 30 Days" },
              { id: "all", label: "All Time" },
              { id: "custom", label: "Custom" }
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleFilterChange(opt.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filter === opt.id
                    ? "bg-white text-[var(--primary-color)] shadow-sm font-semibold"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{opt.label}</span>
                {loading && filter === opt.id && (
                  <FiLoader className="w-3.5 h-3.5 animate-spin text-[var(--primary-color)]" />
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setPrevFilter(filter);
              setFilter("custom");
              setShowCustomModal(true);
            }}
            title="Custom Date Filter"
            className="p-2 bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green,#236B34)] hover:text-white rounded-lg transition-colors cursor-pointer border border-[var(--brand-leaf,#5FA82E)]/30"
          >
            <FiFilter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`space-y-4 transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
        {/* Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <SummaryCard
            title="Total Sales"
            value={`₹${(data?.summary.totalSales || 0).toLocaleString()}`}
            icon={<FiDollarSign className="w-6 h-6" />}
            color="bg-[var(--primary-color)]"
            trend={data?.summary.totalSalesChange !== undefined ? `${data.summary.totalSalesChange > 0 ? '+' : ''}${data.summary.totalSalesChange}%` : "0%"}
          />
        <SummaryCard
          title="Total Orders"
          value={(data?.summary.totalOrders || 0).toString()}
          icon={<FiShoppingBag className="w-6 h-6" />}
          color="bg-[var(--primary-color)]"
          trend={data?.summary.totalOrdersChange !== undefined ? `${data.summary.totalOrdersChange > 0 ? '+' : ''}${data.summary.totalOrdersChange}%` : "0%"}
        />
        <SummaryCard
          title="Paid Amount"
          value={`₹${(data?.summary.paidAmount || 0).toLocaleString()}`}
          icon={<FiCheckCircle className="w-6 h-6" />}
          color="bg-[var(--primary-color)]"
          trend={data?.summary.paidAmountChange !== undefined ? `${data.summary.paidAmountChange > 0 ? '+' : ''}${data.summary.paidAmountChange}%` : "0%"}
        />
        <SummaryCard
          title="Credit Amount"
          value={`₹${(data?.summary.creditAmount || 0).toLocaleString()}`}
          icon={<FiCreditCard className="w-6 h-6" />}
          color="bg-orange-500"
          trend={data?.summary.creditAmountChange !== undefined ? `${data.summary.creditAmountChange > 0 ? '+' : ''}${data.summary.creditAmountChange}%` : "0%"}
        />
      </div>

      {/* Profit & Loss Row */}
      {/* Profit & loss tiles, plus the two Top 15 lists (last 30 days) in the same row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <SummaryCard
          compact
          title="Total Profit"
          value={`₹${(data?.summary.totalProfit || 0).toLocaleString()}`}
          icon={<FiTrendingUp className="w-6 h-6" />}
          color="bg-[var(--primary-color)]"
          trend="Est."
        />
        <SummaryCard
          compact
          title="Total Loss"
          value={`₹${(data?.summary.totalLoss || 0).toLocaleString()}`}
          icon={<FiTrendingDown className="w-6 h-6" />}
          color="bg-red-500"
          trend="Est."
        />
        <SummaryCard
          compact
          title="Net Profit"
          value={`₹${(data?.summary.netProfit || 0).toLocaleString()}`}
          icon={<FiDollarSign className="w-6 h-6" />}
          color="bg-[var(--primary-dark)]"
          trend="Final"
        />
        <TopInsightsButtons tiles />
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h3 className="font-bold text-gray-800 text-lg">Revenue Performance</h3>
          <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            Real-time daily aggregation
          </div>
        </div>
        <div className="h-[400px]">
          <SalesSummaryChart data={data?.dailySales || []} />
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Day-wise Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Day</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Sales</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Orders</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Avg. Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.dailySales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No sales found for this period</td>
                </tr>
              ) : (
                [...(data?.dailySales || [])].reverse().map((day, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-gray-700">{day.day}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(day.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-6 py-4 font-bold text-gray-900 group-hover:text-[var(--primary-color)] transition-colors">₹{day.sales.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] px-3 py-1 rounded-full text-xs font-bold">
                        {day.orders} Items
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      ₹{day.orders > 0 ? (day.sales / day.orders).toFixed(2).toLocaleString() : 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Custom Date Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={handleCancelCustom} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slideUp z-10 border border-[var(--brand-border,#E9E2D3)]">
            <div className="bg-[var(--brand-green-deep,#14401F)] p-6 text-white text-center">
              <FiCalendar className="w-10 h-10 mx-auto mb-2 text-[var(--brand-orange,#F97316)]" />
              <h3 className="text-xl font-display font-extrabold text-white">Select Date Range</h3>
              <p className="text-white/70 text-xs mt-1">Choose start and end dates for custom report</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--brand-ink-muted,#5B6B60)] uppercase mb-1.5">Start Date</label>
                  <input
                    type="date"
                    className="w-full border border-[var(--brand-border,#E9E2D3)] rounded-xl px-3.5 py-2.5 text-sm font-medium text-[var(--brand-ink,#1C2B20)] focus:border-[var(--brand-green,#236B34)] focus:outline-none transition-all"
                    value={customRange.startDate}
                    onChange={(e) => setCustomRange({...customRange, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--brand-ink-muted,#5B6B60)] uppercase mb-1.5">End Date</label>
                  <input
                    type="date"
                    className="w-full border border-[var(--brand-border,#E9E2D3)] rounded-xl px-3.5 py-2.5 text-sm font-medium text-[var(--brand-ink,#1C2B20)] focus:border-[var(--brand-green,#236B34)] focus:outline-none transition-all"
                    value={customRange.endDate}
                    onChange={(e) => setCustomRange({...customRange, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelCustom}
                  className="flex-1 py-2.5 font-bold text-sm text-[var(--brand-ink-muted,#5B6B60)] hover:bg-[var(--brand-cream-soft,#F6EFE2)] rounded-xl transition-all cursor-pointer border border-[var(--brand-border,#E9E2D3)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyCustomFilter}
                  className="flex-1 bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white py-2.5 font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getTrendStyle = (trend: string) => {
  if (trend === 'Est.' || trend === 'Final') {
    return 'bg-gray-100 text-gray-500';
  }
  if (trend.startsWith('+')) {
    return 'bg-green-50 text-green-700 border border-green-100';
  }
  if (trend.startsWith('-')) {
    return 'bg-red-50 text-red-700 border border-red-100';
  }
  return 'bg-gray-50 text-gray-500 border border-gray-100';
};

const SummaryCard = ({ title, value, icon, color, trend, compact }: any) => (
  <div className={`bg-white ${compact ? "p-3" : "p-4"} rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group`}>
    <div className={`flex justify-between items-start ${compact ? "mb-2" : "mb-3"}`}>
      <div className={`${compact ? "p-1.5 [&>svg]:w-5 [&>svg]:h-5" : "p-2"} rounded-lg text-white ${color} shadow-md shadow-gray-100 transition-transform group-hover:scale-105`}>
        {icon}
      </div>
      <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getTrendStyle(trend)}`}>
        {trend}
      </div>
    </div>
    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">{title}</p>
    <div className={`${compact ? "text-lg" : "text-xl"} font-extrabold text-gray-800 tracking-tight`}>{value}</div>
    <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
      {icon}
    </div>
  </div>
);

export default AdminSalesSummary;
