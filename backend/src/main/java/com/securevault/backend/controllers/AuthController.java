package com.securevault.backend.controllers;

import com.securevault.backend.dto.AuthResponse;
import com.securevault.backend.dto.LoginRequest;
import com.securevault.backend.dto.RegisterRequest;
import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.UserRepository;
import com.securevault.backend.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    // inject
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;


    // POST /api/auth/register
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        // chiamo userService
        userService.registerUser(request.getUsername(), request.getEmail(), request.getPassword());

        // ritorno response entity, che gestisce anche vari errori http, 400, 200 e via dicendo
        return ResponseEntity.ok(new AuthResponse("fake-token", "Registration successful"));
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
            return ResponseEntity.status(401).body(new AuthResponse(null, "Password errata"));
        }

        // ritorno response entity, che gestisce anche vari errori http, 400, 200 e via dicendo
        return ResponseEntity.ok(new AuthResponse("fake-token", "Login successful"));
    }


}
