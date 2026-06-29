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

    // valori presi da application.yml
    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private long expiration;

    /**
     * Metodo che genera un token, basandosi su chiave segreta impostata dal dev
     * e usando hmac genera una chiave sicura. La chiave viene anche generata con data e scadenza
     * e contiene come payload lo username
     * @param username Lo username dell'utente al quale viene generata la key
     * @return ritorno il token jwt in formato String
     */
    public String generateToken(String username) {
        // generazione chiave sicura
        SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());

        // data emissione e scadenza
        Date now = new Date();
        // scadenza presa dalla configurazione (jwt.expiration)
        Date expiryDate = new Date(now.getTime() + expiration);

        // creazione jwt token
        String jwt = Jwts.builder()
                .subject(username)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(key)
                .compact();

        return jwt;
    }


    /**
     * Metodo che estrae lo username dal token, utilizzando jwts
     * @param token Token dal quale estrarre lo username
     * @return lo username estratto, o null in caso di mancanza di username o problemi vari
     */
    public String extractUsername(String token) {
        SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());
        // in caso non si trovi, null, molto chiaro
        String username = null;
        // importante gestione eccezioni
        try {
            // uso il parser di jwts per verificare la sessione e tirare fuori il payload
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            // estraggo quello che mi interessa
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
     * metodo che verifica se un token è valido o meno
     * @param token Token da analizzare
     * @return ritorna vero o falso in base alla validità del token
     */
    public boolean isTokenValid(String token) {
        SecretKey key = Keys.hmacShaKeyFor(secretKey.getBytes());

        try {
            // uso il parser di jwts per verificare la sessione
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
