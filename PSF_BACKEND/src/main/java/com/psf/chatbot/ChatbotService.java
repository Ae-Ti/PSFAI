package com.psf.chatbot;

import com.psf.user.User;
import com.psf.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatbotService {

    private final ChatbotHistoryRepository chatbotHistoryRepository;
    private final UserRepository userRepository;
    private final ChatClient.Builder chatClientBuilder;

    public List<ChatbotHistory> getHistory(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        return chatbotHistoryRepository.findByUserOrderByCreatedAtAsc(user);
    }

    @Transactional
    public ChatbotHistory sendMessage(UUID userId, String message) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        // 사용자 메시지 저장
        chatbotHistoryRepository.save(ChatbotHistory.builder()
                .user(user)
                .senderType("user")
                .message(message)
                .build());

        // Spring AI로 응답 생성
        String systemPrompt = """
                당신은 부산 포럼 참석자를 위한 안내 챗봇입니다.
                부산 관광지, 맛집, 다이소 위치, 교통 수단 등에 대해 친절하고 간결하게 안내해주세요.
                한국어로 응답하되, 요청이 영어나 프랑스어이면 해당 언어로 응답하세요.
                """;
        String botReply = chatClientBuilder.build()
                .prompt()
                .system(systemPrompt)
                .user(message)
                .call()
                .content();

        ChatbotHistory botHistory = ChatbotHistory.builder()
                .user(user)
                .senderType("bot")
                .message(botReply)
                .build();
        return chatbotHistoryRepository.save(botHistory);
    }
}
