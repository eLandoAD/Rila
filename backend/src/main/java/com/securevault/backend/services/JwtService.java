package com.securevault.backend.services;

import javax.crypto.SecretKey;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.security.Keys;

import java.util.Date;

@Service
public class JwtService {

    // values taken from application.yml
    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private long expiration;

    /**
     * Method that generates a token, based on a secret key set by the dev
     * and using hmac to generate a secure key. The key is also generated with issue date and expiry
     * and contains the username as payload
     * @param username The username of the user for whom the key is generated
     * @return the jwt token as a String
     */
    public String generateToken(String username) {
        // secure key generation
        SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());

        // issue and expiry date
        Date now = new Date();
        // expiry taken from configuration (jwt.expiration)
        Date expiryDate = new Date(now.getTime() + expiration);

        // create jwt token
        String jwt = Jwts.builder()
                .subject(username)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(key)
                .compact();

        return jwt;
    }


    /**
     * Method that extracts the username from the token, using jwts
     * @param token Token from which to extract the username
     * @return the extracted username, or null if the username is missing or on other issues
     */
    public String extractUsername(String token) {
        SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());
        // null if not found, nice and clear
        String username = null;
        // important exception handling
        try {
            // use the jwts parser to verify the session and pull out the payload
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            // extract what I need
            username = claims.getSubject();


        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            System.err.println("Token expired!");
        } catch (io.jsonwebtoken.security.SignatureException e) {
            System.err.println("Token signature not valid, token compromised");
        } catch (Exception e) {
            System.err.println("Problems with the token: " + e.getMessage());
        }
        return username;
    }


    /**
     * method that checks whether a token is valid or not
     * @param token Token to analyze
     * @return true or false depending on the token's validity
     */
    public boolean isTokenValid(String token) {
        SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());

        try {
            // use the jwts parser to verify the session
            Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token);

            return true;

        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            System.err.println("Token expired!");
        } catch (io.jsonwebtoken.security.SignatureException e) {
            System.err.println("Token signature not valid, token compromised");
        } catch (Exception e) {
            System.err.println("Problems with the token: " + e.getMessage());
        }

        return false;
    }

}
