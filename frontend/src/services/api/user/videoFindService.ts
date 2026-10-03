import api from '../config';

export interface VideoFind {
  _id: string;
  id?: string; // Some parts of the UI use .id instead of ._id
  title: string;
  price: number;
  originalPrice: number;
  videoUrl: string;
  views: string;
  likes: string[];
  shares: number;
  linkedProduct?: {
      _id: string;
      productName: string;
      price: number;
      stock?: number;
      mainImage?: string;
  };
}

export const getVideoFinds = async (location?: { latitude?: number; longitude?: number }) => {
  // Customer app passes the user's location so only nearby stores' videos are returned
  const response = await api.get<{ success: boolean; data: VideoFind[] }>('/customer/video-finds', {
    params: { latitude: location?.latitude, longitude: location?.longitude },
  });
  return response.data;
};

export const toggleLikeVideo = async (videoId: string) => {
  const response = await api.post<{ success: boolean; data: VideoFind; isLiked: boolean }>(`/customer/video-finds/${videoId}/like`);
  return response.data;
};

export const incrementShareCount = async (videoId: string) => {
  const response = await api.post<{ success: boolean; data: VideoFind }>(`/customer/video-finds/${videoId}/share`);
  return response.data;
};
