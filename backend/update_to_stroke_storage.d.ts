// Type declarations for update_to_stroke_storage.js

export function storeSignatureWithStrokeData(
  userId: string,
  strokeData: any,
  imageData: string,
  metrics?: any
): Promise<any>;

export function getSignatureData(
  userId: string
): Promise<any>;

export function extractStrokeData(
  data: any
): any;

export function initializeDatabase(): Promise<void>;