package com.securevault.backend;

import com.securevault.backend.entities.StoredFile;
import com.securevault.backend.entities.User;
import com.securevault.backend.repositories.SharedFileRepository;
import com.securevault.backend.repositories.StoredFileRepository;
import com.securevault.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Alice's file must not be reachable by Bob, by any route. These are the checks
 * the whole project rests on: if they break, the app keeps working perfectly
 * and hands files to people who should not have them.
 */
@SpringBootTest
@AutoConfigureMockMvc
class FileAccessControlTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired StoredFileRepository files;
    @Autowired SharedFileRepository shares;

    @Value("${app.storage.path}") String storagePath;

    private User alice;
    private StoredFile aliceFile;

    @BeforeEach
    void setUp() throws Exception {
        shares.deleteAll();
        files.deleteAll();
        users.deleteAll();
        alice = newUser("alice");
        newUser("bob");
        aliceFile = newFile(alice);
    }

    private User newUser(String name) {
        User u = new User();
        u.setUsername(name);
        u.setEmail(name + "@example.test");
        u.setPassword("irrelevant-for-these-tests");
        u.setEnabled(true);
        return users.save(u);
    }

    private StoredFile newFile(User owner) throws Exception {
        String physical = UUID.randomUUID().toString();
        Path dir = Path.of(storagePath).toAbsolutePath().normalize();
        Files.createDirectories(dir);
        Files.write(dir.resolve(physical), "ciphertext".getBytes());

        StoredFile f = new StoredFile();
        f.setUser(owner);
        f.setEncName("enc-name");
        f.setIv("iv");
        f.setWrappedDek("wrapped");
        f.setDekIv("dek-iv");
        f.setStoragePath(physical);
        f.setFileSize(10L);
        return files.save(f);
    }

    // --- 1. direct access to the private endpoints ---

    @Test
    void bobCannotDownloadAlicesFile() throws Exception {
        mvc.perform(get("/api/files/download/" + aliceFile.getId()).with(user("bob")))
           .andExpect(status().isForbidden());
    }

    @Test
    void bobCannotDeleteAlicesFile() throws Exception {
        mvc.perform(delete("/api/files/" + aliceFile.getId()).with(user("bob")))
           .andExpect(status().isForbidden());
    }

    @Test
    void bobCannotRenameAlicesFile() throws Exception {
        mvc.perform(patch("/api/files/" + aliceFile.getId())
                    .with(user("bob"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"newEncName\":\"stolen\"}"))
           .andExpect(status().isForbidden());
    }

    @Test
    void bobCannotPublishAlicesFile() throws Exception {
        mvc.perform(post("/api/files/" + aliceFile.getId() + "/publish")
                    .with(user("bob"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"hours\":24}"))
           .andExpect(status().isForbidden());
    }

    @Test
    void bobCannotRevokeAlicesLink() throws Exception {
        mvc.perform(post("/api/files/" + aliceFile.getId() + "/unpublish").with(user("bob")))
           .andExpect(status().isForbidden());
    }

    @Test
    void bobsListDoesNotContainAlicesFiles() throws Exception {
        mvc.perform(get("/api/files").with(user("bob")))
           .andExpect(status().isOk())
           .andExpect(content().json("[]"));
    }

    @Test
    void withoutLoginNothingIsDownloadable() throws Exception {
        // any 4xx: with no entry point configured Spring answers 403 where you
        // would expect a 401. What matters is that it is not a 200.
        mvc.perform(get("/api/files/download/" + aliceFile.getId()))
           .andExpect(status().is4xxClientError());
    }

    // --- 2. the public link ---

    @Test
    void aValidPublicLinkServesTheFile() throws Exception {
        String token = publish(24);
        mvc.perform(get("/api/files/public/" + token))
           .andExpect(status().isOk())
           .andExpect(header().string("x-iv", "iv"));
    }

    @Test
    void anExpiredPublicLinkAnswers404() throws Exception {
        String token = publish(24);
        // expiry moved into the past
        StoredFile f = files.findById(aliceFile.getId()).orElseThrow();
        f.setShareTokenExpiresAt(System.currentTimeMillis() - 1000);
        files.save(f);

        mvc.perform(get("/api/files/public/" + token))
           .andExpect(status().isNotFound());
    }

    @Test
    void anInventedTokenAnswers404() throws Exception {
        mvc.perform(get("/api/files/public/" + "0".repeat(64)))
           .andExpect(status().isNotFound());
    }

    @Test
    void afterUnpublishTheLinkIsDead() throws Exception {
        String token = publish(null);
        mvc.perform(post("/api/files/" + aliceFile.getId() + "/unpublish").with(user("alice")))
           .andExpect(status().is2xxSuccessful());
        mvc.perform(get("/api/files/public/" + token))
           .andExpect(status().isNotFound());
    }

    private String publish(Integer hours) throws Exception {
        String body = (hours == null) ? "{\"hours\":null}" : "{\"hours\":" + hours + "}";
        return mvc.perform(post("/api/files/" + aliceFile.getId() + "/publish")
                    .with(user("alice"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
                  .andReturn().getResponse().getContentAsString();
    }
}
