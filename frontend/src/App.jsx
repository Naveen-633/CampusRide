import { useState, useEffect } from "react";
import "./App.css";
import CampusMap from "./components/CampusMap";
import RideHistory from "./components/RideHistory";
import AdminDashboard from "./components/AdminDashboard";
import RiderDashboard from "./components/RiderDashboard";
import SearchableLocation from "./components/SearchableLocation";
// ------------------------------------
// Campus landmarks
// ------------------------------------


// ------------------------------------
// 4Mi rides Fare Table
// Pricing can be edited here later
// ------------------------------------

const girlsHostelRoutes = [
  {
    destination: "SJ",
    onePerson: 27,
    twoPersons: 37,
  },
  {
    destination: "SOM",
    onePerson: 23,
    twoPersons: 33,
  },
  {
    destination: "PONLAIT",
    onePerson: 23,
    twoPersons: 33,
  },
  {
    destination: "SCIENCE BLOCK",
    onePerson: 23,
    twoPersons: 33,
  },
  {
    destination: "BOYS HOSTELS",
    onePerson: 23,
    twoPersons: 23,
  },
  {
    destination: "GATE - I",
    onePerson: 25,
    twoPersons: 35,
  },
  {
    destination: "GATE - II",
    onePerson: 25,
    twoPersons: 35,
  },
];

const boysHostelRoutes = [
  {
    destination: "GATE - I",
    onePerson: 27,
    twoPersons: 37,
  },
  {
    destination: "GATE - II",
    onePerson: 27,
    twoPersons: 37,
  },
  {
    destination: "SJ",
    onePerson: 23,
    twoPersons: 33,
  },
  {
    destination: "SOM",
    onePerson: 23,
    twoPersons: 33,
  },
  {
    destination: "PONLAIT",
    onePerson: 25,
    twoPersons: 35,
  },
  {
    destination: "SCIENCE BLOCK",
    onePerson: 25,
    twoPersons: 35,
  },
  {
    destination: "GIRLS HOSTELS",
    onePerson: 23,
    twoPersons: 33,
  },
];

const universityRoutes = [
  {
    destination: "PONDY BUS STAND",
    onePerson: 170,
    twoPersons: 220,
  },
  {
    destination: "RAILWAY STATION",
    onePerson: 170,
    twoPersons: 220,
  },
  {
    destination: "JIPMER",
    onePerson: 170,
    twoPersons: 220,
  },
  {
    destination: "PIMS",
    onePerson: 75,
    twoPersons: 95,
  },
  {
    destination: "MUTHIALPET",
    onePerson: 95,
    twoPersons: 115,
  },
  {
    destination: "PILLAICHAVADI",
    onePerson: 40,
    twoPersons: 50,
  },
  {
    destination: "AUROVILLE",
    onePerson: 120,
    twoPersons: 150,
  },
  {
    destination: "CHINNA KALAPET",
    onePerson: 30,
    twoPersons: 40,
  },
  {
    destination: "PERIYA KALAPET",
    onePerson: 55,
    twoPersons: 65,
  },
];

function App() {


const [campusLocations, setCampusLocations] = useState([]);
const [locationsLoading, setLocationsLoading] = useState(true);
const [locationsError, setLocationsError] = useState("");

useEffect(() => {
  const fetchCampusLocations = async () => {
    try {
      setLocationsLoading(true);
      setLocationsError("");

      const response = await fetch(
        "http://localhost:5001/api/locations"
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load campus locations."
        );
      }

      const mappedLocations = (data.locations || []).map(
        (location) => ({
          ...location,
          id: Number(location.id),
          lat: Number(location.latitude),
          lng: Number(location.longitude),
        })
      );

      setCampusLocations(mappedLocations);
    } catch (error) {
      console.error("Campus locations error:", error);
      setLocationsError(error.message);
    } finally {
      setLocationsLoading(false);
    }
  };

  fetchCampusLocations();
}, []);


useEffect(() => {
  const fetchStudentFareChart = async () => {
    setFareChartLoading(true);
    setFareChartError("");

    try {
      const response = await fetch(
        "http://localhost:5001/api/admin/fare-routes"
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load fare chart.");
      }

      setFareChartRoutes(
        (data.fare_routes || []).filter(
          (route) => route.is_active === true ||
                     route.is_active === "true"
        )
      );
    } catch (error) {
      console.error("Student fare chart error:", error);
      setFareChartError(
        error.message || "Unable to load the fare chart."
      );
    } finally {
      setFareChartLoading(false);
    }
  };

  fetchStudentFareChart();
}, []);


const [availableRiderCount, setAvailableRiderCount] = useState(null);
const [availableRiders, setAvailableRiders] = useState(0);

useEffect(() => {
  let stopped = false;
  let timer;

  const fetchAvailableRiders = async () => {
    try {
      const response = await fetch(
        "http://localhost:5001/api/riders/available-count",
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch rider count");
      }

      const data = await response.json();

      if (!stopped) {
        setAvailableRiderCount(data.availableCount);
      }
    } catch (error) {
      console.error("Available riders fetch error:", error);
    } finally {
      if (!stopped) {
        timer = setTimeout(fetchAvailableRiders, 10000);
      }
    }
  };

  fetchAvailableRiders();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}, []);



const [page, setPage] = useState(() => {
  try {
    const savedUser = JSON.parse(
      localStorage.getItem("campusrideUser")
    );

    if (!savedUser) return "dashboard";
    if (savedUser.role === "ADMIN") return "admin";
    if (savedUser.role === "RIDER") return "rider";

    return "dashboard";
  } catch {
    return "dashboard";
  }
});  // Forgot password form
  const [forgotData, setForgotData] = useState({
  phone: "",
  securityAnswer: "",
  newPassword: "",
  confirmPassword: "",
  });

  const [securityQuestion, setSecurityQuestion] = useState("");
  const [forgotStep, setForgotStep] = useState(1);
 const [activeSection, setActiveSection] = useState(null);
const [showFareChart, setShowFareChart] = useState(false);

const [fareChartRoutes, setFareChartRoutes] = useState([]);
const [fareChartLoading, setFareChartLoading] = useState(false);
const [fareChartError, setFareChartError] = useState("");
    // 4Mi ride location selection
  const [pickupLocation, setPickupLocation] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");

  const [rideMessage, setRideMessage] = useState("");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [rideLoading, setRideLoading] = useState(false);


const [feedbackType, setFeedbackType] = useState("Suggestion");
const [feedbackMessage, setFeedbackMessage] = useState("");
const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
const [feedbackNotice, setFeedbackNotice] = useState("");
const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Login form
  const [loginData, setLoginData] = useState({
  identifier: "",
  password: "",
});

  // Registration form
 const [registerData, setRegisterData] = useState({
  fullName: "",
  phone: "",
  password: "",
  confirmPassword: "",
  securityQuestion: "",
  securityAnswer: "",
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

  // Handle forgot password input
  const handleForgotChange = (event) => {
  const { name, value } = event.target;

  setForgotData({
    ...forgotData,
    [name]: value,
    });
  };

  const handleForgotPassword = async (event) => {
  event.preventDefault();

  setMessage("");

  if (!forgotData.phone) {
    setMessage("Please enter your mobile number.");
    return;
  }

  const phoneRegex = /^[0-9]{10}$/;

  if (!phoneRegex.test(forgotData.phone)) {
    setMessage("Please enter a valid 10-digit mobile number.");
    return;
  }

  try {
    const response = await fetch(
      "http://localhost:5001/api/auth/forgot-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: forgotData.phone,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Unable to find account.");
      return;
    }

    setSecurityQuestion(data.securityQuestion);
    setForgotStep(2);
    setMessage("");

  } catch (error) {
    console.error("Forgot password error:", error);

    setMessage(
      "Unable to connect to 4Mi Rides server."
    );
  }
};

const handleResetPassword = async (event) => {
  event.preventDefault();

  setMessage("");

  if (
    !forgotData.securityAnswer ||
    !forgotData.newPassword ||
    !forgotData.confirmPassword
  ) {
    setMessage("Please fill in all the fields.");
    return;
  }

  if (forgotData.newPassword.length < 8) {
    setMessage(
      "New password must contain at least 8 characters."
    );
    return;
  }

  if (
    forgotData.newPassword !==
    forgotData.confirmPassword
  ) {
    setMessage("Passwords do not match.");
    return;
  }

  try {
    const response = await fetch(
      "http://localhost:5001/api/auth/reset-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: forgotData.phone,
          securityAnswer: forgotData.securityAnswer,
          newPassword: forgotData.newPassword,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(
        data.message || "Password reset failed."
      );
      return;
    }

    setMessage(
      "Password reset successfully! 🎉"
    );

    setForgotData({
      phone: "",
      securityAnswer: "",
      newPassword: "",
      confirmPassword: "",
    });

    setSecurityQuestion("");
    setForgotStep(1);

    setTimeout(() => {
      setPage("login");
      setMessage("");
    }, 1500);

  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    setMessage(
      "Unable to connect to 4Mi Rides server."
    );
  }
};

  // Login submit
  const handleLogin = async (event) => {
  event.preventDefault();

  setMessage("");

  if (!loginData.identifier || !loginData.password) {
    setMessage("Please enter your mobile number and password.");
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
          identifier: loginData.identifier,
          password: loginData.password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Login failed.");
      return;
    }

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
      "Unable to connect to 4Mi Rides server."
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
    !registerData.phone ||
    !registerData.password ||
    !registerData.confirmPassword ||
    !registerData.securityQuestion ||
    !registerData.securityAnswer
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
  phone: registerData.phone,
  password: registerData.password,
  securityQuestion: registerData.securityQuestion,
  securityAnswer: registerData.securityAnswer,
}),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Registration failed.");
      return;
    }

    setMessage("Registration successful! 🎉");

    setRegisterData({
      fullName: "",
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


const handleFeedbackSubmit = async (event) => {
  event.preventDefault();
  setFeedbackNotice("");

  const message = feedbackMessage.trim();

  if (message.length < 5 || message.length > 2000) {
    setFeedbackNotice(
      "Please enter a message between 5 and 2000 characters."
    );
    return;
  }

  if (!user?.id) {
    setFeedbackNotice("Please log in again before submitting.");
    return;
  }

  try {
    setFeedbackSubmitting(true);

    const response = await fetch(
      "http://localhost:5001/api/feedback",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          feedbackType,
          message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setFeedbackNotice(
        data.message || "Unable to submit feedback."
      );
      return;
    }

    setFeedbackMessage("");
    setFeedbackType("Suggestion");
    setFeedbackNotice(
      "Thank you! Your feedback has been submitted. ❤️"
    );
    setShowFeedbackModal(false);

  } catch (error) {
    console.error("Feedback submission error:", error);
    setFeedbackNotice(
      "Unable to connect to the server. Please try again."
    );
  } finally {
    setFeedbackSubmitting(false);
  }
};


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
  setShowAuthPrompt(true);
  return;
}

  const distance = calculateDistance(
    pickup,
    destination
  );

  // Temporary development fare
  const baseFare = 0;
  const perKm = 0;
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
      "Unable to connect to 4Mi Rides server."
    );

  } finally {
    setRideLoading(false);
  }
};


const studentFareChart = Object.values(
  fareChartRoutes.reduce((groups, route) => {
    const key =
      `${route.pickup_location_id}-${route.destination_location_id}`;

    if (!groups[key]) {
      groups[key] = {
        pickup_location_id: route.pickup_location_id,
        destination_location_id: route.destination_location_id,
        pickup: route.pickup_name,
        destination: route.destination_name,
        onePerson: null,
        twoPersons: null,
      };
    }

    if (Number(route.passenger_count) === 1) {
      groups[key].onePerson = route.fare;
    } else if (Number(route.passenger_count) === 2) {
      groups[key].twoPersons = route.fare;
    }

    return groups;
  }, {})
);


  return (
    <div className="dashboard">

      {/* Header */}
      <header className="dashboard-header">

        <div className="brand">
          <div className="dashboard-logo">🏍️</div>

          <div>
            <h1>4Mi  Rides</h1>
            <p>Your ride. Your way.</p>
          </div>
        </div>
{user ? (
  <button
    className="logout-button"
    onClick={() => {
      localStorage.removeItem("campusrideUser");
      setPage("dashboard");
      setMessage("");
      setRideMessage("");
    }}
  >
    Logout
  </button>
) : (
  <button
    className="logout-button"
    onClick={() => {
      setPage("login");
      setMessage("");
    }}
  >
    Login / Register
  </button>
)}

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


{/* 4Mi FLOATING FEEDBACK BUTTON */}
<button
  type="button"
  className="floating-feedback-button"
  onClick={() => {
    setFeedbackNotice("");
    setShowFeedbackModal(true);
  }}
  aria-label="Open feedback and suggestions"
  title="Feedback & Suggestions"
>
  <span className="feedback-float-icon">💬</span>
  <span className="feedback-float-label">Feedback</span>
</button>

{/* 4Mi FEEDBACK POPUP */}
{showFeedbackModal && (
  <div
    className="feedback-modal-overlay"
    onClick={() => setShowFeedbackModal(false)}
  >
    <section
      className="feedback-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="feedback-modal-header">
        <div>
          <h3 id="feedback-modal-title">💬 Share Your Thoughts</h3>
          <p>Help us make 4Mi Rides better!</p>
        </div>

        <button
          type="button"
          className="feedback-modal-close"
          onClick={() => setShowFeedbackModal(false)}
          aria-label="Close feedback popup"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleFeedbackSubmit}>
        <label htmlFor="feedbackType">
          What would you like to share?
        </label>

        <select
          id="feedbackType"
          value={feedbackType}
          onChange={(event) => setFeedbackType(event.target.value)}
          disabled={feedbackSubmitting}
        >
          <option value="Feedback">⭐ Feedback</option>
          <option value="Suggestion">💡 Suggestion</option>
          <option value="Complaint">⚠️ Complaint</option>
        </select>

        <label htmlFor="feedbackMessage">Your message</label>

        <textarea
          id="feedbackMessage"
          value={feedbackMessage}
          onChange={(event) => setFeedbackMessage(event.target.value)}
          placeholder="Write your message here..."
          rows={4}
          minLength={5}
          maxLength={2000}
          required
          disabled={feedbackSubmitting}
        />

        {feedbackNotice && (
          <p
            className="feedback-notice"
            role="status"
          >
            {feedbackNotice}
          </p>
        )}

        <button
          type="submit"
          className="feedback-submit-button"
          disabled={feedbackSubmitting}
        >
          {feedbackSubmitting ? "Submitting..." : "Send Message ❤️"}
        </button>
      </form>
    </section>
  </div>
)}



{/* 4Mi Fare Information */}

<section className="fare-section">

  <div className="fare-header">

    <div>
      <h3 className="fare-title">
        💰 4Mi Rides Fare Chart
      </h3>

      <p className="fare-subtitle">
        Check the fare before booking your ride
      </p>
    </div>

    <button
      className="fare-toggle-button"
      onClick={() => setShowFareChart(!showFareChart)}
    >
      {showFareChart
        ? "▲ Hide Fare Chart"
        : "👀 View Fare Chart"}
    </button>

  </div>


 
{showFareChart && (
  <div className="fare-chart-content">

    {fareChartLoading ? (
      <p>Loading current fares...</p>
    ) : fareChartError ? (
      <p role="alert">{fareChartError}</p>
    ) : studentFareChart.length === 0 ? (
      <p>No active fare routes are configured yet.</p>
    ) : (
      Object.entries(
        studentFareChart.reduce((groups, route) => {
          /*
           * Find the pickup location from the locations
           * already loaded from /api/locations.
           */
          const pickupLocation = campusLocations.find(
            (location) =>
              Number(location.id) ===
              Number(route.pickup_location_id)
          );

          /*
           * Use the pickup location's category.
           * If a category is unavailable, put the route
           * into "Other Routes".
           */
          const categoryName =
            pickupLocation?.category_name ||
            pickupLocation?.category ||
            "Other Routes";

          if (!groups[categoryName]) {
            groups[categoryName] = [];
          }

          groups[categoryName].push(route);

          return groups;
        }, {})
      ).map(([categoryName, routes]) => (
        <div
          className="fare-table-card"
          key={categoryName}
        >

          {/* Category Heading */}
          <h4>
            📍 {categoryName}
          </h4>

          <div className="fare-table-wrapper">

            <table className="fare-table">

              <thead>
                <tr>
                  <th>Pickup</th>
                  <th>Destination</th>
                  <th>1 Person</th>
                  <th>2 Persons</th>
                </tr>
              </thead>

              <tbody>

                {routes.map((route) => (
                  <tr
                    key={`${route.pickup_location_id}-${route.destination_location_id}`}
                  >

                    <td>
                      {route.pickup}
                    </td>

                    <td>
                      {route.destination}
                    </td>

                    <td>
                      {route.onePerson !== null &&
                      route.onePerson !== undefined
                        ? `₹${Number(
                            route.onePerson
                          ).toFixed(2)}`
                        : "Not set"}
                    </td>

                    <td>
                      {route.twoPersons !== null &&
                      route.twoPersons !== undefined
                        ? `₹${Number(
                            route.twoPersons
                          ).toFixed(2)}`
                        : "Not set"}
                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>

        </div>
      ))
    )}

  </div>
)}


</section>


        {/* Booking Card */}
        <section className="booking-card">


<div className="available-riders-card">
  <div className="available-riders-heading">
    <span className="available-riders-dot"></span>
    <strong>Available Riders</strong>
  </div>

  <strong className="available-riders-count">
    {availableRiderCount === null
      ? "Checking riders..."
      : `${availableRiderCount}  online`}
  </strong>

 <p>
  {availableRiderCount === null
    ? "Checking rider availability..."
    : availableRiderCount === 0
    ? "Currently, no rider is available"
    : "Ready to accept a new ride"}
</p>
</div>




          <h3>Book a Ride 🏍️</h3>

         
<div className="location-input">
  <SearchableLocation
    locations={campusLocations}
    value={pickupLocation}
    onChange={setPickupLocation}
    label="📍 Pickup Location"
    placeholder="Search pickup location..."
  />
</div>

<div className="location-input">
  <SearchableLocation
    locations={campusLocations}
    value={destinationLocation}
    onChange={setDestinationLocation}
    label="📍 Destination"
    placeholder="Search destination..."
  />
</div>


        
{rideMessage && (
  <p className="ride-message">
    {rideMessage}
  </p>
)}

{showAuthPrompt && (
  <div className="auth-prompt">
    <h3>Login to book your ride</h3>

    <p>
      Explore 4Mi Rides freely. To request a ride,
      please log in to your account or create a new one.
    </p>

    <div className="auth-prompt-actions">
      <button
        onClick={() => {
          setShowAuthPrompt(false);
          setPage("login");
          setMessage("");
        }}
      >
        Login
      </button>

      <button
        onClick={() => {
          setShowAuthPrompt(false);
          setPage("register");
          setMessage("");
        }}
      >
        Create Account
      </button>

      <button
        onClick={() => setShowAuthPrompt(false)}
      >
        Continue Exploring
      </button>
    </div>
  </div>
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

          

        </section>


        {/* Quick Actions */}
<section className="quick-actions">

  <div
    className={`action-card ${activeSection === "rides" ? "active" : ""}`}
    onClick={() =>
      setActiveSection(activeSection === "rides" ? null : "rides")
    }
  >
    <div className="action-icon">📋</div>
    <h3>My Rides</h3>
    <p>View your ride history</p>
  </div>

  <div
    className={`action-card ${activeSection === "profile" ? "active" : ""}`}
    onClick={() =>
      setActiveSection(activeSection === "profile" ? null : "profile")
    }
  >
    <div className="action-icon">👤</div>
    <h3>My Profile</h3>
    <p>Manage your account</p>
  </div>

  <div
    className={`action-card ${activeSection === "help" ? "active" : ""}`}
    onClick={() =>
      setActiveSection(activeSection === "help" ? null : "help")
    }
  >
    <div className="action-icon">❓</div>
    <h3>Help</h3>
    <p>Get assistance</p>
  </div>

</section>


{/* MY RIDES */}
{activeSection === "rides" && (
  <section className="dashboard-panel">

    <div className="panel-heading">
      <h2>📋 My Rides</h2>

      <button onClick={() => setActiveSection(null)}>
        ✕ Close
      </button>
    </div>

    <RideHistory />

  </section>
)}

{/* MY PROFILE */}
{activeSection === "profile" && (
  <section className="dashboard-panel">

    <div className="panel-heading">
      <h2>👤 My Profile</h2>

      <button onClick={() => setActiveSection(null)}>
        ✕ Close
      </button>
    </div>

    <div className="profile-details">

      <p>
        <strong>Full Name:</strong> {user?.full_name || "—"}
      </p>

      <p>
        <strong>Mobile:</strong> {user?.mobile || "—"}
      </p>

      <p>
        <strong>Email:</strong> {user?.email || "Not provided"}
      </p>

    

    </div>

  </section>
)}

{/* HELP */}
{activeSection === "help" && (
  <section className="dashboard-panel">

    <div className="panel-heading">
      <h2>❓ Help & Support</h2>

      <button onClick={() => setActiveSection(null)}>
        ✕ Close
      </button>
    </div>

    <div className="help-content">

      <details>
        <summary>How do I book a ride?</summary>
        <p>
          Select your pickup and destination locations,
          then click Find a Ride and Request Ride.
        </p>
      </details>

      <details>
        <summary>How can I track my Captain?</summary>
        <p>
          After your captain accepts the booking, you can
          follow their live location on the map.
        </p>
      </details>

      <details>
        <summary>Can I cancel my ride?</summary>
        <p>
          You can cancel a ride while it is REQUESTED
          or DRIVER_ASSIGNED.
        </p>
      </details>

      <details>
        <summary>Where can I see my previous rides?</summary>
        <p>
          Open My Rides to view your ride history.
        </p>
      </details>

    </div>

  </section>
)}

      </main>

    </div>
  );
}

// ------------------------------------
// FORGOT PASSWORD PAGE
// ------------------------------------

if (page === "forgot") {
  return (
    <div className="app">

      <div className="login-card">

        <div className="logo">
          🔐
        </div>

        <h1>Reset Password</h1>

        <p className="tagline">
          Recover your 4Mi Rides account
        </p>

        {forgotStep === 1 ? (

          <form onSubmit={handleForgotPassword}>

            <div className="welcome">
              <h2>Find Your Account</h2>

              <p>
                Enter your registered mobile number.
              </p>
            </div>

            <label>Mobile Number</label>

            <input
              type="tel"
              name="phone"
              value={forgotData.phone}
              onChange={handleForgotChange}
              placeholder="Enter 10-digit mobile number"
              maxLength="10"
            />

            <button type="submit">
              Continue
            </button>

          </form>

        ) : (

          <form onSubmit={handleResetPassword}>

            <div className="welcome">
              <h2>Security Question 🔐</h2>

              <p>
                {securityQuestion}
              </p>
            </div>

            <label>Security Answer</label>

            <input
              type="text"
              name="securityAnswer"
              value={forgotData.securityAnswer}
              onChange={handleForgotChange}
              placeholder="Enter your answer"
            />

            <label>New Password</label>

            <input
              type="password"
              name="newPassword"
              value={forgotData.newPassword}
              onChange={handleForgotChange}
              placeholder="Minimum 8 characters"
            />

            <label>Confirm New Password</label>

            <input
              type="password"
              name="confirmPassword"
              value={forgotData.confirmPassword}
              onChange={handleForgotChange}
              placeholder="Re-enter your new password"
            />

            <button type="submit">
              Reset Password
            </button>

          </form>

        )}

        {message && (
          <p className="message">
            {message}
          </p>
        )}

        <p className="signup">

          <span
            onClick={() => {
              setPage("login");
              setForgotStep(1);
              setSecurityQuestion("");
              setMessage("");

              setForgotData({
                phone: "",
                securityAnswer: "",
                newPassword: "",
                confirmPassword: "",
              });
            }}
          >
            ← Back to Login
          </span>

        </p>

      </div>

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

          <h1>4Mi Rides</h1>

          <p className="tagline">
            Your ride. Your way.
          </p>

          <div className="welcome">
            <h2>Welcome 👋</h2>
            <p>Login to book a ride</p>
          </div>

          <form onSubmit={handleLogin}>

            <label>Mobile Number </label>

<input
  type="text"
  name="identifier"
  value={loginData.identifier}
  onChange={handleLoginChange}
  placeholder="Enter mobile number"
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
            New to 4Mi Rides?{" "}
            <span onClick={() => {
              setPage("register");
              setMessage("");
            }}>
              Create an account
            </span>
          </p>

          <p className="forgot-password">
  <span
    onClick={() => {
      setPage("forgot");
      setMessage("");
    }}
  >
    Forgot Password?
  </span>
</p>


{/* STUDENT TEAM DISCLAIMER */}
<div className="login-disclaimer">
  <div className="disclaimer-heading">
    <span className="disclaimer-icon">🧡</span>
    <h4>A Small Request from Our Team</h4>
  </div>

  <p>
    We’re students just like you, working hard to make your
    campus rides easier while balancing our studies.
  </p>

<p>
  Every ride takes someone’s time, effort, and fuel.
  So, we kindly request you to book only genuine rides
  and avoid{" "}
  <span className="fake-booking-warning">
    fake bookings
  </span>.
</p>

  <p>
    Your understanding and support mean a lot to us.
    Let’s help each other and make 4Mi Rides a better
    experience for everyone.
  </p>

  <div className="disclaimer-thankyou">
    Thank you for supporting a student-built initiative! 🧡
  </div>
</div>


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
          Join the 4Mi community
        </p>

        <div className="welcome">
          <h2>Registration</h2>
          <p>Create your account</p>
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


          <label>Security Question</label>

<select
  name="securityQuestion"
  value={registerData.securityQuestion}
  onChange={handleRegisterChange}
>
  <option value="">
    Select a security question
  </option>

  <option value="What is your favorite food?">
    What is your favorite food?
  </option>

  <option value="What is your childhood nickname?">
    What is your childhood nickname?
  </option>

  <option value="What is the name of your first school?">
    What is the name of your first school?
  </option>

  <option value="What is your favorite place?">
    What is your favorite place?
  </option>
</select>

<label>Security Answer</label>

<input
  type="text"
  name="securityAnswer"
  value={registerData.securityAnswer}
  onChange={handleRegisterChange}
  placeholder="Enter your answer"
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