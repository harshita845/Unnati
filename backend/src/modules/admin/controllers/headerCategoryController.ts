import { Request, Response } from "express";
import HeaderCategory from "../../../models/HeaderCategory";
import Category from "../../../models/Category";
import SubscriptionPlan from "../../../models/SubscriptionPlan";

// @desc    Get all header categories (Admin)
// @route   GET /api/v1/header-categories/admin
// @access  Private/Admin
export const getAdminHeaderCategories = async (
  _req: Request,
  res: Response
) => {
  try {
    const categories = await HeaderCategory.find().sort({
      order: 1,
      createdAt: -1,
    });
    return res.json(categories);
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get published header categories (Public)
// @route   GET /api/v1/header-categories
// @access  Public
export const getHeaderCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await HeaderCategory.find({ status: "Published" })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    // Subscription is set on main (top-level) categories only. Roll that up to the header
    // category above it, so a seller picking "Electronics" at signup sees it needs a plan,
    // without needing to know about the finer catalog categories underneath.
    const mainCategories = await Category.find({ parentId: null, subscriptionEnabled: true, status: "Active" })
      .select("headerCategoryId")
      .lean();
    const mainCategoryIdsByHeader = new Map<string, string[]>();
    for (const cat of mainCategories) {
      if (!cat.headerCategoryId) continue;
      const key = String(cat.headerCategoryId);
      if (!mainCategoryIdsByHeader.has(key)) mainCategoryIdsByHeader.set(key, []);
      mainCategoryIdsByHeader.get(key)!.push(String(cat._id));
    }

    // Cheapest active plan price covering each main category, for a "from ₹X" hint
    const cheapestPriceByCategory = new Map<string, number>();
    if (mainCategoryIdsByHeader.size) {
      const plans = await SubscriptionPlan.find({ isActive: true }).select("categories price").lean();
      for (const plan of plans) {
        for (const catId of plan.categories) {
          const key = String(catId);
          const current = cheapestPriceByCategory.get(key);
          if (current === undefined || plan.price < current) cheapestPriceByCategory.set(key, plan.price);
        }
      }
    }

    const data = categories.map((header: any) => {
      const headerId = String(header._id);
      const mainCategoryIds = mainCategoryIdsByHeader.get(headerId) || [];
      let fromPrice: number | null = null;
      for (const catId of mainCategoryIds) {
        const price = cheapestPriceByCategory.get(catId);
        if (price !== undefined && (fromPrice === null || price < fromPrice)) fromPrice = price;
      }
      return {
        ...header,
        subscriptionRequired: mainCategoryIds.length > 0,
        subscriptionFromPrice: fromPrice,
      };
    });

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Create a header category
// @route   POST /api/v1/header-categories
// @access  Private/Admin
export const createHeaderCategory = async (req: Request, res: Response) => {
  try {
    const {
      name,
      iconLibrary,
      iconName,
      image,
      slug,
      theme,
      relatedCategory,
      status,
      order,
      addButtonColor,
      offerTagColor,
    } = req.body;

    const categoryExists = await HeaderCategory.findOne({ slug });
    if (categoryExists) {
      return res
        .status(400)
        .json({ message: "Header category already exists" });
    }

    const category = await HeaderCategory.create({
      name,
      iconLibrary,
      iconName,
      image,
      slug,
      theme,
      relatedCategory,
      status,
      order,
      addButtonColor,
      offerTagColor,
    });

    return res.status(201).json(category);
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update a header category
// @route   PUT /api/v1/header-categories/:id
// @access  Private/Admin
// @desc    Update a header category
// @route   PUT /api/v1/header-categories/:id
// @access  Private/Admin
export const updateHeaderCategory = async (req: Request, res: Response) => {
  try {
    const {
      name,
      iconLibrary,
      iconName,
      image,
      slug,
      theme,
      relatedCategory,
      status,
      order,
      addButtonColor,
      offerTagColor,
    } = req.body;
    const category = await HeaderCategory.findById(req.params.id);

    if (category) {
      // Check if slug is being updated and if it's already taken
      if (slug && slug !== category.slug) {
        const slugExists = await HeaderCategory.findOne({ slug });
        if (slugExists) {
          return res
            .status(400)
            .json({ message: "Theme/Slug already used by another category" });
        }
      }

      category.name = name || category.name;
      category.iconLibrary = iconLibrary || category.iconLibrary;
      category.iconName = iconName || category.iconName;
      category.image = image !== undefined ? image : category.image;
      category.slug = slug || category.slug;
      category.theme = theme || category.theme;
      category.relatedCategory = relatedCategory; // Allow clearing it (undefined or null or empty string)
      category.status = status || category.status;
      category.order = order !== undefined ? order : category.order;
      category.addButtonColor = addButtonColor !== undefined ? addButtonColor : category.addButtonColor;
      category.offerTagColor = offerTagColor !== undefined ? offerTagColor : category.offerTagColor;

      const updatedCategory = await category.save();
      return res.json(updatedCategory);
    } else {
      return res.status(404).json({ message: "Header category not found" });
    }
  } catch (error: any) {
    console.error("Update Header Category Error:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "Category with this slug/theme already exists" });
    }
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// @desc    Delete a header category
// @route   DELETE /api/v1/header-categories/:id
// @access  Private/Admin
export const deleteHeaderCategory = async (req: Request, res: Response) => {
  try {
    const category = await HeaderCategory.findById(req.params.id);

    if (category) {
      await category.deleteOne();
      return res.json({ message: "Header category removed" });
    } else {
      return res.status(404).json({ message: "Header category not found" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};
