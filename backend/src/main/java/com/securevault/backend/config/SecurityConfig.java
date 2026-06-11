package com.securevault.backend.config;

// classe easy per togliere momentaneamente login
// e fare dei test per i CORS

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.Customizer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {


    @Bean // oggetto
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // abilito CORS usando il bean sotto
            .cors(Customizer.withDefaults())
            // disabilitato
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                // accesso senza login
                .requestMatchers("/api/status", "/api/auth/**").permitAll()
                .anyRequest().authenticated()
            );
        return http.build();
    }


    // CORS per il frontend (dev :4200, container Docker :4000)
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:4000", "http://localhost:4200"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }


    // per password
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}