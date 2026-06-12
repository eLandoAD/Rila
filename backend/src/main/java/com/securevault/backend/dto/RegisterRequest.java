package com.securevault.backend.dto;

import lombok.Data;


@Data
public class RegisterRequest {
    private String username;
    private String email;
    private String password;

    // Envelope encryption material generated client-side (the server never sees the plaintext DEK)
    private String encryptedDek;
    private String dekIv;
    private String keySalt;
}
