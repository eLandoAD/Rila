package com.securevault.backend.repositories;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.securevault.backend.entities.*;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // utente per username
    Optional<User> findByUsername(String username);

    // utente per mail
    Optional<User> findByEmail(String email);

    // verifica se esiste un utente per questo username
    Optional<User> existsByUsername(String username);
    
    // verifica se esiste un utente per questo username
    Optional<User> existsByEmail(String email);

}
