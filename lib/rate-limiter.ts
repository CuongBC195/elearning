/**
 * Rate Limiter & Security Module
 * Protect API from spam, abuse, and token exhaustion
 */

// Check if running in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
  blocked: boolean;
  blockUntil?: number;
}

interface RequestLog {
  timestamp: number;
  endpoint: string;
  ip: string;
  userAgent: string;
}

// In-memory storage (consider Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();
const requestLogs: RequestLog[] = [];
const suspiciousIPs = new Set<string>();

// Configuration - relaxed for dev, strict for production
const CONFIG = {
  // Rate limits per minute (more relaxed in dev)
  REQUESTS_PER_MINUTE: isDevelopment ? 30 : 10,
  REQUESTS_PER_HOUR: isDevelopment ? 500 : 100,
  
  // Block duration (shorter in dev)
  BLOCK_DURATION_MS: isDevelopment ? 30 * 1000 : 5 * 60 * 1000,  // 30s dev, 5min prod
  PERMANENT_BLOCK_THRESHOLD: 5,
  
  // Request validation (disabled min interval in dev)
  MIN_REQUEST_INTERVAL_MS: isDevelopment ? 500 : 2000,  // 0.5s dev, 2s prod
  MAX_CONTENT_LENGTH: 10000,
  
  // Suspicious behavior detection
  BURST_THRESHOLD: isDevelopment ? 15 : 5,
  BURST_WINDOW_MS: 10000,
  
  // Cleanup
  CLEANUP_INTERVAL_MS: 60 * 1000,
  LOG_RETENTION_MS: 60 * 60 * 1000,
};

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  
  // Cleanup rate limit entries older than 1 hour
  rateLimitStore.forEach((entry, key) => {
    if (now - entry.lastRequest > 60 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  });
  
  // Cleanup old request logs
  const cutoff = now - CONFIG.LOG_RETENTION_MS;
  while (requestLogs.length > 0 && requestLogs[0].timestamp < cutoff) {
    requestLogs.shift();
  }
}, CONFIG.CLEANUP_INTERVAL_MS);

/**
 * Get client identifier (IP + User Agent hash)
 */
export function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Simple hash for client identification
  const hash = Buffer.from(`${ip}-${userAgent}`).toString('base64').slice(0, 20);
  return `${ip}-${hash}`;
}

/**
 * Check if request is from localhost (for dev)
 */
function isLocalhost(clientId: string): boolean {
  return clientId.startsWith('::1') || 
         clientId.startsWith('127.0.0.1') || 
         clientId.startsWith('localhost');
}

/**
 * Clear rate limit for a client (useful for testing)
 */
export function clearRateLimit(clientId?: string): void {
  if (clientId) {
    rateLimitStore.delete(clientId);
  } else {
    rateLimitStore.clear();
  }
  console.log('[RATE LIMIT] Cleared rate limit data');
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(clientId: string): {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
} {
  // In development, be very lenient with localhost
  if (isDevelopment && isLocalhost(clientId)) {
    // Still track but with much higher limits
    const now = Date.now();
    let entry = rateLimitStore.get(clientId);
    
    if (!entry) {
      entry = {
        count: 0,
        firstRequest: now,
        lastRequest: now,
        blocked: false,
      };
      rateLimitStore.set(clientId, entry);
    }
    
    // Auto-unblock localhost in dev after 30 seconds
    if (entry.blocked && entry.blockUntil && now >= entry.blockUntil) {
      entry.blocked = false;
      entry.count = 0;
      entry.firstRequest = now;
    }
    
    // Reset if window expired
    if (now - entry.firstRequest > 60 * 1000) {
      entry.count = 0;
      entry.firstRequest = now;
    }
    
    entry.count++;
    entry.lastRequest = now;
    
    // Only block if really abusive (50+ requests/minute in dev)
    if (entry.count > 50) {
      entry.blocked = true;
      entry.blockUntil = now + 30 * 1000; // Only 30 seconds in dev
      return {
        allowed: false,
        reason: '[DEV] Quá nhiều request. Đợi 30 giây.',
        retryAfter: 30,
      };
    }
    
    return { allowed: true };
  }

  // Production rate limiting
  const now = Date.now();
  let entry = rateLimitStore.get(clientId);
  
  // Initialize entry if not exists
  if (!entry) {
    entry = {
      count: 0,
      firstRequest: now,
      lastRequest: now,
      blocked: false,
    };
    rateLimitStore.set(clientId, entry);
  }
  
  // Check if currently blocked
  if (entry.blocked) {
    if (entry.blockUntil && now < entry.blockUntil) {
      const retryAfter = Math.ceil((entry.blockUntil - now) / 1000);
      return {
        allowed: false,
        reason: `Bạn đã bị tạm khóa do gửi quá nhiều request. Vui lòng đợi ${retryAfter} giây.`,
        retryAfter,
      };
    } else {
      // Unblock after duration
      entry.blocked = false;
      entry.count = 0;
      entry.firstRequest = now;
    }
  }
  
  // Check minimum interval between requests
  const timeSinceLastRequest = now - entry.lastRequest;
  if (timeSinceLastRequest < CONFIG.MIN_REQUEST_INTERVAL_MS) {
    return {
      allowed: false,
      reason: 'Vui lòng đợi 2 giây giữa các lần gửi.',
      retryAfter: Math.ceil((CONFIG.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest) / 1000),
    };
  }
  
  // Reset counter if window expired (1 minute)
  const windowMs = 60 * 1000;
  if (now - entry.firstRequest > windowMs) {
    entry.count = 0;
    entry.firstRequest = now;
  }
  
  // Check rate limit
  entry.count++;
  entry.lastRequest = now;
  
  if (entry.count > CONFIG.REQUESTS_PER_MINUTE) {
    // Block the client
    entry.blocked = true;
    entry.blockUntil = now + CONFIG.BLOCK_DURATION_MS;
    
    console.warn(`[RATE LIMIT] Client ${clientId} blocked for exceeding rate limit`);
    
    return {
      allowed: false,
      reason: `Bạn đã vượt quá giới hạn ${CONFIG.REQUESTS_PER_MINUTE} request/phút. Tài khoản bị tạm khóa 5 phút.`,
      retryAfter: CONFIG.BLOCK_DURATION_MS / 1000,
    };
  }
  
  return { allowed: true };
}

/**
 * Detect suspicious behavior patterns
 */
export function detectSuspiciousBehavior(clientId: string, request: Request): {
  suspicious: boolean;
  reason?: string;
} {
  const userAgent = request.headers.get('user-agent') || '';
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  
  // Check for common bot/tool user agents
  const suspiciousAgents = [
    'postman', 'insomnia', 'curl', 'wget', 'python-requests',
    'httpie', 'axios', 'node-fetch', 'go-http-client', 'java',
    'apache-httpclient', 'okhttp', 'rest-client', 'thunder client'
  ];
  
  const lowerUA = userAgent.toLowerCase();
  for (const agent of suspiciousAgents) {
    if (lowerUA.includes(agent)) {
      console.warn(`[SECURITY] Suspicious user agent detected: ${userAgent}`);
      return {
        suspicious: true,
        reason: 'Request từ công cụ tự động không được phép.',
      };
    }
  }
  
  // Check for missing or invalid origin (not from our app)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://your-production-domain.com', // Update this for production
  ];
  
  // Allow requests without origin (same-origin) but log them
  if (origin && !allowedOrigins.some(o => origin.startsWith(o.replace(/:\d+$/, '')))) {
    console.warn(`[SECURITY] Request from unauthorized origin: ${origin}`);
    // Don't block, just log for now
  }
  
  // Check for empty user agent (likely automated)
  if (!userAgent || userAgent.length < 10) {
    return {
      suspicious: true,
      reason: 'Request không hợp lệ.',
    };
  }
  
  // Check for burst requests (rapid fire)
  const now = Date.now();
  const recentRequests = requestLogs.filter(
    log => log.ip === clientId && now - log.timestamp < CONFIG.BURST_WINDOW_MS
  );
  
  if (recentRequests.length >= CONFIG.BURST_THRESHOLD) {
    suspiciousIPs.add(clientId);
    console.warn(`[SECURITY] Burst detected from ${clientId}: ${recentRequests.length} requests in ${CONFIG.BURST_WINDOW_MS}ms`);
    return {
      suspicious: true,
      reason: 'Phát hiện hành vi bất thường. Vui lòng thử lại sau.',
    };
  }
  
  return { suspicious: false };
}

/**
 * Validate request body
 */
export function validateRequestBody(body: any, requiredFields: string[]): {
  valid: boolean;
  reason?: string;
} {
  // Check if body exists
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      reason: 'Request body không hợp lệ.',
    };
  }
  
  // Check required fields
  for (const field of requiredFields) {
    if (!(field in body) || body[field] === undefined || body[field] === null) {
      return {
        valid: false,
        reason: `Thiếu trường bắt buộc: ${field}`,
      };
    }
  }
  
  // Check content length
  const bodyString = JSON.stringify(body);
  if (bodyString.length > CONFIG.MAX_CONTENT_LENGTH) {
    return {
      valid: false,
      reason: 'Nội dung request quá dài.',
    };
  }
  
  // Sanitize string fields (basic XSS prevention)
  for (const key in body) {
    if (typeof body[key] === 'string') {
      // Check for potential injection
      const suspicious = /<script|javascript:|on\w+=/i.test(body[key]);
      if (suspicious) {
        console.warn(`[SECURITY] Potential XSS attempt in field ${key}`);
        return {
          valid: false,
          reason: 'Nội dung không hợp lệ.',
        };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Log request for monitoring
 */
export function logRequest(clientId: string, endpoint: string, request: Request): void {
  requestLogs.push({
    timestamp: Date.now(),
    endpoint,
    ip: clientId,
    userAgent: request.headers.get('user-agent') || 'unknown',
  });
  
  // Keep only last 1000 logs in memory
  if (requestLogs.length > 1000) {
    requestLogs.shift();
  }
}

/**
 * Get security stats (for monitoring)
 */
export function getSecurityStats(): {
  totalRequests: number;
  blockedClients: number;
  suspiciousIPs: number;
  requestsLastMinute: number;
} {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  
  let blockedCount = 0;
  rateLimitStore.forEach(entry => {
    if (entry.blocked) blockedCount++;
  });
  
  return {
    totalRequests: requestLogs.length,
    blockedClients: blockedCount,
    suspiciousIPs: suspiciousIPs.size,
    requestsLastMinute: requestLogs.filter(log => log.timestamp > oneMinuteAgo).length,
  };
}

/**
 * Main security middleware function
 */
export async function securityCheck(
  request: Request,
  endpoint: string,
  requiredFields: string[] = []
): Promise<{
  allowed: boolean;
  error?: {
    message: string;
    status: number;
    retryAfter?: number;
  };
  clientId: string;
  body?: any;
}> {
  const clientId = getClientId(request);
  
  // Log the request
  logRequest(clientId, endpoint, request);
  
  // Check for suspicious behavior first
  const suspiciousCheck = detectSuspiciousBehavior(clientId, request);
  if (suspiciousCheck.suspicious) {
    return {
      allowed: false,
      error: {
        message: suspiciousCheck.reason || 'Request bị từ chối.',
        status: 403,
      },
      clientId,
    };
  }
  
  // Check rate limit
  const rateLimitCheck = checkRateLimit(clientId);
  if (!rateLimitCheck.allowed) {
    return {
      allowed: false,
      error: {
        message: rateLimitCheck.reason || 'Quá nhiều request.',
        status: 429,
        retryAfter: rateLimitCheck.retryAfter,
      },
      clientId,
    };
  }
  
  // Parse and validate body if needed
  if (requiredFields.length > 0) {
    try {
      const body = await request.json();
      const validation = validateRequestBody(body, requiredFields);
      
      if (!validation.valid) {
        return {
          allowed: false,
          error: {
            message: validation.reason || 'Request không hợp lệ.',
            status: 400,
          },
          clientId,
        };
      }
      
      return { allowed: true, clientId, body };
    } catch (e) {
      return {
        allowed: false,
        error: {
          message: 'Không thể parse request body.',
          status: 400,
        },
        clientId,
      };
    }
  }
  
  return { allowed: true, clientId };
}
