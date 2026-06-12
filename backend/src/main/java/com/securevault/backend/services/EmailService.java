package com.securevault.backend.services;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Sends transactional emails (verification, password reset, security alerts) over SMTP.
 *
 * The links embedded in the emails point at the frontend, which then calls the
 * backend API — so the user always lands on a real page instead of a raw JSON endpoint.
 */
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@securevault.local}")
    private String from;

    @Value("${app.frontend-url:http://localhost:4000}")
    private String frontendUrl;

    public void sendVerificationEmail(String to, String username, String token) {
        String link = frontendUrl + "/verify-email?token=" + token;
        String body = """
                <h2>Welcome to SecureVault, %s!</h2>
                <p>Confirm your email address to activate your account:</p>
                <p><a href="%s" style="background:#570df8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Verify my email</a></p>
                <p>Or paste this link into your browser:<br><code>%s</code></p>
                <p>If you did not create this account you can ignore this message.</p>
                """.formatted(username, link, link);
        send(to, "Verify your SecureVault account", body);
    }

    public void sendPasswordResetEmail(String to, String username, String token) {
        String link = frontendUrl + "/reset-password?token=" + token;
        String body = """
                <h2>Password reset requested</h2>
                <p>Hi %s, we received a request to reset your SecureVault password.</p>
                <p><a href="%s" style="background:#570df8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Reset my password</a></p>
                <p>Or paste this link into your browser:<br><code>%s</code></p>
                <p>This link expires in 15 minutes. If you did not request a reset, ignore this email and your password stays unchanged.</p>
                """.formatted(username, link, link);
        send(to, "Reset your SecureVault password", body);
    }

    public void sendPasswordChangedAlert(String to, String username) {
        String body = """
                <h2>Your password was changed</h2>
                <p>Hi %s, your SecureVault password was just changed.</p>
                <p>If this was you, no action is needed. If you did not change your password,
                contact support immediately — your account may be compromised.</p>
                """.formatted(username);
        send(to, "Security alert: your password was changed", body);
    }

    public void sendWelcomeEmail(String to, String username) {
        String body = """
                <h2>Your account is active</h2>
                <p>Hi %s, your email has been verified and your SecureVault account is ready.</p>
                <p>You can now sign in and start storing your files with end-to-end encryption.</p>
                """.formatted(username);
        send(to, "Welcome to SecureVault", body);
    }

    private void send(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send email to " + to, e);
        }
    }
}
