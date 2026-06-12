package com.securevault.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FolderContentResponse {
    private List<FolderResponse> folders;
    private List<FileResponse> files;
    private UUID currentFolderId;
    private String currentFolderName;
}
