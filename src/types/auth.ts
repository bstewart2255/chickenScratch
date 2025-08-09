// Authentication-specific type definitions

export interface DeviceInfo {
  userAgent: string;
  ipAddress: string;
  deviceId?: string;
  platform: string;
  browser: string;
  screenResolution?: string;
  timezone: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  deviceInfo?: DeviceInfo;
}

export interface RegistrationData {
  name: string;
  email: string;
  password: string;
  deviceInfo?: DeviceInfo;
}

export interface PasswordResetRequest {
  email: string;
  token: string;
  newPassword: string;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  deviceInfo: DeviceInfo;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface AuthSession {
  user: User;
  session: SessionData;
  permissions: string[];
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy: string;
} 