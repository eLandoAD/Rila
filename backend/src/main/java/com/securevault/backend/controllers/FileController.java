package com.securevault.backend.controllers;

import com.securevault.backend.dto.FileResponse;
import com.securevault.backend.dto.FileUploadResponse;
import com.securevault.backend.entities.StoredFile;
import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.StoredFileRepository;
import com.securevault.backend.repositories.UserRepository;
import com.securevault.backend.services.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;


import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileStorageService fileStorageService;
    private final StoredFileRepository storedFileRepository;
    private final UserRepository userRepository;

    @PostMapping("/upload")
    public ResponseEntity<FileUploadResponse> upload(@RequestParam("file") MultipartFile file, @RequestParam("iv") String iv, @RequestParam("encName") String encName) {

        try {
            // recupero user
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            // non posso gestirlo senza l'eccezione, essendo un optional
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // genero nome univoco, ho scelto UUID
            String physicalName = UUID.randomUUID().toString();
            fileStorageService.saveFile(file.getBytes(), physicalName);

            // non uso il costruttore (ho messo allArgs, quindi vorrebbe anche id e data creazione),
            // per ovviare a questo problema uso i setter
            StoredFile storedFile = new StoredFile();
            storedFile.setEncName(encName);
            storedFile.setIv(iv);
            storedFile.setStoragePath(physicalName);
            storedFile.setUser(user);
            // prendo la dimensione dal file Multipart
            storedFile.setFileSize(file.getSize());

            // salvo nel db
            storedFileRepository.save(storedFile);

            return ResponseEntity.ok(new FileUploadResponse(storedFile.getId().toString(), encName, "Upload successful!"));
        } catch(Exception e) {
            throw new RuntimeException("Error while uploading the file: ", e);
        }
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<byte[]> downloadFile(@PathVariable UUID id) {
        try {
            // prendo lo username attuale
            String username = SecurityContextHolder.getContext().getAuthentication().getName();

            // cerco il file nel DB
            StoredFile storedFile = storedFileRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found"));

            // controllo che il proprietario sia l'utente loggato
            if (!storedFile.getUser().getUsername().equals(username)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: you are not the owner of this file");
            }

            // recupero fisico
            byte[] fileContent = fileStorageService.loadFile(storedFile.getStoragePath());

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + storedFile.getEncName() + "\"")
                    .header("x-iv", storedFile.getIv())
                    .header("x-enc-name", storedFile.getEncName())
                    .body(fileContent);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error during download", e);
        }
    }

    @GetMapping
    public ResponseEntity<List<FileResponse>> listFiles() {
        try {
            // come prima recupero username e User dal DB
            String username = SecurityContextHolder.getContext().getAuthentication().getName();

            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // recupero tutti i file dell'utente
            List<StoredFile> files = storedFileRepository.findByUser(user);

            // da stored file a FileResponse
            List<FileResponse> response = files.stream().map(file -> {
                 FileResponse dto = new FileResponse();
                 dto.setId(file.getId());
                 dto.setEncName(file.getEncName());
                 dto.setFileSize(file.getFileSize());
                 dto.setCreatedAt(file.getCreatedAt());
                 return dto;
            }).toList();

            return ResponseEntity.ok(response);

        } catch (Exception e){
            throw new RuntimeException("Error retrieving file list: " + e);
        }


    }


}
