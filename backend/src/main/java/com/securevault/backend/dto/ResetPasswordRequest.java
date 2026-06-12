package com.securevault.backend.dto;

import lombok.Data;

@Data
public class ResetPasswordRequest {
    private String token;
    private String newPassword;

    // New envelope material: the DEK re-wrapped under the new password (client-side)
    private String newEncryptedDek;
    private String newDekIv;
    private String newKeySalt;
}
