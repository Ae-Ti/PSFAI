package com.psf.chat;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_rooms")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatRoom {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(length = 30)
    private String roomType;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
