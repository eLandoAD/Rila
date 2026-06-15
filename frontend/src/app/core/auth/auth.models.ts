export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  encryptedDek?: string;
  dekIv?: string;
  keySalt?: string;
  recoveryEncryptedDek?: string;
  recoveryDekIv?: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  token: string | null;
  message: string;
  encryptedDek?: string;
  dekIv?: string;
  keySalt?: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  newEncryptedDek: string;
  newDekIv: string;
}

export interface ResetInfoResponse {
  recoveryEncryptedDek: string;
  recoveryDekIv: string;
  keySalt: string;
}
