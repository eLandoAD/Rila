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

    // costruttore ridotto per le risposte senza dati E2EE (errori, registrazione)
    public AuthResponse(String token, String message) {
        this(token, message, null, null, null);
    }
}
