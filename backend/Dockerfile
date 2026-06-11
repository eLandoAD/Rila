# syntax=docker/dockerfile:1

# --- Stage 1: build ---
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
# normalize line endings (gradlew may be checked out with CRLF on Windows)
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew

COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test

# --- Stage 2: runtime ---
FROM eclipse-temurin:25-jdk AS runtime
WORKDIR /app
ENV SERVER_PORT=8080

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
