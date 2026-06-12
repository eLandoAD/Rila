package com.securevault.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String message;

    // Envelope encryption material returned on login so the browser can unwrap the DEK
    private String encryptedDek;
    private String dekIv;
    private String keySalt;

    public AuthResponse(String token, String message) {
        this.token = token;
        this.message = message;
    }
}
