package com.psf.notice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface NoticeRepository extends JpaRepository<Notice, UUID> {
    List<Notice> findAllByOrderByCreatedAtDesc();

    @Query("SELECT n FROM Notice n ORDER BY n.createdAt DESC LIMIT 1")
    java.util.Optional<Notice> findLatest();
}
