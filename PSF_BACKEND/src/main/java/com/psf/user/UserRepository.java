package com.psf.user;

import com.psf.global.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);

    // 연락처: 팀 내 + HQ(teamName='All') 필터
    @Query("SELECT u FROM User u WHERE u.teamName = :team OR u.teamName = 'All'")
    List<User> findByTeamOrAll(@Param("team") String team);

    // 이름 검색 포함 팀 필터
    @Query("SELECT u FROM User u WHERE (u.teamName = :team OR u.teamName = 'All') AND LOWER(u.name) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<User> findByTeamOrAllAndNameContaining(@Param("team") String team, @Param("keyword") String keyword);

    // 전체 조회 (의전/사무국용)
    List<User> findByNameContainingIgnoreCase(String name);

    List<User> findByRole(UserRole role);
}
