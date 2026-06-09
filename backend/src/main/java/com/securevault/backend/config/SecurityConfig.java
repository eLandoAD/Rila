package com.securevault.backend.config;

// classe easy per togliere momentaneamente login
// e fare dei test per i CORS

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {


    @Bean // oggetto
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // disabilitato
            .csrf(csrf -> csrf.disable()) 
            .authorizeHttpRequests(auth -> auth
                // accesso senza login
                .requestMatchers("/api/status").permitAll()
                .anyRequest().authenticated()              
            );
        return http.build();
    }



    // per password
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}