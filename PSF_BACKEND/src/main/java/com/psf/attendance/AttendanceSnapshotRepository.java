package com.psf.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.List;

public interface AttendanceSnapshotRepository extends JpaRepository<AttendanceSnapshot, UUID> {
    List<AttendanceSnapshot> findAllByOrderByResetAtDesc();
}
