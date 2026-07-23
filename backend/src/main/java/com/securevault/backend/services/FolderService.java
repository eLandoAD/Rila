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
        // fetch the folder entity from the DB
        Folder folder = folderRepository.findById(id)
             .orElseThrow(() -> new RuntimeException("Folder not found"));

        // verify the user
        if (folder.getUser() == null || !folder.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied: you are not the owner");
        }

        // collect the paths before touching the DB
        List<String> filePaths = new ArrayList<>();
        collectFilePaths(folder, folder.getUser(), filePaths);

        // delete the whole subtree from the DB
        deleteSubtree(folder, folder.getUser());


        // delete from disk
        filePaths.forEach(fileStorageService::deleteFile);

    }


    // supporting wrapper method
    // recursively deletes children first, then the parent
    private void deleteSubtree(Folder folder, User user) {
        List<StoredFile> files = storedFileRepository.findByUserAndFolder(user, folder);
        storedFileRepository.deleteAll(files);

        folderRepository.findByUserAndParentFolder(user, folder)
                .forEach(sub -> deleteSubtree(sub, user));

        folderRepository.delete(folder);
    }


    // recursively collects all paths without touching anything
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
        // find the folder to move
        Folder sourceFolder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found"));

        // verify owner
        if (!sourceFolder.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied: you are not the owner");
        }

        // move to root
        if (targetFolderId == null) {
            sourceFolder.setParentFolder(null);
            folderRepository.save(sourceFolder);
            return;
        }

        // fetch destination folder
        Folder destFolder = folderRepository.findById(targetFolderId)
                .orElseThrow(() -> new RuntimeException("Folder not found"));


        // check that it belongs to the same user
        if (!destFolder.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied: you are not the owner");
        }


        // check that it's not being moved into itself
        if (isDescendantOrSelf(destFolder, sourceFolder)) {
            throw new RuntimeException("Cannot move a folder into itself or its subfolder");
        }

        // change the parent folder and save
        sourceFolder.setParentFolder(destFolder);
        folderRepository.save(sourceFolder);
    }

    // wrapper method
    private boolean isDescendantOrSelf(Folder dest, Folder source) {
        // walk up the tree towards the root
        // if sourceFolder is found along the path, destFolder is a descendant of it
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
    public void renameFolder(UUID folderId, String newEncName, String newIv, String username) {
        // fetch the folder
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found"));

        // verify owner
        if (!folder.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied: you are not the owner");
        }

        // update encrypted name and iv
        folder.setEncName(newEncName);
        folder.setIv(newIv);
        folderRepository.save(folder);
    }

    @Transactional
    public void moveFile(UUID fileId, UUID targetFolderId, String username) {
        // fetch the file
        StoredFile file = storedFileRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("File not found"));

        // verify file owner
        if (!file.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied: you are not the owner of this file");
        }

        Folder destFolder = null;
        if (targetFolderId != null) {
            // fetch destination folder
            destFolder = folderRepository.findById(targetFolderId)
                    .orElseThrow(() -> new RuntimeException("Target folder not found"));

            // verify folder owner
            if (!destFolder.getUser().getUsername().equals(username)) {
                throw new RuntimeException("Access denied: target folder belongs to another user");
            }
        }

        // move and save
        file.setFolder(destFolder);
        storedFileRepository.save(file);
    }

}
