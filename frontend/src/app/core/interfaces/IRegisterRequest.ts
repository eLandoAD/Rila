export interface IRegisterRequest {
  username: string;
  email: string;
  password: string;
  encryptedDek?: string;
  dekIv?: string;
  keySalt?: string;
  recoveryEncryptedDek?: string;
  recoveryDekIv?: string;
  publicKey?: string;
  encryptedPrivateKey?: string;
  privateKeyIv?: string;
}
