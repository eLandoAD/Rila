package com.securevault.backend.config;

// classe easy per togliere momentaneamente login
// e fare dei test per i CORS

import com.securevault.backend.filters.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    // inietto il filtro
    private final JwtAuthFilter jwtAuthFilter;

    @Bean // oggetto
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // disabilitato
            .csrf(csrf -> csrf.disable()) 
            .authorizeHttpRequests(auth -> auth
                // accesso senza login
                .requestMatchers("/api/status").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                // accesso admin
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()              
            )
            // stateless
            .sessionManagement(session -> session
                    .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            // filtro
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }



    // per password
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}