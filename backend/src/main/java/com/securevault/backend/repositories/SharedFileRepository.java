package com.securevault.backend.repositories;

import com.securevault.backend.entities.SharedFile;
import com.securevault.backend.entities.StoredFile;
import com.securevault.backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SharedFileRepository extends JpaRepository<SharedFile, UUID> {

    List<SharedFile> findByReceiver(User receiver);

    Optional<SharedFile> findByFileAndReceiver(StoredFile file, User receiver);
}
