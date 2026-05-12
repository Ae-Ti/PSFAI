package com.psf.chatbot;

import com.psf.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatbotHistoryRepository extends JpaRepository<ChatbotHistory, UUID> {
    List<ChatbotHistory> findByUserOrderByCreatedAtAsc(User user);
}
