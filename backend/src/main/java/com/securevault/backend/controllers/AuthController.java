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
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        // chiamo userService con il materiale di cifratura envelope generato dal client
        userService.registerUser(request.getUsername(), request.getEmail(), request.getPassword(),
                request.getEncryptedDek(), request.getDekIv(), request.getKeySalt());

        // nessun token: l'account va prima verificato via email
        return ResponseEntity.ok(new AuthResponse(null, "Registration successful, check your email to verify your account"));
    }


    // POST /api/auth/login
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest loginRequest) {
        // chiamo userService
        Optional<User> user = userService.findByUsernameOrEmail(loginRequest.getUsernameOrEmail());

        // se non esiste mando errore
        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(new AuthResponse(null, "User not found"));
        }

        if (!passwordEncoder.matches(loginRequest.getPassword(), user.get().getPassword())) {
            return ResponseEntity.status(401).body(new AuthResponse(null, "Wrong password"));
        }

        if (!user.get().getEnabled()) {
            return ResponseEntity.status(403).body(new AuthResponse(null, "Account not verified, check your email"));
        }

        // ritorno token + materiale envelope per sbloccare il DEK nel browser
        User u = user.get();
        return ResponseEntity.ok(new AuthResponse(
                jwtService.generateToken(u.getUsername()),
                "Login successful",
                u.getEncryptedDek(),
                u.getDekIv(),
                u.getKeySalt()));
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
        userService.resetPassword(request.getToken(), request.getNewPassword(),
                request.getNewEncryptedDek(), request.getNewDekIv(), request.getNewKeySalt());
        return ResponseEntity.ok("Password updated successfully");
    }








}
