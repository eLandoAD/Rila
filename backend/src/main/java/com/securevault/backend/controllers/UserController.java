package com.securevault.backend.controllers;

import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class UserController {
    private final UserRepository userRepository;

    // rsa pubblica di un user
    @GetMapping("/public-key")
    public ResponseEntity<Map<String, String>> getPublicKey(@RequestParam String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient email not refistered on SecureVault"));
        if (user.getPublicKey() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient has no sharing key");
        }
        return ResponseEntity.ok(Map.of("publicKey", user.getPublicKey()));
    }
}
