package com.securevault.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class FileResponse {
    private UUID id;
    private String encName;
    private Long fileSize;
    private Long createdAt;
}
