import { Request, Response } from 'express';
import { findSellersWithinRange } from "../utils/locationHelper";
import Seller from "../models/Seller";
import Product from "../models/Product";
import mongoose from "mongoose";
import { Banner } from '../models/Banner';
import AppSettings from '../models/AppSettings';
import { asyncHandler } from '../utils/asyncHandler';
import { uploadImage } from '../services/cloudinaryService';
import { CLOUDINARY_FOLDERS } from '../config/cloudinary';

/**
 * @desc    Get all banners
 * @route   GET /api/v1/banners
 * @access  Public
 */
export const getBanners = asyncHandler(async (req: Request, res: Response) => {
  const { position } = req.query;
  const query: any = { isActive: true };

  if (position) {
    query.position = position;
  }

  // If requesting from admin (implied by route structure usually, but here we just return all for lists)
  // We might want to return inactive ones for admin?
  // For now, let's just return all if no specific filter, or handle "admin" param if needed.
  // But typically admin view fetches all.

  // Let's verify if this is an admin request.
  // For simplicity, if no query params, return all (sorted by created desc)
  const filter = position ? query : {};

  const banners = await Banner.find(filter).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: banners.length,
    data: banners,
  });
});

/**
 * @desc    Create a new banner
 * @route   POST /api/v1/banners
 * @access  Private/Admin
 */
export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  const { position, resourceType, resourceId, resourceName, imageUrl, isActive, title, subtitle, redirectType, redirectValue } = req.body;

  const banner = await Banner.create({
    position,
    resourceType,
    resourceId,
    resourceName,
    imageUrl,
    isActive: isActive !== undefined ? isActive : true,
    title,
    subtitle,
    redirectType,
    redirectValue,
  });

  res.status(201).json({
    success: true,
    data: banner,
  });
});

/**
 * @desc    Update a banner
 * @route   PUT /api/v1/banners/:id
 * @access  Private/Admin
 */
export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  let banner = await Banner.findById(req.params.id);

  if (!banner) {
    res.status(404);
    throw new Error('Banner not found');
  }

  banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: banner,
  });
});

/**
 * @desc    Delete a banner
 * @route   DELETE /api/v1/banners/:id
 * @access  Private/Admin
 */
export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.findById(req.params.id);

  if (!banner) {
    res.status(404);
    throw new Error('Banner not found');
  }

  await banner.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// One upload at a time, even when several pages ask for the deals together
let inlineFlashImageMigration: Promise<string> | null = null;

const migrateInlineFlashDealImage = (settingsId: unknown, dataUrl: string): Promise<string> => {
  if (!inlineFlashImageMigration) {
    inlineFlashImageMigration = (async () => {
      try {
        const url = (await uploadImage(dataUrl, { folder: CLOUDINARY_FOLDERS.STORES })).secureUrl;
        await AppSettings.updateOne({ _id: settingsId }, { $set: { 'flashDeal.image': url } });
        return url;
      } catch (error) {
        console.error('Moving the flash deal image to Cloudinary failed:', (error as Error).message);
        return dataUrl;
      } finally {
        inlineFlashImageMigration = null;
      }
    })();
  }
  return inlineFlashImageMigration;
};

/**
 * @desc    Get flash deal settings
 * @route   GET /flash-deals
 * @access  Public
 */
export const getFlashDeals = asyncHandler(async (req: Request, res: Response) => {
  let settings: any = await AppSettings.findOne().select('flashDeal.targetDate flashDeal.active flashDeal.productIds flashDeal.image dealOfTheDay featuredDeal');

  if (!settings) {
     settings = await AppSettings.getSettings();
  }

  // An image saved as text (data:image/...) before uploads went to Cloudinary made every read
  // download megabytes (requests timed out): move it to Cloudinary once and keep only the link
  let flashDealImage: string = settings.flashDeal?.image || '';
  if (flashDealImage.startsWith('data:image/')) {
    flashDealImage = await migrateInlineFlashDealImage(settings._id, flashDealImage);
  }

  let flashDealProductIds: string[] = (settings.flashDeal?.productIds || []).map(String);
  let dealOfTheDayProductIds: string[] = (settings.dealOfTheDay?.productIds || []).map(String);
  let featuredDealProductIds: string[] = (settings.featuredDeal?.productIds || []).map(String);

  // The customer app (scope=customer) only gets deal products from stores that deliver to the
  // user's location; with no location, none. Admin screens get the full lists to edit.
  if (req.query.scope === 'customer') {
    const lat = parseFloat(String(req.query.latitude ?? ''));
    const lng = parseFloat(String(req.query.longitude ?? ''));
    let allowed = new Set<string>();
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const nearby = await findSellersWithinRange(lat, lng);
      const visible = await Seller.find({ _id: { $in: nearby }, isEnabled: true }).select('_id').lean();
      const ids = Array.from(new Set([...flashDealProductIds, ...dealOfTheDayProductIds, ...featuredDealProductIds])).filter((id) =>
        mongoose.isValidObjectId(id)
      );
      const products = await Product.find({
        _id: { $in: ids },
        seller: { $in: visible.map((v: any) => v._id) },
        status: 'Active',
        publish: true,
      })
        .select('_id')
        .lean();
      allowed = new Set(products.map((p: any) => String(p._id)));
    }
    flashDealProductIds = flashDealProductIds.filter((id) => allowed.has(id));
    dealOfTheDayProductIds = dealOfTheDayProductIds.filter((id) => allowed.has(id));
    featuredDealProductIds = featuredDealProductIds.filter((id) => allowed.has(id));
  }

  const rawTargetDate = settings.flashDeal?.targetDate ? new Date(settings.flashDeal.targetDate) : null;
  const isExpired = rawTargetDate ? rawTargetDate.getTime() <= Date.now() : true;
  const isCustomerScope = req.query.scope === 'customer';

  const data = {
    flashDealTargetDate: rawTargetDate
      ? rawTargetDate.toISOString()
      : '',
    flashDealImage,
    isActive: isCustomerScope && isExpired ? false : (settings.flashDeal?.active ?? true),
    isExpired,
    // Flash Deal Products (separate from Deal of the Day)
    flashDealProductIds,
    // Deal of the Day
    dealOfTheDayProductIds,
    // Featured Deal
    featuredDealProductIds,
  };

  res.status(200).json({
    success: true,
    data
  });
});

/**
 * @desc    Update flash deal settings
 * @route   PUT /flash-deals
 * @access  Private/Admin
 */
export const updateFlashDeals = asyncHandler(async (req: Request, res: Response) => {
  const { flashDealTargetDate, flashDealImage, isActive, flashDealProductIds, dealOfTheDayProductIds, featuredDealProductIds } = req.body;

  let settings: any = await AppSettings.findOne().select('+flashDeal.image');
  if (!settings) {
      settings = await AppSettings.create({
          appName: "Unnati Stores",
          contactEmail: "contact@Unnatistores.com",
          contactPhone: "1234567890",
      });
  }

  // A picture sent as text (data:image/...) is stored on Cloudinary and only its link is saved:
  // kept inside the settings record it made every settings read download megabytes
  let flashImage = flashDealImage;
  if (typeof flashImage === 'string' && flashImage.startsWith('data:image/')) {
      try {
          flashImage = (await uploadImage(flashImage, { folder: CLOUDINARY_FOLDERS.STORES })).secureUrl;
      } catch (error) {
          console.error('Flash deal image upload failed:', (error as Error).message);
          return res.status(502).json({ success: false, message: 'Could not upload the flash deal image. Please try again.' });
      }
  }

  // Update Flash Deal fields if provided
  if (flashDealTargetDate !== undefined || flashDealImage !== undefined || isActive !== undefined || flashDealProductIds !== undefined) {
      settings.flashDeal = {
          targetDate: flashDealTargetDate ? new Date(flashDealTargetDate) : settings.flashDeal?.targetDate,
          image: flashImage !== undefined ? flashImage : settings.flashDeal?.image,
          active: isActive !== undefined ? isActive : (settings.flashDeal?.active ?? true),
          productIds: flashDealProductIds !== undefined ? flashDealProductIds : settings.flashDeal?.productIds
      };
  }

  // Update Deal of the Day if provided
  if (dealOfTheDayProductIds !== undefined) {
      settings.dealOfTheDay = {
          productIds: dealOfTheDayProductIds,
          active: settings.dealOfTheDay?.active ?? true
      };
  }

  // Update Featured Deal if provided
  if (featuredDealProductIds !== undefined) {
      settings.featuredDeal = {
          productIds: featuredDealProductIds,
          active: settings.featuredDeal?.active ?? true
      };
  }

  await settings.save();

  const data = {
    flashDealTargetDate: settings.flashDeal?.targetDate?.toISOString(),
    flashDealImage: settings.flashDeal?.image,
    isActive: settings.flashDeal?.active,
    flashDealProductIds: settings.flashDeal?.productIds,
    dealOfTheDayProductIds: settings.dealOfTheDay?.productIds,
    featuredDealProductIds: settings.featuredDeal?.productIds
  };

  res.status(200).json({
    success: true,
    data
  });
});
