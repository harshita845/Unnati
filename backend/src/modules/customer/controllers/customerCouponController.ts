import { Request, Response } from "express";
import { CouponError, resolveCoupon } from "../../../services/orderPricingService";
import Coupon from "../../../models/Coupon";

// Get available coupons
export const getCoupons = async (_req: Request, res: Response) => {
    try {
        const currentDate = new Date();

        const coupons = await Coupon.find({
            isActive: true,
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate },
        }).sort({ endDate: 1 });

        return res.status(200).json({
            success: true,
            data: coupons,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching coupons",
            error: error.message,
        });
    }
};

// Validate a coupon code
export const validateCoupon = async (req: Request, res: Response) => {
    try {
        const { code } = req.body;
        const orderTotal = Number(req.body.orderTotal) || 0;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: "Coupon code is required",
            });
        }

        // Same rules the order placement applies, so an accepted coupon is honoured at checkout
        const { coupon, discount } = await resolveCoupon(code, orderTotal, req.user?.userId);

        return res.status(200).json({
            success: true,
            data: {
                isValid: true,
                coupon,
                discountAmount: discount,
                finalTotal: Math.max(0, orderTotal - discount),
            },
        });
    } catch (error: any) {
        if (error instanceof CouponError) {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({
            success: false,
            message: "Error validating coupon",
            error: error.message,
        });
    }
};
