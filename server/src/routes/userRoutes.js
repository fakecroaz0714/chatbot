import { Router } from 'express';
import { getUsers, getUserById } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', getUsers);
router.get('/:id', getUserById);

export default router;
