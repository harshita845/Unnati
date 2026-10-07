import api from '../config';
import type { DisplayBranding, DisplaySettingsPublic, DisplayState, DisplayTheme, LiveBanner } from '../../../modules/customerDisplay/sync/displayTypes';

/** Admin APIs for the POS Customer Display (banners, campaigns, settings, terminals). */

export type BannerStatus = 'active' | 'scheduled' | 'expired' | 'inactive';

export interface CampaignRef {
  _id: string;
  name: string;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DisplayBanner {
  _id: string;
  title: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mediaPublicId?: string;
  posterUrl?: string;
  durationSeconds: number;
  sortOrder: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  startDay: string | null;
  endDay: string | null;
  terminals: string[];
  campaign?: CampaignRef | null;
  link?: string;
  notes?: string;
  status: BannerStatus;
  createdAt: string;
}

export interface BannerInput {
  title: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mediaPublicId?: string;
  posterUrl?: string;
  durationSeconds?: number;
  sortOrder?: number;
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  terminals?: string[];
  campaign?: string | null;
  link?: string;
  notes?: string;
}

export interface DisplayCampaign {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  startDay: string | null;
  endDay: string | null;
  status: BannerStatus;
  bannerCount: number;
}

export interface CampaignInput {
  name: string;
  description?: string;
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DisplaySettings extends DisplaySettingsPublic {
  storeName: string;
  logoUrl: string;
  contentVersion: number;
  resolvedBranding: DisplayBranding;
}

export type DisplaySettingsInput = Partial<Omit<DisplaySettings, 'theme' | 'resolvedBranding' | 'contentVersion'>> & {
  theme?: Partial<DisplayTheme>;
};

export interface DisplayTerminal {
  _id: string;
  code: string;
  name: string;
  displayKey: string;
  isActive: boolean;
  lastSeenAt?: string | null;
  stateUpdatedAt?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

const BASE = '/admin/customer-display';

// Banners
export const getDisplayBanners = (params?: { status?: string; campaign?: string; search?: string }) =>
  api.get<ApiResponse<DisplayBanner[]>>(`${BASE}/banners`, { params }).then((r) => r.data);
export const createDisplayBanner = (data: BannerInput) =>
  api.post<ApiResponse<DisplayBanner>>(`${BASE}/banners`, data).then((r) => r.data);
export const updateDisplayBanner = (id: string, data: Partial<BannerInput>) =>
  api.put<ApiResponse<DisplayBanner>>(`${BASE}/banners/${id}`, data).then((r) => r.data);
export const setDisplayBannerActive = (id: string, isActive: boolean) =>
  api.patch<ApiResponse<DisplayBanner>>(`${BASE}/banners/${id}/status`, { isActive }).then((r) => r.data);
export const duplicateDisplayBanner = (id: string) =>
  api.post<ApiResponse<DisplayBanner>>(`${BASE}/banners/${id}/duplicate`).then((r) => r.data);
export const deleteDisplayBanner = (id: string) =>
  api.delete<ApiResponse<null>>(`${BASE}/banners/${id}`).then((r) => r.data);
export const reorderDisplayBanners = (ids: string[]) =>
  api.put<ApiResponse<null>>(`${BASE}/banners/reorder`, { ids }).then((r) => r.data);

// Campaigns
export const getDisplayCampaigns = () => api.get<ApiResponse<DisplayCampaign[]>>(`${BASE}/campaigns`).then((r) => r.data);
export const createDisplayCampaign = (data: CampaignInput) =>
  api.post<ApiResponse<DisplayCampaign>>(`${BASE}/campaigns`, data).then((r) => r.data);
export const updateDisplayCampaign = (id: string, data: Partial<CampaignInput>) =>
  api.put<ApiResponse<DisplayCampaign>>(`${BASE}/campaigns/${id}`, data).then((r) => r.data);
export const deleteDisplayCampaign = (id: string) =>
  api.delete<ApiResponse<null>>(`${BASE}/campaigns/${id}`).then((r) => r.data);

// Settings
export const getCustomerDisplaySettings = () => api.get<ApiResponse<DisplaySettings>>(`${BASE}/settings`).then((r) => r.data);
export const updateCustomerDisplaySettings = (data: DisplaySettingsInput) =>
  api.put<ApiResponse<DisplaySettings>>(`${BASE}/settings`, data).then((r) => r.data);

// Terminals
export const getDisplayTerminals = () => api.get<ApiResponse<DisplayTerminal[]>>(`${BASE}/terminals`).then((r) => r.data);
export const ensureDisplayTerminal = (code: string, name?: string) =>
  api.post<ApiResponse<DisplayTerminal>>(`${BASE}/terminals/${encodeURIComponent(code)}/ensure`, { name }).then((r) => r.data);
export const updateDisplayTerminal = (code: string, data: { name?: string; isActive?: boolean }) =>
  api.put<ApiResponse<DisplayTerminal>>(`${BASE}/terminals/${encodeURIComponent(code)}`, data).then((r) => r.data);
export const regenerateDisplayTerminalKey = (code: string) =>
  api.post<ApiResponse<DisplayTerminal>>(`${BASE}/terminals/${encodeURIComponent(code)}/regenerate-key`).then((r) => r.data);
export const deleteDisplayTerminal = (code: string) =>
  api.delete<ApiResponse<null>>(`${BASE}/terminals/${encodeURIComponent(code)}`).then((r) => r.data);

/** Cashier → server bill snapshot (for customer screens on another PC). */
export const pushDisplayState = (code: string, state: DisplayState) =>
  api.put(`${BASE}/terminals/${encodeURIComponent(code)}/state`, state).then((r) => r.data);

/** What a terminal shows right now (admin live preview). */
export const getDisplayPreview = (terminal?: string) =>
  api
    .get<ApiResponse<{ settings: DisplaySettingsPublic; branding: DisplayBranding; banners: LiveBanner[] }>>(`${BASE}/preview`, {
      params: terminal ? { terminal } : undefined,
    })
    .then((r) => r.data);

// ─── Media upload (direct to Cloudinary, signed by the backend) ─────────────

export const DISPLAY_MEDIA_LIMITS = {
  image: { maxBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], label: 'JPG, PNG, WebP or GIF up to 5 MB' },
  video: { maxBytes: 50 * 1024 * 1024, types: ['video/mp4', 'video/webm'], label: 'MP4 or WebM up to 50 MB' },
} as const;

/** Returns an error message, or null when the file is acceptable for the given media type. */
export const validateDisplayMedia = (file: File, mediaType: 'image' | 'video'): string | null => {
  const rule = DISPLAY_MEDIA_LIMITS[mediaType];
  if (!(rule.types as readonly string[]).includes(file.type)) return `Use ${rule.label}`;
  if (file.size > rule.maxBytes) return `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is ${rule.maxBytes / 1024 / 1024} MB`;
  return null;
};

export interface UploadedDisplayMedia {
  url: string;
  publicId: string;
  posterUrl?: string;
  width?: number;
  height?: number;
}

/** Uploads straight from the browser to Cloudinary so large videos don't pass through the API. */
export const uploadDisplayMedia = async (
  file: File,
  mediaType: 'image' | 'video',
  onProgress?: (percent: number) => void
): Promise<UploadedDisplayMedia> => {
  const { data } = await api.post<ApiResponse<{ uploadUrl: string; apiKey: string; folder: string; timestamp: number; signature: string }>>(
    `${BASE}/upload-signature`,
    { resourceType: mediaType }
  );
  const sig = data.data;
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  const result = await new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(body?.error?.message || 'Upload failed'));
      } catch {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed: check your connection'));
    xhr.send(form);
  });

  const url: string = result.secure_url;
  return {
    url,
    publicId: result.public_id,
    // Cloudinary serves a video's first frame as a JPG: used as the poster while loading
    posterUrl: mediaType === 'video' ? url.replace(/\.[a-z0-9]+$/i, '.jpg') : undefined,
    width: result.width,
    height: result.height,
  };
};
