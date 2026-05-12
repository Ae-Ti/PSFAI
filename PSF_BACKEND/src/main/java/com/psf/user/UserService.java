package com.psf.user;

import com.psf.global.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public User findById(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    @Transactional
    public User updateProfile(UUID userId, String phone, String email, String position) {
        User user = findById(userId);
        if (phone != null && !phone.trim().isEmpty()) user.setPhone(phone);
        if (email != null && !email.trim().isEmpty()) user.setEmail(email);
        if (position != null && !position.trim().isEmpty()) user.setPosition(position);
        return userRepository.save(user);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional
    public User createUser(String username, String password, String name, UserRole role, String teamName, String email, String phone, String position) {
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다: " + username);
        }
        User user = User.builder()
                .username(username)
                .passwordHash(passwordEncoder.encode(password))
                .name(name)
                .role(role)
                .teamName(role == UserRole.HQ ? "All" : teamName)
                .email(email)
                .phone(phone)
                .position(position)
                .emoji("👤")
                .build();
        return userRepository.save(user);
    }

    @Transactional
    public User updateUser(UUID userId, String username, String password, String name, UserRole role, String teamName, String email, String phone, String position) {
        User user = findById(userId);
        if (!user.getUsername().equals(username) && userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다: " + username);
        }
        user.setUsername(username);
        if (password != null && !password.trim().isEmpty()) {
            user.setPasswordHash(passwordEncoder.encode(password));
        }
        if (name != null && !name.trim().isEmpty()) user.setName(name);
        if (role != null) user.setRole(role);
        if (teamName != null && !teamName.trim().isEmpty()) {
            user.setTeamName(role == UserRole.HQ ? "All" : teamName);
        }
        if (email != null && !email.trim().isEmpty()) user.setEmail(email);
        if (phone != null && !phone.trim().isEmpty()) user.setPhone(phone);
        if (position != null && !position.trim().isEmpty()) user.setPosition(position);
        return userRepository.save(user);
    }

    @Transactional
    public void deleteUser(UUID userId) {
        userRepository.deleteById(userId);
    }

    public List<User> getContacts(User requester, String keyword) {
        boolean isEscortOrHq = requester.getRole() == UserRole.ESCORT || requester.getRole() == UserRole.HQ;
        if (isEscortOrHq) {
            return keyword != null && !keyword.isBlank()
                    ? userRepository.findByNameContainingIgnoreCase(keyword)
                    : userRepository.findAll();
        } else {
            return keyword != null && !keyword.isBlank()
                    ? userRepository.findByTeamOrAllAndNameContaining(requester.getTeamName(), keyword)
                    : userRepository.findByTeamOrAll(requester.getTeamName());
        }
    }
}
