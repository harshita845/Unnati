import mongoose from "mongoose";
import Seller from "../models/Seller";

/**
 * Helper function to calculate distance between two coordinates (Haversine formula)
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find sellers whose service radius covers the user's location
 * @param userLat User's latitude
 * @param userLng User's longitude
 * @returns Array of seller IDs within range
 */
export async function findSellersWithinRange(
  userLat: number,
  userLng: number
): Promise<mongoose.Types.ObjectId[]> {
  if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
    return [];
  }

  // Validate coordinates
  if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
    return [];
  }

  try {
    // Fetch all approved sellers with location or Admin status
    // Only stores whose delivery radius covers the user. (The Admin Store used to be included
    // everywhere, but it has no real location, so its products showed in every city and then
    // failed at checkout as out of range.)
    const sellers = await Seller.find({
      status: "Approved",
      location: { $exists: true, $ne: null },
      // Store-wide plan rule: stores without an active plan are hidden from customers
      subscriptionLocked: { $ne: true },
    }).select("_id location serviceRadiusKm email category storeName");

    // Keep sellers whose service radius covers the user
    const nearbySellerIds: mongoose.Types.ObjectId[] = [];

    for (const seller of sellers) {
      const coords = seller.location?.coordinates;
      if (coords && coords.length === 2 && !(coords[0] === 0 && coords[1] === 0)) {
        const sellerLng = coords[0];
        const sellerLat = coords[1];
        const distance = calculateDistance(
          userLat,
          userLng,
          sellerLat,
          sellerLng
        );
        const serviceRadius = seller.serviceRadiusKm || 10; // Default to 10km if not set

        if (distance <= serviceRadius) {
          nearbySellerIds.push(seller._id as mongoose.Types.ObjectId);
        }
      }
    }

    return nearbySellerIds;
  } catch (error) {
    console.error("Error finding nearby sellers:", error);
    return [];
  }
}
