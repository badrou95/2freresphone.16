export interface StoreSettings {
  storeName: string;
  tagline: string;
  logoUrl: string | null;
  whatsappPhone: string;
  supportEmail: string;
  adminAlertEmail?: string;
  defaultLowStockThreshold?: number;
  currency: string;
  storeAddress: string;
  codEnabled: boolean;
  digitalOrderNote: string;
}

export interface Category {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  categoryGroup: 'accessories' | 'gaming' | 'digital' | string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductImageItem {
  id: number;
  productId?: number;
  url: string;
  altText: string;
  sortOrder?: number;
  isPrimary: boolean;
}

export interface StoreProduct {
  id: number;
  sku: string;
  name: string;
  slug: string;
  brand: string | null;
  shortDescription: string | null;
  description: string;
  productType: 'physical' | 'digital';
  priceDzd: number;
  compareAtPriceDzd: number | null;
  stockQuantity: number;
  isFeatured: boolean;
  digitalAvailability: string | null;
  digitalActivationNote?: string | null;
  categoryId: number | null;
  categoryName: string;
  categorySlug: string;
  categoryGroup: string;
  primaryImage: string | null;
  images: ProductImageItem[];
  averageRating: number;
  reviewCount: number;
  ratingDistribution?: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface PublicReview {
  id: number;
  customerName: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  adminReply: string | null;
  createdAt: string;
}

export interface CarrierSummary {
  id: number;
  name: string;
  code: string;
  supportsHome: boolean;
  supportsStopDesk: boolean;
}

export interface ShippingRate {
  id: number;
  carrierId: number;
  wilayaCode: string;
  wilayaName: string;
  homePriceDzd: number;
  stopDeskPriceDzd: number;
  estimatedDays: string;
  isActive: boolean;
}

export interface SocialLinkItem {
  id: number;
  platform: string;
  label: string;
  urlOrHandle: string;
  pixelId?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface StoreBootstrap {
  settings: StoreSettings;
  categories: Category[];
  socialLinks: SocialLinkItem[];
  carriers: CarrierSummary[];
  shippingRates: ShippingRate[];
  wilayas: { code: string; name: string; region: string }[];
}

export interface CartItem {
  productId: number;
  sku: string;
  name: string;
  slug: string;
  priceDzd: number;
  productType: 'physical' | 'digital';
  image: string | null;
  quantity: number;
  maxStock: number;
}

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
}
