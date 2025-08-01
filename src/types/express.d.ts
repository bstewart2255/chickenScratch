// import { Request } from 'express'; // Unused import removed

declare global {
  namespace Express {
    interface Request {
      validatedBody?: Record<string, unknown>;
      validatedQuery?: Record<string, unknown>;
      validatedParams?: Record<string, unknown>;
    }
  }
}

export {}; 