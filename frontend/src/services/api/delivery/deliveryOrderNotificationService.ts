import api from '../config';

export interface OrderNotificationData {
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: {
        address: string;
        city: string;
        state?: string;
        pincode: string;
    };
    total: number;
    subtotal: number;
    shipping: number;
    createdAt: string;
}

export interface AcceptOrderResponse {
    success: boolean;
    message: string;
}

export interface RejectOrderResponse {
    success: boolean;
    message: string;
    allRejected: boolean;
}

/**
 * Accept an offered order. Uses HTTP, so it works whether or not the live socket is connected
 * (the backend has no socket server on serverless hosting).
 */
export const acceptOrder = async (orderId: string): Promise<AcceptOrderResponse> => {
    try {
        const response = await api.post(`/delivery/orders/${orderId}/accept`);
        return response.data;
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || error?.message || 'Could not accept the order' };
    }
};

/** Decline an offered order (HTTP). */
export const rejectOrder = async (orderId: string): Promise<RejectOrderResponse> => {
    try {
        const response = await api.post(`/delivery/orders/${orderId}/reject`);
        return { allRejected: false, ...response.data };
    } catch (error: any) {
        return { success: false, allRejected: false, message: error?.response?.data?.message || error?.message || 'Could not decline the order' };
    }
};
