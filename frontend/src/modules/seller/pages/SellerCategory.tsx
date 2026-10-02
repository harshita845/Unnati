import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getCategories, Category } from '../../../services/api/categoryService';
import { getSellerProfile } from '../../../services/api/auth/sellerAuthService';
import {
    getSellerOwnCategories as apiGetSellerOwnCategories,
    createSellerOwnCategory as apiCreateSellerOwnCategory,
    updateSellerOwnCategory as apiUpdateSellerOwnCategory,
    deleteSellerOwnCategory as apiDeleteSellerOwnCategory,
} from '../../../services/api/seller/sellerPurchaseService';
import ThemedDropdown from '../components/ThemedDropdown';
import SellerCategoryForm from './SellerCategoryForm';
import { useToast } from '../../../context/ToastContext';

const DUMMY_CATEGORIES: Category[] = [
  {
    _id: "cat_101",
    name: "Seeds & Plantation",
    image: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=160&q=80",
    totalSubcategory: 4,
    isBestseller: true,
    hasWarning: false,
  },
  {
    _id: "cat_102",
    name: "Fertilizers & Soil Nutrients",
    image: "https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?auto=format&fit=crop&w=160&q=80",
    totalSubcategory: 5,
    isBestseller: true,
    hasWarning: false,
  },
  {
    _id: "cat_103",
    name: "Crop Protection & Pesticides",
    image: "https://images.unsplash.com/photo-1592417817098-8f3d69106093?auto=format&fit=crop&w=160&q=80",
    totalSubcategory: 3,
    isBestseller: false,
    hasWarning: false,
  },
  {
    _id: "cat_104",
    name: "Drip & Micro Irrigation",
    image: "https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=160&q=80",
    totalSubcategory: 4,
    isBestseller: false,
    hasWarning: false,
  },
  {
    _id: "cat_105",
    name: "Farm Machinery & Sprayers",
    image: "https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=160&q=80",
    totalSubcategory: 3,
    isBestseller: false,
    hasWarning: false,
  },
  {
    _id: "cat_106",
    name: "Organic Bio-Inputs & Compost",
    image: "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=160&q=80",
    totalSubcategory: 2,
    isBestseller: false,
    hasWarning: false,
  },
  {
    _id: "cat_107",
    name: "Gardening & Nursery Tools",
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=160&q=80",
    totalSubcategory: 3,
    isBestseller: false,
    hasWarning: false,
  },
  {
    _id: "cat_108",
    name: "Animal Feed & Veterinary",
    image: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=160&q=80",
    totalSubcategory: 2,
    isBestseller: false,
    hasWarning: false,
  },
];

export default function SellerCategory() {
    const { showToast } = useToast();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [canCreateCategories, setCanCreateCategories] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [ownCategories, setOwnCategories] = useState<Category[]>([]);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [subcategoryParent, setSubcategoryParent] = useState<Category | null>(null);
    const [navigationStack, setNavigationStack] = useState<Category[]>([]);

    // Initial Data Loading
    useEffect(() => {
        const loadSellerPermission = async () => {
            try {
                const res = await getSellerProfile();
                if (res?.success && res?.data) {
                    setCanCreateCategories(res.data.canCreateCategories !== false);
                }
            } catch {
                setCanCreateCategories(true);
            }
        };
        void loadSellerPermission();

        // Load Own Categories
        const loadOwnCategories = async () => {
            try {
                const res = await apiGetSellerOwnCategories();
                if (res.success && Array.isArray(res.data) && res.data.length > 0) {
                    setOwnCategories(res.data as any);
                    localStorage.setItem('seller_own_categories', JSON.stringify(res.data));
                    return;
                }
            } catch {
                // fallback to local cache
            }

            const savedCategories = localStorage.getItem('seller_own_categories');
            if (savedCategories) {
                try {
                    const parsed = JSON.parse(savedCategories);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setOwnCategories(parsed);
                    }
                } catch {}
            }
        };
        void loadOwnCategories();
    }, []);

    // Fetch Admin Categories with Fallback
    useEffect(() => {
        const fetchCategories = async () => {
            setLoading(true);
            try {
                const params: any = {};
                if (searchTerm) {
                    params.search = searchTerm;
                }

                const response = await getCategories(params);
                if (response.success && response.data && response.data.length > 0) {
                    setCategories(response.data);
                } else {
                    setCategories(DUMMY_CATEGORIES);
                }
            } catch (err: any) {
                console.warn('Could not load live categories, using mock dataset:', err);
                setCategories(DUMMY_CATEGORIES);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, [searchTerm]);

    const normalizeParentId = (cat: any): string | null => {
        const raw = cat?.parentId;
        if (!raw) return null;
        if (typeof raw === 'string') return raw;
        if (typeof raw === 'object' && raw?._id) return String(raw._id);
        return null;
    };

    const sellerChildrenByParentId = useMemo(() => {
        const map = new Map<string, any[]>();
        ownCategories.forEach((c: any) => {
            const parentId = normalizeParentId(c);
            if (!parentId) return;
            const existing = map.get(parentId) || [];
            existing.push(c);
            map.set(parentId, existing);
        });
        return map;
    }, [ownCategories]);

    const isInSubcategoryView = navigationStack.length > 0;
    const activeParent = isInSubcategoryView ? navigationStack[navigationStack.length - 1] : null;
    const activeParentId = activeParent?._id ? String(activeParent._id) : null;

    const sellerRootCategories = ownCategories.filter((c: any) => !normalizeParentId(c));
    const sellerActiveChildren = activeParentId
        ? (sellerChildrenByParentId.get(activeParentId) || [])
        : [];

    // Merge Categories
    const allCategories = useMemo(() => {
        if (isInSubcategoryView) {
            return sellerActiveChildren.map((c) => ({ ...c, type: 'seller' }));
        }
        return [
            ...categories.map((c) => ({ ...c, type: 'admin' })),
            ...sellerRootCategories.map((c) => ({ ...c, type: 'seller' })),
        ];
    }, [isInSubcategoryView, sellerActiveChildren, categories, sellerRootCategories]);

    const filteredCategories = useMemo(() => {
        if (!searchTerm.trim()) return allCategories;
        const q = searchTerm.toLowerCase().trim();
        return allCategories.filter((cat: any) =>
            String(cat?.name || '').toLowerCase().includes(q) ||
            String(cat?._id || '').toLowerCase().includes(q) ||
            String(cat?.slug || '').toLowerCase().includes(q)
        );
    }, [allCategories, searchTerm]);

    // Summary Statistics
    const stats = useMemo(() => {
        const totalCount = allCategories.length;
        const totalSubcats = allCategories.reduce((sum: number, c: any) => sum + (c.totalSubcategory || 0), 0);
        const myCatsCount = sellerRootCategories.length;
        return { totalCount, totalSubcats, myCatsCount };
    }, [allCategories, sellerRootCategories]);

    // Pagination
    const totalPages = Math.ceil(filteredCategories.length / rowsPerPage) || 1;
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedCategories = filteredCategories.slice(startIndex, endIndex);

    const handleSaveCategory = async (category: Category) => {
        const isEdit = !!editingCategory?._id;
        try {
            const res = isEdit
                ? await apiUpdateSellerOwnCategory(String(editingCategory?._id), category)
                : await apiCreateSellerOwnCategory(category);
            if (!res.success || !res.data) {
                showToast(res.message || 'Failed to save category', 'error');
                return;
            }
            const saved: any = res.data;

            const updatedCategories = isEdit
                ? ownCategories.map((c) => (c._id === saved._id ? saved : c))
                : [saved, ...ownCategories];
            setOwnCategories(updatedCategories);
            localStorage.setItem('seller_own_categories', JSON.stringify(updatedCategories));
            showToast(isEdit ? 'Category updated successfully!' : 'Category created successfully!', 'success');
            setEditingCategory(null);
            setIsAddModalOpen(false);
        } catch (err: any) {
            // Don't keep a local-only copy: products can't be saved against a category the server doesn't have
            showToast(err?.response?.data?.message || 'Failed to save category', 'error');
        }
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setSubcategoryParent(null);
        setIsAddModalOpen(true);
    };

    const handleAddSubcategory = (parent: Category) => {
        setEditingCategory(null);
        setSubcategoryParent(parent);
        setIsAddModalOpen(true);
    };

    const handleEnterCategory = (category: any) => {
        if (!category?._id) return;
        setSearchTerm('');
        setCurrentPage(1);
        setNavigationStack((prev) => [...prev, category]);
    };

    const handleBack = () => {
        setSearchTerm('');
        setCurrentPage(1);
        setNavigationStack((prev) => prev.slice(0, -1));
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this category?')) {
            try {
                // Categories created offline by older versions only exist in this browser
                if (!String(id).startsWith('cat_sel_')) {
                    await apiDeleteSellerOwnCategory(id);
                }
                const updatedCategories = ownCategories.filter(c => c._id !== id);
                setOwnCategories(updatedCategories);
                localStorage.setItem('seller_own_categories', JSON.stringify(updatedCategories));
                showToast('Category deleted successfully!', 'success');
            } catch (err: any) {
                showToast(err?.response?.data?.message || 'Failed to delete category', 'error');
            }
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.3, staggerChildren: 0.04 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            className="flex flex-col space-y-6 w-full pb-10"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl shadow-sm border border-neutral-200">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Category Management</h1>
                    <p className="text-sm text-neutral-500 mt-1">Browse store merchandise categories and manage product taxonomy</p>
                </div>
                <div className="flex items-center gap-2 text-sm bg-neutral-50 px-3.5 py-1.5 rounded-xl border border-neutral-200 mt-3 sm:mt-0">
                    <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium cursor-pointer hover:underline">Home</Link>
                    <span className="text-neutral-400">/</span>
                    <span className="text-neutral-700 font-medium">Category</span>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 border border-purple-100">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Categories</div>
                        <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.totalCount}</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Subcategories Linked</div>
                        <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.totalSubcats}</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Custom Seller Categories</div>
                        <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.myCatsCount}</div>
                    </div>
                </div>
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 w-full overflow-hidden">
                {/* Header Section */}
                <div className="p-5 border-b border-neutral-100 bg-neutral-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        {isInSubcategoryView && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 transition-colors shadow-2xs"
                                aria-label="Back"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 12H5"></path>
                                    <path d="M12 19l-7-7 7-7"></path>
                                </svg>
                            </button>
                        )}
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900">
                                {isInSubcategoryView ? (activeParent?.name || 'Subcategories') : 'Category List'}
                            </h2>
                            {isInSubcategoryView && (
                                <p className="text-xs text-neutral-500 mt-0.5">Viewing subcategories for {activeParent?.name}</p>
                            )}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="w-full sm:w-28">
                            <ThemedDropdown
                                options={[10, 20, 50, 100]}
                                value={rowsPerPage}
                                onChange={(val) => {
                                    setRowsPerPage(Number(val));
                                    setCurrentPage(1);
                                }}
                                placeholder="Rows"
                            />
                        </div>

                        <button
                            onClick={() => {
                                const headers = ['ID', 'Category Name', 'Total Subcategory', 'Type'];
                                const csvContent = [
                                    headers.join(','),
                                    ...filteredCategories.map(cat => [
                                        `"${cat._id}"`,
                                        `"${cat.name}"`,
                                        cat.totalSubcategory || 0,
                                        (cat as any).type || 'standard'
                                    ].join(','))
                                ].join('\n');
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', `categories_${new Date().toISOString().split('T')[0]}.csv`);
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="w-full sm:w-auto bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-2xs"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export CSV
                        </button>

                        {/* Add Category Button */}
                        {!isInSubcategoryView && (
                            <button
                                onClick={() => {
                                    setEditingCategory(null);
                                    setSubcategoryParent(null);
                                    setIsAddModalOpen(true);
                                }}
                                className="w-full sm:w-auto bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                <span>Add Category</span>
                            </button>
                        )}

                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all placeholder:text-neutral-400 shadow-2xs"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search categories..."
                            />
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center p-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary-dark)] mb-4"></div>
                        <div className="text-neutral-500 font-medium">Loading categories...</div>
                    </div>
                )}

                {/* Table View */}
                {!loading && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-neutral-50/90 border-b border-neutral-200">
                                    <th className="p-4 px-6 font-bold text-neutral-600 uppercase text-xs tracking-wider w-24">ID</th>
                                    <th className="p-4 px-6 font-bold text-neutral-600 uppercase text-xs tracking-wider">Category Name</th>
                                    <th className="p-4 px-6 font-bold text-neutral-600 uppercase text-xs tracking-wider text-center">Image</th>
                                    <th className="p-4 px-6 font-bold text-neutral-600 uppercase text-xs tracking-wider text-center">Subcategories</th>
                                    <th className="p-4 px-6 font-bold text-neutral-600 uppercase text-xs tracking-wider text-center">Type</th>
                                    <th className="p-4 px-6 font-bold text-neutral-600 uppercase text-xs tracking-wider text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white">
                                {displayedCategories.map((category, index) => {
                                    const childCount =
                                        sellerChildrenByParentId.get(String(category._id))?.length || (category.totalSubcategory ?? 0);
                                    const canOpenSubcategories = childCount > 0;

                                    return (
                                    <motion.tr
                                        key={category._id}
                                        onClick={() => {
                                            if (canOpenSubcategories) handleEnterCategory(category);
                                        }}
                                        className={`hover:bg-neutral-50/80 transition-colors group text-sm text-neutral-700 ${
                                            canOpenSubcategories ? 'cursor-pointer' : ''
                                        }`}
                                        variants={itemVariants}
                                        custom={index}
                                    >
                                        <td className="p-4 px-6 align-middle">
                                            <span className="font-mono text-xs font-semibold text-[var(--primary-darker)] bg-[var(--primary-alpha-10)] px-2.5 py-1 rounded-lg border border-[var(--primary-alpha-20)]">
                                                {category._id.length > 8 ? '#' + category._id.slice(-6) : '#' + category._id}
                                            </span>
                                        </td>

                                        <td className="p-4 px-6 align-middle font-bold text-neutral-900">
                                            <span className={canOpenSubcategories ? 'hover:underline decoration-[var(--primary-color)] underline-offset-4' : ''}>
                                                {category.name}
                                            </span>
                                        </td>

                                        <td className="p-4 px-6 align-middle text-center">
                                            <div className="w-14 h-12 bg-neutral-50 border border-neutral-200 rounded-xl p-1 flex items-center justify-center mx-auto shadow-2xs group-hover:scale-105 transition-transform overflow-hidden">
                                                <img
                                                    src={category.image || 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=160&q=80'}
                                                    alt={category.name}
                                                    className="max-w-full max-h-full object-cover rounded-lg"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=160&q=80';
                                                    }}
                                                />
                                            </div>
                                        </td>

                                        <td className="p-4 px-6 align-middle text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                                                {childCount} {childCount === 1 ? 'Subcategory' : 'Subcategories'}
                                            </span>
                                        </td>

                                        <td className="p-4 px-6 align-middle text-center">
                                            {(category as any).type === 'seller' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    My Category
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                                    Store Catalog
                                                </span>
                                            )}
                                        </td>

                                        <td className="p-4 px-6 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => handleAddSubcategory(category)}
                                                    className="p-1.5 text-neutral-600 hover:text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)] rounded-lg transition-colors"
                                                    title="Add Subcategory"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(category)}
                                                    className="p-1.5 text-neutral-600 hover:text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)] rounded-lg transition-colors"
                                                    title="Edit Category"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                                {(category as any).type === 'seller' && (
                                                    <button
                                                        onClick={() => handleDelete(category._id)}
                                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Delete Category"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                    );
                                })}

                                {filteredCategories.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-14 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-3">
                                                    <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                                </div>
                                                <h3 className="text-lg font-bold text-neutral-800">No categories found</h3>
                                                <p className="text-neutral-500 text-sm mt-1">Try adjusting your search criteria</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Footer */}
                {filteredCategories.length > 0 && (
                    <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
                        <div>
                            Showing <span className="font-semibold text-neutral-900">{startIndex + 1}</span> to <span className="font-semibold text-neutral-900">{Math.min(endIndex, filteredCategories.length)}</span> of <span className="font-semibold text-neutral-900">{filteredCategories.length}</span> categories
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white disabled:opacity-50 hover:bg-neutral-50 transition-colors shadow-2xs"
                            >
                                Previous
                            </button>
                            <span className="text-xs font-semibold px-2 text-neutral-700">Page {currentPage} of {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white disabled:opacity-50 hover:bg-neutral-50 transition-colors shadow-2xs"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="text-center py-4">
                <p className="text-sm text-neutral-500">
                    Copyright © 2025. Developed By <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium hover:underline">Ecommerce</Link>
                </p>
            </footer>

            {/* Category Form Modal */}
            <SellerCategoryForm
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveCategory}
                editingCategory={editingCategory}
                parentCategory={subcategoryParent}
                mode={subcategoryParent ? "create-subcategory" : editingCategory ? "edit" : "create"}
                ownCategories={ownCategories}
            />
        </motion.div>
    );
}
