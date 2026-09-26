import { useState } from "react";
import "./App.css";
import CampusMap from "./components/CampusMap";
import RideHistory from "./components/RideHistory";
import AdminDashboard from "./components/AdminDashboard";
import RiderDashboard from "./components/RiderDashboard";

// ------------------------------------
// Campus landmarks
// ------------------------------------

const campusLocations = [
  {
    name: "Main Gate",
    lat: 12.02223,
    lng: 79.84769,
  },
  {
    name: "University Library",
    lat: 12.01590,
    lng: 79.85820,
  },
  {
    name: "Administrative Block",
    lat: 12.02050,
    lng: 79.85350,
  },
  {
    name: "Hostel Area",
    lat: 12.01850,
    lng: 79.85550,
  },
  {
    name: "Academic Block",
    lat: 12.02150,
    lng: 79.85450,
  },
  {
    name: "Sports Complex",
    lat: 12.02400,
    lng: 79.85500,
  },
];

function App() {
  const [page, setPage] = useState("login");
  const [showRideHistory, setShowRideHistory] = useState(false);
    // Campus ride location selection
  const [pickupLocation, setPickupLocation] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");

  const [rideMessage, setRideMessage] = useState("");
  const [rideLoading, setRideLoading] = useState(false);

  // Login form
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Registration form
  const [registerData, setRegisterData] = useState({
    fullName: "",
    studentId: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");

  // Handle login input
  const handleLoginChange = (event) => {
    const { name, value } = event.target;

    setLoginData({
      ...loginData,
      [name]: value,
    });
  };

  // Handle registration input
  const handleRegisterChange = (event) => {
    const { name, value } = event.target;

    setRegisterData({
      ...registerData,
      [name]: value,
    });
  };

  // Login submit
  const handleLogin = async (event) => {
  event.preventDefault();

  setMessage("");

  // Check required fields
  if (!loginData.email || !loginData.password) {
    setMessage("Please enter your email and password.");
    return;
  }

  try {
    const response = await fetch(
      "http://localhost:5001/api/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginData.email,
          password: loginData.password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Login failed.");
      return;
    }

    // Save logged-in user
    localStorage.setItem(
     "campusrideUser",
      JSON.stringify(data.user)
      );

     if (data.user.role === "ADMIN") {
       setPage("admin");
      } else if (data.user.role === "RIDER") {
        setPage("rider");
      } else {
       setPage("dashboard");
      }

  } catch (error) {
    console.error("Login error:", error);
    setMessage(
      "Unable to connect to CampusRide server."
    );
  }
};

  // Registration submit
  const handleRegister = async (event) => {
  event.preventDefault();

  setMessage("");

  // Check required fields
  if (
    !registerData.fullName ||
    !registerData.studentId ||
    !registerData.email ||
    !registerData.phone ||
    !registerData.password ||
    !registerData.confirmPassword
  ) {
    setMessage("Please fill in all the fields.");
    return;
  }

  // Check phone number
  const phoneRegex = /^[0-9]{10}$/;

  if (!phoneRegex.test(registerData.phone)) {
    setMessage("Please enter a valid 10-digit mobile number.");
    return;
  }

  // Check password length
  if (registerData.password.length < 8) {
    setMessage("Password must contain at least 8 characters.");
    return;
  }

  // Check password match
  if (registerData.password !== registerData.confirmPassword) {
    setMessage("Passwords do not match.");
    return;
  }

  try {
    const response = await fetch(
      "http://localhost:5001/api/auth/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: registerData.fullName,
          studentId: registerData.studentId,
          email: registerData.email,
          phone: registerData.phone,
          password: registerData.password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Registration failed.");
      return;
    }

    setMessage("Registration successful! 🎉");

    // Clear registration form
    setRegisterData({
      fullName: "",
      studentId: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    });

  } catch (error) {
    console.error("Registration error:", error);
    setMessage(
      "Unable to connect to the server. Please try again."
    );
  }
};

// ADMIN DASHBOARD
if (page === "admin") {
    return <AdminDashboard />;
}

// RIDER DASHBOARD
if (page === "rider") {
    return <RiderDashboard />;
}

  // STUDENT DASHBOARD
if (page === "dashboard") {
  const user = JSON.parse(
    localStorage.getItem("campusrideUser")
  );

  const calculateDistance = (point1, point2) => {
  const R = 6371;

  const lat1 = (point1.lat * Math.PI) / 180;
  const lat2 = (point2.lat * Math.PI) / 180;

  const deltaLat =
    ((point2.lat - point1.lat) * Math.PI) / 180;

  const deltaLng =
    ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
};

const handleFindRide = async () => {
  setRideMessage("");

  if (!pickupLocation || !destinationLocation) {
    setRideMessage("Please select pickup and destination.");
    return;
  }

  if (pickupLocation === destinationLocation) {
    setRideMessage(
      "Pickup and destination cannot be the same."
    );
    return;
  }

  const pickup = campusLocations.find(
    (location) => location.name === pickupLocation
  );

  const destination = campusLocations.find(
    (location) => location.name === destinationLocation
  );

  if (!pickup || !destination) {
    setRideMessage(
      "Unable to find selected campus locations."
    );
    return;
  }

  const user = JSON.parse(
    localStorage.getItem("campusrideUser")
  );

  if (!user) {
    setRideMessage("Please login first.");
    return;
  }

  const distance = calculateDistance(
    pickup,
    destination
  );

  // Temporary development fare
  const baseFare = 20;
  const perKm = 10;
  const fare = Math.ceil(
    baseFare + distance * perKm
  );

  try {
    setRideLoading(true);

    const response = await fetch(
      "http://localhost:5001/api/rides",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,

          pickupName: pickup.name,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,

          destinationName: destination.name,
          destinationLat: destination.lat,
          destinationLng: destination.lng,

          distance: Number(distance.toFixed(2)),
          fare: fare,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setRideMessage(
        data.message || "Unable to request ride."
      );
      return;
    }

    setRideMessage(
      `✅ Ride #${data.ride.id} requested successfully!`
    );

    console.log("Ride created:", data.ride);

  } catch (error) {
    console.error("Find ride error:", error);

    setRideMessage(
      "Unable to connect to CampusRide server."
    );

  } finally {
    setRideLoading(false);
  }
};

  return (
    <div className="dashboard">

      {/* Header */}
      <header className="dashboard-header">

        <div className="brand">
          <div className="dashboard-logo">🏍️</div>

          <div>
            <h1>CampusRide</h1>
            <p>Your campus. Your ride. Your way.</p>
          </div>
        </div>

        <button
          className="logout-button"
          onClick={() => {
            localStorage.removeItem("campusrideUser");
            setPage("login");
            setMessage("");
          }}
        >
          Logout
        </button>

      </header>


      {/* Main Content */}
      <main className="dashboard-content">

        <section className="welcome-section">

          <h2>
            Hello, {user?.full_name || "Student"} 👋
          </h2>

          <p>
            Where would you like to go today?
          </p>

        </section>


        {/* Booking Card */}
        <section className="booking-card">

          <h3>Book a Campus Ride 🏍️</h3>

          <div className="location-input">

  <label>📍 Pickup Location</label>

  <select
    value={pickupLocation}
    onChange={(event) => setPickupLocation(event.target.value)}
  >
    <option value="">
      Select pickup location
    </option>

    {campusLocations.map((location) => (
      <option
        key={location.name}
        value={location.name}
      >
        {location.name}
      </option>
    ))}
  </select>

</div>


         <div className="location-input">

  <label>📍 Destination</label>

  <select
    value={destinationLocation}
    onChange={(event) =>
      setDestinationLocation(event.target.value)
    }
  >
    <option value="">
      Select destination
    </option>

    {campusLocations.map((location) => (
      <option
        key={location.name}
        value={location.name}
      >
        {location.name}
      </option>
    ))}
  </select>

</div>


         <button
  className="find-ride-button"
  onClick={handleFindRide}
  disabled={rideLoading}
>
  {rideLoading ? "Finding a Ride..." : "Find a Ride"}
</button>

{rideMessage && (
  <p className="ride-message">
    {rideMessage}
  </p>
)}

          <CampusMap
  selectedPickup={
    campusLocations.find(
      (location) => location.name === pickupLocation
    ) || null
  }
  selectedDestination={
    campusLocations.find(
      (location) => location.name === destinationLocation
    ) || null
  }
/>

          {showRideHistory && <RideHistory />}

        </section>


        {/* Quick Actions */}
        <section className="quick-actions">

          <div
               className="action-card"
               onClick={() => setShowRideHistory(!showRideHistory)}
               style={{ cursor: "pointer" }}
          >
         <div className="action-icon">📋</div>
         <h3>My Rides</h3>
         <p>View your ride history</p>
         </div>

          <div className="action-card">
            <div className="action-icon">👤</div>
            <h3>My Profile</h3>
            <p>Manage your account</p>
          </div>

          <div className="action-card">
            <div className="action-icon">❓</div>
            <h3>Help</h3>
            <p>Get assistance</p>
          </div>

        </section>

      </main>

    </div>
  );
}
  // LOGIN PAGE
  if (page === "login") {
    return (
      <div className="app">
        <div className="login-card">

          <div className="logo">
            🏍️
          </div>

          <h1>CampusRide</h1>

          <p className="tagline">
            Your campus. Your ride. Your way.
          </p>

          <div className="welcome">
            <h2>Welcome Back 👋</h2>
            <p>Login to book a campus ride</p>
          </div>

          <form onSubmit={handleLogin}>

            <label>University Email</label>

            <input
              type="email"
              name="email"
              value={loginData.email}
              onChange={handleLoginChange}
              placeholder="Enter your university email"
            />

            <label>Password</label>

            <input
              type="password"
              name="password"
              value={loginData.password}
              onChange={handleLoginChange}
              placeholder="Enter your password"
            />

            <button type="submit">
              Login
            </button>

          </form>

          {message && (
            <p className="message">
              {message}
            </p>
          )}

          <p className="signup">
            New to CampusRide?{" "}
            <span onClick={() => {
              setPage("register");
              setMessage("");
            }}>
              Create an account
            </span>
          </p>

        </div>
      </div>
    );
  }

  // REGISTRATION PAGE
  return (
    <div className="app">

      <div className="login-card registration-card">

        <div className="logo">
          🏍️
        </div>

        <h1>Create Account</h1>

        <p className="tagline">
          Join the CampusRide community
        </p>

        <div className="welcome">
          <h2>Student Registration 🎓</h2>
          <p>Create your account to book rides.</p>
        </div>

        <form onSubmit={handleRegister}>

          {/* Full Name */}
          <label>Full Name</label>

          <input
            type="text"
            name="fullName"
            value={registerData.fullName}
            onChange={handleRegisterChange}
            placeholder="Enter your full name"
          />

          {/* Student ID */}
          <label>Student ID</label>

          <input
            type="text"
            name="studentId"
            value={registerData.studentId}
            onChange={handleRegisterChange}
            placeholder="Enter your university ID"
          />

          {/* Email */}
          <label>University Email</label>

          <input
            type="email"
            name="email"
            value={registerData.email}
            onChange={handleRegisterChange}
            placeholder="Enter your university email"
          />

          {/* Phone */}
          <label>Mobile Number</label>

          <input
            type="tel"
            name="phone"
            value={registerData.phone}
            onChange={handleRegisterChange}
            placeholder="Enter 10-digit mobile number"
            maxLength="10"
          />

          {/* Password */}
          <label>Password</label>

          <input
            type="password"
            name="password"
            value={registerData.password}
            onChange={handleRegisterChange}
            placeholder="Minimum 8 characters"
          />

          {/* Confirm Password */}
          <label>Confirm Password</label>

          <input
            type="password"
            name="confirmPassword"
            value={registerData.confirmPassword}
            onChange={handleRegisterChange}
            placeholder="Re-enter your password"
          />

          <button type="submit">
            Create Account
          </button>

        </form>

        {message && (
          <p className="message">
            {message}
          </p>
        )}

        <p className="signup">
          Already have an account?{" "}
          <span
            onClick={() => {
              setPage("login");
              setMessage("");
            }}
          >
            Login
          </span>
        </p>

      </div>

    </div>
  );
}

export default App;