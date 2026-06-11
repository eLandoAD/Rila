package com.securevault.backend.filters;

import com.securevault.backend.services.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;


@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    // override obbligatorio del metodo
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        // controllo prima che non sia valido
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            // salto filtro e vado avanti
            filterChain.doFilter(request, response);
            return;
        }

        // estraggo il token, rimuovendo bearer e lo spazio (7 chars)
        String jwtToken = authHeader.substring(7);


        try {
            // verifico token ed estraggo username
            String username = jwtService.extractUsername(jwtToken);
            // se username è valido
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                if (jwtService.isTokenValid(jwtToken)) {
                    // oggetto per autenticazione spring security
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            username,
                            null,
                            Collections.emptyList()
                    );
                    // associo dettagli http
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    // autenticazione utente
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    System.out.println("User " + username + " authenticated successfully");
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
