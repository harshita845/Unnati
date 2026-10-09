import mongoose, { Document, Schema } from "mongoose";

export interface IAppSettings extends Document {
  // App Info
  appName: string;
  appLogo?: string;
  appFavicon?: string;

  // Contact Info
  contactEmail: string;
  contactPhone: string;
  supportEmail?: string;
  supportPhone?: string;

  // Address
  address?: string; // Added to match frontend field name
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyPincode?: string;
  companyCountry?: string;

  // Social Media Links
  socialMediaLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };

  // Mail Settings
  mailSettings?: {
    mailerName?: string;
    host?: string;
    driver?: string;
    port?: string;
    userName?: string;
    emailId?: string;
    encryption?: string;
    password?: string;
  };

  // Google API Settings
  googleSettings?: {
    analyticsId?: string;
    recaptchaSiteKey?: string;
    recaptchaSecretKey?: string;
    mapApiKey?: string;
  };

  // Firebase Settings
  firebaseSettings?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    msgSenderId?: string;
    appId?: string;
    measurementId?: string;
  };

  // Notification Settings
  notificationSettings?: {
    fcmKey?: string;
    enablePush?: boolean;
    enableEmail?: boolean;
  };

  // Shiprocket Settings
  shiprocketSettings?: {
    enabled?: boolean;
    email?: string;
    password?: string;
    baseUrl?: string;
  };

  // Other Settings
  otherSettings?: {
    currencySymbol?: string;
    currencyCode?: string;
    timezone?: string;
    maintenanceMode?: boolean;
    forceUpdate?: boolean;
  };

  // Payment Settings
  paymentMethods: {
    cod: boolean;
    online: boolean;
    wallet: boolean;
    upi: boolean;
  };
  paymentGateways?: {
    razorpay?: {
      enabled: boolean;
      keyId?: string;
      keySecret?: string;
    };
    stripe?: {
      enabled: boolean;
      publishableKey?: string;
      secretKey?: string;
    };
  };

  invoiceSettings?: {
      notes?: {
          text: string;
          enabled: boolean;
      };
      terms?: {
          text: string;
          enabled: boolean;
      };
      gst?: {
          text: string;
          enabled: boolean;
      };
      fssai?: {
          text: string;
          enabled: boolean;
      };
  };

  billSettings?: any;


  // SMS Gateway Settings
  smsGateway?: {
    provider: string; // e.g., 'Twilio', 'MSG91', 'TextLocal'
    apiKey?: string;
    apiSecret?: string;
    senderId?: string;
    enabled: boolean;
  };

  // Commission Settings
  defaultCommission: number;

  // Delivery Settings
  deliveryCharges: number;
  freeDeliveryThreshold?: number;
  deliveryRadius?: number;
  serviceType?: string;

  // Tax Settings
  gstEnabled: boolean;
  gstRate?: number;

  // Policies
  privacyPolicy?: string;
  termsOfService?: string;
  returnPolicy?: string;
  refundPolicy?: string;
  customerAppPolicy?: string;
  deliveryAppPolicy?: string;

  // FAQ
  faq?: Array<{
    question: string;
    answer: string;
  }>;

  // Home Sections Configuration
  homeSections?: Array<{
    title: string;
    category?: mongoose.Types.ObjectId;
    subcategory?: mongoose.Types.ObjectId;
    city?: string;
    deliverableArea?: string;
    status: string;
    productSortBy?: string;
    productLimit?: number;
    order: number;
  }>;

  // Feature Flags
  features: {
    sellerRegistration: boolean;
    productApproval: boolean;
    orderTracking: boolean;
    wallet: boolean;
    coupons: boolean;
  };

  // Maintenance Mode
  maintenanceMode: boolean;
  maintenanceMessage?: string;

  // External APIs
  geminiApiKey?: string;
  googleCxId?: string; // Search Engine ID for Google Custom Search

  // Product Display Settings
  productDisplaySettings?: Array<{
    id: string;
    title: string;
    description?: string;
    fields: Array<{
      id: string;
      label: string;
      description?: string;
      isEnabled: boolean;
      type?: string;
      canDelete?: boolean;
    }>;
  }>;

  // Flash Deal Settings
  flashDeal?: {
    targetDate?: Date;
    image?: string;
    active?: boolean;
    productIds?: string[];
  };

  // Deal of the Day Settings
  dealOfTheDay?: {
      productIds: string[];
      active?: boolean;
  };

  // Featured Deal Settings
  featuredDeal?: {
      productIds: string[];
      active?: boolean;
  };

  // Payment Discount Settings
  onlinePaymentDiscount?: {
      enabled: boolean;
      percentage: number;
  };

  // First Order Offer Settings
  firstOrderOffer?: {
    enabled: boolean;
    title: string;
    subtitle: string;
    discountAmount: number;
    minOrderAmount: number;
    ctaText: string;
    updatedAt?: Date;
  };

  // Barcode Settings
    barcodeSettings?: {
        width: number;
        height: number;
        fontSize: number;
        barcodeHeight: number;
        barcodeWidth: number;
        productNameSize: number;
        showPrice: boolean;
        showName: boolean;
        mrpLabel?: string;
        spLabel?: string;
        /** Label page setup: labels per row/page, page margins and gaps between labels (mm) */
        layout?: {
            paper: "roll" | "a4";
            columns: number;
            rows: number;
            marginTop: number;
            marginBottom: number;
            marginLeft: number;
            marginRight: number;
            gapX: number;
            gapY: number;
            border: boolean;
        };
    };

  // Updated By
  updatedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface IAppSettingsModel extends mongoose.Model<IAppSettings> {
  getSettings(): Promise<IAppSettings>;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    // App Info
    appName: {
      type: String,
      required: [true, "App name is required"],
      default: "Unnati Stores",
      trim: true,
    },
    appLogo: {
      type: String,
      trim: true,
    },
    appFavicon: {
      type: String,
      trim: true,
    },

    // Contact Info
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      trim: true,
    },

    contactPhone: {
      type: String,
      required: [true, "Contact phone is required"],
      trim: true,

    },

    supportEmail: {
      type: String,
      trim: true,
    },

    supportPhone: {
      type: String,
      trim: true,
    },

    // Address
    address: {
      type: String,
      trim: true,
    },
    companyAddress: {
      type: String,
      trim: true,
    },

    companyCity: {
      type: String,
      trim: true,
    },
    companyState: {
      type: String,
      trim: true,
    },
    companyPincode: {
      type: String,
      trim: true,
    },

    companyCountry: {
      type: String,
      default: "India",
      trim: true,
    },

    // Social Media Links
    socialMediaLinks: {
      facebook: { type: String, trim: true },
      twitter: { type: String, trim: true },
      instagram: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      youtube: { type: String, trim: true },
    },

    // Mail Settings
    mailSettings: {
      mailerName: { type: String, trim: true },
      host: { type: String, trim: true },
      driver: { type: String, trim: true },
      port: { type: String, trim: true },
      userName: { type: String, trim: true },
      emailId: { type: String, trim: true },
      encryption: { type: String, trim: true },
      password: { type: String, trim: true },
    },

    // Google API Settings
    googleSettings: {
      analyticsId: { type: String, trim: true },
      recaptchaSiteKey: { type: String, trim: true },
      recaptchaSecretKey: { type: String, trim: true },
      mapApiKey: { type: String, trim: true },
    },

    // Firebase Settings
    firebaseSettings: {
      apiKey: { type: String, trim: true },
      authDomain: { type: String, trim: true },
      projectId: { type: String, trim: true },
      storageBucket: { type: String, trim: true },
      msgSenderId: { type: String, trim: true },
      appId: { type: String, trim: true },
      measurementId: { type: String, trim: true },
    },

    // Notification Settings
    notificationSettings: {
      fcmKey: { type: String, trim: true },
      enablePush: { type: Boolean, default: true },
      enableEmail: { type: Boolean, default: true },
    },

    // Shiprocket Settings
    shiprocketSettings: {
      enabled: { type: Boolean, default: true },
      email: { type: String, trim: true },
      password: { type: String, trim: true },
      baseUrl: { type: String, default: "https://apiv2.shiprocket.in", trim: true },
    },

    // Other Settings
    otherSettings: {
      currencySymbol: { type: String, default: "₹", trim: true },
      currencyCode: { type: String, default: "INR", trim: true },
      timezone: { type: String, default: "IST (India)", trim: true },
      maintenanceMode: { type: Boolean, default: false },
      forceUpdate: { type: Boolean, default: false },
    },

    // Payment Settings
    paymentMethods: {
      cod: {
        type: Boolean,
        default: true,
      },
      online: {
        type: Boolean,
        default: true,
      },
      wallet: {
        type: Boolean,
        default: true,
      },
      upi: {
        type: Boolean,
        default: true,
      },
    },
    paymentGateways: {
      razorpay: {
        enabled: Boolean,
        keyId: String,
        keySecret: String,
      },
      stripe: {
        enabled: Boolean,
        publishableKey: String,
        secretKey: String,
      },
    },

    // SMS Gateway Settings
    smsGateway: {
      provider: {
        type: String,
        trim: true,
      },
      apiKey: {
        type: String,
        trim: true,
      },
      apiSecret: {
        type: String,
        trim: true,
      },
      senderId: {
        type: String,
        trim: true,
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },

    // Commission Settings
    defaultCommission: {
      type: Number,
      default: 10,
      min: [0, "Commission cannot be negative"],
      max: [100, "Commission cannot exceed 100%"],
    },

    // Delivery Settings
    deliveryCharges: {
      type: Number,
      default: 0,
      min: [0, "Delivery charges cannot be negative"],
    },
    freeDeliveryThreshold: {
      type: Number,
      min: [0, "Free delivery threshold cannot be negative"],
    },
    deliveryRadius: {
      type: Number,
      default: 0,
      min: [0, "Delivery radius cannot be negative"],
    },
    serviceType: {
      type: String,
      enum: ["Delivery", "Pickup", "Delivery + Pickup"],
      default: "Delivery + Pickup",
    },

    // Tax Settings
    gstEnabled: {
      type: Boolean,
      default: false,
    },
    gstRate: {
      type: Number,
      min: [0, "GST rate cannot be negative"],
      max: [100, "GST rate cannot exceed 100%"],
    },

    // Policies
    privacyPolicy: {
      type: String,
      trim: true,
    },
    termsOfService: {
      type: String,
      trim: true,
    },
    returnPolicy: {
      type: String,
      trim: true,
    },
    refundPolicy: {
      type: String,
      trim: true,
    },
    customerAppPolicy: {
      type: String,
      trim: true,
    },
    deliveryAppPolicy: {
      type: String,
      trim: true,
    },

    // FAQ
    faq: [
      {
        question: {
          type: String,
          required: true,
          trim: true,
        },
        answer: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    // Home Sections Configuration
    homeSections: [
      {
        title: String,
        category: {
          type: Schema.Types.ObjectId,
          ref: "Category",
        },
        subcategory: {
          type: Schema.Types.ObjectId,
          ref: "SubCategory",
        },
        city: String,
        deliverableArea: String,
        status: String,
        productSortBy: String,
        productLimit: Number,
        order: {
          type: Number,
          default: 0,
        },
      },
    ],

    // Feature Flags
    features: {
      sellerRegistration: {
        type: Boolean,
        default: true,
      },
      productApproval: {
        type: Boolean,
        default: true,
      },
      orderTracking: {
        type: Boolean,
        default: true,
      },
      wallet: {
        type: Boolean,
        default: true,
      },
      coupons: {
        type: Boolean,
        default: true,
      },
    },

    // Maintenance Mode
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      trim: true,
    },

    // External APIs
    geminiApiKey: {
      type: String,
      trim: true,
      select: false, // Security: Don't return by default
    },
    googleCxId: {
      type: String,
      trim: true,
      select: false,
    },

    // Product Display Settings
    productDisplaySettings: [
      {
        id: String,
        title: String,
        description: String,
        fields: [
          {
            id: String,
            label: String,
            description: String,
            isEnabled: {
              type: Boolean,
              default: true,
            },
            type: {
              type: String,
              default: "toggle",
            },
            canDelete: {
              type: Boolean,
              default: false,
            },
          },
        ],
      },
    ],

    // Flash Deal Settings
    flashDeal: {
      targetDate: {
        type: Date,
      },
      image: {
        type: String,
        trim: true,
      },
      active: {
        type: Boolean,
        default: true
      },
      productIds: [{
        type: String,
        trim: true
      }]
    },

    // Deal of the Day Settings
    dealOfTheDay: {
      productIds: [{
        type: String, // Storing as String first as these might not be ObjectIds if from different DBs? Actually assuming strictObjectId. But let's use String for robustness with legacy code if any.
        trim: true
      }],
      active: {
          type: Boolean,
          default: true
      }
    },

    // Featured Deal Settings
    featuredDeal: {
      productIds: [{
        type: String,
        trim: true
      }],
      active: {
          type: Boolean,
          default: true
      }
    },

    // Payment Discount Settings
    onlinePaymentDiscount: {
      enabled: {
        type: Boolean,
        default: false
      },
      percentage: {
        type: Number,
        default: 0,
        min: [0, "Discount percentage cannot be negative"],
        max: [100, "Discount percentage cannot exceed 100%"]
      }
    },

    // First Order Offer Settings
    firstOrderOffer: {
      enabled: {
        type: Boolean,
        default: false
      },
      title: {
        type: String,
        default: "On your first order"
      },
      subtitle: {
        type: String,
        default: "OFF"
      },
      discountAmount: {
        type: Number,
        default: 0
      },
      minOrderAmount: {
        type: Number,
        default: 0
      },
      ctaText: {
        type: String,
        default: "Claim"
      },
      updatedAt: {
        type: Date
      }
    },

    // Barcode Settings
    barcodeSettings: {
        width: { type: Number, default: 38 },
        height: { type: Number, default: 25 },
        fontSize: { type: Number, default: 10 },
        barcodeHeight: { type: Number, default: 40 },
        barcodeWidth: { type: Number, default: 2 },
        productNameSize: { type: Number, default: 10 },
        showPrice: { type: Boolean, default: true },
        showName: { type: Boolean, default: true },
        mrpLabel: { type: String, default: "MRP" },
        spLabel: { type: String, default: "SP" },
        layout: {
            paper: { type: String, enum: ["roll", "a4"], default: "roll" },
            columns: { type: Number, min: 1, max: 4, default: 2 },
            rows: { type: Number, min: 1, max: 30, default: 1 },
            marginTop: { type: Number, min: 0, max: 50, default: 0 },
            marginBottom: { type: Number, min: 0, max: 50, default: 0 },
            marginLeft: { type: Number, min: 0, max: 50, default: 1.5 },
            marginRight: { type: Number, min: 0, max: 50, default: 1.5 },
            gapX: { type: Number, min: 0, max: 50, default: 2 },
            gapY: { type: Number, min: 0, max: 50, default: 2 },
            border: { type: Boolean, default: false }
        }
    },

    // Invoice Settings (Notes & Terms)
    invoiceSettings: {
        notes: {
            text: { type: String, default: "Thank you for your business" },
            enabled: { type: Boolean, default: true }
        },
        terms: {
            text: { type: String, default: "Goods once sold will not be taken back." },
            enabled: { type: Boolean, default: true }
        },
        gst: {
            text: { type: String, default: "" },
            enabled: { type: Boolean, default: false }
        },
        fssai: {
            text: { type: String, default: "" },
            enabled: { type: Boolean, default: false }
        }
    },

    billSettings: {
        type: Schema.Types.Mixed,
        default: {},
    },


    // Updated By
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
AppSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      appName: "Unnati Stores",
      contactEmail: "contact@Unnatistores.com",
      contactPhone: "1234567890",
    });
  }

  // Verify and backfill Deal of the Day, Featured Deal, and Flash Deal settings with actual database product IDs
  try {
    const Product = mongoose.model("Product");
    const activeProducts = await Product.find({ isAvailable: true }).limit(10).select('_id');
    if (activeProducts && activeProducts.length > 0) {
      const dbIds = activeProducts.map(p => p._id.toString());
      let needsSave = false;

      // Validate/Backfill Deal of the Day
      const currentDotD = settings.dealOfTheDay?.productIds || [];
      const validDotD = await Product.find({ _id: { $in: currentDotD } }).select('_id');
      if (validDotD.length === 0) {
        settings.dealOfTheDay = {
          productIds: dbIds.slice(0, 4),
          active: true
        };
        needsSave = true;
      }

      // Validate/Backfill Featured Deal
      const currentFeatured = settings.featuredDeal?.productIds || [];
      const validFeatured = await Product.find({ _id: { $in: currentFeatured } }).select('_id');
      if (validFeatured.length === 0) {
        settings.featuredDeal = {
          productIds: dbIds.slice(4, 8),
          active: true
        };
        needsSave = true;
      }

      // Validate/Backfill Flash Deal
      const currentFlash = settings.flashDeal?.productIds || [];
      const validFlash = await Product.find({ _id: { $in: currentFlash } }).select('_id');
      if (validFlash.length === 0) {
        settings.flashDeal = {
          targetDate: new Date(Date.now() + 86400000),
          image: settings.flashDeal?.image || '',
          active: true,
          productIds: dbIds.slice(8, 10)
        };
        needsSave = true;
      }

      if (needsSave) {
        await settings.save();
        console.log("✓ Dynamic AppSettings deals backfilled with active product IDs from DB.");
      }
    }
  } catch (err) {
    console.error("Error backfilling AppSettings product IDs:", err);
  }

  return settings;
};

// Indexes
AppSettingsSchema.index({ appName: 1 });

const AppSettings = mongoose.model<IAppSettings, IAppSettingsModel>(
  "AppSettings",
  AppSettingsSchema
);

export default AppSettings;
