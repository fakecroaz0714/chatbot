import { Router } from 'express';
import {
  getConversations,
  createConversation,
  getConversationById,
} from '../controllers/conversationController.js';
import { getMessages } from '../controllers/messageController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', getConversations);
router.post('/', createConversation);
router.get('/:id', getConversationById);
router.get('/:id/messages', getMessages);

export default router;
