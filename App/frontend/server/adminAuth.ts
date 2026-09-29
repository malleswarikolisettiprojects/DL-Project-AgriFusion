/**
 * AgriFusion Admin Authentication & Authorization Middleware
 * Enforces server-side authentication, token validation, and role checks.
 */

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { adminStore, type ServerUser } from './adminStore';

// Salted hash helper using native node crypto
export function hashPassword(password: string, salt = 'agrifusion_secure_salt_2026'): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

// Configured admin credentials from environment or secure defaults
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@agrifusion.org';
const DEFAULT_ADMIN_PASS = process.env.ADMIN_INITIAL_PASSWORD || 'AgriAdmin@2026';
const ADMIN_PASSWORD_HASH = hashPassword(DEFAULT_ADMIN_PASS);

export interface AuthenticatedAdminRequest extends Request {
  adminUser?: ServerUser;
  sessionToken?: string;
}

/**
 * Extract token from Authorization header (Bearer) or Cookie
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Parse Cookie header if present
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith('agrifusion_admin_token=')) {
        return c.substring('agrifusion_admin_token='.length);
      }
    }
  }

  return null;
}

/**
 * Verify session token and retrieve user
 */
export function getSessionUser(token: string | null): ServerUser | null {
  if (!token) return null;
  const session = adminStore.sessions.get(token);
  if (!session) return null;

  // Check expiration (24 hour TTL)
  if (Date.now() > session.expiresAt) {
    adminStore.sessions.delete(token);
    return null;
  }

  const user = adminStore.users.find((u) => u.id === session.userId);
  if (!user || user.status !== 'active') return null;

  return user;
}

/**
 * Admin Login Handler
 */
export function verifyAdminCredentials(email: string, pass: string): { user: ServerUser; token: string } | null {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const inputHash = hashPassword(pass || '');

  // Check primary administrator
  if (normalizedEmail === DEFAULT_ADMIN_EMAIL.toLowerCase() && inputHash === ADMIN_PASSWORD_HASH) {
    let adminUser = adminStore.users.find((u) => u.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase());
    if (!adminUser) {
      adminUser = {
        id: 'usr-admin-01',
        name: 'System Administrator',
        email: DEFAULT_ADMIN_EMAIL,
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastSignIn: new Date().toISOString(),
      };
      adminStore.users.unshift(adminUser);
    } else {
      adminUser.lastSignIn = new Date().toISOString();
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    adminStore.sessions.set(token, { userId: adminUser.id, role: 'admin', expiresAt });

    // Audit log
    adminStore.log(adminUser.id, adminUser.name, 'ADMIN_LOGIN', 'AUTH_PORTAL', 'SESSION_CREATE', {
      email: adminUser.email,
    });

    return { user: adminUser, token };
  }

  return null;
}

/**
 * Admin Authorization Middleware
 * Rejects unauthenticated requests with 401 and non-admin requests with 403.
 */
export function requireAdmin(req: AuthenticatedAdminRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ detail: 'Authentication required. Please provide a valid admin token.' });
    return;
  }

  const user = getSessionUser(token);
  if (!user) {
    res.status(401).json({ detail: 'Invalid or expired session. Please sign in again.' });
    return;
  }

  if (user.role !== 'admin') {
    res.status(403).json({ detail: 'Admin access required. Your account lacks administrative privileges.' });
    return;
  }

  req.adminUser = user;
  req.sessionToken = token;
  next();
}
