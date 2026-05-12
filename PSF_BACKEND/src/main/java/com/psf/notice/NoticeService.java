package com.psf.notice;

import com.psf.user.User;
import com.psf.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NoticeService {

    private final NoticeRepository noticeRepository;
    private final UserRepository userRepository;
    private final ChatClient.Builder chatClientBuilder;

    public List<Notice> getAll() {
        return noticeRepository.findAllByOrderByCreatedAtDesc();
    }

    public Notice getLatest() {
        return noticeRepository.findLatest().orElse(null);
    }

    @Transactional
    public Notice create(UUID authorId, String title, String content, boolean isImportant) {
        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new IllegalArgumentException("작성자를 찾을 수 없습니다."));
        Notice notice = Notice.builder()
                .author(author)
                .title(title)
                .content(content)
                .isImportant(isImportant)
                .build();
        return noticeRepository.save(notice);
    }

    @Transactional
    public void delete(UUID noticeId) {
        noticeRepository.deleteById(noticeId);
    }

    @Transactional
    public Notice update(UUID noticeId, String title, String content, boolean isImportant) {
        Notice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new IllegalArgumentException("공지사항을 찾을 수 없습니다."));
        notice.setTitle(title);
        notice.setContent(content);
        notice.setImportant(isImportant);
        return noticeRepository.save(notice);
    }

    public Map<String, String> generateAiDraft(String prompt) {
        try {
            ChatClient chatClient = chatClientBuilder.build();
            String systemPrompt = """
                    당신은 포럼 공지사항 작성 보조 AI입니다.
                    주어진 키워드를 바탕으로 공지사항 제목과 내용을 JSON 형식으로 작성하세요.
                    반드시 아래 형식으로만 응답하세요:
                    {"title": "공지 제목", "content": "공지 내용"}
                    """;
            String response = chatClient.prompt()
                    .system(systemPrompt)
                    .user("키워드: " + prompt)
                    .call()
                    .content();
            
            response = response.trim();
            System.out.println("====== RAW AI RESPONSE ======");
            System.out.println(response);
            System.out.println("=============================");
            if (response.startsWith("```")) {
                response = response.replaceAll("```json|```", "").trim();
            }
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            @SuppressWarnings("unchecked")
            Map<String, String> result = mapper.readValue(response, Map.class);
            return result;
        } catch (Exception e) {
            String errorMsg = "AI Draft Error: " + e.getMessage();
            if (e.getCause() != null) {
                errorMsg += " | Cause: " + e.getCause().getMessage();
            }
            return Map.of("title", "AI 생성 실패", "content", errorMsg);
        }
    }
}
