package com.securevault.backend.services;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

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
        String html = buildTemplate(
                "Confirm your account",
                "Welcome to SecureVault! Confirm your account to start storing your encrypted files.",
                "Confirm account",
                link,
                "If you did not create this account, you can safely ignore this email."
        );
        send(to, "SecureVault — confirm your account", html, link);
    }

    public void sendResetPasswordEmail(String to, String token) {
        String link = frontendUrl + "/reset-password?token=" + token;
        String html = buildTemplate(
                "Reset your password",
                "We received a request to reset your SecureVault password. "
                        + "You will need your Recovery Key to complete the reset. This link expires in 15 minutes.",
                "Reset password",
                link,
                "If you did not request this, you can safely ignore this email — your password stays unchanged."
        );
        send(to, "SecureVault — reset your password", html, link);
    }

    public void sendWelcomeEmail(String to, String username) {
        String html = buildTemplate(
                "Welcome to SecureVault!",
                "Hello " + HtmlUtils.htmlEscape(username) + ", your account is verified and ready. You can now log in and store your files with end-to-end encryption.",
                "Go to Login",
                frontendUrl + "/login",
                "Thank you for choosing SecureVault."
        );
        send(to, "SecureVault — Welcome!", html, frontendUrl + "/login");
    }

    public void sendPasswordChangedAlert(String to, String username) {
        String html = buildTemplate(
                "Password Changed",
                "Hello " + HtmlUtils.htmlEscape(username) + ", your SecureVault account password was successfully updated. "
                        + "If you did not make this change, please contact us immediately or use your recovery options.",
                "Go to SecureVault",
                frontendUrl + "/login",
                "This is an automated security alert."
        );
        send(to, "SecureVault — password changed alert", html, frontendUrl + "/login");
    }

    public void sendSharedFileEmail(String to, String senderUsername) {
        String link = frontendUrl + "/filemanager/shared";
        String html = buildTemplate(
                "A file has been shared with you!",
                "Hello, user " + HtmlUtils.htmlEscape(senderUsername) + " has shared a secure encrypted file with you. You can view, decrypt, and download it from your Shared files dashboard.",
                "Go to Shared Files",
                link,
                "Log in to SecureVault to access the shared file."
        );
        send(to, "SecureVault — new file shared with you", html, link);
    }

    // semplice template HTML inline, responsive e con fallback testuale sul link
    private String buildTemplate(String title, String body, String cta, String link, String footer) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
                    <tr><td align="center">
                      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <tr><td style="background:#4f46e5;padding:24px 32px;color:#ffffff;font-size:20px;font-weight:bold;">🔒 SecureVault</td></tr>
                        <tr><td style="padding:32px;">
                          <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">%s</h1>
                          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">%s</p>
                          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#4f46e5;">
                            <a href="%s" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">%s</a>
                          </td></tr></table>
                          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">Or copy this link into your browser:<br>
                            <a href="%s" style="color:#4f46e5;word-break:break-all;">%s</a></p>
                        </td></tr>
                        <tr><td style="padding:20px 32px;background:#f9fafb;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;">%s</td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(title, body, link, cta, link, link, footer);
    }

    private void send(String to, String subject, String html, String fallbackLink) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true); // true => HTML
            mailSender.send(message);
        } catch (Exception e) {
            // NON logghiamo il link (contiene il token di verifica/reset): solo l'avviso di fallimento
            System.out.println(">>> [EMAIL] Could not send '" + subject + "' to " + to + " (" + e.getMessage() + ")");
        }
    }
}
