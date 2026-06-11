package com.securevault.backend.dto;

// il frontend manda un json col nuovo nome

import lombok.Data;

@Data
public class RenameRequest {
    public String newEncName;
}
