package com.dinotransit.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DinoTransitBackendApplication {

    public static void main(String[] args) {

        SpringApplication.run(DinoTransitBackendApplication.class, args);

    }

}
