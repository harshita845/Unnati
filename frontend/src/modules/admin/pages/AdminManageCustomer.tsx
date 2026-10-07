import { useState, useMemo, useEffect } from "react";
import {
  getAllCustomers,
  getCustomerOrders,
  updateCustomer,
  updateCustomerStatus,
  type Customer,
  type CustomerOrder,
} from "../../../services/api/admin/adminCustomerService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

type SortField =
  | "id"
  | "name"
  | "email"
  | "phone"
  | "registrationDate"
  | "status"
  | "totalOrders"
  | "totalSpent";
type SortDirection = "asc" | "desc";

export default function AdminManageCustomer() {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dateRange, setDateRange] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Active" | "Inactive" | undefined>(
    undefined
  );
  const [entriesPerPage, setEntriesPerPage] = useState("10");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedCustomerForView, setSelectedCustomerForView] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState<Customer | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fetch customers on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: {
          page: number;
          limit: number;
          status?: "Active" | "Inactive";
          search?: string;
        } = {
          page: currentPage,
          limit: parseInt(entriesPerPage),
        };

        if (statusFilter) {
          params.status = statusFilter;
        }

        if (searchQuery) {
          params.search = searchQuery;
        }

        const response = await getAllCustomers(params);
        if (response.success) {
          setCustomers(response.data);
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
        if (err && typeof err === "object" && "response" in err) {
          const axiosError = err as {
            response?: { data?: { message?: string } };
          };
          setError(
            axiosError.response?.data?.message ||
            "Failed to load customers. Please try again."
          );
        } else {
          setError("Failed to load customers. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [
    isAuthenticated,
    token,
    currentPage,
    entriesPerPage,
    statusFilter,
    searchQuery,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleViewCustomer = async (customer: Customer) => {
    setSelectedCustomerForView(customer);
    setLoadingOrders(true);
    try {
      const res = await getCustomerOrders(customer._id);
      if (res && res.success && res.data) {
        setCustomerOrders(res.data);
      } else {
        setCustomerOrders([]);
      }
    } catch (err) {
      console.error("Error fetching customer orders:", err);
      setCustomerOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomerForEdit(customer);
    setEditFormData({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      status: customer.status || "Active",
      dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.split("T")[0] : "",
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      pincode: customer.pincode || "",
      gst: customer.gst || "",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForEdit) return;

    setIsSaving(true);
    try {
      const res = await updateCustomer(selectedCustomerForEdit._id, editFormData);
      if (res && res.success) {
        showToast("Customer updated successfully!", "success");
        setCustomers((prev) =>
          prev.map((c) =>
            c._id === selectedCustomerForEdit._id ? { ...c, ...editFormData } : c
          )
        );
        if (selectedCustomerForView?._id === selectedCustomerForEdit._id) {
          setSelectedCustomerForView((prev) =>
            prev ? { ...prev, ...editFormData } : null
          );
        }
        setSelectedCustomerForEdit(null);
      } else {
        showToast(res?.message || "Failed to update customer", "error");
      }
    } catch (err: any) {
      console.error("Error updating customer:", err);
      showToast(err.response?.data?.message || "Failed to update customer", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (customer: Customer) => {
    const newStatus = customer.status === "Active" ? "Inactive" : "Active";
    try {
      const res = await updateCustomerStatus(customer._id, { status: newStatus });
      if (res && res.success) {
        showToast(`Customer status updated to ${newStatus}`, "success");
        setCustomers((prev) =>
          prev.map((c) => (c._id === customer._id ? { ...c, status: newStatus } : c))
        );
        if (selectedCustomerForView?._id === customer._id) {
          setSelectedCustomerForView((prev) =>
            prev ? { ...prev, status: newStatus } : null
          );
        }
      }
    } catch (err: any) {
      console.error("Error toggling customer status:", err);
      showToast("Failed to update status", "error");
    }
  };

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = [...customers];

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortField) {
          case "id":
            aValue = a._id || "";
            bValue = b._id || "";
            break;
          case "name":
            aValue = a.name || "";
            bValue = b.name || "";
            break;
          case "email":
            aValue = a.email || "";
            bValue = b.email || "";
            break;
          case "phone":
            aValue = a.phone || "";
            bValue = b.phone || "";
            break;
          case "registrationDate":
            aValue = a.registrationDate || "";
            bValue = b.registrationDate || "";
            break;
          case "status":
            aValue = a.status || "";
            bValue = b.status || "";
            break;
          case "totalOrders":
            aValue = a.totalOrders || 0;
            bValue = b.totalOrders || 0;
            break;
          case "totalSpent":
            aValue = a.totalSpent || 0;
            bValue = b.totalSpent || 0;
            break;
          default:
            return 0;
        }

        if (typeof aValue === "string") {
          aValue = (aValue as string).toLowerCase();
        }
        if (typeof bValue === "string") {
          bValue = (bValue as string).toLowerCase();
        }

        if (sortDirection === "asc") {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    }

    return filtered;
  }, [customers, sortField, sortDirection]);

  const totalPages = Math.ceil(
    filteredAndSortedCustomers.length / Number(entriesPerPage)
  );
  const startIndex = (currentPage - 1) * Number(entriesPerPage);
  const endIndex = startIndex + Number(entriesPerPage);
  const displayedCustomers = filteredAndSortedCustomers.slice(
    startIndex,
    endIndex
  );

  const handleExport = () => {
    const headers = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "Registration Date",
      "Status",
      "Ref Code",
      "Wallet Amount",
      "Total Orders",
      "Total Spent",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredAndSortedCustomers.map((customer) =>
        [
          customer._id.slice(-6),
          customer.name,
          customer.email,
          customer.phone,
          customer.registrationDate
            ? new Date(customer.registrationDate).toLocaleString()
            : "",
          customer.status,
          customer.refCode,
          customer.walletAmount || 0,
          customer.totalOrders,
          customer.totalSpent.toFixed(2),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `customers_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="text-neutral-300 text-[10px]">
      {sortField === field ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
    </span>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
              Manage Customer
            </h1>
          </div>
          <div className="text-sm text-neutral-600">
            <span className="text-[var(--primary-color)]">Home</span> /{" "}
            <span className="text-neutral-900">Manage Customer</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50">
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          {/* Filters */}
          <div className="p-4 sm:p-6 border-b border-neutral-200 bg-neutral-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Date Range
                </label>
                <input
                  type="text"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  placeholder="MM/DD/YYYY - MM/DD/YYYY"
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter || "All"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStatusFilter(val === "All" ? undefined : (val as "Active" | "Inactive"));
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] bg-white">
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Show
                </label>
                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    setEntriesPerPage(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] bg-white">
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleExport}
                  className="w-full bg-[var(--primary-color)] hover:bg-[#e076a4] text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                  Export
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 sm:p-6 border-b border-neutral-200">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                Search:
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-14 pr-3 py-2 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-[var(--primary-color)]"
                placeholder="Search by name, email, phone, or ref code..."
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800">
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("id")}>
                    <div className="flex items-center justify-between">
                      ID <SortIcon field="id" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("name")}>
                    <div className="flex items-center justify-between">
                      Name <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("email")}>
                    <div className="flex items-center justify-between">
                      Email <SortIcon field="email" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("phone")}>
                    <div className="flex items-center justify-between">
                      Phone <SortIcon field="phone" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("registrationDate")}>
                    <div className="flex items-center justify-between">
                      Registration Date <SortIcon field="registrationDate" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("status")}>
                    <div className="flex items-center justify-between">
                      Status <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="p-4 border border-neutral-200">Ref Code</th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("totalOrders")}>
                    <div className="flex items-center justify-between">
                      Total Orders <SortIcon field="totalOrders" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("totalSpent")}>
                    <div className="flex items-center justify-between">
                      Total Spent <SortIcon field="totalSpent" />
                    </div>
                  </th>
                  <th className="p-4 border border-neutral-200 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-8 text-center text-neutral-400 border border-neutral-200">
                      Loading customers...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-8 text-center text-red-600 border border-neutral-200">
                      {error}
                    </td>
                  </tr>
                ) : displayedCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-8 text-center text-neutral-400 border border-neutral-200">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  displayedCustomers.map((customer) => (
                    <tr
                      key={customer._id}
                      className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700">
                      <td className="p-4 border border-neutral-200 font-mono text-xs text-neutral-500">
                        {customer._id.slice(-6)}
                      </td>
                      <td className="p-4 border border-neutral-200 font-medium text-neutral-900">
                        {customer.name}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.email || "-"}
                      </td>
                      <td className="p-4 border border-neutral-200 font-mono">
                        {customer.phone || "-"}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.registrationDate
                          ? new Date(customer.registrationDate).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            customer.status === "Active"
                              ? "bg-pink-100 text-pink-700 border border-pink-200"
                              : "bg-red-100 text-red-800 border border-red-200"
                          }`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className="p-4 border border-neutral-200 font-mono text-xs">
                        {customer.refCode || "-"}
                      </td>
                      <td className="p-4 border border-neutral-200 text-center font-semibold">
                        {customer.totalOrders}
                      </td>
                      <td className="p-4 border border-neutral-200 font-semibold text-neutral-900">
                        ₹{(customer.totalSpent || 0).toFixed(2)}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewCustomer(customer)}
                            className="p-1.5 bg-[#163F2E] hover:bg-[#112f22] text-white rounded transition-all shadow-sm active:scale-95 cursor-pointer"
                            title="View Details">
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEditCustomer(customer)}
                            className="p-1.5 bg-[var(--primary-color)] hover:bg-[#e076a4] text-white rounded transition-all shadow-sm active:scale-95 cursor-pointer"
                            title="Edit">
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <div className="text-xs sm:text-sm text-neutral-700">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredAndSortedCustomers.length)} of{" "}
              {filteredAndSortedCustomers.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 border border-[var(--primary-color)] rounded ${
                  currentPage === 1
                    ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                    : "text-[var(--primary-color)] hover:bg-pink-50 cursor-pointer"
                }`}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2">
                  <path d="M15 18L9 12L15 6"></path>
                </svg>
              </button>
              <button className="px-3 py-1.5 border border-[var(--primary-color)] bg-[var(--primary-color)] text-white rounded font-medium text-sm">
                {currentPage}
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className={`p-2 border border-[var(--primary-color)] rounded ${
                  currentPage === totalPages || totalPages === 0
                    ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                    : "text-[var(--primary-color)] hover:bg-pink-50 cursor-pointer"
                }`}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2">
                  <path d="M9 18L15 12L9 6"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== View Customer Details Modal ==================== */}
      {selectedCustomerForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-neutral-200">
            {/* Modal Header */}
            <div className="bg-[#163F2E] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-lg uppercase shadow-inner">
                  {selectedCustomerForView.name?.charAt(0) || "C"}
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">
                    {selectedCustomerForView.name}
                  </h2>
                  <p className="text-xs text-white/80 font-mono">
                    ID: {selectedCustomerForView._id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleStatus(selectedCustomerForView)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    selectedCustomerForView.status === "Active"
                      ? "bg-green-500/20 text-green-200 border-green-400 hover:bg-green-500/30"
                      : "bg-red-500/20 text-red-200 border-red-400 hover:bg-red-500/30"
                  }`}
                  title="Click to toggle status">
                  {selectedCustomerForView.status} • Click to toggle
                </button>
                <button
                  onClick={() => setSelectedCustomerForView(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer">
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
                    Total Orders
                  </span>
                  <span className="text-lg font-extrabold text-neutral-900 mt-1 block">
                    {selectedCustomerForView.totalOrders || 0}
                  </span>
                </div>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
                    Total Spent
                  </span>
                  <span className="text-lg font-extrabold text-[#163F2E] mt-1 block">
                    ₹{(selectedCustomerForView.totalSpent || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
                    Wallet Amount
                  </span>
                  <span className="text-lg font-extrabold text-blue-600 mt-1 block">
                    ₹{(selectedCustomerForView.walletAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block">
                    Credit Balance
                  </span>
                  <span className="text-lg font-extrabold text-purple-600 mt-1 block">
                    ₹{(selectedCustomerForView.creditBalance || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Personal & Contact Details */}
              <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-3 pb-2 border-b border-neutral-100">
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-neutral-500 block">Phone Number</span>
                    <span className="font-semibold text-neutral-900 font-mono">
                      {selectedCustomerForView.phone || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 block">Email Address</span>
                    <span className="font-semibold text-neutral-900">
                      {selectedCustomerForView.email || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 block">Date of Birth</span>
                    <span className="font-semibold text-neutral-900">
                      {selectedCustomerForView.dateOfBirth
                        ? new Date(selectedCustomerForView.dateOfBirth).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 block">Registration Date</span>
                    <span className="font-semibold text-neutral-900">
                      {selectedCustomerForView.registrationDate
                        ? new Date(selectedCustomerForView.registrationDate).toLocaleString()
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 block">Referral Code</span>
                    <span className="font-semibold text-neutral-900 font-mono">
                      {selectedCustomerForView.refCode || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 block">GST Number</span>
                    <span className="font-semibold text-neutral-900 font-mono">
                      {selectedCustomerForView.gst || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Address Details */}
              <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-3 pb-2 border-b border-neutral-100">
                  Address Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="sm:col-span-3">
                    <span className="text-xs text-neutral-500 block">Full Address</span>
                    <span className="font-semibold text-neutral-900">
                      {selectedCustomerForView.address || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 block">City</span>
                    <span className="font-semibold text-neutral-900">
                      {selectedCustomerForView.city || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 block">State</span>
                    <span className="font-semibold text-neutral-900">
                      {selectedCustomerForView.state || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 block">Pincode</span>
                    <span className="font-semibold text-neutral-900 font-mono">
                      {selectedCustomerForView.pincode || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Orders Section */}
              <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100">
                  <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Recent Orders ({customerOrders.length})
                  </h3>
                </div>

                {loadingOrders ? (
                  <div className="py-6 text-center text-sm text-neutral-500">
                    Loading order history...
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="py-6 text-center text-sm text-neutral-400">
                    No orders placed by this customer yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                          <th className="p-2">Order #</th>
                          <th className="p-2">Date</th>
                          <th className="p-2">Items</th>
                          <th className="p-2">Status</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {customerOrders.slice(0, 10).map((ord) => (
                          <tr key={ord._id} className="hover:bg-neutral-50">
                            <td className="p-2 font-mono font-medium text-neutral-800">
                              {ord.orderNumber || ord._id.slice(-6)}
                            </td>
                            <td className="p-2 text-neutral-600">
                              {ord.orderDate ? new Date(ord.orderDate).toLocaleDateString() : "-"}
                            </td>
                            <td className="p-2 text-neutral-600">
                              {ord.items?.length || 0} item(s)
                            </td>
                            <td className="p-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                                {ord.status || "Completed"}
                              </span>
                            </td>
                            <td className="p-2 text-right font-semibold text-neutral-900">
                              ₹{(ord.total || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-neutral-50 px-6 py-3 border-t border-neutral-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const cust = selectedCustomerForView;
                  setSelectedCustomerForView(null);
                  handleEditCustomer(cust);
                }}
                className="px-4 py-2 bg-[var(--primary-color)] hover:bg-[#e076a4] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit Customer
              </button>
              <button
                type="button"
                onClick={() => setSelectedCustomerForView(null)}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Edit Customer Modal ==================== */}
      {selectedCustomerForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-neutral-200">
            {/* Modal Header */}
            <div className="bg-[var(--primary-color)] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Edit Customer</h2>
                <p className="text-xs text-white/80 font-mono">
                  ID: {selectedCustomerForEdit._id}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerForEdit(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer">
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.phone || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editFormData.email || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editFormData.status || "Active"}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        status: e.target.value as "Active" | "Inactive",
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none bg-white">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={editFormData.dateOfBirth || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    GST Number
                  </label>
                  <input
                    type="text"
                    value={editFormData.gst || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, gst: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none font-mono"
                    placeholder="e.g. 22AAAAA0000A1Z5"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={editFormData.address || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={editFormData.city || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={editFormData.state || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={editFormData.pincode || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerForEdit(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[var(--primary-color)] hover:bg-[#e076a4] text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50">
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
