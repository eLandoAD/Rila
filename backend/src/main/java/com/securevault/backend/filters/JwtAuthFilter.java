package com.securevault.backend.filters;

import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.UserRepository;
import com.securevault.backend.services.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;


@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    // override obbligatorio del metodo
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        // controllo prima che non sia valido
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // estraggo il token, rimuovendo "Bearer " (7 chars)
        String jwtToken = authHeader.substring(7);

        try {
            String username = jwtService.extractUsername(jwtToken);

            if (username != null
                    && SecurityContextHolder.getContext().getAuthentication() == null
                    && jwtService.isTokenValid(jwtToken)) {

                User user = userRepository.findByUsername(username).orElse(null);

                // autentico SOLO se l'utente esiste ed è ancora abilitato:
                // un account disabilitato dopo il login non passa più, anche con token valido
                if (user != null && Boolean.TRUE.equals(user.getEnabled())) {

                    // carico i ruoli reali dal DB come authorities (es. ROLE_USER, ROLE_ADMIN)
                    String rolesRaw = user.getRoles() == null ? "" : user.getRoles();
                    List<SimpleGrantedAuthority> authorities = Arrays.stream(rolesRaw.split(","))
                            .map(String::trim)
                            .filter(s -> !s.isEmpty())
                            .map(SimpleGrantedAuthority::new)
                            .toList();

                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            username,
                            null,
                            authorities
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (Exception e) {
            // errore 401
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Invalid token or expired\"}");
            return;
        }

        //continua la catena dei filtri verso il Controller
        filterChain.doFilter(request, response);
    }
}
