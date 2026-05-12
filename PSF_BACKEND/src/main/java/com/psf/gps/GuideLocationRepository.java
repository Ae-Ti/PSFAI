package com.psf.gps;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface GuideLocationRepository extends JpaRepository<GuideLocation, UUID> {
    @EntityGraph(attributePaths = {"guide"})
    @Query("SELECT g FROM GuideLocation g WHERE g.guide.teamName = :team")
    List<GuideLocation> findByTeam(@Param("team") String team);

    @EntityGraph(attributePaths = {"guide"})
    List<GuideLocation> findAll();
}
