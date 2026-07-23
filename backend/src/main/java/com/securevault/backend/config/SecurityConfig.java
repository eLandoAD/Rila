package com.securevault.backend.config;

// simple class to temporarily remove login
// and run some CORS tests

import com.securevault.backend.filters.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    // inject the filter
    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    @Bean // bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // enable CORS using the bean below
            .cors(Customizer.withDefaults())
            // disabled
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                // access without login
                .requestMatchers("/api/status").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/files/public/**").permitAll()
                // admin access
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            // stateless
            .sessionManagement(session -> session
                    .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            // filter
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }


    // CORS for the frontend (dev :4200, Docker container :4000)
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
            "http://localhost:4000",
            "http://localhost:4200",
            frontendUrl,
            frontendUrl.replace("http://", "https://")
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        // custom download headers readable client-side (needed for decryption)
        config.setExposedHeaders(List.of("x-iv", "x-enc-name"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }


    // for passwords
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}