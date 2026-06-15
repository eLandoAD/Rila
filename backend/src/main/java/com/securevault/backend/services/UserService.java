package com.securevault.backend.services;

import com.securevault.backend.dto.ResetInfoResponse;
import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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
     * Metodo che registra un utente con username, email e password criptata
     * @param username campo username
     * @param email campo email
     * @param password campo passowrd
     * @return ritorno l'intero oggetto User
     */
    public User registerUser(String username, String email, String password, String encryptedDek, String dekIv, String keySalt, String recoveryEncryptedDek, String recoveryDekIv) {
        // controllo duplicati con messaggio chiaro (evita il 403 mascherato da /error)
        if (userRepository.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        // istanzio oggetto user
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        // password criptata
        user.setPassword(passwordEncoder.encode(password));
        user.setEnabled(false);
        user.setVerificationToken(UUID.randomUUID().toString());
        user.setEncryptedDek(encryptedDek);
        user.setDekIv(dekIv);
        user.setKeySalt(keySalt);
        user.setRecoveryDekIv(recoveryDekIv);
        user.setRecoveryEncryptedDek(recoveryEncryptedDek);
        userRepository.save(user);
        emailService.sendVerificationEmail(user.getEmail(), user.getVerificationToken());
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
    }

    public void forgotPassword(String email) {
        // user
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Email not found"));

        // genero token, scadenza
        String token = UUID.randomUUID().toString();
        user.setResetToken(token);
        user.setResetTokenExpiry(System.currentTimeMillis() + (15*60*1000L));
        userRepository.save(user);

        emailService.sendResetPasswordEmail(user.getEmail(), token);
    }

    public void resetPassword(String token, String newPassword, String newEncryptedDek, String newDekIv) {
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
        user.setEncryptedDek(newEncryptedDek);
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        user.setDekIv(newDekIv);
        userRepository.save(user);
    }


    public ResetInfoResponse getResetInfo(String token) {
        User user = userRepository.findByResetToken(token)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // verifico che il token non sia scaduto
        if (System.currentTimeMillis() > user.getResetTokenExpiry()) {
            throw new RuntimeException("Token expired");
        }

        // dati per il frontend
        return new ResetInfoResponse(
                user.getRecoveryEncryptedDek(),
                user.getRecoveryDekIv(),
                user.getKeySalt()
        );
    }


}
