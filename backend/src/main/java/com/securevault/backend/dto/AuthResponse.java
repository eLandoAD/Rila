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
    private String encryptedDek;
    private String dekIv;
    private String keySalt;
    // per l'email
    private String verificationToken;

    // costruttore a 2 argomenti
    public AuthResponse(String token, String message) {
        this(token, message, null, null,fammi te null);
    }

    // costruttore a 5 argomenti (senza verificationToken) per login e dati E2EE
    public AuthResponse(String token, String message, String encryptedDek, String dekIv, String keySalt) {
        this(token, message, encryptedDek, dekIv, keySalt, null);
    }
}
