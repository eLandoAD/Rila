package com.securevault.backend.services;

import org.springframework.core.io.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

@Service
public class FileStorageService {

    // Storage directory configurable via APP_STORAGE_PATH.
    // In Docker it points to the persistent volume (/storage); locally, by default,
    // to the ../storage folder relative to the backend's working directory.
    @Value("${app.storage.path:../storage}")
    private String storagePath;

    private Path storageDirectory() {
        return Paths.get(storagePath).toAbsolutePath().normalize();
    }

    // save the encrypted stream to disk without buffering the whole file in RAM
    public void saveFile(InputStream in, String fileName) {
        Path storageDirectory = storageDirectory();

        try {
            Files.createDirectories(storageDirectory);
            Path targetPath = storageDirectory.resolve(fileName);
            // stream directly to disk, in chunks -> not loaded fully into RAM
            Files.copy(in, targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch(IOException ioe) {
            throw new RuntimeException("Error while saving the file" + ioe.getMessage(), ioe);
        }
    }



    public Resource loadFileAsResource(String fileName) {
        Path filePath = storageDirectory().resolve(fileName);
        if (!Files.exists(filePath)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found on disk: " + fileName);
        }
        return new FileSystemResource(filePath);
    }

    public void deleteFile(String fileName) {
        Path filePath = storageDirectory().resolve(fileName);

        // delete it if it exists
        try {
            Files.deleteIfExists(filePath);
        } catch(IOException ioe) {
            throw new RuntimeException("Error while deleting the file: " + ioe);
        }

    }
}
