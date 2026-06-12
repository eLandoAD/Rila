package com.securevault.backend.services;

import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    // inietto i servizi
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    /**
     * Registra un utente con username, email, password hashata e il materiale di
     * cifratura envelope (encryptedDek, dekIv, keySalt) generato dal client.
     * @return l'intero oggetto User
     */
    public User registerUser(String username, String email, String password,
                             String encryptedDek, String dekIv, String keySalt) {
        // istanzio oggetto user
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        // password criptata
        user.setPassword(passwordEncoder.encode(password));
        user.setEnabled(false);
        user.setVerificationToken(UUID.randomUUID().toString());
        // materiale envelope encryption (il server non vede mai il DEK in chiaro)
        user.setEncryptedDek(encryptedDek);
        user.setDekIv(dekIv);
        user.setKeySalt(keySalt);
        userRepository.save(user);

        // invio email di verifica via SMTP (link verso il frontend)
        emailService.sendVerificationEmail(email, username, user.getVerificationToken());
        return user;
    }

    /**
     * metodo per trovare un utente in base a username o email
     * @param usernameOrEmail campo username o email
     * @return ritorno l'intero oggetto user, gestito da optional in caso di null
     */
    // uso optional per evitare null pointer exception
    public Optional<User> findByUsernameOrEmail(String usernameOrEmail) {
        Optional<User> user = userRepository.findByUsername(usernameOrEmail);

        // se trovato, allora ritorno
        if (user.isPresent()) {
            return user;
        }

        // tento con email, sennò lo gestisce l'optional
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
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Email not found"));

        if (user.getEnabled()) {
            throw new RuntimeException("Account already activated");
        }

        // rigenero il token e re-invio l'email
        user.setVerificationToken(UUID.randomUUID().toString());
        userRepository.save(user);
        emailService.sendVerificationEmail(user.getEmail(), user.getUsername(), user.getVerificationToken());
    }

    public void forgotPassword(String email) {
        // l'optional è gestito silenziosamente per non rivelare se l'email esiste
        userRepository.findByEmail(email).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            user.setResetToken(token);
            user.setResetTokenExpiry(System.currentTimeMillis() + (15 * 60 * 1000L));
            userRepository.save(user);

            // invio link di reset via SMTP (verso il frontend)
            emailService.sendPasswordResetEmail(user.getEmail(), user.getUsername(), token);
        });
    }

    public void resetPassword(String token, String newPassword, String newEncryptedDek,
                              String newDekIv, String newKeySalt) {
        User user = userRepository.findByResetToken(token)
                .orElseThrow(() -> new RuntimeException("Token not valid"));

        // controllo scadenza
        if (System.currentTimeMillis() > user.getResetTokenExpiry()) {
            user.setResetToken(null);
            user.setResetTokenExpiry(null);
            userRepository.save(user);
            throw new RuntimeException("Token expired");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        // il client rigenera/ri-incapsula il DEK sotto la nuova password
        user.setEncryptedDek(newEncryptedDek);
        user.setDekIv(newDekIv);
        user.setKeySalt(newKeySalt);
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);

        // avviso di sicurezza: password cambiata
        emailService.sendPasswordChangedAlert(user.getEmail(), user.getUsername());
    }


}
