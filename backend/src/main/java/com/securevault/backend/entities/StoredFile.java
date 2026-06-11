package com.securevault.backend.entities;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "stored_files")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StoredFile {

    // id, questa volta UUID
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // nome file cifrato
    @Column(name = "enc_name", nullable = false)
    private String encName;

    // path su disco
    @Column(name = "storage_path", nullable = false, unique = true)
    private String storagePath;

    // initialization vector, per cifratura
    @Column(nullable = false)
    private String iv;

    // dimensione del file, comodo da avere
    @Column(name = "file_size")
    private Long fileSize;

    // riferimento a tutto l'utente
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // ora creazione
    @Column(name = "created_at", nullable = false, updatable = false)
    private Long createdAt = System.currentTimeMillis();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id")
    private Folder folder;}
