import api from './config';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Order {
  id: string;
  orderId: string;
  deliveryDate: string;
  orderDate: string;
  status: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  deliveryBoyName?: string;
}

export interface ReportOrder {
  _id: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  stock?: number;
  taxAmount?: number;
  price?: number;
}

export interface OrderItem {
  srNo: string;
  product: string;
  soldBy: string;
  unit: string;
  price: number;
  tax: number;
  taxPercent: number;
  qty: number;
  subtotal: number;
  warrantyType?: string;
  warrantyDuration?: string;
}

export interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
}

export interface OrderDetail {
  id: string;
  /** Order number shown in every app; the rider scans its barcode at pickup */
  orderNumber: string;
  invoiceNumber: string;
  orderDate: string;
  deliveryDate: string;
  timeSlot: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryBoyName: string;
  deliveryBoyPhone: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: DeliveryAddress;
  /** This store's part of the flow; null for POS orders */
  sellerProgress?: SellerOrderProgress | null;
  pickupVerifiedAt?: string | null;
  /** The store's own details for the invoice header */
  store?: StoreDetails | null;
}

export interface SellerOrderProgress {
  acceptedAt: string | null;
  readyAt: string | null;
  totalStores: number;
  storesAccepted: number;
  storesReady: number;
}

export interface StoreDetails {
  storeName?: string;
  sellerName?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  taxName?: string;
  taxNumber?: string;
  fssaiLicNo?: string;
  logo?: string;
}

/** Store actions: delivery itself is done by the delivery partner */
export interface UpdateOrderStatusData {
  status: 'Accepted' | 'Ready for pickup' | 'Rejected' | 'Cancelled';
  reason?: string;
}

export interface GetOrdersParams {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Get orders with filters
 */
export const getOrders = async (params?: GetOrdersParams): Promise<ApiResponse<Order[]>> => {
  const response = await api.get<ApiResponse<Order[]>>('/orders', { params });
  return response.data;
};

/**
 * Get order by ID
 */
export const getOrderById = async (id: string): Promise<ApiResponse<OrderDetail>> => {
  const response = await api.get<ApiResponse<OrderDetail>>(`/orders/${id}`);
  return response.data;
};

/**
 * Update order status
 */
export const updateOrderStatus = async (
  id: string,
  data: UpdateOrderStatusData
): Promise<ApiResponse<{ id: string; status: string; sellerProgress?: SellerOrderProgress | null }>> => {
  const response = await api.patch<ApiResponse<{ id: string; status: string; sellerProgress?: SellerOrderProgress | null }>>(`/orders/${id}/status`, data);
  return response.data;
};

/**
 * Create POS Order
 */
export const createPOSOrder = async (data: any): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>('/seller/pos/orders', data);
  return response.data;
};

/**
 * Initiate Online POS Order
 */
export const initiatePOSOnlineOrder = async (data: any): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>('/seller/pos/orders/online', data);
  return response.data;
};

/**
 * Verify POS Payment
 */
export const verifyPOSPayment = async (data: any): Promise<ApiResponse<any>> => {
  const response = await api.post<ApiResponse<any>>('/seller/pos/orders/verify', data);
  return response.data;
};

/**
 * Get POS Report
 */
export const getPOSReport = async (params: any): Promise<ApiResponse<any>> => {
  const response = await api.get<ApiResponse<any>>('/seller/pos/report', { params });
  return response.data;
};

/**
 * Get POS Stock Ledger
 */
export const getPOSStockLedger = async (params: any): Promise<ApiResponse<any>> => {
  const response = await api.get<ApiResponse<any>>('/seller/pos/stock-ledger', { params });
  return response.data;
};

/**
 * Update Stock Ledger Entry
 */
export const updateStockLedgerEntry = async (id: string, data: any): Promise<ApiResponse<any>> => {
  const response = await api.put<ApiResponse<any>>(`/seller/pos/stock-ledger/${id}`, data);
  return response.data;
};

/**
 * Get online orders (excluding POS) for seller
 */
export const getOnlineOrders = async (
  params?: any
): Promise<ApiResponse<ReportOrder[]>> => {
  const response = await api.get<ApiResponse<ReportOrder[]>>("/seller/orders/online", {
    params,
  });
  return response.data;
};

/**
 * Get POS orders for invoice report for seller
 */
export const getSellerPOSOrders = async (
  params?: any
): Promise<ApiResponse<ReportOrder[]>> => {
  const response = await api.get<ApiResponse<ReportOrder[]>>("/seller/orders/pos-report", {
    params,
  });
  return response.data;
};

/**
 * Get Seller Order by ID
 */
export const getSellerOrderById = async (id: string): Promise<ApiResponse<any>> => {
  const response = await api.get<ApiResponse<any>>(`/seller/orders/pos/${id}`);
  return response.data;
};

/**
 * Delete Seller Order (Online/Non-POS) and Restore Stock
 */
export const deleteSellerOrder = async (id: string): Promise<ApiResponse<any>> => {
  const response = await api.delete<ApiResponse<any>>(`/orders/${id}`);
  return response.data;
};

/**
 * Delete Seller POS Order and Restore Stock
 */
export const deleteSellerPOSOrder = async (id: string): Promise<ApiResponse<any>> => {
  const response = await api.delete<ApiResponse<any>>(`/seller/orders/pos/${id}`);
  return response.data;
};
