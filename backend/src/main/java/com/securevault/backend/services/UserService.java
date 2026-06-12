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

    // inietto i due servizi
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Metodo che registra un utente con username, email e password criptata
     * @param username campo username
     * @param email campo email
     * @param password campo passowrd
     * @return ritorno l'intero oggetto User
     */
    public User registerUser(String username, String email, String password) {
        // istanzio oggetto user
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        // password criptata
        user.setPassword(passwordEncoder.encode(password));
        user.setEnabled(false);
        user.setVerificationToken(UUID.randomUUID().toString());
        userRepository.save(user);
        System.out.println(">>> Verification link: http://localhost:8080/api/auth/verify?token=" + user.getVerificationToken());
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

        // sim email
        System.out.println(">>> LINK RESET PASSWORD: http://localhost:8080/api/auth/reset-password?token=" + token);

    }

    public void resetPassword(String token, String newPassword, String newEncryptedDek) {
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
        userRepository.save(user);
    }


}
