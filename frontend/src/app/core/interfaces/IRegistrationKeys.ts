export interface IRegistrationKeys {
    encryptedDek: string;
    iv: string;
    salt: string;
    recoveryKey: string;
    recoveryEncryptedDek: string;
    recoveryDekIv: string;
    publicKey: string;
    encryptedPrivateKey: string;
    privateKeyIv: string;
}
