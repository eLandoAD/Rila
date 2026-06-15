package com.securevault.backend.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class CreateFolderRequest {
    private String encName;
    private String iv;
    private UUID parentId;
}
