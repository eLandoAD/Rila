package com.securevault.backend.dto;


import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class FolderResponse {
    private String id;
    private String encName;
    private String parentId;
}
