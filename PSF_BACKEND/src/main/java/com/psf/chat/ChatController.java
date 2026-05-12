package com.psf.chat;

import com.psf.global.util.ApiResponse;
import com.psf.user.User;
import com.psf.user.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatRoomMemberRepository roomMemberRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // 접근 가능 채팅방 목록
    @GetMapping("/rooms")
    public ResponseEntity<ApiResponse<List<ChatRoom>>> getRooms(Authentication auth) {
        List<ChatRoom> rooms = roomMemberRepository.findRoomsByUserId(UUID.fromString(auth.getName()));
        return ResponseEntity.ok(ApiResponse.success(rooms));
    }

    // 채팅 내역 조회
    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<ApiResponse<List<ChatMessage>>> getMessages(@PathVariable String roomId) {
        return ResponseEntity.ok(ApiResponse.success(messageRepository.findByRoomId(roomId)));
    }

    // WebSocket 메시지 처리 (STOMP)
    @MessageMapping("/chat/{roomId}")
    public void handleMessage(@DestinationVariable String roomId,
                               @Payload ChatMessagePayload payload,
                               Principal principal) {
        UUID senderId = UUID.fromString(principal.getName());
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다."));

        ChatMessage saved = messageRepository.save(ChatMessage.builder()
                .room(room)
                .sender(sender)
                .content(payload.getContent())
                .build());

        // 같은 채팅방 구독자 전체에게 브로드캐스트
        messagingTemplate.convertAndSend("/topic/chat/" + roomId, saved);
    }

    // HTTP를 통한 메시지 전송 (폴링 클라이언트 지원)
    @PostMapping("/rooms/{roomId}/messages")
    public ResponseEntity<ApiResponse<ChatMessage>> sendHttpMessage(@PathVariable String roomId,
                                                                    @RequestBody ChatMessagePayload payload,
                                                                    Authentication auth) {
        UUID senderId = UUID.fromString(auth.getName());
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다."));

        ChatMessage saved = messageRepository.save(ChatMessage.builder()
                .room(room)
                .sender(sender)
                .content(payload.getContent())
                .build());

        messagingTemplate.convertAndSend("/topic/chat/" + roomId, saved);
        return ResponseEntity.ok(ApiResponse.success("메시지가 전송되었습니다.", saved));
    }

    @Data
    public static class ChatMessagePayload {
        private String content;
    }
}
