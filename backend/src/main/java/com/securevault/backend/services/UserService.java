package com.securevault.backend.services;

import com.securevault.backend.dto.ResetInfoResponse;
import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    /**
     * Registra un utente con username, email, password hashata e il materiale di
     * cifratura envelope (encryptedDek, dekIv, keySalt) generato dal client.
     * @return l'intero oggetto User
     */
    public User registerUser(String username, String email, String password, String encryptedDek, String dekIv, String keySalt, String recoveryEncryptedDek, String recoveryDekIv) {
        if (userRepository.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setEnabled(false);
        user.setVerificationToken(UUID.randomUUID().toString());
        user.setEncryptedDek(encryptedDek);
        user.setDekIv(dekIv);
        user.setKeySalt(keySalt);
        user.setRecoveryDekIv(recoveryDekIv);
        user.setRecoveryEncryptedDek(recoveryEncryptedDek);
        userRepository.save(user);
        // L'invio email è best-effort: se l'SMTP non è raggiungibile la registrazione
        // non deve fallire (l'utente può sempre richiedere un nuovo invio di verifica).
        try {
            emailService.sendVerificationEmail(user.getEmail(), user.getVerificationToken());
        } catch (Exception e) {
            log.warn("Verification email could not be sent to {}: {}", user.getEmail(), e.getMessage());
        }
        return user;
    }

    public Optional<User> findByUsernameOrEmail(String usernameOrEmail) {
        Optional<User> user = userRepository.findByUsername(usernameOrEmail);
        if (user.isPresent()) {
            return user;
        }
        return userRepository.findByEmail(usernameOrEmail);
    }

    public void verifyEmail(String token) {
        User user = userRepository.findByVerificationToken(token)
                .orElseThrow(() -> new RuntimeException("Token not valid"));

        if (user.getEnabled()) {
            throw new RuntimeException("Account already activated");
        }

        user.setEnabled(true);
        user.setVerificationToken(null);
        userRepository.save(user);

        // avviso di benvenuto: account attivato
        emailService.sendWelcomeEmail(user.getEmail(), user.getUsername());
    }

    public void resendVerification(String email) {
        // silenzioso se l'email non esiste o l'account è già attivo:
        // nessuna differenza osservabile dall'esterno (no user enumeration)
        Optional<User> opt = userRepository.findByEmail(email);
        if (opt.isEmpty()) return;
        User user = opt.get();
        if (user.getEnabled()) return;

        user.setVerificationToken(UUID.randomUUID().toString());
        userRepository.save(user);
        emailService.sendVerificationEmail(user.getEmail(), user.getVerificationToken());
    }

    public void forgotPassword(String email) {
        // risposta identica anche se l'email non esiste: no user enumeration
        Optional<User> opt = userRepository.findByEmail(email);
        if (opt.isEmpty()) return;
        User user = opt.get();

        String token = UUID.randomUUID().toString();
        user.setResetToken(token);
        user.setResetTokenExpiry(System.currentTimeMillis() + (15*60*1000L));
        userRepository.save(user);

        emailService.sendResetPasswordEmail(user.getEmail(), token);
    }

    public void resetPassword(String token, String newPassword, String newEncryptedDek, String newDekIv) {
        User user = userRepository.findByResetToken(token)
                .orElseThrow(() -> new RuntimeException("Token not valid"));

        if (System.currentTimeMillis() > user.getResetTokenExpiry()) {
            user.setResetToken(null);
            user.setResetTokenExpiry(null);
            userRepository.save(user);
            throw new RuntimeException("Token expired");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setEncryptedDek(newEncryptedDek);
        user.setDekIv(newDekIv);
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);

        // avviso di sicurezza: password cambiata
        emailService.sendPasswordChangedAlert(user.getEmail(), user.getUsername());
    }

    public ResetInfoResponse getResetInfo(String token) {
        User user = userRepository.findByResetToken(token)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (System.currentTimeMillis() > user.getResetTokenExpiry()) {
            throw new RuntimeException("Token expired");
        }

        return new ResetInfoResponse(
                user.getRecoveryEncryptedDek(),
                user.getRecoveryDekIv(),
                user.getKeySalt()
        );
    }
}
