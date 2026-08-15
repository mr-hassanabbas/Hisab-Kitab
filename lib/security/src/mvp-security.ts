// MVP Security - Simplified permission checking for MVP
import type { ToolContext, ToolResult } from '@workspace/tools/src/types/tool-types';

export interface MVPSecurityContext {
  userId?: number;
  userRole?: string;
  token?: string;
  permissions?: string[];
}

export interface MVPPermissionCheck {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

export class MVPSecurityManager {
  private rolePermissions: Record<string, string[]> = {
    owner: ['*'],
    admin: ['attendance:*', 'workers:*', 'expenses:*', 'projects:*'],
    manager: ['attendance:read', 'attendance:write', 'workers:read', 'expenses:read', 'projects:read'],
    accountant: ['expenses:read', 'expenses:write', 'payment:read', 'payment:write'],
    worker: ['attendance:read', 'payment:read'],
    viewer: ['attendance:read', 'projects:read', 'expenses:read']
  };

  /**
   * Check if user has permission for a tool
   */
  checkPermission(toolName: string, requiredPermission: string, context: MVPSecurityContext): MVPPermissionCheck {
    const userRole = context.userRole || 'viewer';
    const userPermissions = this.rolePermissions[userRole] || [];

    // Check wildcard permission
    if (userPermissions.includes('*')) {
      return { allowed: true };
    }

    // Check specific permission
    if (userPermissions.includes(requiredPermission)) {
      return { allowed: true };
    }

    // Check wildcard category permission
    const [category] = requiredPermission.split(':');
    const wildcardPermission = `${category}:*`;
    if (userPermissions.includes(wildcardPermission)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `User role '${userRole}' does not have permission '${requiredPermission}'`
    };
  }

  /**
   * Assess risk level for tool execution
   */
  assessRiskLevel(toolName: string, params: Record<string, any>): 'low' | 'medium' | 'high' {
    // High-risk operations
    const highRiskTools = ['delete_worker', 'delete_project', 'delete_expense'];
    if (highRiskTools.includes(toolName)) {
      return 'high';
    }

    // Medium-risk operations (write operations)
    const mediumRiskPatterns = ['create_', 'add_', 'update_', 'mark_'];
    if (mediumRiskPatterns.some(pattern => toolName.startsWith(pattern))) {
      return 'medium';
    }

    // Check for high amounts in expenses
    if (toolName === 'add_expense' && params.amount > 10000) {
      return 'high';
    }

    // Default to low for read operations
    return 'low';
  }

  /**
   * Determine if confirmation is required
   */
  requiresConfirmation(toolName: string, params: Record<string, any>, context: MVPSecurityContext): boolean {
    const riskLevel = this.assessRiskLevel(toolName, params);
    
    // High-risk always requires confirmation
    if (riskLevel === 'high') {
      return true;
    }

    // Medium-risk requires confirmation for non-admin users
    if (riskLevel === 'medium' && context.userRole !== 'admin' && context.userRole !== 'owner') {
      return true;
    }

    // Specific tools always require confirmation
    const confirmationRequiredTools = ['create_worker', 'add_expense'];
    if (confirmationRequiredTools.includes(toolName)) {
      return true;
    }

    return false;
  }

  /**
   * Validate input parameters for security
   */
  validateInput(toolName: string, params: Record<string, any>): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION|SCRIPT)\b)/i,
      /(;|--|\/\*|\*\/)/,
      /(\bOR\b.*=.*\bOR\b)/i
    ];

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        for (const pattern of sqlPatterns) {
          if (pattern.test(value)) {
            issues.push(`Potential SQL injection in parameter '${key}'`);
          }
        }
      }
    }

    // Check for XSS patterns
    const xssPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i];
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        for (const pattern of xssPatterns) {
          if (pattern.test(value)) {
            issues.push(`Potential XSS in parameter '${key}'`);
          }
        }
      }
    }

    // Validate specific parameter types
    if (params.amount && typeof params.amount !== 'number') {
      issues.push('Amount must be a number');
    }

    if (params.amount && params.amount < 0) {
      issues.push('Amount cannot be negative');
    }

    if (params.amount && params.amount > 1000000) {
      issues.push('Amount exceeds reasonable limit');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Sanitize input parameters
   */
  sanitizeInput(params: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        sanitized[key] = value
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      } else if (typeof value === 'number') {
        // Ensure numbers are within reasonable bounds
        sanitized[key] = Math.max(0, Math.min(value, 1000000));
      } else if (Array.isArray(value)) {
        // Recursively sanitize arrays
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? item.replace(/[<>]/g, '').trim() : item
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: {
    type: 'permission_check' | 'risk_assessment' | 'input_validation' | 'tool_execution';
    toolName: string;
    userId?: number;
    userRole?: string;
    result: 'allowed' | 'denied' | 'warning';
    details?: string;
  }): void {
    // MVP: Simple console logging (in production, this would go to audit log)
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...event
    };
    
    console.log('[MVP Security]', JSON.stringify(logEntry));
    
    // In production, this would be stored in the ai_action_logs table
    // For MVP, we rely on existing audit infrastructure
  }

  /**
   * Complete security check for tool execution
   */
  async securityCheck(
    toolName: string,
    requiredPermission: string,
    params: Record<string, any>,
    context: MVPSecurityContext
  ): Promise<{ allowed: boolean; reason?: string; sanitizedParams?: Record<string, any> }> {
    // Step 1: Permission check
    const permissionCheck = this.checkPermission(toolName, requiredPermission, context);
    if (!permissionCheck.allowed) {
      this.logSecurityEvent({
        type: 'permission_check',
        toolName,
        userId: context.userId,
        userRole: context.userRole,
        result: 'denied',
        details: permissionCheck.reason
      });
      return permissionCheck;
    }

    // Step 2: Input validation
    const validation = this.validateInput(toolName, params);
    if (!validation.valid) {
      this.logSecurityEvent({
        type: 'input_validation',
        toolName,
        userId: context.userId,
        userRole: context.userRole,
        result: 'denied',
        details: validation.issues.join(', ')
      });
      return {
        allowed: false,
        reason: `Input validation failed: ${validation.issues.join(', ')}`
      };
    }

    // Step 3: Risk assessment
    const riskLevel = this.assessRiskLevel(toolName, params);
    const needsConfirmation = this.requiresConfirmation(toolName, params, context);

    this.logSecurityEvent({
      type: 'risk_assessment',
      toolName,
      userId: context.userId,
      userRole: context.userRole,
      result: needsConfirmation ? 'warning' : 'allowed',
      details: `Risk level: ${riskLevel}, Confirmation required: ${needsConfirmation}`
    });

    // Step 4: Sanitize input
    const sanitizedParams = this.sanitizeInput(params);

    return {
      allowed: true,
      sanitizedParams
    };
  }

  /**
   * Update role permissions (for admin use)
   */
  updateRolePermissions(role: string, permissions: string[]): void {
    this.rolePermissions[role] = permissions;
  }

  /**
   * Get current role permissions
   */
  getRolePermissions(role: string): string[] {
    return this.rolePermissions[role] || [];
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(userRole: string, permission: string): boolean {
    const userPermissions = this.rolePermissions[userRole] || [];
    
    if (userPermissions.includes('*')) {
      return true;
    }

    if (userPermissions.includes(permission)) {
      return true;
    }

    const [category] = permission.split(':');
    const wildcardPermission = `${category}:*`;
    return userPermissions.includes(wildcardPermission);
  }
}
