import bcrypt from 'bcryptjs';
import prisma from '../db/prisma.js';
import { signToken } from '../utils/token.js';
import { isValidEmail, sanitizeString } from '../utils/validator.js';

export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const cleanUsername = sanitizeString(username);
    const cleanEmail = sanitizeString(email).toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanEmail }, { username: cleanUsername }],
      },
    });

    if (existing) {
      if (existing.email === cleanEmail) {
        return res.status(409).json({ error: 'Email already registered.' });
      }
      return res.status(409).json({ error: 'Username already taken.' });
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Initial avatar url using stylish dicebear/initials
    const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUsername)}`;

    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        password_hash,
        avatar_url,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar_url: true,
        created_at: true,
      },
    });

    const token = signToken({ userId: user.id });

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { loginId, password } = req.body;

    const identifier = sanitizeString(loginId);
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = signToken({ userId: user.id });

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    };

    return res.json({
      message: 'Login successful',
      token,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  return res.json({ user: req.user });
};
