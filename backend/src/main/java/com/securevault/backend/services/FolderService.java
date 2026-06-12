package com.securevault.backend.services;

import com.securevault.backend.entities.Folder;
import com.securevault.backend.entities.StoredFile;
import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.FolderRepository;
import com.securevault.backend.repositories.StoredFileRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FolderService {

    private final FolderRepository folderRepository;
    private final StoredFileRepository storedFileRepository;
    private final FileStorageService fileStorageService;

    @Transactional
    public void deleteFolderRecursive(UUID id, String username) {
        // recupero l'entità cartella dal DB
        Folder folder = folderRepository.findById(id)
             .orElseThrow(() -> new RuntimeException("Folder not found"));

        // verifico l'utente
        if (folder.getUser() == null || !folder.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied: you are not the owner");
        }

        // prima di toccare il DB raccolgo i path
        List<String> filePaths = new ArrayList<>();
        collectFilePaths(folder, folder.getUser(), filePaths);

        // elimino l'intero sottoalbero dal DB
        deleteSubtree(folder, folder.getUser());


        // elimino dal disco
        filePaths.forEach(fileStorageService::deleteFile);

    }


    // metodo wrapper di supporto
    // Elimina ricorsivamente prima i figli, poi il padre
    private void deleteSubtree(Folder folder, User user) {
        List<StoredFile> files = storedFileRepository.findByUserAndFolder(user, folder);
        storedFileRepository.deleteAll(files);

        folderRepository.findByUserAndParentFolder(user, folder)
                .forEach(sub -> deleteSubtree(sub, user));

        folderRepository.delete(folder);
    }


    // Raccoglie ricorsivamente tutti i path senza toccare nulla
    private void collectFilePaths(Folder folder, User user, List<String> paths) {
        storedFileRepository.findByUserAndFolder(user, folder)
                .stream()
                .map(StoredFile::getStoragePath)
                .forEach(paths::add);

        folderRepository.findByUserAndParentFolder(user, folder)
                .forEach(sub -> collectFilePaths(sub, user, paths));
    }

    @Transactional
    public void moveFolder(UUID folderId, UUID targetFolderId, String username) {
        // trovo la cartella da spostare
        Folder sourceFolder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found"));

        // verifico owner
        if (!sourceFolder.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied: you are not the owner");
        }

        // spostamento nella root
        if (targetFolderId == null) {
            sourceFolder.setParentFolder(null);
            folderRepository.save(sourceFolder);
            return;
        }

        // recupero cartella di destinazione
        Folder destFolder = folderRepository.findById(targetFolderId)
                .orElseThrow(() -> new RuntimeException("Folder not found"));


        // controllo che appartenga allo stesso utente
        if (!destFolder.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied: you are not the owner");
        }


        // controllo che non la sposti dentro se stesa
        if (isDescendantOrSelf(destFolder, sourceFolder)) {
            throw new RuntimeException("Cannot move a folder into itself or its subfolder");
        }

        // cambio il parent folder e salvo
        sourceFolder.setParentFolder(destFolder);
        folderRepository.save(sourceFolder);
    }

    // metodo wrapper
    private boolean isDescendantOrSelf(Folder dest, Folder source) {
        // risalgo l'albero verso la root
        // se trovo sourceFolder nel percorso, destFolder è un suo discendente
        Folder current = dest;
        while (current != null) {
            if (current.getId().equals(source.getId())) {
                return true;
            }
            current = current.getParentFolder();
        }
        return false;
    }

    @Transactional
    public void moveFile(UUID fileId, UUID targetFolderId, String username) {
        // recupero il file
        StoredFile file = storedFileRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("File not found"));

        // verifico owner del file
        if (!file.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied: you are not the owner of this file");
        }

        Folder destFolder = null;
        if (targetFolderId != null) {
            // recupero cartella di destinazione
            destFolder = folderRepository.findById(targetFolderId)
                    .orElseThrow(() -> new RuntimeException("Target folder not found"));

            // verifico owner della cartella
            if (!destFolder.getUser().getUsername().equals(username)) {
                throw new RuntimeException("Access denied: target folder belongs to another user");
            }
        }

        // sposto e salvo
        file.setFolder(destFolder);
        storedFileRepository.save(file);
    }

}
