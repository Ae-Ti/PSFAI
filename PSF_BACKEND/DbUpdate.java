import java.sql.*;

public class DbUpdate {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:postgresql://localhost:5432/psfdb";
        String user = "psfuser";
        String pass = "psfpass123";
        
        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            System.out.println("Updating team_name: 본부 -> 사무국");
            int updated = conn.createStatement().executeUpdate(
                "UPDATE users SET team_name = '사무국' WHERE team_name = '본부';"
            );
            System.out.println("Updated " + updated + " users.");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
