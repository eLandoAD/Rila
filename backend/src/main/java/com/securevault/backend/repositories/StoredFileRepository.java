package com.securevault.backend.repositories;


import com.securevault.backend.entities.Folder;
import com.securevault.backend.entities.StoredFile;
import com.securevault.backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StoredFileRepository extends JpaRepository<StoredFile, UUID> {

    // vedere la lista dei file di un utente
    List<StoredFile> findByUser(User user);

    List<StoredFile> findByUserAndFolder(User user, Folder folder);
}
