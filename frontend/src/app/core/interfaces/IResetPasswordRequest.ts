export interface IResetPasswordRequest {
  token: string;
  newPassword: string;
  newEncryptedDek: string;
  newDekIv: string;
}