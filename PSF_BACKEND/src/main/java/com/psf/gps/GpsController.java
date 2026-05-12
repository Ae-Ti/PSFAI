package com.psf.gps;

import com.psf.global.UserRole;
import com.psf.global.util.ApiResponse;
import com.psf.user.User;
import com.psf.user.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/gps")
@RequiredArgsConstructor
public class GpsController {

    private final GuideLocationRepository guideLocationRepository;
    private final UserRepository userRepository;

    // 인솔자 위치 업데이트
    @PutMapping
    @PreAuthorize("hasRole('GUIDE')")
    @Transactional
    public ResponseEntity<ApiResponse<GuideLocation>> updateLocation(Authentication auth,
                                                                     @RequestBody GpsUpdateRequest req) {
        validateCoordinates(req);

        UUID guideId = UUID.fromString(auth.getName());
        // getReferenceById를 사용하여 영속성 컨텍스트 내 참조 확보
        User guide = userRepository.getReferenceById(guideId);

        GuideLocation loc = guideLocationRepository.findById(guideId)
                .orElseGet(() -> {
                    GuideLocation newLoc = new GuideLocation();
                    newLoc.setGuide(guide);
                    return newLoc;
                });

        loc.setLatitude(req.getLatitude());
        loc.setLongitude(req.getLongitude());
        loc.setAddress(req.getAddress());
        loc.setStatus(req.getStatus());
        loc.setTransmitting(req.isTransmitting());
        loc.setUpdatedAt(LocalDateTime.now());

        GuideLocation saved = guideLocationRepository.saveAndFlush(loc);
        return ResponseEntity.ok(ApiResponse.success(saved));
    }

    private void validateCoordinates(GpsUpdateRequest req) {
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "요청 본문이 비어 있습니다.");
        }
        if (req.getLatitude() == null || req.getLongitude() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "위도/경도는 필수입니다.");
        }

        BigDecimal minLat = BigDecimal.valueOf(-90);
        BigDecimal maxLat = BigDecimal.valueOf(90);
        BigDecimal minLng = BigDecimal.valueOf(-180);
        BigDecimal maxLng = BigDecimal.valueOf(180);

        if (req.getLatitude().compareTo(minLat) < 0 || req.getLatitude().compareTo(maxLat) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "위도 범위가 올바르지 않습니다.");
        }
        if (req.getLongitude().compareTo(minLng) < 0 || req.getLongitude().compareTo(maxLng) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "경도 범위가 올바르지 않습니다.");
        }
    }

    // 대시보드용 GPS 조회 (의전: 팀 필터, 사무국: 전체)
    @GetMapping
    @PreAuthorize("hasRole('ESCORT') or hasRole('HQ')")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<GuideLocation>>> getLocations(Authentication auth) {
        User requester = userRepository.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        List<GuideLocation> locations;
        if (requester.getRole() == UserRole.HQ) {
            locations = guideLocationRepository.findAll();
        } else {
            locations = guideLocationRepository.findByTeam(requester.getTeamName());
        }
        return ResponseEntity.ok(ApiResponse.success(locations));
    }

    @Data
    public static class GpsUpdateRequest {
        private BigDecimal latitude;
        private BigDecimal longitude;
        private String address;
        private String status;
        private boolean transmitting;
    }
}
