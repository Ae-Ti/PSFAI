package com.psf.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, ChatRoomMember.ChatRoomMemberId> {
    @Query("SELECT m.room FROM ChatRoomMember m WHERE m.user.id = :userId")
    List<ChatRoom> findRoomsByUserId(@Param("userId") UUID userId);
}
