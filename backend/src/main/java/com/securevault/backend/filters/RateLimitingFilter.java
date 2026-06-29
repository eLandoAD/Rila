package com.securevault.backend.filters;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiting semplice e in-memory sugli endpoint di autenticazione, per
 * mitigare brute force (login) ed email bombing (forgot/resend).
 * Limite: MAX_REQUESTS per IP per finestra di WINDOW_MS su ciascun path.
 * Nota: stato in memoria, ok per singola istanza (come questo deploy).
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Set<String> LIMITED_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/forgot-password",
            "/api/auth/resend-verification"
    );

    private static final int MAX_REQUESTS = 10;     // richieste consentite
    private static final long WINDOW_MS = 60_000;   // per finestra (1 minuto)

    private final Map<String, Window> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        if (!LIMITED_PATHS.contains(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = clientIp(request) + "|" + path;
        if (!allow(key)) {
            response.setStatus(429); // Too Many Requests
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Too many requests. Please wait a minute and try again.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private synchronized boolean allow(String key) {
        long now = System.currentTimeMillis();
        Window w = buckets.computeIfAbsent(key, k -> new Window(now));
        if (now - w.windowStart >= WINDOW_MS) {
            w.windowStart = now;
            w.count = 0;
        }
        w.count++;
        return w.count <= MAX_REQUESTS;
    }

    // IP reale del client: primo valore di X-Forwarded-For (impostato da nginx),
    // con fallback all'indirizzo della connessione.
    private String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static final class Window {
        long windowStart;
        int count;
        Window(long start) { this.windowStart = start; }
    }
}
