package com.securevault.backend;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


// simple example controller
@RestController
@RequestMapping("/api")
public class StatusController {

    // status endpoint
    @GetMapping("/status")
    public Map<String, String> getStatus() {
        return Map.of(
            "status", "UP",
            "message", "Securevault Backend running"
        );
    }
}
