package com.securevault.backend.dto;

import lombok.Data;

// il frontend manda il nuovo nome cifrato e il relativo iv
@Data
public class RenameFolderRequest {
    private String newEncName;
    private String newIv;
}
