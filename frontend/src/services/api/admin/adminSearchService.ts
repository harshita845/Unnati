import api from '../config';

export interface AdminSearchOrder {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  status: string;
  paymentStatus?: string;
  createdAt: string;
}

export interface AdminSearchProduct {
  _id: string;
  productName: string;
  sku: string;
  price: number;
  image: string;
  stock: number;
  status: string;
  categoryName?: string;
}

export interface AdminSearchCustomer {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  totalOrders?: number;
  totalSpent?: number;
}

export interface AdminSearchSeller {
  _id: string;
  storeName: string;
  sellerName?: string;
  email?: string;
  mobile?: string;
  city?: string;
  status?: string;
  category?: string;
}

export interface AdminSearchCategory {
  _id: string;
  name: string;
  image?: string;
  status?: string;
}

export interface AdminSearchSubCategory {
  _id: string;
  name?: string;
  subcategoryName?: string;
  category?: { _id: string; name: string };
}

export interface GlobalSearchResult {
  orders: AdminSearchOrder[];
  products: AdminSearchProduct[];
  customers: AdminSearchCustomer[];
  sellers: AdminSearchSeller[];
  categories: AdminSearchCategory[];
  subcategories: AdminSearchSubCategory[];
}

export const adminGlobalSearch = async (query: string): Promise<GlobalSearchResult> => {
  const response = await api.get<{ success: boolean; data: GlobalSearchResult }>('/admin/global-search', {
    params: { q: query },
  });
  return response.data?.data || {
    orders: [],
    products: [],
    customers: [],
    sellers: [],
    categories: [],
    subcategories: [],
  };
};
