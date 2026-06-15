package com.securevault.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ResetInfoResponse {
    private String recoveryEncryptedDek;
    private String recoveryDekIv;
    private String keySalt;
}