package com.securevault.backend.controllers;

import com.securevault.backend.dto.FileResponse;
import com.securevault.backend.dto.FileUploadResponse;
import com.securevault.backend.dto.MoveRequest;
import com.securevault.backend.dto.RenameRequest;
import com.securevault.backend.entities.Folder;
import com.securevault.backend.entities.StoredFile;
import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.FolderRepository;
import com.securevault.backend.repositories.StoredFileRepository;
import com.securevault.backend.repositories.UserRepository;
import com.securevault.backend.services.FileStorageService;
import com.securevault.backend.services.FolderService;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.securevault.backend.dto.ShareFileRequest;
import com.securevault.backend.dto.SharedFileResponse;
import com.securevault.backend.entities.SharedFile;
import com.securevault.backend.repositories.SharedFileRepository;
import com.securevault.backend.services.EmailService;


import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileStorageService fileStorageService;
    private final StoredFileRepository storedFileRepository;
    private final UserRepository userRepository;
    private final FolderRepository folderRepository;
    private final FolderService folderService;
    private final SharedFileRepository sharedFileRepository;
    private final EmailService emailService;

    @PostMapping("/upload")
    public ResponseEntity<FileUploadResponse> upload(@RequestParam("file") MultipartFile file, @RequestParam("iv") String iv, @RequestParam("encName") String encName,
                                                     @RequestParam(value = "folder_id", required = false) UUID folderId) {

        try {
            // recupero user
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            // non posso gestirlo senza l'eccezione, essendo un optional
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // genero nome univoco, ho scelto UUID
            String physicalName = UUID.randomUUID().toString();
            fileStorageService.saveFile(file.getBytes(), physicalName);

            // cerco la cartella
            Folder folder = null;
            if (folderId != null) {
                folder = folderRepository.findById(folderId)
                        .orElseThrow(() -> new RuntimeException("Target folder not found"));

                if (!folder.getUser().getId().equals(user.getId())) {
                    throw new RuntimeException("Access denied to target folder");
                }

            }

            // non uso il costruttore (ho messo allArgs, quindi vorrebbe anche id e data creazione),
            // per ovviare a questo problema uso i setter
            StoredFile storedFile = new StoredFile();
            storedFile.setEncName(encName);
            storedFile.setIv(iv);
            storedFile.setStoragePath(physicalName);
            storedFile.setUser(user);
            // associo la cartella padre o null se root
            storedFile.setFolder(folder);
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

            // controllo che il proprietario sia l'utente loggato O che sia condiviso con lui
            boolean isOwner = storedFile.getUser().getUsername().equals(username);
            boolean isShared = false;
            if (!isOwner) {
                User loggedUser = userRepository.findByUsername(username)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
                isShared = sharedFileRepository.findByFileAndReceiver(storedFile, loggedUser).isPresent();
            }

            if (!isOwner && !isShared) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: you do not have access to this file");
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
                dto.setIv(file.getIv());
                return dto;
            }).toList();

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            throw new RuntimeException("Error retrieving file list: " + e);
        }

    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        try {
            // prendo come prima username e cerco il file nel DB
            String username = SecurityContextHolder.getContext().getAuthentication().getName();

            StoredFile storedFile = storedFileRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("File not found!"));

            // controllo che il proprietario sia l'utente loggato
            if (!storedFile.getUser().getUsername().equals(username)) {
                throw new RuntimeException("Access denied: you are not the owner of this file");
            }

            // elimino il file dal disco
            fileStorageService.deleteFile(storedFile.getStoragePath());
            // rimuovo anche dal database
            storedFileRepository.delete(storedFile);

            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            throw new RuntimeException("Error while deleting the file: " + e.getMessage(), e);
        }
    }


    @PatchMapping("/{id}")
    public ResponseEntity<Void> rename(@PathVariable UUID id, @RequestBody RenameRequest request) {
        try {
            // prendo lo username
            String username = SecurityContextHolder.getContext().getAuthentication().getName();

            // trovo il file
            StoredFile storedFile = storedFileRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("File not found!"));

            // controllo che l'utente sia l'owner
            if (!storedFile.getUser().getUsername().equals(username)) {
                throw new RuntimeException("Access denied: you are not the owner of this file");
            }

            // cambio nome dell'entità
            storedFile.setEncName(request.newEncName);

            // salvo la modifica nel DB
            storedFileRepository.save(storedFile);

            return ResponseEntity.ok().build();
        } catch (Exception e) {
            throw new RuntimeException("Error while renaming the file: " + e.getMessage(), e);
        }
    }

    @PatchMapping("/{id}/move")
    public ResponseEntity<Void> move(@PathVariable UUID id, @RequestBody MoveRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        folderService.moveFile(id, request.getTargetFolderId(), username);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/public/{id}")
    public ResponseEntity<byte[]> downloadFilePublic(@PathVariable UUID id) {
        try {
            StoredFile storedFile = storedFileRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found"));

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

    @PostMapping("/share")
    public ResponseEntity<Void> shareFile(@RequestBody ShareFileRequest request) {
        try {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            User sender = userRepository.findByUsername(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

            StoredFile storedFile = storedFileRepository.findById(request.getFileId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found"));

            if (!storedFile.getUser().getId().equals(sender.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: you are not the owner of this file");
            }

            User receiver = userRepository.findByEmail(request.getReceiverEmail())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient email not registered on SecureVault"));

            if (receiver.getId().equals(sender.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot share a file with yourself");
            }

            // Check if already shared
            SharedFile sharedFile = sharedFileRepository.findByFileAndReceiver(storedFile, receiver)
                    .orElse(new SharedFile());

            sharedFile.setFile(storedFile);
            sharedFile.setSender(sender);
            sharedFile.setReceiver(receiver);
            sharedFile.setDek(request.getDek());
            sharedFile.setCreatedAt(System.currentTimeMillis());

            sharedFileRepository.save(sharedFile);

            // Send notification email
            emailService.sendSharedFileEmail(receiver.getEmail(), sender.getUsername());

            return ResponseEntity.ok().build();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error during file share: " + e.getMessage(), e);
        }
    }

    @GetMapping("/shared")
    public ResponseEntity<List<SharedFileResponse>> listSharedFiles() {
        try {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

            List<SharedFile> sharedList = sharedFileRepository.findByReceiver(user);

            List<SharedFileResponse> response = sharedList.stream().map(sf -> {
                SharedFileResponse dto = new SharedFileResponse();
                dto.setId(sf.getId());
                dto.setFileId(sf.getFile().getId());
                dto.setEncName(sf.getFile().getEncName());
                dto.setFileSize(sf.getFile().getFileSize());
                dto.setCreatedAt(sf.getCreatedAt());
                dto.setIv(sf.getFile().getIv());
                dto.setSenderEmail(sf.getSender().getEmail());
                dto.setSenderUsername(sf.getSender().getUsername());
                dto.setDek(sf.getDek());
                return dto;
            }).toList();

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error retrieving shared files: " + e.getMessage(), e);
        }
    }

    @DeleteMapping("/shared/{id}")
    public ResponseEntity<Void> removeSharedFile(@PathVariable UUID id) {
        try {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

            SharedFile sharedFile = sharedFileRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shared file record not found"));

            if (!sharedFile.getReceiver().getId().equals(user.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: you cannot remove this shared file");
            }

            sharedFileRepository.delete(sharedFile);
            return ResponseEntity.noContent().build();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error removing shared file: " + e.getMessage(), e);
        }
    }

}
