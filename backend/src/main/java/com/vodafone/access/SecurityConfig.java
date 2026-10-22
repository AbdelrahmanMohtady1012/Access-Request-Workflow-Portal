package com.vodafone.access;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import java.util.Map;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean UserDetailsService users(JdbcTemplate jdbc) {
        return email -> jdbc.query("SELECT * FROM portal_users WHERE email = ? AND enabled = TRUE", (rs, row) ->
            User.withUsername(rs.getString("email")).password(rs.getString("password_hash"))
                .roles(rs.getString("role")).build(), email.toLowerCase(java.util.Locale.ROOT)).stream()
            .findFirst().orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    }

    @Bean SecurityFilterChain security(HttpSecurity http, ObjectMapper json) throws Exception {
        return http
            .csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/csrf", "/api/auth/login", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .anyRequest().authenticated())
            .formLogin(form -> form.loginProcessingUrl("/api/auth/login")
                .successHandler((req, res, authentication) -> { res.setContentType("application/json"); json.writeValue(res.getWriter(), Map.of("authenticated", true)); })
                .failureHandler((req, res, exception) -> { res.setStatus(401); res.setContentType("application/json"); json.writeValue(res.getWriter(), Map.of("message", "Email or password is incorrect.")); }))
            .logout(logout -> logout.logoutUrl("/api/auth/logout").deleteCookies("JSESSIONID", "XSRF-TOKEN")
                .logoutSuccessHandler((req, res, auth) -> res.setStatus(204)))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((req, res, e) -> { res.setStatus(HttpStatus.UNAUTHORIZED.value()); res.setContentType("application/json"); json.writeValue(res.getWriter(), Map.of("message", "Please sign in to continue.")); })
                .accessDeniedHandler((req, res, e) -> { res.setStatus(403); res.setContentType("application/json"); json.writeValue(res.getWriter(), Map.of("message", "Access denied or session security token expired. Refresh and try again.")); }))
            .build();
    }
}
