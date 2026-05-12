package com.psf.attendance;

import com.psf.global.UserRole;
import com.psf.global.util.ApiResponse;
import com.psf.user.User;
import com.psf.user.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;
    private final AttendanceSnapshotRepository snapshotRepository;
    private final AttendanceSnapshotDetailRepository snapshotDetailRepository;

    @GetMapping("/me")
    @PreAuthorize("hasRole('ATTENDEE')")
    public ResponseEntity<ApiResponse<Attendance>> getMyAttendance(Authentication auth) {
        User user = userRepository.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        Attendance att = attendanceRepository.findTopByUserOrderByScannedAtDesc(user).orElse(null);
        return ResponseEntity.ok(ApiResponse.success(att));
    }

    @PostMapping
    @PreAuthorize("hasRole('ATTENDEE')")
    public ResponseEntity<ApiResponse<Attendance>> checkIn(Authentication auth,
                                                           @RequestBody CheckInRequest req) {
        User user = userRepository.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        Attendance existingAtt = attendanceRepository.findTopByUserOrderByScannedAtDesc(user).orElse(null);
        if (existingAtt != null && "ATTENDED".equals(existingAtt.getStatus())) {
            return ResponseEntity.ok(ApiResponse.success("이미 출석 처리되었습니다.", existingAtt));
        }

        Attendance att = Attendance.builder()
                .user(user)
                .status("ATTENDED")
                .qrData(req.getQrData())
                .scannedAt(LocalDateTime.now())
                .build();
        attendanceRepository.save(att);
        return ResponseEntity.ok(ApiResponse.success("출석이 확인되었습니다.", att));
    }

    @PostMapping("/reset")
    @PreAuthorize("hasRole('HQ')")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> resetAttendance(Authentication auth) {
        User requester = userRepository.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        List<User> attendees = userRepository.findByRole(UserRole.ATTENDEE);
        
        long totalCount = attendees.size();
        long attendedCount = 0;

        AttendanceSnapshot snapshot = AttendanceSnapshot.builder()
                .resetByUsername(requester.getUsername())
                .resetByName(requester.getName())
                .totalCount(totalCount)
                .build();

        List<AttendanceSnapshotDetail> details = new ArrayList<>();
        for (User u : attendees) {
            boolean hasAttended = attendanceRepository.findTopByUserOrderByScannedAtDesc(u)
                    .map(a -> "ATTENDED".equals(a.getStatus()))
                    .orElse(false);
            
            if (hasAttended) attendedCount++;

            details.add(AttendanceSnapshotDetail.builder()
                    .snapshot(snapshot)
                    .userId(u.getId())
                    .userName(u.getName())
                    .userTeam(u.getTeamName())
                    .userRole(u.getRole().name())
                    .attended(hasAttended)
                    .build());
        }
        
        snapshot.setAttendedCount(attendedCount);
        snapshot.setDetails(details);
        
        snapshotRepository.save(snapshot);
        attendanceRepository.deleteAllInBatch();

        return ResponseEntity.ok(ApiResponse.success("출석 기록이 초기화되었으며 스냅샷이 저장되었습니다.", null));
    }

    @GetMapping("/snapshots")
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<ApiResponse<List<AttendanceSnapshot>>> getSnapshots() {
        return ResponseEntity.ok(ApiResponse.success(snapshotRepository.findAllByOrderByResetAtDesc()));
    }

    @GetMapping("/snapshots/{id}/details")
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<ApiResponse<List<AttendanceSnapshotDetail>>> getSnapshotDetails(@PathVariable UUID id) {
        AttendanceSnapshot snapshot = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("스냅샷을 찾을 수 없습니다."));
        return ResponseEntity.ok(ApiResponse.success(snapshotDetailRepository.findBySnapshotOrderByUserTeamAscUserNameAsc(snapshot)));
    }

    @GetMapping("/snapshots/{id}/export")
    @PreAuthorize("hasRole('HQ')")
    public ResponseEntity<byte[]> exportSnapshotCsv(@PathVariable UUID id) throws Exception {
        AttendanceSnapshot snapshot = snapshotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("스냅샷을 찾을 수 없습니다."));
        List<AttendanceSnapshotDetail> details =
                snapshotDetailRepository.findBySnapshotOrderByUserTeamAscUserNameAsc(snapshot);

        Map<String, String> roleKorean = Map.of(
                "ATTENDEE", "참석자",
                "GUIDE", "인솔자",
                "ESCORT", "의전",
                "HQ", "사무국"
        );

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        String resetTime = snapshot.getResetAt() != null ? snapshot.getResetAt().format(fmt) : "";

        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF'); // UTF-8 BOM for Excel
        sb.append("기록일시,이름,팀,역할,출석여부\r\n");

        for (AttendanceSnapshotDetail d : details) {
            String role = roleKorean.getOrDefault(d.getUserRole(), d.getUserRole());
            String attended = d.isAttended() ? "출석" : "미출석";
            sb.append(String.format("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\r\n",
                    resetTime,
                    d.getUserName() != null ? d.getUserName() : "",
                    d.getUserTeam() != null ? d.getUserTeam() : "",
                    role,
                    attended));
        }

        byte[] csvBytes = sb.toString().getBytes(StandardCharsets.UTF_8);

        String fileDate = snapshot.getResetAt() != null
                ? snapshot.getResetAt().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmm"))
                : "history";
        String fileName = "attendance_" + fileDate + ".csv";
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.set(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''" + encodedFileName);
        headers.setContentLength(csvBytes.length);

        return ResponseEntity.ok().headers(headers).body(csvBytes);
    }

    @Data
    public static class CheckInRequest {
        private String qrData;
    }
}
