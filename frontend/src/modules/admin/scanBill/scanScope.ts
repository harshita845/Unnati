import { getPOSProducts, getCategories as getAdminCategories } from '../../../services/api/admin/adminProductService';
import { getAllSuppliers as getAdminSuppliers } from '../../../services/api/admin/supplierService';
import { getAllCustomers } from '../../../services/api/admin/adminCustomerService';
import { getProducts as getSellerProducts } from '../../../services/api/seller/sellerProductService';
import { getAllSuppliers as getSellerSuppliers } from '../../../services/api/seller/supplierService';
import { getCategories as getSellerCategories } from '../../../services/api/categoryService';

/**
 * Scan Bill runs in two places: Admin POS (the admin's own store) and the seller panel (premium
 * plans). The page and its parts are shared; this says which API and lookups they use. The server
 * scopes everything to the login as well, so this only picks the right endpoints and links.
 */
export interface ScanScope {
  kind: 'admin' | 'seller';
  apiBase: string;
  searchProducts: (search: string) => Promise<any[]>;
  searchSuppliers: (search: string) => Promise<any[]>;
  /** Sales bills (POS orders for app customers) are admin-only */
  searchCustomers: ((search: string) => Promise<any[]>) | null;
  loadCategories: () => Promise<any[]>;
  links: { purchaseReport: string; supplier: (id: string) => string; posReport: string };
}

export const adminScanScope: ScanScope = {
  kind: 'admin',
  apiBase: '/admin/pos/ocr',
  searchProducts: async (search) => ((await getPOSProducts({ search } as any)).data || []) as any[],
  searchSuppliers: async (search) => ((await getAdminSuppliers(search)) as any)?.data || [],
  searchCustomers: async (search) => ((await getAllCustomers({ search, limit: 8 } as any)) as any)?.data || [],
  loadCategories: async () => ((await getAdminCategories({ status: 'Active' } as any)) as any)?.data || [],
  links: {
    purchaseReport: '/admin/purchase/report',
    supplier: (id) => `/admin/pos/suppliers/${id}`,
    posReport: '/admin/pos/report',
  },
};

export const sellerScanScope: ScanScope = {
  kind: 'seller',
  apiBase: '/seller/pos/ocr',
  searchProducts: async (search) => ((await getSellerProducts({ search } as any)).data || []) as any[],
  searchSuppliers: async (search) => ((await getSellerSuppliers(search)) as any)?.data || [],
  searchCustomers: null,
  loadCategories: async () => ((await getSellerCategories()) as any)?.data || [],
  links: {
    purchaseReport: '/seller/purchase/report',
    supplier: (id) => `/seller/pos/suppliers/${id}`,
    posReport: '/seller/pos/report',
  },
};

let current: ScanScope = adminScanScope;

/** Set by the page before it renders its parts (one Scan Bill page is open at a time). */
export const setScanScope = (scope: ScanScope) => {
  current = scope;
};

export const scanScope = () => current;
