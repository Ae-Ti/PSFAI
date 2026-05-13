package com.psf.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(
                    "http://localhost:5173",
                    "http://localhost",           // Android Capacitor 앱 (HTTP)
                    "https://localhost",          // Android Capacitor 앱 (HTTPS Scheme)
                    "http://<S3_BUCKET_NAME>.s3-website.ap-northeast-2.amazonaws.com",
                    "https://api.psfapp.cloud",
                    "https://psfapp.cloud"
                )
                .setAllowedOriginPatterns(
                    "https://*.cloudfront.net",   // CloudFront
                    "capacitor://*"               // iOS Capacitor 앱
                )
                .withSockJS();
    }
}
