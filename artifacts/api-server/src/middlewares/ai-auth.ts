import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger.js";
import { authenticate, type JwtPayload } from "./auth.js";
import { AIRateLimiter, InputValidator } from "@workspace/security";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      aiContext?: AIContext;
    }
  }
}

// Rate limiter instance
const aiRateLimiter = new AIRateLimiter();

/**
 * AI-specific authentication middleware
 * Verifies JWT token and checks if user has AI access permission
 */
export async function aiAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  logger.info({ url: req.url }, "AI authentication check");
  
  // First authenticate user
  await authenticate(req, res, (err) => {
    if (err) return;
    
    // Check if user has AI access permission
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: "User not authenticated" });
      return;
    }

    // Check AI access permission
    const hasAIAccess = checkAIAccess(user);
    if (!hasAIAccess) {
      logger.warn({ userId: user.id, role: user.role }, "AI access denied");
      res.status(403).json({ success: false, error: "AI access not permitted" });
      return;
    }

    // Log AI request initiation
    logger.info({ userId: user.id, role: user.role }, "AI authentication successful");
    
    // Add AI-specific context to request
    req.aiContext = {
      userId: user.id,
      userRole: user.role || "admin",
      sessionId: generateSessionId(),
      requestStartTime: Date.now()
    };

    next();
  });
}

/**
 * Rate limiting middleware for AI endpoints
 * Stricter limits for AI endpoints to prevent abuse and control costs
 */
export function aiRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  logger.info({ url: req.url }, "AI rate limit check");
  
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: "User not authenticated" });
    return;
  }

  const identifier = `ai-${user.id}`;
  const result = aiRateLimiter.isAllowed(identifier);

  if (!result.allowed) {
    logger.warn({ userId: user.id }, "AI rate limit exceeded");
    res.status(429).json({
      success: false,
      error: "Rate limit exceeded",
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', 10);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

  logger.info({ ip: req.ip, remaining: result.remaining }, "AI rate limit check passed");
  next();
}

/**
 * Request validation middleware for AI endpoints
 * Validates AI request structure and content
 */
export function aiRequestValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  logger.info({ url: req.url, method: req.method }, "AI request validation");
  
  // Basic validation
  if (req.method === 'POST' && !req.body) {
    res.status(400).json({ success: false, error: "Request body is required" });
    return;
  }

  // Validate transcript if present
  if (req.body.transcript) {
    const validation = InputValidator.validateTranscript(req.body.transcript);
    if (!validation.valid) {
      logger.warn({ error: validation.error }, "Invalid transcript");
      res.status(400).json({ success: false, error: validation.error });
      return;
    }
    req.body.transcript = validation.sanitized;
  }

  // Validate tool parameters if present
  if (req.body.tool && req.body.parameters) {
    const validation = InputValidator.validateToolParameters(req.body.tool, req.body.parameters);
    if (!validation.valid) {
      logger.warn({ errors: validation.errors }, "Invalid tool parameters");
      res.status(400).json({ success: false, error: "Invalid parameters", details: validation.errors });
      return;
    }
  }

  logger.info("AI request validation passed");
  next();
}

/**
 * Check if user has AI access permission
 */
function checkAIAccess(user: JwtPayload): boolean {
  const role = user.role || "admin";
  const allowedRoles = ["admin", "owner", "manager"];
  return allowedRoles.includes(role);
}

/**
 * Generate unique session ID for AI requests
 */
function generateSessionId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * AI context interface
 */
interface AIContext {
  userId: number;
  userRole: string;
  sessionId: string;
  requestStartTime: number;
}