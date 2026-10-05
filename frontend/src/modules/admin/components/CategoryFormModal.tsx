import { useState, useEffect } from "react";
import {
  Category,
  CreateCategoryData,
  UpdateCategoryData,
} from "../../../services/api/admin/adminProductService";
import { uploadImage } from "../../../services/api/uploadService";
import { dateInputToISO, toDateInput } from "../../../services/api/subscriptionService";
import {
  validateImageFile,
  createImagePreview,
} from "../../../utils/imageUpload";
import {
  getAvailableParents,
  validateParentChange,
} from "../../../utils/categoryUtils";
import {
  getHeaderCategoriesAdmin,
  HeaderCategory,
} from "../../../services/api/headerCategoryService";

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCategoryData | UpdateCategoryData) => Promise<void>;
  category?: Category;
  parentCategory?: Category;
  mode: "create" | "edit" | "create-subcategory";
  allCategories: Category[];
}

export default function CategoryFormModal({
  isOpen,
  onClose,
  onSubmit,
  category,
  parentCategory,
  mode,
  allCategories,
}: CategoryFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    image: "",
    order: 0,
    parentId: null as string | null,
    headerCategoryId: null as string | null,
    status: "Active" as "Active" | "Inactive",
    isBestseller: false,
    hasWarning: false,
    groupCategory: "",
    subscriptionEnabled: false,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>(
    []
  );
  const [loadingHeaderCategories, setLoadingHeaderCategories] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Subscription rules for this category (Super Admin)
  const [graceMode, setGraceMode] = useState<"default" | "custom">("default");
  const [graceDays, setGraceDays] = useState(3);
  const [billType, setBillType] = useState<"" | "gst" | "receipt">("");
  const [existingMode, setExistingMode] = useState<"trial" | "buy">("trial");
  const [trialStart, setTrialStart] = useState(toDateInput(new Date()));
  const [trialEnd, setTrialEnd] = useState(toDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));

  useEffect(() => {
    if (!isOpen) return;
    const custom = mode === "edit" && typeof category?.subscriptionGraceDays === "number";
    setGraceMode(custom ? "custom" : "default");
    setGraceDays(custom ? (category!.subscriptionGraceDays as number) : 3);
    setBillType((mode === "edit" && category?.subscriptionBillType) || "");
    setExistingMode("trial");
    setTrialStart(toDateInput(new Date()));
    setTrialEnd(toDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
  }, [isOpen, mode, category]);

  // Get available parent categories
  const availableParents = getAvailableParents(
    category?._id || null,
    allCategories
  );

  // Fetch header categories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchHeaderCategories();
    }
  }, [isOpen]);

  const fetchHeaderCategories = async () => {
    try {
      setLoadingHeaderCategories(true);
      const categories = await getHeaderCategoriesAdmin();
      // Filter only Published header categories
      const publishedCategories = categories.filter(
        (cat) => cat.status === "Published"
      );
      setHeaderCategories(publishedCategories);
    } catch (error) {
      console.error("Error fetching header categories:", error);
      setHeaderCategories([]);
    } finally {
      setLoadingHeaderCategories(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && category) {
        // Pre-fill form with category data safely extracting string IDs from populated objects
        let editHeaderCategoryId: string | null = null;
        if (category.headerCategoryId) {
          if (typeof category.headerCategoryId === "string") {
            editHeaderCategoryId = category.headerCategoryId;
          } else if (typeof category.headerCategoryId === "object" && category.headerCategoryId !== null) {
            editHeaderCategoryId = (category.headerCategoryId as { _id?: string })._id || null;
          }
        }
        if (!editHeaderCategoryId && (category as any).headerCategory) {
          const hc = (category as any).headerCategory;
          editHeaderCategoryId = typeof hc === "string" ? hc : hc?._id || null;
        }

        let editParentId: string | null = null;
        if (category.parentId) {
          if (typeof category.parentId === "string") {
            editParentId = category.parentId;
          } else if (typeof category.parentId === "object" && category.parentId !== null) {
            editParentId = (category.parentId as { _id?: string })._id || null;
          }
        }

        setFormData({
          name: category.name || "",
          image: category.image || "",
          order: category.order || 0,
          parentId: editParentId,
          headerCategoryId: editHeaderCategoryId,
          status: category.status || "Active",
          isBestseller: category.isBestseller || false,
          hasWarning: category.hasWarning || false,
          groupCategory: category.groupCategory || "",
          subscriptionEnabled: category.subscriptionEnabled || false,
        });
        if (category.image) {
          setImagePreview(category.image);
        }
      } else if (mode === "create-subcategory" && parentCategory) {
        // Pre-fill parent for subcategory and inherit header category
        // Handle both populated object and string ID
        let inheritedHeaderCategoryId: string | null = null;
        if (parentCategory.headerCategoryId) {
          if (typeof parentCategory.headerCategoryId === "string") {
            inheritedHeaderCategoryId = parentCategory.headerCategoryId;
          } else if (
            typeof parentCategory.headerCategoryId === "object" &&
            parentCategory.headerCategoryId !== null
          ) {
            // It's populated, extract the _id
            inheritedHeaderCategoryId =
              (parentCategory.headerCategoryId as { _id?: string })._id || null;
          }
        }
        // Also check headerCategory field (if it exists as separate field)
        if (!inheritedHeaderCategoryId && parentCategory.headerCategory) {
          if (typeof parentCategory.headerCategory === "string") {
            inheritedHeaderCategoryId = parentCategory.headerCategory;
          } else if (
            typeof parentCategory.headerCategory === "object" &&
            parentCategory.headerCategory !== null
          ) {
            inheritedHeaderCategoryId = parentCategory.headerCategory._id;
          }
        }
        setFormData({
          name: "",
          image: "",
          order: 0,
          parentId: parentCategory._id,
          headerCategoryId: inheritedHeaderCategoryId,
          status: "Active",
          isBestseller: false,
          hasWarning: false,
          groupCategory: "",
          subscriptionEnabled: false,
        });
      } else {
        // Reset form for new category
        setFormData({
          name: "",
          image: "",
          order: 0,
          parentId: null,
          headerCategoryId: null,
          status: "Active",
          isBestseller: false,
          hasWarning: false,
          groupCategory: "",
          subscriptionEnabled: false,
        });
      }
      setImageFile(null);
      setImagePreview(mode === "edit" && category?.image ? category.image : "");
      setErrors({});
      setShowAdvanced(false);
    }
  }, [isOpen, mode, category, parentCategory]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
          ? parseInt(value) || 0
          : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrors((prev) => ({
        ...prev,
        image: validation.error || "Invalid image file",
      }));
      return;
    }

    setImageFile(file);
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.image;
      return newErrors;
    });

    try {
      const preview = await createImagePreview(file);
      setImagePreview(preview);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        image: "Failed to create image preview",
      }));
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Category name is required";
    }

    if (formData.order < 0) {
      newErrors.order = "Display order must be a positive number";
    }

    // Validate header category (required for root categories, inherited for subcategories)
    if (isSubcategoryMode) {
      // For subcategories, header category should be inherited from parent
      if (!formData.headerCategoryId) {
        if (parentCategory) {
          const parentHeaderCategoryId =
            parentCategory.headerCategoryId ||
            (parentCategory.headerCategory
              ? typeof parentCategory.headerCategory === "string"
                ? null
                : parentCategory.headerCategory._id
              : null);
          if (!parentHeaderCategoryId) {
            newErrors.headerCategoryId =
              "Parent category does not have a header category assigned. Please assign a header category to the parent category first.";
          }
        } else {
          newErrors.headerCategoryId =
            "Header category is required for subcategories";
        }
      }
    } else {
      // For root categories or when editing, header category is required
      if (!formData.headerCategoryId) {
        if (mode === "edit" && category && !category.headerCategoryId) {
          newErrors.headerCategoryId =
            "Header category is required. Please assign a header category to this category.";
        } else if (mode === "create") {
          newErrors.headerCategoryId = "Header category is required";
        }
      }
    }

    // Validate parent change if editing
    if (mode === "edit" && category) {
      const validation = validateParentChange(
        category._id,
        formData.parentId,
        allCategories
      );
      if (!validation.valid) {
        newErrors.parentId = validation.error || "Invalid parent selection";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      const modalEl = document.getElementById("category-form-modal-container");
      if (modalEl) modalEl.scrollTop = 0;
      return;
    }

    try {
      setSubmitting(true);
      setErrors({});

      let imageUrl = formData.image;

      // Upload image if a new file is selected
      if (imageFile) {
        setUploading(true);
        const imageResult = await uploadImage(imageFile, "Ecommerce/categories");
        imageUrl = imageResult.secureUrl;
        setUploading(false);
      }

      const submitData: CreateCategoryData | UpdateCategoryData = {
        name: formData.name.trim(),
        image: imageUrl,
        order: formData.order,
        parentId: formData.parentId,
        headerCategoryId: formData.headerCategoryId,
        status: formData.status,
        isBestseller: formData.isBestseller,
        hasWarning: formData.hasWarning,
        groupCategory: formData.groupCategory || undefined,
        subscriptionEnabled: formData.subscriptionEnabled,
        subscriptionGraceDays: graceMode === "custom" ? Math.max(0, Math.round(graceDays)) : null,
        subscriptionBillType: billType || null,
        // Switching the requirement on for an existing category: what current sellers get
        ...(mode === "edit" && formData.subscriptionEnabled && !category?.subscriptionEnabled
          ? {
              existingSellers:
                existingMode === "buy"
                  ? { mode: "buy" as const }
                  : {
                      mode: "trial" as const,
                      trialStartDate: dateInputToISO(trialStart, "start"),
                      trialEndDate: dateInputToISO(trialEnd, "end"),
                    },
            }
          : {}),
      };

      await onSubmit(submitData);
      onClose();
    } catch (error: any) {
      const modalEl = document.getElementById("category-form-modal-container");
      if (modalEl) modalEl.scrollTop = 0;
      setErrors({
        submit:
          error.response?.data?.message ||
          error.message ||
          "Failed to save category. Please try again.",
      });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const modalTitle =
    mode === "edit"
      ? "Edit Category"
      : mode === "create-subcategory"
      ? "Create Subcategory"
      : "Create Category";

  const isSubcategoryMode = mode === "create-subcategory";
  const isEditMode = mode === "edit";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}></div>

      {/* Modal */}
      <div id="category-form-modal-container" className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            {modalTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
            disabled={submitting}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Parent Category Info (for subcategory mode) */}
          {isSubcategoryMode && parentCategory && (
            <div className="mb-4 p-3 bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/30 rounded-lg">
              <p className="text-sm text-[var(--primary-color)]">Parent Category</p>
              <p className="text-base font-semibold text-[var(--primary-color)]">
                {parentCategory.name}
              </p>
            </div>
          )}

          {/* Error Messages */}
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Category Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] ${
                errors.name ? "border-red-300" : "border-neutral-300"
              }`}
              placeholder="Enter category name"
              disabled={submitting}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Header Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Header Category{" "}
              {!isSubcategoryMode && <span className="text-red-500">*</span>}
            </label>
            {isSubcategoryMode ? (
              <div>
                <input
                  type="text"
                  value={(() => {
                    // First, try to get name from parentCategory.headerCategory (if populated as separate field)
                    if (parentCategory?.headerCategory) {
                      return typeof parentCategory.headerCategory === "string"
                        ? parentCategory.headerCategory
                        : parentCategory.headerCategory.name;
                    }

                    // Second, check if headerCategoryId is populated (object from backend)
                    if (parentCategory?.headerCategoryId) {
                      if (
                        typeof parentCategory.headerCategoryId === "object" &&
                        parentCategory.headerCategoryId !== null
                      ) {
                        // It's populated, get the name
                        return (
                          (parentCategory.headerCategoryId as { name?: string })
                            .name || "Unknown"
                        );
                      }
                    }

                    // Third, try to find in loaded headerCategories using formData.headerCategoryId
                    if (
                      formData.headerCategoryId &&
                      headerCategories.length > 0
                    ) {
                      const found = headerCategories.find(
                        (hc) => hc._id === formData.headerCategoryId
                      );
                      if (found) return found.name;
                    }

                    // If still loading and we have an ID, show loading
                    if (loadingHeaderCategories && formData.headerCategoryId) {
                      return "Loading...";
                    }

                    // Otherwise, show not assigned
                    return "Not assigned";
                  })()}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-[var(--primary-color)]">
                  Inherited from parent category
                </p>
                {errors.headerCategoryId && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.headerCategoryId}
                  </p>
                )}
              </div>
            ) : (
              <div>
                {loadingHeaderCategories ? (
                  <div className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-500 text-sm">
                    Loading header categories...
                  </div>
                ) : headerCategories.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-yellow-300 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
                    No Published header categories available. Please create a
                    header category first.
                  </div>
                ) : (
                  <>
                    {mode === "edit" &&
                      category &&
                      !category.headerCategoryId && (
                        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                          This category does not have a header category
                          assigned. Please select one.
                        </div>
                      )}
                    <select
                      name="headerCategoryId"
                      value={formData.headerCategoryId || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          headerCategoryId: e.target.value || null,
                        }))
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] ${
                        errors.headerCategoryId
                          ? "border-red-300"
                          : "border-neutral-300"
                      }`}
                      disabled={submitting}>
                      <option value="">
                        {mode === "edit" && !category?.headerCategoryId
                          ? "-- Select Header Category (Required) --"
                          : "-- Select Header Category --"}
                      </option>
                      {headerCategories.map((headerCat) => (
                        <option key={headerCat._id} value={headerCat._id}>
                          {headerCat.name}
                        </option>
                      ))}
                    </select>
                    {errors.headerCategoryId && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.headerCategoryId}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Category Image */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Category Image
            </label>
            <label
              className={`block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-[var(--primary-color)] bg-[var(--primary-color)]/10"
                  : "border-neutral-300 hover:border-[var(--primary-color)]"
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}>
              {imagePreview ? (
                <div className="space-y-2">
                  <img
                    src={imagePreview}
                    alt="Category preview"
                    className="max-h-32 mx-auto rounded-lg object-cover"
                  />
                  <p className="text-xs text-neutral-600">
                    {imageFile?.name || "Current image"}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setImageFile(null);
                      setImagePreview("");
                      setFormData((prev) => ({ ...prev, image: "" }));
                    }}
                    className="text-xs text-red-600 hover:text-red-700">
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mx-auto mb-2 text-neutral-400">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <p className="text-xs text-neutral-600">
                    {isDragging ? "Drop image here" : "Choose File or Drag & Drop"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">Max 5MB</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={submitting || uploading}
              />
            </label>
            {errors.image && (
              <p className="mt-1 text-sm text-red-600">{errors.image}</p>
            )}
          </div>

          {/* Parent Category (only for create/edit, not subcategory mode) */}
          {!isSubcategoryMode && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Parent Category
              </label>
              <select
                name="parentId"
                value={formData.parentId || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    parentId: e.target.value || null,
                  }))
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] ${
                  errors.parentId ? "border-red-300" : "border-neutral-300"
                }`}
                disabled={submitting}>
                <option value="">None (Root Category)</option>
                {availableParents.map((parent) => (
                  <option key={parent._id} value={parent._id}>
                    {parent.name}
                  </option>
                ))}
              </select>
              {errors.parentId && (
                <p className="mt-1 text-sm text-red-600">{errors.parentId}</p>
              )}
            </div>
          )}

          {/* Display Order */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Display Order
            </label>
            <input
              type="number"
              name="order"
              value={formData.order}
              onChange={handleInputChange}
              min="0"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] ${
                errors.order ? "border-red-300" : "border-neutral-300"
              }`}
              disabled={submitting}
            />
            {errors.order && (
              <p className="mt-1 text-sm text-red-600">{errors.order}</p>
            )}
          </div>

          {/* Active Status */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="status"
                checked={formData.status === "Active"}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: e.target.checked ? "Active" : "Inactive",
                  }))
                }
                className="mr-2"
                disabled={submitting}
              />
              <span className="text-sm font-medium text-neutral-700">
                Active Status
              </span>
            </label>
          </div>

          {/* Subscription Settings — main (top-level) categories only; a subcategory follows its main category */}
          {formData.parentId ? (
            <div className="mb-4 p-4 border border-neutral-200 rounded-lg bg-neutral-50">
              <p className="text-sm text-neutral-500">
                Subscriptions are set on the main category, not on subcategories. This subcategory follows whatever its main category requires.
              </p>
            </div>
          ) : (
          <div className="mb-4 p-4 border border-neutral-200 rounded-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-700">Subscription required</p>
                <p className="text-xs text-neutral-500">
                  Sellers need an active plan that includes this category to sell here. Plans, prices,
                  durations and features are managed in Manage Seller → Seller Subscriptions.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.subscriptionEnabled}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    subscriptionEnabled: !prev.subscriptionEnabled,
                  }))
                }
                disabled={submitting}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                  formData.subscriptionEnabled ? "bg-[var(--primary-color)]" : "bg-neutral-300"
                }`}>
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    formData.subscriptionEnabled ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </div>
            {formData.subscriptionEnabled && (
              <div className="mt-3 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">After a seller's plan expires</label>
                    <select
                      value={graceMode === "custom" && graceDays === 0 ? "hide" : graceMode}
                      onChange={(e) => {
                        if (e.target.value === "hide") {
                          setGraceMode("custom");
                          setGraceDays(0);
                        } else if (e.target.value === "custom") {
                          setGraceMode("custom");
                          setGraceDays((d) => (d > 0 ? d : 3));
                        } else setGraceMode("default");
                      }}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      disabled={submitting}>
                      <option value="default">Use default grace period</option>
                      <option value="custom">Custom grace period</option>
                      <option value="hide">Hide products immediately</option>
                    </select>
                    {graceMode === "custom" && graceDays > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={graceDays}
                          onChange={(e) => setGraceDays(Number(e.target.value))}
                          className="w-24 px-3 py-1.5 border border-neutral-300 rounded-lg text-sm"
                          disabled={submitting}
                        />
                        <span className="text-xs text-neutral-600">days, then products are hidden</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Bill for subscription payments</label>
                    <select
                      value={billType}
                      onChange={(e) => setBillType(e.target.value as "" | "gst" | "receipt")}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      disabled={submitting}>
                      <option value="">Use default</option>
                      <option value="gst">GST invoice (GST charged)</option>
                      <option value="receipt">Payment receipt (no GST)</option>
                    </select>
                  </div>
                </div>

                {mode === "edit" && !category?.subscriptionEnabled && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-amber-900">Sellers already selling in this category:</p>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={existingMode === "trial"} onChange={() => setExistingMode("trial")} disabled={submitting} />
                      Give a free trial
                    </label>
                    {existingMode === "trial" && (
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <div>
                          <label className="block text-xs text-neutral-600 mb-1">Start date</label>
                          <input type="date" value={trialStart} onChange={(e) => setTrialStart(e.target.value)}
                            className="w-full px-2 py-1.5 border border-neutral-300 rounded-lg text-sm" disabled={submitting} />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-600 mb-1">End date</label>
                          <input type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)}
                            className="w-full px-2 py-1.5 border border-neutral-300 rounded-lg text-sm" disabled={submitting} />
                        </div>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={existingMode === "buy"} onChange={() => setExistingMode("buy")} disabled={submitting} />
                      They must buy a plan now (their products here are hidden until they do)
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Advanced Fields (Collapsible) */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-neutral-700 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
              <span>Advanced Settings</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className={`transform transition-transform ${
                  showAdvanced ? "rotate-180" : ""
                }`}>
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {showAdvanced && (
              <div className="mt-2 p-4 bg-neutral-50 rounded-lg space-y-4">
                {/* Is Bestseller */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="isBestseller"
                      checked={formData.isBestseller}
                      onChange={handleInputChange}
                      className="mr-2"
                      disabled={submitting}
                    />
                    <span className="text-sm font-medium text-neutral-700">
                      Is Bestseller Category
                    </span>
                  </label>
                </div>

                {/* Has Warning */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="hasWarning"
                      checked={formData.hasWarning}
                      onChange={handleInputChange}
                      className="mr-2"
                      disabled={submitting}
                    />
                    <span className="text-sm font-medium text-neutral-700">
                      Has Warning
                    </span>
                  </label>
                </div>

                {/* Group Category */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Group Category
                  </label>
                  <input
                    type="text"
                    name="groupCategory"
                    value={formData.groupCategory}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                    placeholder="Enter group category"
                    disabled={submitting}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              submitting || uploading
                ? "bg-neutral-400 cursor-not-allowed"
                : "bg-[var(--primary-color)] hover:bg-[var(--primary-dark)]"
            }`}>
            {submitting
              ? "Saving..."
              : uploading
              ? "Uploading..."
              : isEditMode
              ? "Update Category"
              : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}
