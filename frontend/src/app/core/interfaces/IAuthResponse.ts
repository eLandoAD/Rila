export interface IAuthResponse {
  token: string | null;
  message: string;
  encryptedDek?: string;
  dekIv?: string;
  keySalt?: string;
  verificationToken?: string;
  encryptedPrivateKey?: string;
  privateKeyIv?: string;
}