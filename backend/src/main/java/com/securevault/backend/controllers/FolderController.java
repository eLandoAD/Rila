package com.securevault.backend.controllers;

import com.securevault.backend.repositories.FolderRepository;
import com.securevault.backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/folders")
@RequiredArgsConstructor
public class FolderController {

    // injection
    private final FolderRepository folderRepository;
    private final UserRepository userRepository;

    @PostMapping("/create")



}
