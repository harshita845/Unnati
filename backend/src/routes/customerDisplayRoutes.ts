import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import * as admin from "../modules/customerDisplay/adminCustomerDisplayController";
import * as display from "../modules/customerDisplay/publicCustomerDisplayController";

/** Admin → /api/v1/admin/customer-display/* (admin login required) */
export const adminCustomerDisplayRoutes = Router();
adminCustomerDisplayRoutes.use(authenticate, requireUserType("Admin"));

adminCustomerDisplayRoutes.get("/banners", admin.listBanners);
adminCustomerDisplayRoutes.post("/banners", admin.createBanner);
adminCustomerDisplayRoutes.put("/banners/reorder", admin.reorderBanners);
adminCustomerDisplayRoutes.put("/banners/:id", admin.updateBanner);
adminCustomerDisplayRoutes.patch("/banners/:id/status", admin.setBannerStatus);
adminCustomerDisplayRoutes.post("/banners/:id/duplicate", admin.duplicateBanner);
adminCustomerDisplayRoutes.delete("/banners/:id", admin.deleteBanner);

adminCustomerDisplayRoutes.get("/campaigns", admin.listCampaigns);
adminCustomerDisplayRoutes.post("/campaigns", admin.createCampaign);
adminCustomerDisplayRoutes.put("/campaigns/:id", admin.updateCampaign);
adminCustomerDisplayRoutes.delete("/campaigns/:id", admin.deleteCampaign);

adminCustomerDisplayRoutes.get("/settings", admin.getSettings);
adminCustomerDisplayRoutes.put("/settings", admin.updateSettings);

adminCustomerDisplayRoutes.get("/terminals", admin.listTerminals);
adminCustomerDisplayRoutes.post("/terminals/:code/ensure", admin.ensureTerminalHandler);
adminCustomerDisplayRoutes.put("/terminals/:code", admin.updateTerminal);
adminCustomerDisplayRoutes.post("/terminals/:code/regenerate-key", admin.regenerateTerminalKey);
adminCustomerDisplayRoutes.delete("/terminals/:code", admin.deleteTerminal);
adminCustomerDisplayRoutes.put("/terminals/:code/state", admin.pushTerminalState);

adminCustomerDisplayRoutes.post("/upload-signature", admin.getUploadSignature);
adminCustomerDisplayRoutes.get("/preview", admin.previewDisplay);

/** Customer screen → /api/v1/customer-display/* (terminal display key, no login) */
export const publicCustomerDisplayRoutes = Router();
publicCustomerDisplayRoutes.use(display.requireDisplayKey);
publicCustomerDisplayRoutes.get("/bootstrap", display.getBootstrap);
publicCustomerDisplayRoutes.get("/banners", display.getBanners);
publicCustomerDisplayRoutes.get("/state", display.getState);
