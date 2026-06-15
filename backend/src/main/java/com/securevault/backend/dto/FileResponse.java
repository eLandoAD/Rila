package com.securevault.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FileResponse {
    private UUID id;
    private String encName;
    private Long fileSize;
    private Long createdAt;
    private String iv;
}
