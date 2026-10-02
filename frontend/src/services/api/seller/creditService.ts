import api from '../config';

const BASE_PATH = '/seller/pos/credit';

// Types
export interface CreditCustomer {
    _id: string;
    name: string;
    phone: string;
    creditBalance: number;
}

export interface CreditTransaction {
    _id: string;
    type: 'Order' | 'Payment' | 'Manual' | 'Return';
    amount: number; // Positive if balance increased (Debt), Negative if decreased (Payment)
    balanceAfter: number;
    description: string;
    referenceId?: string;
    date: Date;
    createdAt: Date;
}

export interface CustomerCreditHistory {
    customer: CreditCustomer;
    transactions: CreditTransaction[];
}

// APIs
export const getCreditCustomers = async (search?: string, hasDue?: boolean, hasAdvance?: boolean) => {
    const response = await api.get(`${BASE_PATH}/customers`, {
        params: { search, hasDue, hasAdvance }
    });
    return response.data;
};

export const getCustomerHistory = async (customerId: string) => {
    const response = await api.get(`${BASE_PATH}/history/${customerId}`);
    return response.data;
};

export const addCredit = async (data: { customerId: string, amount: number, description: string, date?: string }) => {
    const response = await api.post(`${BASE_PATH}/add`, data);
    return response.data;
};

export const acceptPayment = async (data: { customerId: string, amount: number, description: string, date?: string }) => {
    const response = await api.post(`${BASE_PATH}/payment`, data);
    return response.data;
};

export const initiateCreditPayment = async (data: { customerId: string, amount: number, gateway: string }) => {
    const response = await api.post(`${BASE_PATH}/payment/initiate`, data);
    return response.data;
};

export const verifyCreditPayment = async (data: { customerId: string, amount: number, paymentId: string, gateway: string }) => {
    const response = await api.post(`${BASE_PATH}/payment/verify`, data);
    return response.data;
};
