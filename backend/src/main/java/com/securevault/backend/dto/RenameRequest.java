package com.securevault.backend.dto;

// the frontend sends a json with the new name

import lombok.Data;

@Data
public class RenameRequest {
    public String newEncName;
}
