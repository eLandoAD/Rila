package com.securevault.backend.dto;

import lombok.Data;


@Data
public class RegisterRequest {
    private String username;
    private String email;
    private String password;
    private String encryptedDek;
    private String dekIv;
    private String keySalt;
    private String recoveryEncryptedDek;
    private String recoveryDekIv;
}
