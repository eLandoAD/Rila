package com.securevault.backend.dto;

// lifetime of the public link, in hours. null = never expires
public record PublishRequest(Integer hours) {}
