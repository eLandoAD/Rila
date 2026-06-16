package com.securevault.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SharedFileResponse {
    private UUID id;
    private UUID fileId;
    private String encName;
    private Long fileSize;
    private Long createdAt;
    private String iv;
    private String senderEmail;
    private String senderUsername;
    private String dek;
}
