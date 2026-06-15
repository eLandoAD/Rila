package com.securevault.backend.dto;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FolderResponse {
    private UUID id;
    private String encName;
    private String iv;
    private UUID parentId;
}
