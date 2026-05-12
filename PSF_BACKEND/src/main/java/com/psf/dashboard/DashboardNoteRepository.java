package com.psf.dashboard;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DashboardNoteRepository extends JpaRepository<DashboardNote, UUID> {
    @EntityGraph(attributePaths = {"author"})
    List<DashboardNote> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"author"})
    List<DashboardNote> findByTeamNameOrderByCreatedAtDesc(String teamName);
}
