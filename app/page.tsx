export default function Home() {
  return (
    <div style={{ fontFamily: "Arial", padding: 40 }}>
      
      <h1 style={{ fontSize: 34, fontWeight: "bold" }}>
        School Management System
      </h1>

      <p style={{ marginTop: 10 }}>
        Welcome Admin (DOS) and Teachers
      </p>

      {/* LOGIN AREA */}
      <div style={{ marginTop: 30 }}>
        <h2>Login Area</h2>

        <button style={{ padding: 10, margin: 10 }}>
          Admin / DOS Login
        </button>

        <button style={{ padding: 10, margin: 10 }}>
          Teacher Login
        </button>
      </div>

      {/* FEATURES */}
      <div style={{ marginTop: 40 }}>
        <h2>System Features</h2>

        <ul>
          <li>Teacher accounts</li>
          <li>Student registration</li>
          <li>Lessons per teacher</li>
          <li>Marks entry per lesson</li>
          <li>Automatic report cards</li>
          <li>Marks analysis</li>
        </ul>
      </div>

    </div>
  );
}