import java.sql.*;

public class DbCheck {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:postgresql://localhost:5432/psfdb";
        String user = "psfuser";
        String pass = "psfpass123";
        
        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            System.out.println("--- USERS ---");
            ResultSet rs = conn.createStatement().executeQuery("SELECT id, username, role, team_name FROM users;");
            while(rs.next()) {
                System.out.println(rs.getString("username") + " | " + rs.getString("role") + " | " + rs.getString("id"));
            }
            
            System.out.println("--- GUIDE_LOCATIONS ---");
            rs = conn.createStatement().executeQuery("SELECT * FROM guide_locations;");
            ResultSetMetaData meta = rs.getMetaData();
            int cols = meta.getColumnCount();
            while(rs.next()) {
                for(int i=1; i<=cols; i++) {
                    System.out.print(meta.getColumnName(i) + ":" + rs.getObject(i) + "  ");
                }
                System.out.println();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
