import { CreateProductPayload } from "../../../modules/shared/product-form/types/productForm.types";
import api from "../config";

export type { CreateProductPayload };

import { apiCache } from "../../../utils/apiCache";

export const notifyProductSync = (id?: string, data?: any) => {
  apiCache.invalidatePattern(/product/);
  apiCache.invalidatePattern(/home-content/);
  apiCache.invalidatePattern(/search/);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("productUpdated", { detail: { id, data } }));
    try {
      const bc = new BroadcastChannel("product_updates");
      bc.postMessage({ type: "PRODUCT_UPDATED", id, data });
      bc.close();
    } catch {
      // ignore
    }
  }
};

export const createProductAdmin = async (data: CreateProductPayload) => {
  const response = await api.post("/admin/products", {
    ...data,
    variations: data.variants,
  });
  notifyProductSync(undefined, data);
  return response.data;
};

export const updateProductAdmin = async (id: string, data: Partial<CreateProductPayload>) => {
  const response = await api.put(`/admin/products/${id}`, {
    ...data,
    variations: data.variants,
  });
  notifyProductSync(id, data);
  return response.data;
};

export const createProductSeller = async (data: CreateProductPayload) => {
  const response = await api.post("/products", {
    ...data,
    variations: data.variants,
  });
  notifyProductSync(undefined, data);
  return response.data;
};

export const updateProductSeller = async (id: string, data: Partial<CreateProductPayload>) => {
  const response = await api.put(`/products/${id}`, {
    ...data,
    variations: data.variants,
  });
  notifyProductSync(id, data);
  return response.data;
};

export const getProductAdmin = async (id: string) => {
  const response = await api.get(`/admin/products/${id}`);
  return response.data;
};

export const getProductSeller = async (id: string) => {
  const response = await api.get(`/products/${id}`);
  return response.data;
};
