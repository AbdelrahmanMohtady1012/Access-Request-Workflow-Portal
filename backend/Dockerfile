FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S portal && adduser -S portal -G portal
COPY --from=build /app/target/access-portal-1.0.0.jar app.jar
USER portal
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
