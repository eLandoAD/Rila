package com.securevault.backend.services;

import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

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

        userRepository.save(user);
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
}
