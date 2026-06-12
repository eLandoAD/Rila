export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  encryptedDek: string;
  dekIv: string;
  keySalt: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  token: string | null;
  message: string;
  encryptedDek?: string | null;
  dekIv?: string | null;
  keySalt?: string | null;
}
