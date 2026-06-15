package com.securevault.backend.dto;

import lombok.Data;

@Data
public class ResetPasswordRequest {
    private String token;
    private String newPassword;
    private String newEncryptedDek;
    private String newDekIv;
}
