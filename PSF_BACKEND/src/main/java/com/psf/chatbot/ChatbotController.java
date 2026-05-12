package com.psf.chatbot;

import com.psf.global.util.ApiResponse;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class ChatbotController {

    private final ChatbotService chatbotService;

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<ChatbotHistory>>> getHistory(Authentication auth) {
        List<ChatbotHistory> history = chatbotService.getHistory(UUID.fromString(auth.getName()));
        return ResponseEntity.ok(ApiResponse.success(history));
    }

    @PostMapping("/message")
    public ResponseEntity<ApiResponse<ChatbotHistory>> sendMessage(Authentication auth,
                                                                    @RequestBody MessageRequest req) {
        ChatbotHistory response = chatbotService.sendMessage(UUID.fromString(auth.getName()), req.getMessage());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Data
    public static class MessageRequest {
        private String message;
    }
}
