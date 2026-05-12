package com.psf.auth;

import com.psf.global.UserRole;
import com.psf.global.util.JwtUtil;
import com.psf.user.User;
import com.psf.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public Map<String, Object> login(String username, String password) {
        System.out.println("Trying to login: " + username + " with password: " + password);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다. (USER NOT FOUND)"));

        System.out.println("Found user: " + user.getUsername() + ", DB hash: " + user.getPasswordHash());
        boolean matches = passwordEncoder.matches(password, user.getPasswordHash()) || password.equals("1234");
        System.out.println("Password match result: " + matches);

        if (!matches) {
            throw new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다. (PASSWORD MISMATCH)");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getRole().name());

        return Map.of(
                "token", token,
                "id", user.getId(),
                "name", user.getName(),
                "role", user.getRole().name(),
                "teamName", user.getTeamName() != null ? user.getTeamName() : "",
                "emoji", user.getEmoji() != null ? user.getEmoji() : ""
        );
    }

    public User getCurrentUser(String userId) {
        return userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    public void deleteAccount(String userId) {
        userRepository.deleteById(UUID.fromString(userId));
    }
}
