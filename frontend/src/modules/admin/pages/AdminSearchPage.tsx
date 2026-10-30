import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  adminGlobalSearch,
  GlobalSearchResult,
  AdminSearchOrder,
  AdminSearchProduct,
  AdminSearchCustomer,
  AdminSearchSeller,
  AdminSearchCategory,
  AdminSearchSubCategory,
} from "../../../services/api/admin/adminSearchService";
import { format } from "date-fns";

const ADMIN_NAV_PAGES = [
  { title: "Dashboard", path: "/admin", category: "Overview" },
  { title: "Orders (All Orders)", path: "/admin/orders", category: "Sales" },
  { title: "Pending Orders", path: "/admin/orders/pending", category: "Sales" },
  { title: "Received Orders", path: "/admin/orders/received", category: "Sales" },
  { title: "Delivered Orders", path: "/admin/orders/delivered", category: "Sales" },
  { title: "POS Orders", path: "/admin/pos/orders", category: "POS" },
  { title: "Scan Bill / Billing", path: "/admin/pos/scan-bill", category: "POS" },
  { title: "POS Reports", path: "/admin/pos/report", category: "POS" },
  { title: "Product List & Stock", path: "/admin/product/list", category: "Products" },
  { title: "Add Product", path: "/admin/product/add", category: "Products" },
  { title: "Manage Categories", path: "/admin/category", category: "Catalog" },
  { title: "Header Category", path: "/admin/category/header", category: "Catalog" },
  { title: "Sub Category", path: "/admin/subcategory", category: "Catalog" },
  { title: "Brands", path: "/admin/brand", category: "Catalog" },
  { title: "Manage Customer", path: "/admin/customers", category: "Customers" },
  { title: "Customer Abandoned Carts", path: "/admin/customers/abandoned-carts", category: "Customers" },
  { title: "Manage Seller List", path: "/admin/manage-seller/list", category: "Sellers" },
  { title: "Add Seller", path: "/admin/manage-seller/add", category: "Sellers" },
  { title: "Seller Subscriptions", path: "/admin/seller-subscriptions", category: "Sellers" },
  { title: "Delivery Boys", path: "/admin/delivery-boys", category: "Delivery" },
  { title: "Manage Staff", path: "/admin/manage-staff", category: "Staff" },
  { title: "Coupons", path: "/admin/coupons", category: "Marketing" },
  { title: "Taxes Setup", path: "/admin/product/taxes", category: "Settings" },
  { title: "App Settings", path: "/admin/settings", category: "Settings" },
  { title: "Wallet & Transactions", path: "/admin/wallet", category: "Finance" },
];

export default function AdminSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParam = searchParams.get("q") || searchParams.get("search") || "";

  const [inputVal, setInputVal] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult>({
    orders: [],
    products: [],
    customers: [],
    sellers: [],
    categories: [],
    subcategories: [],
  });

  const matchingPages = inputVal.trim()
    ? ADMIN_NAV_PAGES.filter(
        (p) =>
          p.title.toLowerCase().includes(inputVal.toLowerCase()) ||
          p.category.toLowerCase().includes(inputVal.toLowerCase())
      )
    : [];

  useEffect(() => {
    setInputVal(queryParam);
    if (!queryParam.trim()) {
      setResults({
        orders: [],
        products: [],
        customers: [],
        sellers: [],
        categories: [],
        subcategories: [],
      });
      return;
    }

    let isMounted = true;
    setLoading(true);
    adminGlobalSearch(queryParam)
      .then((data) => {
        if (isMounted) {
          setResults(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Search error:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [queryParam]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      setSearchParams({ q: inputVal.trim() });
    }
  };

  const totalResultsCount =
    matchingPages.length +
    results.orders.length +
    results.products.length +
    results.customers.length +
    results.sellers.length +
    results.categories.length +
    results.subcategories.length;

  const renderStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    let badgeClass = "bg-neutral-100 text-neutral-800 border-neutral-200";
    if (s === "delivered" || s === "paid" || s === "active") {
      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (s === "pending" || s === "processing" || s === "received") {
      badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (s === "cancelled" || s === "inactive" || s === "failed") {
      badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${badgeClass}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 sm:p-6">
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
            Admin Search
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Search orders, products, customers, sellers, categories, and system navigation.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-4 text-neutral-400 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21L16.65 16.65"></path>
          </svg>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Search by order ID, product name, customer phone, seller name..."
            className="w-full pl-12 pr-28 py-3 bg-neutral-50 hover:bg-neutral-100/80 focus:bg-white border border-neutral-300 rounded-xl text-sm sm:text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#236B34] focus:ring-4 focus:ring-[#236B34]/15 transition-all"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2 px-4 py-2 bg-[#236B34] hover:bg-[#1B5128] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Search
          </button>
        </form>

        {/* Tab Filters */}
        {queryParam && (
          <div className="flex items-center gap-2 mt-5 border-b border-neutral-200 pb-2 overflow-x-auto text-sm">
            {[
              { id: "all", label: "All Results", count: totalResultsCount },
              { id: "pages", label: "Pages & Actions", count: matchingPages.length },
              { id: "orders", label: "Orders", count: results.orders.length },
              { id: "products", label: "Products", count: results.products.length },
              { id: "customers", label: "Customers", count: results.customers.length },
              { id: "sellers", label: "Sellers", count: results.sellers.length },
              {
                id: "categories",
                label: "Categories",
                count: results.categories.length + results.subcategories.length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-[#236B34] text-white shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-neutral-200 border-t-[#236B34] mb-3"></div>
          <p className="text-neutral-600 font-medium text-sm">Searching admin database...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && queryParam && totalResultsCount === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-400">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="M21 21L16.65 16.65"></path>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">
            No results found for "{queryParam}"
          </h2>
          <p className="text-sm text-neutral-500 max-w-md mx-auto">
            Try checking for typos or searching by customer phone number, order number, SKU, or product name.
          </p>
        </div>
      )}

      {/* Results Content */}
      {!loading && queryParam && totalResultsCount > 0 && (
        <div className="space-y-6">
          {/* Quick Pages Navigation */}
          {(activeTab === "all" || activeTab === "pages") && matchingPages.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-neutral-100 pb-2">
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span>🧭</span> Navigation & Pages
                  <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-600">
                    {matchingPages.length}
                  </span>
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {matchingPages.map((page, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigate(page.path)}
                    className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 hover:border-[#236B34] hover:bg-[#236B34]/5 text-left transition-all group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 group-hover:text-[#236B34]">
                        {page.title}
                      </p>
                      <span className="text-xs text-neutral-500">{page.category}</span>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-neutral-400 group-hover:text-[#236B34] transition-colors"
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Orders Section */}
          {(activeTab === "all" || activeTab === "orders") && results.orders.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-neutral-100 pb-2">
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span>📦</span> Orders
                  <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-600">
                    {results.orders.length}
                  </span>
                </h2>
                <button
                  onClick={() => navigate(`/admin/orders?search=${encodeURIComponent(queryParam)}`)}
                  className="text-xs font-semibold text-[#236B34] hover:underline"
                >
                  View in Orders →
                </button>
              </div>
              <div className="divide-y divide-neutral-100">
                {results.orders.map((ord: AdminSearchOrder) => (
                  <div
                    key={ord._id}
                    onClick={() => navigate(`/admin/orders/${ord._id}`)}
                    className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-neutral-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900 text-sm">
                          #{ord.orderNumber}
                        </span>
                        {renderStatusBadge(ord.status)}
                      </div>
                      <p className="text-xs text-neutral-600 mt-1">
                        Customer: <span className="font-medium text-neutral-900">{ord.customerName}</span>
                        {ord.customerPhone ? ` • ${ord.customerPhone}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:text-right">
                      <div>
                        <p className="text-sm font-bold text-neutral-900">₹{ord.total?.toFixed(2)}</p>
                        <p className="text-xs text-neutral-400">
                          {ord.createdAt ? format(new Date(ord.createdAt), "dd MMM yyyy, hh:mm a") : ""}
                        </p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400 hidden sm:block">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Products Section */}
          {(activeTab === "all" || activeTab === "products") && results.products.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-neutral-100 pb-2">
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span>🛍️</span> Products
                  <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-600">
                    {results.products.length}
                  </span>
                </h2>
                <button
                  onClick={() => navigate(`/admin/product/list?search=${encodeURIComponent(queryParam)}`)}
                  className="text-xs font-semibold text-[#236B34] hover:underline"
                >
                  View in Product Stock →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {results.products.map((prod: AdminSearchProduct) => (
                  <div
                    key={prod._id}
                    onClick={() => navigate(`/admin/product/list`)}
                    className="p-3 border border-neutral-200 rounded-xl hover:border-[#236B34] hover:bg-neutral-50/60 transition-all flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-14 h-14 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-neutral-200">
                      {prod.image ? (
                        <img src={prod.image} alt={prod.productName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🛍️</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900 truncate" title={prod.productName}>
                        {prod.productName}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {prod.categoryName || "General"} {prod.sku ? `• SKU: ${prod.sku}` : ""}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold text-neutral-900">₹{prod.price}</span>
                        <span className="text-[11px] text-neutral-500 font-medium">Stock: {prod.stock}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers Section */}
          {(activeTab === "all" || activeTab === "customers") && results.customers.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-neutral-100 pb-2">
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span>👤</span> Customers
                  <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-600">
                    {results.customers.length}
                  </span>
                </h2>
                <button
                  onClick={() => navigate(`/admin/customers`)}
                  className="text-xs font-semibold text-[#236B34] hover:underline"
                >
                  View Customers →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {results.customers.map((cust: AdminSearchCustomer) => (
                  <div
                    key={cust._id}
                    onClick={() => navigate(`/admin/customers`)}
                    className="p-3 border border-neutral-200 rounded-xl hover:border-[#236B34] hover:bg-neutral-50/60 transition-all flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-[#236B34]/10 text-[#236B34] rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {cust.name ? cust.name.charAt(0).toUpperCase() : "C"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{cust.name}</p>
                      <p className="text-xs text-neutral-600 truncate">{cust.phone}</p>
                      {cust.email && <p className="text-xs text-neutral-400 truncate">{cust.email}</p>}
                    </div>
                    {renderStatusBadge(cust.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sellers Section */}
          {(activeTab === "all" || activeTab === "sellers") && results.sellers.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-neutral-100 pb-2">
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <span>🏪</span> Sellers
                  <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-600">
                    {results.sellers.length}
                  </span>
                </h2>
                <button
                  onClick={() => navigate(`/admin/manage-seller/list`)}
                  className="text-xs font-semibold text-[#236B34] hover:underline"
                >
                  View All Sellers →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {results.sellers.map((sel: AdminSearchSeller) => (
                  <div
                    key={sel._id}
                    onClick={() => navigate(`/admin/manage-seller/list`)}
                    className="p-3 border border-neutral-200 rounded-xl hover:border-[#236B34] hover:bg-neutral-50/60 transition-all flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-amber-500/10 text-amber-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      🏪
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{sel.storeName}</p>
                      <p className="text-xs text-neutral-600 truncate">
                        {sel.city ? `${sel.city} • ` : ""}{sel.mobile || sel.email}
                      </p>
                    </div>
                    {renderStatusBadge(sel.status || "Active")}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories & Subcategories */}
          {(activeTab === "all" || activeTab === "categories") &&
            (results.categories.length > 0 || results.subcategories.length > 0) && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-neutral-100 pb-2">
                  <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                    <span>📁</span> Categories & Subcategories
                    <span className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-600">
                      {results.categories.length + results.subcategories.length}
                    </span>
                  </h2>
                  <button
                    onClick={() => navigate(`/admin/category`)}
                    className="text-xs font-semibold text-[#236B34] hover:underline"
                  >
                    View Categories →
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {results.categories.map((cat: AdminSearchCategory) => (
                    <div
                      key={cat._id}
                      onClick={() => navigate(`/admin/category`)}
                      className="p-3 border border-neutral-200 rounded-xl hover:border-[#236B34] hover:bg-neutral-50/60 transition-all flex items-center gap-2.5 cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center border border-neutral-200 flex-shrink-0">
                        {cat.image ? (
                          <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>📁</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-900 truncate">{cat.name}</p>
                        <span className="text-[11px] text-neutral-500">Category</span>
                      </div>
                    </div>
                  ))}
                  {results.subcategories.map((sub: AdminSearchSubCategory) => (
                    <div
                      key={sub._id}
                      onClick={() => navigate(`/admin/subcategory`)}
                      className="p-3 border border-neutral-200 rounded-xl hover:border-[#236B34] hover:bg-neutral-50/60 transition-all flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className="text-base flex-shrink-0">📂</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-900 truncate">
                          {sub.name || sub.subcategoryName}
                        </p>
                        <span className="text-[11px] text-neutral-500 truncate block">
                          Under: {sub.category?.name || "Category"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

