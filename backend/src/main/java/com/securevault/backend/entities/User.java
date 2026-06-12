package com.securevault.backend.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    // id
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // username
    @Column(nullable = false, unique = true, length = 50)
    private String username;

    // email
    @Column(nullable = false, unique = true, length = 100)
    private String email;

    // password hashata
    @Column(nullable = false, length = 255)
    private String password;

    // roles
    @Column(nullable = false)
    private String roles = "ROLE_USER";
    // Esempi validi:
    // "ROLE_USER"
    // "ROLE_USER,ROLE_ADMIN"
    // "ROLE_USER,ROLE_TESTER"
    // "ROLE_USER,ROLE_ADMIN,ROLE_TESTER"

    // per disabilitare un utente
    @Column(nullable = false)
    private Boolean enabled = false;

    // tempo creazione
    @Column(name = "created_at", nullable = false, updatable = false)
    private Long createdAt = System.currentTimeMillis();

    // tempo update
    @Column(name = "updated_at")
    private Long updatedAt;

    // sempre update
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = System.currentTimeMillis();
    }

    // token univoco per la verifica
    @Column(name = "verification_token", length = 255)
    private String verificationToken;

    // per reset password
    @Column(name = "reset_token", length = 255)
    private String resetToken;

    @Column(name = "reset_token_expiry")
    private Long resetTokenExpiry;

    @Column(name = "encrypted_dek", length = 512)
    private String encryptedDek;

    @Column(name = "dek_iv", length = 255)
    private String dekIv;
    
    
    @Column(name = "key_salt", length = 255)
    private String keySalt;

}
