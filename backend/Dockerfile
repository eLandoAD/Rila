# syntax=docker/dockerfile:1

# --- Stage 1: build ---
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
# normalize line endings (gradlew may be checked out with CRLF on Windows)
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew

# Warm the Gradle home in a cache mount: the wrapper downloads ~130 MB of
# distribution plus every dependency, and without this it does it again on
# every single build (and it is the step that breaks first on a slow link).
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon dependencies --configuration runtimeClasspath > /dev/null || true

COPY src ./src
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew bootJar --no-daemon -x test

# --- Stage 2: runtime ---
FROM eclipse-temurin:25-jdk AS runtime
WORKDIR /app
ENV SERVER_PORT=8080

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
