import { Router } from 'express';
import {
    getAdminHeaderCategories,
    getHeaderCategories,
    createHeaderCategory,
    updateHeaderCategory,
    deleteHeaderCategory,
    updateHeaderSubscription,
} from '../modules/admin/controllers/headerCategoryController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

// Public route to get published categories
router.get('/', getHeaderCategories);

// Protected Admin routes
router.get('/admin', authenticate, requireUserType('Admin'), getAdminHeaderCategories);
router.post('/', authenticate, requireUserType('Admin'), createHeaderCategory);
router.put('/:id', authenticate, requireUserType('Admin'), updateHeaderCategory);
// Subscription rule for the whole header category (all its categories and subcategories)
router.put('/:id/subscription', authenticate, requireUserType('Admin'), updateHeaderSubscription);
router.delete('/:id', authenticate, requireUserType('Admin'), deleteHeaderCategory);

export default router;
