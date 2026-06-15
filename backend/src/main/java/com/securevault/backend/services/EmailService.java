package com.securevault.backend.services;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    // mittente e base url del frontend, configurabili da env
    @Value("${app.mail.from:noreply@northleap.it}")
    private String from;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    public void sendVerificationEmail(String to, String token) {
        String link = frontendUrl + "/verify-email?token=" + token;
        String body = "Welcome to SecureVault!\n\n"
                + "Confirm your account by opening this link:\n" + link
                + "\n\nIf you did not create this account, ignore this email.";
        send(to, "SecureVault — confirm your account", body, link);
    }

    public void sendResetPasswordEmail(String to, String token) {
        String link = frontendUrl + "/reset-password?token=" + token;
        String body = "We received a request to reset your SecureVault password.\n\n"
                + "Open this link to set a new password (you will need your Recovery Key):\n" + link
                + "\n\nThe link expires in 15 minutes. If you did not request this, ignore this email.";
        send(to, "SecureVault — reset your password", body, link);
    }

    private void send(String to, String subject, String body, String fallbackLink) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (Exception e) {
            // fallback: se l'SMTP non è raggiungibile (es. dev), logghiamo il link
            System.out.println(">>> [EMAIL FALLBACK] Could not send to " + to + " (" + e.getMessage() + ")");
            System.out.println(">>> [EMAIL FALLBACK] " + subject + ": " + fallbackLink);
        }
    }
}
