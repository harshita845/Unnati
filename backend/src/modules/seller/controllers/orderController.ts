import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Seller from "../../../models/Seller";
import { asyncHandler } from "../../../utils/asyncHandler";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import { OrderPlacementError } from "../../../services/orderPlacementService";
import {
  getSellerOrderProgress,
  sellerAcceptOrder,
  sellerCancelOrder,
  sellerMarkReady,
  sellerRejectOrder,
} from "../../../services/orderFlowService";
import { notifyDeliveryBoysOfNewOrder } from "../../../services/orderNotificationService";

// Dates are shown in Indian time, DD/MM/YYYY (en-US formatting showed 2 Oct as "10/02")
const formatDateIN = (date?: Date | null) =>
  date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
// YYYY-MM-DD in Indian time (toISOString uses UTC and can show the previous day)
const isoDateIN = (date?: Date | null) =>
  date ? new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';


/**
 * Get seller's orders with filters, sorting, and pagination
 */
export const getOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      dateFrom,
      dateTo,
      status,
      search,
      page = "1",
      limit = "10",
      sortBy = "orderDate",
      sortOrder = "desc",
    } = req.query;

    // Find all order IDs that contain items from this seller
    const orderItems = await OrderItem.find({ seller: sellerId }).distinct("order");

    // Build query - filter by orders containing this seller's items OR POS orders created by this seller
    const query: any = {
      $or: [
        { _id: { $in: orderItems } },
        { adminNotes: { $regex: `POS Order - Seller: ${sellerId}`, $options: "i" } },
      ],
    };

    // Date range filter
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) {
        query.orderDate.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.orderDate.$lte = new Date(dateTo as string);
      }
    }

    // Status filter
    if (status && status !== 'All Status') {
      // Map frontend status to backend status
      const statusMapping: Record<string, string> = {
        'Pending': 'Pending',
        'Accepted': 'Processed',
        'On the way': 'Out for Delivery',
        'Delivered': 'Delivered',
        'Cancelled': 'Cancelled',
        'Rejected': 'Rejected',
        'Out For Delivery': 'Out for Delivery',
        'Out for Delivery': 'Out for Delivery',
        'Processed': 'Processed',
        'Shipped': 'Shipped',
        'Received': 'Received',
      };
      const targetStatus = statusMapping[status as string] || status;
      if (targetStatus === 'Out for Delivery' || status === 'Out For Delivery') {
        query.status = { $in: ['Out for Delivery', 'Out For Delivery', 'On the way'] };
      } else {
        query.status = targetStatus;
      }
    }

    // Search filter — wrap in $and to avoid overwriting the top-level $or
    if (search) {
      const searchOr = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
      ];
      query.$and = [...(query.$and || []), { $or: searchOr }];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;
    if (sortBy !== "_id") sort._id = sortOrder === "asc" ? 1 : -1;

    // Get orders with populated customer and delivery info
    const orders = await Order.find(query)
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    // Format response for frontend
    const formattedOrders = orders.map(order => ({
      id: order._id,
      orderId: order.orderNumber,
      // Actual delivery date once delivered, otherwise the expected date if one was set
      deliveryDate: formatDateIN(order.deliveredAt || order.estimatedDeliveryDate),
      orderDate: formatDateIN(order.orderDate || order.createdAt),
      status: order.status === 'On the way' ? 'On the way' : order.status,
      amount: order.total,
      customerName: (order.customer as any)?.name || order.customerName || '',
      customerPhone: (order.customer as any)?.phone || order.customerPhone || '',
      deliveryBoyName: (order.deliveryBoy as any)?.name || '',
    }));

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: formattedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get order by ID with populated order items, customer, and delivery info
 */
 export const getOrderById = asyncHandler(
   async (req: Request, res: Response) => {
     const sellerId = (req as any).user.userId;
     const { id } = req.params;

     // 1. Get order with populated data (support both ObjectId and orderNumber string)
     let order: any = null;
     if (mongoose.Types.ObjectId.isValid(id)) {
       order = await Order.findById(id)
         .populate("customer", "name email phone")
         .populate("deliveryBoy", "name mobile email");
     }

     if (!order) {
       const cleanId = id.startsWith("#") ? id.slice(1) : id;
       order = await Order.findOne({
         $or: [
           { orderNumber: id },
           { orderNumber: cleanId },
           { orderNumber: `ORD${cleanId}` },
           { orderNumber: `#${cleanId}` },
         ],
       })
         .populate("customer", "name email phone")
         .populate("deliveryBoy", "name mobile email");
     }

     if (!order) {
       return res.status(404).json({
         success: false,
         message: "Order not found",
       });
     }

     const orderMongoId = order._id;

     // 2. Access check: Either seller has items in it, OR it's their POS order
     const isTheirPOSOrder = order.adminNotes?.includes(`POS Order - Seller: ${sellerId}`);

     // Get this seller's specific items (important for online orders)
     const sellerItems = await OrderItem.find({ order: orderMongoId, seller: sellerId })
       .populate("seller", "storeName")
       .populate("product");

     if (!isTheirPOSOrder && (!sellerItems || sellerItems.length === 0)) {
       return res.status(403).json({
         success: false,
         message: "Access denied or order not found",
       });
     }

     // 3. For POS orders created by this seller, return ALL items.
     // For online orders, return only items belonging to this seller.
     let orderItems;
     if (isTheirPOSOrder) {
         orderItems = await OrderItem.find({ order: orderMongoId })
            .populate("seller", "storeName")
            .populate("product");
     } else {
         orderItems = sellerItems;
     }

    // Format order items for frontend
    // Format order items for frontend
    const formattedItems = orderItems.map(item => {
      let unit = item.variation || 'N/A';
      let variationMatched = false;
      let resolvedVariationId = '';

      // Try to resolve variation value from product if it exists
      // item.product is populated now
      const product = item.product as any;
      if (product && product.variations && Array.isArray(product.variations)) {
        // 1. Try to match by ID or Value if validation is present
        if (item.variation) {
            const variationById = product.variations.find((v: any) => v._id.toString() === item.variation);
            if (variationById) {
              unit = variationById.value;
              variationMatched = true;
              resolvedVariationId = variationById._id.toString();
            } else {
                const variationByValue = product.variations.find((v: any) => v.value === item.variation);
                if (variationByValue) {
                    unit = variationByValue.value;
                    variationMatched = true;
                    resolvedVariationId = variationByValue._id.toString();
                }
            }
        }

        // 2. Fallback: If not matched yet (even if we have a value like '250'), try to recover
        if (!variationMatched) {
             const variationByPrice = product.variations.find((v: any) => v.price === item.unitPrice || v.discPrice === item.unitPrice);
             if (variationByPrice) {
                 unit = variationByPrice.value;
                 variationMatched = true;
                 resolvedVariationId = variationByPrice._id.toString();
             } else if (product.variations.length === 1) {
                 // 3. Last Resort: If there is only one variation, assume it's that one
                 unit = product.variations[0].value;
                 resolvedVariationId = product.variations[0]._id.toString();
             }
        }
      }

      const qty = item.quantity || 1;
      const subtotal = item.total || 0;
      const computedUnitPrice = (item.unitPrice > 0 && Math.abs(item.unitPrice * qty - subtotal) < 1)
        ? item.unitPrice
        : (qty > 0 && subtotal > 0 ? subtotal / qty : item.unitPrice || 0);

      return {
        _id: item._id,
        srNo: item._id.toString().slice(-4),
        product: item.productName || 'Unknown Product',
        productId: product?._id?.toString?.() || item.product?.toString?.() || '',
        productName: item.productName || 'Unknown Product',
        productImage: item.productImage || product?.mainImage || '',
        soldBy: (item.seller as any)?.storeName || 'N/A',
        unit: unit,
        price: computedUnitPrice,
        unitPrice: computedUnitPrice,
        tax: 0,
        taxPercent: 0,
        qty: item.quantity || 0,
        quantity: item.quantity || 0,
        subtotal: subtotal || computedUnitPrice * qty,
        sku: item.sku || '',
        variation: item.variation || '',
        variationId: resolvedVariationId,
      };
    });

    // Format order data for frontend
    const orderDetail = {
      id: order._id,
      _id: order._id,
      orderNumber: order.orderNumber || order.invoiceNumber || 'N/A',
      invoiceNumber: order.invoiceNumber || order.orderNumber || 'N/A',
      orderDate: isoDateIN(order.orderDate || order.createdAt),
      deliveryDate: isoDateIN(order.deliveredAt || order.estimatedDeliveryDate),
      timeSlot: order.timeSlot || 'N/A',
      status: order.status === 'On the way' ? 'Out For Delivery' : order.status,
      customer: order.customer,
      customerName: (order.customer as any)?.name || order.customerName || '',
      customerEmail: (order.customer as any)?.email || order.customerEmail || '',
      customerPhone: (order.customer as any)?.phone || order.customerPhone || '',
      deliveryBoyName: (order.deliveryBoy as any)?.name || '',
      deliveryBoyPhone: (order.deliveryBoy as any)?.mobile || '',
      items: formattedItems,
      subtotal: order.subtotal || 0,
      tax: order.tax || 0,
      grandTotal: order.total || 0,
      paymentMethod: order.paymentMethod || 'N/A',
      paymentStatus: order.paymentStatus || 'Pending',
      deliveryAddress: order.deliveryAddress || {},
      // This store's part of the flow (accept -> ready); other stores in the same order are counted
      sellerProgress: isTheirPOSOrder ? null : await getSellerOrderProgress(order, sellerId),
      // The invoice header shows the store's own details
      store: await Seller.findById(sellerId).select("storeName sellerName mobile email address city taxName taxNumber fssaiLicNo logo").lean(),
      pickupVerifiedAt: order.pickupVerifiedAt || null,
    };

    return res.status(200).json({
      success: true,
      message: "Order details fetched successfully",
      data: orderDetail,
    });
  }
);

// Seller actions. Delivery itself (On the way / Delivered) belongs to the delivery partner,
// who must collect the package with the pickup code and finish with the customer's OTP.
const SELLER_ACTIONS: Record<string, "accept" | "ready" | "reject" | "cancel"> = {
  'Accepted': 'accept',
  'Accept': 'accept',
  'Processed': 'accept',
  'Ready for pickup': 'ready',
  'Ready': 'ready',
  'Rejected': 'reject',
  'Reject': 'reject',
  'Cancelled': 'cancel',
};

/**
 * Update order status from the store: Accept, Ready for pickup, Reject or Cancel.
 */
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const { status, reason } = req.body;

    const action = SELLER_ACTIONS[status];
    if (!action) {
      const riderOwned = ['On the way', 'Out for Delivery', 'Out For Delivery', 'Picked up', 'Delivered'].includes(status);
      return res.status(400).json({
        success: false,
        message: riderOwned
          ? "The delivery partner updates this after collecting the package with the pickup code."
          : "Invalid status. A store can: Accept, mark Ready for pickup, Reject or Cancel.",
      });
    }

    let updatedOrder: any;
    let dispatchNow = false;
    let progress: any = null;
    try {
      if (action === 'accept') {
        ({ order: updatedOrder, progress } = await sellerAcceptOrder(id, sellerId));
      } else if (action === 'ready') {
        ({ order: updatedOrder, dispatchNow, progress } = await sellerMarkReady(id, sellerId));
      } else if (action === 'reject') {
        updatedOrder = await sellerRejectOrder(id, sellerId, reason);
      } else {
        updatedOrder = await sellerCancelOrder(id, sellerId, reason);
      }
    } catch (error: any) {
      if (error instanceof OrderPlacementError) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      throw error;
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`order-${id}`).emit('order-status-updated', { orderId: id, status: updatedOrder.status });
      notifySellersOfOrderUpdate(io, updatedOrder, action === 'cancel' || action === 'reject' ? 'ORDER_CANCELLED' : 'STATUS_UPDATE');
      // Every store has packed and marked ready: only now are delivery partners offered the order
      if (dispatchNow) {
        notifyDeliveryBoysOfNewOrder(io, updatedOrder.toObject ? updatedOrder.toObject() : updatedOrder).catch((err: any) =>
          console.error('Error dispatching accepted order to riders:', err)
        );
      }
    }

    return res.status(200).json({
      success: true,
      message:
        action === 'accept' && updatedOrder.status === 'Received'
          ? "Accepted. Waiting for the other store(s) in this order to accept."
          : "Order status updated successfully",
      data: {
        id: updatedOrder._id,
        status: updatedOrder.status,
        sellerProgress: progress,
      },
    });
  }
);

/**
 * Get online orders (excluding POS) for seller
 */
export const getOnlineOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      dateFrom,
      dateTo,
      status,
      search,
      page = "1",
      limit = "10",
      sortBy = "orderDate",
      sortOrder = "desc",
    } = req.query;

    // Find all order IDs that contain items from this seller
    const orderItems = await OrderItem.find({ seller: sellerId }).distinct("order");

    // Build query - filter by orders containing this seller's items
    const query: any = {
      _id: { $in: orderItems },
      // Exclude POS orders
      adminNotes: { $not: { $regex: `POS Order - Seller:`, $options: 'i' } }
    };

    // Date range filter
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) {
        query.orderDate.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.orderDate.$lte = new Date(dateTo as string);
      }
    }

    // Status filter
    if (status && status !== 'All Status') {
      const statusMapping: Record<string, string> = {
        'Pending': 'Pending',
        'Accepted': 'Processed',
        'On the way': 'Out for Delivery',
        'Delivered': 'Delivered',
        'Cancelled': 'Cancelled',
        'Rejected': 'Rejected',
      };
      query.status = statusMapping[status as string] || status;
    }

    // Search filter
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
       // { 'deliveryAddress.phone': { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;
    if (sortBy !== "_id") sort._id = sortOrder === "asc" ? 1 : -1;

    // Get orders
    const orders = await Order.find(query)
      .populate("customer", "name email phone")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Order.countDocuments(query);

    // Format for report
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      customerName: order.customerName || (order.customer as any)?.name || 'Guest',
      customerPhone: order.customerPhone || (order.customer as any)?.phone || '',
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status
    }));

    return res.status(200).json({
      success: true,
      data: formattedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get POS orders for seller report
 */
export const getSellerPOSOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      dateFrom,
      dateTo,
      paymentMethod,
      search,
      page = "1",
      limit = "10",
      sortBy = "orderDate",
      sortOrder = "desc",
    } = req.query;

    const query: any = {
      // Filter strictly by POS note for this seller
      adminNotes: { $regex: `POS Order - Seller: ${sellerId}`, $options: 'i' }
    };

    // Date range filter
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) {
        query.orderDate.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.orderDate.$lte = new Date(dateTo as string);
      }
    }

    // Payment Method Filter
    if (paymentMethod && paymentMethod !== 'All Methods') {
      query.paymentMethod = paymentMethod;
    }

    // Search filter
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    if (sortBy) {
        sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;
        if (sortBy !== "_id") sort._id = sortOrder === "asc" ? 1 : -1;
    } else {
        sort.orderDate = -1;
    }

    // Get orders
    const orders = await Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Order.countDocuments(query);

    // Format Data
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      total: order.total,
      paymentMethod: order.paymentMethod,
      status: order.status // Usually 'Delivered' for POS
    }));

    return res.status(200).json({
      success: true,
      data: formattedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);
