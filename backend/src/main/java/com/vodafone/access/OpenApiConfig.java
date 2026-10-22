package com.vodafone.access;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(info = @Info(title = "AccessHub API", version = "1.0", description = "Session-authenticated access request workflow. Login: POST /api/auth/login with URL-encoded username and password. Get /api/auth/csrf before login and again after login; send the returned token in X-XSRF-TOKEN for every mutation. Logout: POST /api/auth/logout. See README.md for examples."), security = @SecurityRequirement(name = "session"))
@SecurityScheme(name = "session", type = SecuritySchemeType.APIKEY, in = SecuritySchemeIn.COOKIE, paramName = "JSESSIONID")
public class OpenApiConfig {}
