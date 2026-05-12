package com.psf.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {
    @Query("SELECT m FROM ChatMessage m WHERE m.room.id = :roomId ORDER BY m.createdAt ASC")
    List<ChatMessage> findByRoomId(@Param("roomId") String roomId);

    @Query("SELECT m FROM ChatMessage m WHERE m.room.id = :roomId ORDER BY m.createdAt DESC")
    List<ChatMessage> findLatestByRoomId(@Param("roomId") String roomId, Pageable pageable);
}
