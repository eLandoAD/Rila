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

    @NotBlank private String encryptedDek;
    @NotBlank private String dekIv;
    @NotBlank private String keySalt;
    @NotBlank private String recoveryEncryptedDek;
    @NotBlank private String recoveryDekIv;
}
