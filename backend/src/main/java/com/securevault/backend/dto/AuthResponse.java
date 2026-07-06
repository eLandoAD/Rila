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
    // rsa
    private String encryptedPrivateKey;
    private String privateKeyIv;

    // costruttore a 2 argomenti
    public AuthResponse(String token, String message) {
        this(token, message, null, null, null);
    }

    // costruttore a 5 argomenti - i campi extra restano null e
    // vengono valorizzati coi setter dove servono
    public AuthResponse(String token, String message, String encryptedDek, String dekIv, String keySalt) {
        this(token, message, encryptedDek, dekIv, keySalt, null, null, null);
    }
}
