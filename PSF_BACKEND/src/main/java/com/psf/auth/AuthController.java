package com.psf.auth;

import com.psf.global.util.ApiResponse;
import com.psf.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<Map<String, Object>>> login(@Valid @RequestBody LoginRequest req) {
        Map<String, Object> result = authService.login(req.getUsername(), req.getPassword());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/hash")
    public String hash(@RequestParam String pw) {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode(pw);
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<User>> me(Authentication auth) {
        User user = authService.getCurrentUser(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @DeleteMapping("/me")
    public ResponseEntity<ApiResponse<Void>> deleteAccount(Authentication auth) {
        authService.deleteAccount(auth.getName());
        return ResponseEntity.ok(ApiResponse.success("회원 탈퇴 처리되었습니다.", null));
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginRequest {
        @NotBlank 
        @com.fasterxml.jackson.annotation.JsonProperty("username")
        private String username;

        @NotBlank 
        @com.fasterxml.jackson.annotation.JsonProperty("password")
        private String password;
    }
}
