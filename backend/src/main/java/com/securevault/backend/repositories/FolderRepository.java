package com.securevault.backend.repositories;

import com.securevault.backend.entities.Folder;
import com.securevault.backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FolderRepository extends JpaRepository<Folder, UUID> {

    List<Folder> findByUserAndParentFolder(User user, Folder parentFolder);

    List<Folder> findByUser(User user);
}
