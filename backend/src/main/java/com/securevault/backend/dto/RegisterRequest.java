package com.securevault.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;


@Data
public class RegisterRequest {
    @NotBlank
    @Size(min = 3, max = 50)
    private String username;

    @NotBlank
    @Email
    @Size(max = 100)
    private String email;

    @NotBlank
    @Size(min = 8, max = 100)
    private String password;

    // materiale crittografico generato dal client: niente @NotBlank per non
    // rischiare di rompere la registrazione se un campo arriva vuoto in qualche flusso
    private String encryptedDek;
    private String dekIv;
    private String keySalt;
    private String recoveryEncryptedDek;
    private String recoveryDekIv;
}
