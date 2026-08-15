import { Request, Response, NextFunction } from "express";

// Temporary placeholder - zod import will be added when package installation completes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateBody(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Placeholder validation - will be replaced with actual zod validation
    // when package installation completes
    next();
  };
}
