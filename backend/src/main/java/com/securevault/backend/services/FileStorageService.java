package com.securevault.backend.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class FileStorageService {

    // Directory di storage configurabile via APP_STORAGE_PATH.
    // In Docker punta al volume persistente (/storage); in locale, di default,
    // alla cartella ../storage relativa alla working directory del backend.
    @Value("${app.storage.path:../storage}")
    private String storagePath;

    private Path storageDirectory() {
        return Paths.get(storagePath).toAbsolutePath().normalize();
    }

    public void saveFile(byte[] encryptedContent, String fileName) {
        Path storageDirectory = storageDirectory();

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
        Path filePath = storageDirectory().resolve(fileName);

        // controllo se il file esiste
        if (!Files.exists(filePath)) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "File not found on disk: " + fileName);
        }

        try {
            // leggo i byte dal file specifico
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            throw new RuntimeException("Error while reading the file: " + e.getMessage(), e);
        }
    }

    public void deleteFile(String fileName) {
        Path filePath = storageDirectory().resolve(fileName);

        // lo elimino se esiste
        try {
            Files.deleteIfExists(filePath);
        } catch(IOException ioe) {
            throw new RuntimeException("Error while deleting the file: " + ioe);
        }

    }
}
