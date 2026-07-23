package com.securevault.backend.entities;


import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "stored_files")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StoredFile {

    // id, this time UUID
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // encrypted file name
    @Column(name = "enc_name", nullable = false)
    private String encName;

    // unshared token
    @Column(name = "share_token", unique = true, length = 64)
    private String shareToken;

    // path on disk
    @Column(name = "storage_path", nullable = false, unique = true)
    private String storagePath;

    // initialization vector, for encryption
    @Column(nullable = false)
    private String iv;

    // file's dek, wrapped with the owner's master dek
    @Column(name = "wrapped_dek", length = 512)
    private String wrappedDek;

    @Column(name = "dek_iv", length = 255)
    private String dekIv;

    // file size, handy to have
    @Column(name = "file_size")
    private Long fileSize;

    // reference to the owning user
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // creation time
    @Column(name = "created_at", nullable = false, updatable = false)
    private Long createdAt = System.currentTimeMillis();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id")
    private Folder folder;

}
