package com.securevault.backend.controllers;

import com.securevault.backend.dto.CreateFolderRequest;
import com.securevault.backend.dto.FileResponse;
import com.securevault.backend.dto.FolderContentResponse;
import com.securevault.backend.dto.FolderResponse;
import com.securevault.backend.entities.Folder;
import com.securevault.backend.entities.StoredFile;
import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.FolderRepository;
import com.securevault.backend.repositories.StoredFileRepository;
import com.securevault.backend.repositories.UserRepository;
import com.securevault.backend.services.FolderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/folders")
@RequiredArgsConstructor
public class FolderController {

    // injection
    private final FolderRepository folderRepository;
    private final UserRepository userRepository;
    private final StoredFileRepository storedFileRepository;
    private final FolderService folderService;

    @PostMapping("/create")
    public ResponseEntity<FolderResponse> createFolder(@RequestBody CreateFolderRequest request) {
        // recupero user loggato
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // cartella genitore
        Folder parent = null;
        if (request.getParentId() != null) {
            parent = folderRepository.findById(request.getParentId())
                    .orElseThrow(() -> new RuntimeException("Parent folder not found"));

            // se c'è, verifico che sia dell'utente loggato
            if(!parent.getUser().getUsername().equals(username)) {
                throw new RuntimeException("Access denied to parent folder: you are not the owner");
            }
        }

        Folder folder = new Folder();
        folder.setUser(user);
        folder.setEncName(request.getEncName());
        // se parent = null -> cartella root
        folder.setParentFolder(parent);

        folderRepository.save(folder);

        // ritorno
        return ResponseEntity.ok(new FolderResponse(folder.getId(), folder.getEncName(), request.getParentId()));
    }

    @GetMapping("/content")
    public ResponseEntity<FolderContentResponse> getFolderContent(@RequestParam(required = false) UUID folderId) {
        // recupero l'utente
        String username = SecurityContextHolder.getContext().getAuthentication().getName();

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Folder currentFolder = null;
        // default Home
        String currentFolderName = "Root";

        // se folderId è presente -> recuperiamo la cartella attuale
        if (folderId != null) {
            currentFolder = folderRepository.findById(folderId)
                    .orElseThrow(() -> new RuntimeException("Folder not found"));

            // check owner
            if (!currentFolder.getUser().getUsername().equals(username)) {
                throw new RuntimeException("Access denied");
            }

            currentFolderName = currentFolder.getEncName();
        }

        // recupero sottocartelle e file
        List<Folder> folders = folderRepository.findByUserAndParentFolder(user, currentFolder);
        List<StoredFile> files = storedFileRepository.findByUserAndFolder(user, currentFolder);

        // mappatura in dto delle cartelle e dei file
        List<FolderResponse> folderResponses = folders.stream()
                .map(f -> new FolderResponse(f.getId(), f.getEncName(), folderId))
                .toList();

        List<FileResponse> fileResponses = files.stream()
                .map( f -> {
                    FileResponse dto = new FileResponse();
                    dto.setId(f.getId());
                    dto.setEncName(f.getEncName());
                    dto.setFileSize(f.getFileSize());
                    dto.setCreatedAt(f.getCreatedAt());
                    return dto;
                }).toList();

        // ritorno la risposta completa
        return ResponseEntity.ok(new FolderContentResponse(folderResponses, fileResponses, folderId, currentFolderName));
    }

}
