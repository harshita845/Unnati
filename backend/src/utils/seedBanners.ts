import { Banner } from '../models/Banner';
import HeaderCategory from '../models/HeaderCategory';

export const seedDefaultBanners = async () => {
  try {
    const mainCount = await Banner.countDocuments({ position: 'Main Banner' });
    if (mainCount === 0) {
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
      console.log('✓ Default Main banners seeded in database');
    }

    const flashCount = await Banner.countDocuments({ position: 'Flash Deals' });
    if (flashCount === 0) {
      const fashion = await HeaderCategory.findOne({ name: 'Fashion' }).select('_id name').lean();
      const electronics = await HeaderCategory.findOne({ name: 'Electronics' }).select('_id name').lean();
      const grocery = await HeaderCategory.findOne({ name: 'Grocery' }).select('_id name').lean();

      await Banner.insertMany([
        {
          position: 'Flash Deals',
          title: 'Weekend Deals',
          subtitle: 'Fresh items on discount!',
          resourceType: 'Category',
          resourceId: fashion?._id ? String(fashion._id) : undefined,
          resourceName: 'Fashion',
          categoryName: 'Fashion',
          redirectType: 'CATEGORY',
          redirectValue: fashion?._id ? String(fashion._id) : 'Fashion',
          imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&auto=format&fit=crop&q=80',
          isActive: true,
        },
        {
          position: 'Flash Deals',
          title: 'Flash Sale',
          subtitle: 'Shop now before it ends!',
          resourceType: 'Category',
          resourceId: electronics?._id ? String(electronics._id) : undefined,
          resourceName: 'Electronics',
          categoryName: 'Electronics',
          redirectType: 'CATEGORY',
          redirectValue: electronics?._id ? String(electronics._id) : 'Electronics',
          imageUrl: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&auto=format&fit=crop&q=80',
          isActive: true,
        },
        {
          position: 'Flash Deals',
          title: 'Super Saver',
          subtitle: 'Hurry up, stock is limited!',
          resourceType: 'Category',
          resourceId: grocery?._id ? String(grocery._id) : undefined,
          resourceName: 'Grocery',
          categoryName: 'Grocery',
          redirectType: 'CATEGORY',
          redirectValue: grocery?._id ? String(grocery._id) : 'Grocery',
          imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&auto=format&fit=crop&q=80',
          isActive: true,
        },
      ]);
      console.log('✓ Default Flash Deals banners seeded in database');
    }
  } catch (err) {
    console.error('Failed to seed default banners:', err);
  }
};
