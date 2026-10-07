import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../services/jwtService";
import { getSellerPlanAccess } from "../services/sellerSubscriptionService";

interface ModuleRule {
  /** Plan modules that allow any request on this route group */
  modules: string[];
  /** Extra modules that allow read-only requests (e.g. the product form reads attributes) */
  readModules?: string[];
  /** Read-only requests are always allowed (shared look-ups like categories) */
  openReads?: boolean;
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Seller-panel access comes from the seller's subscription plan. This rejects API calls for
 * modules the plan doesn't include, so hiding a menu item isn't the only protection.
 * Admins and other user types pass straight through; missing or bad tokens are left for the
 * route's own `authenticate` to reject.
 */
export const requireSellerModule = (rule: ModuleRule) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return next();
    let user: any;
    try {
      user = verifyToken(header.substring(7));
    } catch {
      return next();
    }
    if (user?.userType !== "Seller" || !user?.userId) return next();

    const isRead = READ_METHODS.has(req.method);
    if (isRead && rule.openReads) return next();

    const access = await getSellerPlanAccess(user.userId);
    const allowedBy = isRead ? [...rule.modules, ...(rule.readModules || [])] : rule.modules;
    if (allowedBy.some((m) => access.modules.includes(m))) return next();

    return res.status(403).json({
      success: false,
      code: access.locked ? "PLAN_REQUIRED" : "MODULE_NOT_IN_PLAN",
      message: access.locked
        ? "Your store needs an active subscription plan. Go to Subscriptions to activate one."
        : "This feature isn't included in your subscription plan. Upgrade your plan to use it.",
    });
  } catch (error) {
    return next(error);
  }
};
