package com.vodafone.access;

import java.util.UUID;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("dev")
public class DevData implements CommandLineRunner {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    public DevData(JdbcTemplate jdbc, PasswordEncoder encoder) { this.jdbc = jdbc; this.encoder = encoder; }
    @Override @Transactional
    public void run(String... args) {
        String password = System.getenv().getOrDefault("DEMO_PASSWORD", "AccessDemo123!");
        addUser(2, "manager", "Omar Hassan", "MANAGER", password);
        addUser(3, "owner", "Nour Ahmed", "APPLICATION_OWNER", password);
        addUser(4, "security", "Youssef Ali", "SECURITY", password);
        addUser(1, "employee", "Salma Mostafa", "EMPLOYEE", password);
        jdbc.update("UPDATE portal_users SET manager_id = ? WHERE id = ? AND manager_id IS NULL", id(2), id(1));
        addApp(101, "Salesforce", "Customer relationships, sales opportunities, and account management.", "Sales & CRM");
        addApp(102, "SAP SuccessFactors", "People operations, employee records, and HR services.", "People & HR");
        addApp(103, "Jira", "Plan projects, track work, and collaborate with your delivery team.", "Productivity");
        addApp(104, "Power BI", "Business dashboards, reporting, and data insights.", "Data & Analytics");
    }
    private void addUser(int id, String email, String name, String role, String password) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM portal_users WHERE id = ?", Integer.class, id(id)) == 0)
            jdbc.update("INSERT INTO portal_users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)", id(id), email + "@example.com", name, role, encoder.encode(password));
    }
    private void addApp(int id, String name, String description, String category) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM applications WHERE id = ?", Integer.class, id(id)) == 0)
            jdbc.update("INSERT INTO applications (id, name, description, category, owner_id, security_id) VALUES (?, ?, ?, ?, ?, ?)", id(id), name, description, category, id(3), id(4));
    }
    private UUID id(int number) { return UUID.fromString("00000000-0000-0000-0000-%012d".formatted(number)); }
}
