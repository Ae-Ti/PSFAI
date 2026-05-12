package com.psf.user;

import com.psf.global.UserRole;
import com.psf.global.util.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;

    // 내 프로필 조회
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<User>> getMe(Authentication auth) {
        User user = userService.findById(UUID.fromString(auth.getName()));
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    // 연락처/이메일 수정
    @PutMapping("/me")
    public ResponseEntity<ApiResponse<User>> updateProfile(Authentication auth,
                                                           @RequestBody UpdateProfileRequest req) {
        User updated = userService.updateProfile(UUID.fromString(auth.getName()), req.getPhone(), req.getEmail(), req.getPosition());
        return ResponseEntity.ok(ApiResponse.success("프로필이 저장되었습니다.", updated));
    }

    // 전체 회원 목록 (사무국 전용)
    @GetMapping
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<ApiResponse<List<User>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.success(userService.getAllUsers()));
    }

    // 신규 계정 발급 (사무국 전용)
    @PostMapping
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<ApiResponse<User>> createUser(@Valid @RequestBody CreateUserRequest req) {
        User user = userService.createUser(req.getUsername(), req.getPassword(),
                req.getName(), UserRole.valueOf(req.getRole()), req.getTeamName(),
                req.getEmail(), req.getPhone(), req.getPosition());
        return ResponseEntity.ok(ApiResponse.success("계정이 생성되었습니다.", user));
    }

    // 계정 삭제 (사무국 전용)
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.success("계정이 삭제되었습니다.", null));
    }

    // 계정 수정 (사무국 전용)
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<ApiResponse<User>> updateUser(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest req) {
        User user = userService.updateUser(id, req.getUsername(), req.getPassword(),
                req.getName(), UserRole.valueOf(req.getRole()), req.getTeamName(),
                req.getEmail(), req.getPhone(), req.getPosition());
        return ResponseEntity.ok(ApiResponse.success("계정이 수정되었습니다.", user));
    }

    // 연락처 조회 (역할별 필터)
    @GetMapping("/contacts")
    public ResponseEntity<ApiResponse<List<User>>> getContacts(Authentication auth,
                                                               @RequestParam(required = false) String keyword) {
        User requester = userService.findById(UUID.fromString(auth.getName()));
        List<User> contacts = userService.getContacts(requester, keyword);
        return ResponseEntity.ok(ApiResponse.success(contacts));
    }

    @Data
    public static class UpdateProfileRequest {
        private String phone;
        private String email;
        private String position;
    }

    @Data
    public static class CreateUserRequest {
        @NotBlank private String username;
        @NotBlank private String password;
        @NotBlank private String name;
        @NotBlank private String role;
        private String teamName;
        private String email;
        private String phone;
        private String position;
    }

    @Data
    public static class UpdateUserRequest {
        @NotBlank private String username;
        private String password;
        @NotBlank private String name;
        @NotBlank private String role;
        private String teamName;
        private String email;
        private String phone;
        private String position;
    }
}
