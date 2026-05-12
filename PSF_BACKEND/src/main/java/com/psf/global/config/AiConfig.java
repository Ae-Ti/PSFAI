package com.psf.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.ai.chat.client.ChatClient;

@Configuration
public class AiConfig {

    // 💡 핵심: ChatClient.builder()를 직접 호출하지 않고, 
    // 스프링이 파라미터로 넘겨주는(주입해주는) 완성된 builder를 사용합니다.
    @Bean
    public ChatClient chatClient(ChatClient.Builder builder) {
        return builder
                // 필요한 경우 여기에 프로젝트 전체 공통 설정을 추가할 수 있습니다.
                // .defaultSystem("당신은 사용자에게 유용한 레시피와 영수증 분석을 제공하는 (Salty) AI 어시스턴트입니다.")
                .build();
    }
}