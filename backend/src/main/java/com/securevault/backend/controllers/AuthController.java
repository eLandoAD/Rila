package com.securevault.backend.controllers;

import com.securevault.backend.dto.*;
import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.UserRepository;
import com.securevault.backend.services.JwtService;
import com.securevault.backend.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    // inject
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;


    // POST /api/auth/register
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        // registro l'utente; la mail di verifica viene inviata dal service
        userService.registerUser(
            request.getUsername(), 
            request.getEmail(), 
            request.getPassword(), 
            request.getEncryptedDek(), 
            request.getDekIv(), 
            request.getKeySalt(),
            request.getRecoveryEncryptedDek(),
            request.getRecoveryDekIv(),
            request.getPublicKey(),
            request.getEncryptedPrivateKey(),
            request.getPrivateKeyIv()
        );

        AuthResponse res = new AuthResponse(null, "Registration successful");
        return ResponseEntity.ok(res);
    }


    // POST /api/auth/login
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest loginRequest) {
        // chiamo userService
        Optional<User> user = userService.findByUsernameOrEmail(loginRequest.getUsernameOrEmail());

        // stesso messaggio per "utente inesistente" e "password errata":
        // evita la user enumeration
        if (user.isEmpty() || !passwordEncoder.matches(loginRequest.getPassword(), user.get().getPassword())) {
            return ResponseEntity.status(401).body(new AuthResponse(null, "Invalid credentials"));
        }

        User u = user.get();

        if (!u.getEnabled()) {
            return ResponseEntity.status(403).body(new AuthResponse(null, "Account not verified. Please verify your account before logging in."));
        }

        AuthResponse res = new AuthResponse(jwtService.generateToken(u.getUsername()), "Login successful", u.getEncryptedDek(), u.getDekIv(), u.getKeySalt());
        res.setEncryptedPrivateKey(u.getEncryptedPrivateKey());
        res.setPrivateKeyIv(u.getPrivateKeyIv());
        return ResponseEntity.ok(res);
    }


    @GetMapping("/verify")
    public ResponseEntity<String> verifyEmail(@RequestParam String token) {
        userService.verifyEmail(token);
        return ResponseEntity.ok("Account activated with success!");
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<String> resendVerification(@RequestBody ForgotPasswordRequest request) {
        userService.resendVerification(request.getEmail());
        return ResponseEntity.ok("Verification email sent");
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<String> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        userService.forgotPassword(request.getEmail());
        return ResponseEntity.ok("If the email exists, a reset link has been sent");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(@RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request.getToken(), request.getNewPassword(), request.getNewEncryptedDek(), request.getNewDekIv());
        return ResponseEntity.ok("Password updated successfully");
    }

    @GetMapping("/reset-info")
    public ResponseEntity<ResetInfoResponse> getResetInfo(@RequestParam String token) {
        // chiamiamo il service
        ResetInfoResponse info = userService.getResetInfo(token);
        return ResponseEntity.ok(info);
    }

}
