package com.psf.attendance;

import com.psf.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {
    Optional<Attendance> findTopByUserOrderByScannedAtDesc(User user);
    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT a.user) FROM Attendance a WHERE a.status = :status")
    long countDistinctUserByStatus(@org.springframework.data.repository.query.Param("status") String status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT a.user) FROM Attendance a WHERE a.status = :status AND a.user.teamName = :teamName")
    long countDistinctUserByStatusAndUserTeamName(@org.springframework.data.repository.query.Param("status") String status, @org.springframework.data.repository.query.Param("teamName") String teamName);
}
