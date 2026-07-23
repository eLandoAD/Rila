package com.securevault.backend.repositories;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.securevault.backend.entities.*;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // user by username
    Optional<User> findByUsername(String username);

    // user by email
    Optional<User> findByEmail(String email);

    // check whether a user exists for this username
    Optional<User> existsByUsername(String username);

    // check whether a user exists for this email
    Optional<User> existsByEmail(String email);

    Optional<User> findByVerificationToken(String token);

    Optional<User> findByResetToken(String token);

}
