package com.psf.dashboard;

import com.psf.attendance.AttendanceRepository;
import com.psf.global.UserRole;
import com.psf.global.util.ApiResponse;
import com.psf.user.User;
import com.psf.user.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ESCORT') or hasRole('HQ')")
public class DashboardController {

    private final AttendanceRepository attendanceRepository;
    private final DashboardNoteRepository noteRepository;
    private final UserRepository userRepository;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getStats(Authentication auth) {
        User requester = userRepository.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        boolean isHq = requester.getRole() == UserRole.HQ;

        long total = isHq
                ? userRepository.findByRole(UserRole.ATTENDEE).size()
                : userRepository.findByTeamOrAll(requester.getTeamName()).stream()
                    .filter(u -> u.getRole() == UserRole.ATTENDEE).count();

        long attended = isHq
                ? attendanceRepository.countDistinctUserByStatus("ATTENDED")
                : attendanceRepository.countDistinctUserByStatusAndUserTeamName("ATTENDED", requester.getTeamName());


        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "total", total,
                "attended", attended,
                "missing", total - attended
        )));
    }

    @GetMapping("/attendees")
    public ResponseEntity<ApiResponse<List<AttendeeDto>>> getAttendees(Authentication auth) {
        User requester = userRepository.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        boolean isHq = requester.getRole() == UserRole.HQ;

        List<User> attendees = isHq
                ? userRepository.findByRole(UserRole.ATTENDEE)
                : userRepository.findByTeamOrAll(requester.getTeamName()).stream()
                    .filter(u -> u.getRole() == UserRole.ATTENDEE).toList();

        List<AttendeeDto> dtoList = attendees.stream().map(u -> {
            boolean hasAttended = attendanceRepository.findTopByUserOrderByScannedAtDesc(u)
                    .map(a -> "ATTENDED".equals(a.getStatus()))
                    .orElse(false);
            return new AttendeeDto(u.getId(), u.getName(), u.getTeamName(), hasAttended);
        }).toList();

        return ResponseEntity.ok(ApiResponse.success(dtoList));
    }

    @Data
    public static class AttendeeDto {
        private UUID id;
        private String name;
        private String teamName;
        private boolean attended;

        public AttendeeDto(UUID id, String name, String teamName, boolean attended) {
            this.id = id;
            this.name = name;
            this.teamName = teamName;
            this.attended = attended;
        }
    }

    @GetMapping("/notes")
    public ResponseEntity<ApiResponse<List<DashboardNote>>> getNotes(Authentication auth) {
        User requester = userRepository.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        List<DashboardNote> notes = requester.getRole() == UserRole.HQ
                ? noteRepository.findAllByOrderByCreatedAtDesc()
                : noteRepository.findByTeamNameOrderByCreatedAtDesc(requester.getTeamName());
        return ResponseEntity.ok(ApiResponse.success(notes));
    }

    @PostMapping("/notes")
    @PreAuthorize("hasRole('ESCORT')")
    @Transactional
    public ResponseEntity<ApiResponse<DashboardNote>> createNote(Authentication auth,
                                                                  @RequestBody CreateNoteRequest req) {
        User author = userRepository.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        DashboardNote note = noteRepository.save(DashboardNote.builder()
                .author(author)
                .teamName(author.getTeamName())
                .content(req.getContent())
                .build());
        return ResponseEntity.ok(ApiResponse.success("특이사항이 등록되었습니다.", note));
    }

    @PutMapping("/notes/{id}")
    @PreAuthorize("hasRole('ESCORT') or hasRole('HQ')")
    @Transactional
    public ResponseEntity<ApiResponse<DashboardNote>> updateNote(Authentication auth,
                                                                 @PathVariable UUID id,
                                                                 @RequestBody CreateNoteRequest req) {
        User requester = userRepository.findById(UUID.fromString(auth.getName())).orElseThrow();
        DashboardNote note = noteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("특이사항을 찾을 수 없습니다."));

        // Author or HQ can edit
        if (!note.getAuthor().getId().equals(requester.getId()) && requester.getRole() != UserRole.HQ) {
            return ResponseEntity.status(403).body(ApiResponse.error("수정 권한이 없습니다."));
        }

        note.setContent(req.getContent());
        return ResponseEntity.ok(ApiResponse.success("특이사항이 수정되었습니다.", noteRepository.save(note)));
    }

    @DeleteMapping("/notes/{id}")
    @PreAuthorize("hasRole('ESCORT') or hasRole('HQ')")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> deleteNote(Authentication auth,
                                                        @PathVariable UUID id) {
        User requester = userRepository.findById(UUID.fromString(auth.getName())).orElseThrow();
        DashboardNote note = noteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("특이사항을 찾을 수 없습니다."));

        // Author or HQ can delete
        if (!note.getAuthor().getId().equals(requester.getId()) && requester.getRole() != UserRole.HQ) {
            return ResponseEntity.status(403).body(ApiResponse.error("삭제 권한이 없습니다."));
        }

        noteRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success("특이사항이 삭제되었습니다.", null));
    }

    @Data
    public static class CreateNoteRequest {
        private String content;
    }
}
