package com.securevault.backend.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "folder")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Folder {
    // id
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // nome criptato
    @Column(name = "enc_name", nullable = false)
    private String encName;

    // riferimento a tutto l'utente
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // riferimento a una cartella padre
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Folder parentFolder;

    // data creazione
    @Column(name = "created_at", nullable = false, updatable = false)
    private Long createdAt = System.currentTimeMillis();

}
