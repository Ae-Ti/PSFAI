package com.psf.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.List;

public interface AttendanceSnapshotDetailRepository extends JpaRepository<AttendanceSnapshotDetail, UUID> {
    List<AttendanceSnapshotDetail> findBySnapshotOrderByUserTeamAscUserNameAsc(AttendanceSnapshot snapshot);
}
