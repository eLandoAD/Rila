package com.securevault.backend.dto;

import lombok.Data;

// the frontend sends the new encrypted name and its iv
@Data
public class RenameFolderRequest {
    private String newEncName;
    private String newIv;
}
