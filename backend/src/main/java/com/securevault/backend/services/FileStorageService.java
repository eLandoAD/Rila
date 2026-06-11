package com.securevault.backend.services;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
@RequiredArgsConstructor
public class FileStorageService {

    private final CryptoService cryptoService;

    public void saveFile(byte[] encryptedContent, String fileName) {
        Path storageDirectory = Paths.get("..", "storage").toAbsolutePath().normalize();

        try {
            Files.createDirectories(storageDirectory);
            Path targetPath = storageDirectory.resolve(fileName);
            // Scriviamo i byte direttamente (sono già stati cifrati dal frontend)
            Files.write(targetPath, encryptedContent);
        } catch (IOException e) {
            throw new RuntimeException("Errore durante il salvataggio fisico del file: " + e.getMessage(), e);
        }
    }

    public byte[] loadFile(String fileName) {
        // prendo il path della cartella
        Path storageDirectory = Paths.get("..", "storage").toAbsolutePath().normalize();

        // file specifico
        Path filePath = storageDirectory.resolve(fileName);

        // controllo se il file esiste
        if (!Files.exists(filePath)) {
            throw new RuntimeException("File not found on disk: " + fileName);
        }

        try {
            // leggo i byte dal file specifico
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            throw new RuntimeException("Error while reading the file: " + e.getMessage(), e);
        }
    }
}
