package com.psf.notice;

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
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notices")
@RequiredArgsConstructor
public class NoticeController {

    private final NoticeService noticeService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Notice>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(noticeService.getAll()));
    }

    @PostMapping
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<ApiResponse<Notice>> create(Authentication auth,
                                                      @Valid @RequestBody CreateNoticeRequest req) {
        Notice notice = noticeService.create(
                UUID.fromString(auth.getName()),
                req.getTitle(), req.getContent(), req.isImportant());
        return ResponseEntity.ok(ApiResponse.success("공지가 등록되었습니다.", notice));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        noticeService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("공지가 삭제되었습니다.", null));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<ApiResponse<Notice>> update(@PathVariable UUID id,
                                                      @Valid @RequestBody CreateNoticeRequest req) {
        Notice notice = noticeService.update(id, req.getTitle(), req.getContent(), req.isImportant());
        return ResponseEntity.ok(ApiResponse.success("공지가 수정되었습니다.", notice));
    }

    @PostMapping("/ai-draft")
    @PreAuthorize("hasAuthority('ROLE_HQ')")
    public ResponseEntity<ApiResponse<Map<String, String>>> aiDraft(@RequestBody AiDraftRequest req) {
        Map<String, String> draft = noticeService.generateAiDraft(req.getPrompt());
        return ResponseEntity.ok(ApiResponse.success(draft));
    }

    @Data
    public static class CreateNoticeRequest {
        @NotBlank private String title;
        @NotBlank private String content;
        private boolean important;
    }

    @Data
    public static class AiDraftRequest {
        @NotBlank private String prompt;
    }
}
