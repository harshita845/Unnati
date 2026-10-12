import { Banner } from '../models/Banner';

export const seedDefaultBanners = async () => {
  try {
    const count = await Banner.countDocuments();
    if (count === 0) {
      await Banner.insertMany([
        {
          position: 'Main Banner',
          resourceType: 'Category',
          resourceName: 'Grocery',
          imageUrl: '/grocery_banner.jpg',
          isActive: true,
        },
        {
          position: 'Main Banner',
          resourceType: 'Category',
          resourceName: 'Electronics',
          imageUrl: '/electronics_banner.jpg',
          isActive: true,
        },
        {
          position: 'Main Banner',
          resourceType: 'Category',
          resourceName: 'Fashion',
          imageUrl: '/fashion_banner.jpg',
          isActive: true,
        },
      ]);
      console.log('✓ Default banners seeded in database');
    }
  } catch (err) {
    console.error('Failed to seed default banners:', err);
  }
};
