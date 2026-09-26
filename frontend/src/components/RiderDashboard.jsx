import {useEffect,useState,useRef} from "react";
import "./RiderDashboard.css";
import RiderRideMap from "./RiderRideMap";

function RiderDashboard() {

  const [rider, setRider] = useState(null);
  const [rides, setRides] = useState([]);

  const [loading, setLoading] = useState(true);
  const [ridesLoading, setRidesLoading] = useState(true);

  const [available, setAvailable] = useState(false);
  const [location, setLocation] = useState(null);

  const [notificationEnabled, setNotificationEnabled] =
  useState(false);

const previousAssignedRideIds =
  useRef(new Set());

const isFirstAssignedLoad =
  useRef(true);


  // ------------------------------------
// RIDER NOTIFICATION + SOUND
// ------------------------------------

const playRideNotificationSound = () => {

  try {

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext =
      new AudioContext();

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      1000,
      audioContext.currentTime
    );

    gain.gain.setValueAtTime(
      0.3,
      audioContext.currentTime
    );

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + 0.5
    );

    setTimeout(() => {
      audioContext.close();
    }, 600);

  } catch (error) {

    console.error(
      "Rider notification sound error:",
      error
    );

  }
};


const showRideAssignmentNotification =
  (ride) => {

    playRideNotificationSound();

    if (
      "Notification" in window &&
      Notification.permission === "granted"
    ) {

      new Notification(
        "🏍️ New Ride Assigned",
        {
          body:
            `Ride #${ride.id} is assigned to you. Tap Accept Ride.`,
        }
      );

    }

  };

  // ------------------------------------
  // Fetch rider profile
  // ------------------------------------
  useEffect(() => {

    const fetchRider = async () => {

      try {

        const user = JSON.parse(
          localStorage.getItem("campusrideUser")
        );

        if (!user) {
          return;
        }

        const response = await fetch(
          `http://localhost:5001/api/riders/${user.id}`
        );

        const data = await response.json();

        if (response.ok) {

          setRider(data.rider);

          setAvailable(
            data.rider.is_available
          );

        }

      } catch (error) {

        console.error(
          "Rider fetch error:",
          error
        );

      } finally {

        setLoading(false);

      }
    };

    fetchRider();

  }, []);


  // ------------------------------------
  // Fetch assigned rides
  // ------------------------------------
  useEffect(() => {

  if (!rider) {
    return;
  }

  const fetchAssignedRides = async () => {

    try {

      const response = await fetch(
        `http://localhost:5001/api/riders/${rider.id}/rides`
      );

      const data = await response.json();

      if (!response.ok) {

        console.error(
          data.message
        );

        return;
      }

      const newRides =
        data.rides || [];

      // ------------------------------------
      // Detect newly assigned rides
      // ------------------------------------

      if (!isFirstAssignedLoad.current) {

        newRides.forEach((ride) => {

          if (
            ride.status === "DRIVER_ASSIGNED" &&
            !previousAssignedRideIds.current.has(
              ride.id
            )
          ) {

            showRideAssignmentNotification(
              ride
            );

          }

        });

      }

      // Remember current ride IDs
      previousAssignedRideIds.current =
        new Set(
          newRides.map(
            (ride) => ride.id
          )
        );

      isFirstAssignedLoad.current =
        false;

      setRides(newRides);

    } catch (error) {

      console.error(
        "Assigned rides error:",
        error
      );

    } finally {

      setRidesLoading(false);

    }

  };

  // First check
  fetchAssignedRides();

  // Continue checking
  const interval =
    setInterval(
      fetchAssignedRides,
      3000
    );

  return () => {
    clearInterval(interval);
  };

}, [rider]);

 // ------------------------------------
 // Rider Live Location
 // ------------------------------------
  useEffect(() => {

  if (!rider) {
    return;
  }

  // Check whether rider currently has an active ride
  const hasActiveRide = rides.some(
    (ride) =>
      ride.status === "DRIVER_ASSIGNED" ||
      ride.status === "RIDER_ACCEPTED" ||
      ride.status === "ONGOING"
  );

  // GPS should run when:
  // 1. Rider is available
  // OR
  // 2. Rider is currently handling a ride
  const shouldTrackLocation =
    available || hasActiveRide;

  if (!shouldTrackLocation) {
    return;
  }

  if (!navigator.geolocation) {

    console.error(
      "Geolocation is not supported by this browser."
    );

    return;
  }

  console.log(
    "📍 GPS tracking started"
  );

  const watchId =
    navigator.geolocation.watchPosition(

      async (position) => {

        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        setLocation({
          latitude,
          longitude
        });

        console.log(
          "📍 Rider location:",
          latitude,
          longitude
        );

        try {

          const response = await fetch(
            `http://localhost:5001/api/riders/${rider.user_id}/location`,
            {
              method: "PATCH",

              headers: {
                "Content-Type": "application/json",
              },

              body: JSON.stringify({
                latitude,
                longitude,
              }),
            }
          );

          const data =
            await response.json();

          if (!response.ok) {

            console.error(
              "Location update failed:",
              data.message
            );

            return;
          }

          console.log(
            "✅ Location sent to server:",
            data.rider
          );

        } catch (error) {

          console.error(
            "Location update error:",
            error
          );
        }
      },

      (error) => {

        console.error(
          "GPS error:",
          error.message
        );
      },

      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );

  // Stop GPS when rider no longer needs tracking
  return () => {

    console.log(
      "🛑 GPS tracking stopped"
    );

    navigator.geolocation.clearWatch(
      watchId
    );
  };

}, [rider, available, rides]);


  // ------------------------------------
  // Toggle availability
  // ------------------------------------
  const toggleAvailability = async () => {
  if (!rider) {
    return;
  }

  // ------------------------------------
  // Check for active ride
  // ------------------------------------
  const activeRide = rides.find(
    (ride) =>
      ride.status === "DRIVER_ASSIGNED" ||
      ride.status === "RIDER_ACCEPTED" ||
      ride.status === "ONGOING"
  );

  // Don't allow rider to go offline during an active ride
  if (available && activeRide) {

    alert(
      "You cannot go offline while a ride is active."
    );

    return;
  }

  try {

      const response = await fetch(
        `http://localhost:5001/api/riders/${rider.user_id}/availability`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            isAvailable: !available,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {

        alert(
          data.message ||
          "Unable to update availability."
        );

        return;
      }

      setAvailable(
        data.rider.is_available
      );

    } catch (error) {

      console.error(error);

      alert(
        "Unable to connect to server."
      );

    }
  };


  // ------------------------------------
  // Loading
  // ------------------------------------
  if (loading) {

    return (
      <div className="rider-dashboard">

        <h2>
          Loading Rider Dashboard...
        </h2>

      </div>
    );

  }


  // ------------------------------------
  // Rider not found
  // ------------------------------------
  if (!rider) {

    return (
      <div className="rider-dashboard">

        <h2>
          Rider profile not found.
        </h2>

      </div>
    );

  }

// ------------------------------------
// Accept Ride
// ------------------------------------
const acceptRide = async (rideId) => {

  try {

    // ------------------------------------
    // Accept the ride
    // ------------------------------------
    const response = await fetch(
      `http://localhost:5001/api/rides/${rideId}/accept`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          riderId: rider.id,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {

      alert(
        data.message ||
        "Unable to accept ride."
      );

      return;
    }

    // ------------------------------------
    // Make rider unavailable
    // ------------------------------------
    const availabilityResponse = await fetch(
      `http://localhost:5001/api/riders/${rider.user_id}/availability`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          isAvailable: false,
        }),
      }
    );

    const availabilityData =
      await availabilityResponse.json();

    if (!availabilityResponse.ok) {

      alert(
        availabilityData.message ||
        "Ride accepted, but availability update failed."
      );

    }

    // ------------------------------------
    // Update frontend availability
    // ------------------------------------
    setAvailable(false);

    // ------------------------------------
    // Refresh assigned rides
    // ------------------------------------
    const ridesResponse = await fetch(
      `http://localhost:5001/api/riders/${rider.id}/rides`
    );

    const ridesData =
      await ridesResponse.json();

    if (ridesResponse.ok) {

      setRides(
        ridesData.rides
      );

    }

    alert(
      "Ride accepted successfully!"
    );

  } catch (error) {

    console.error(
      "Accept ride error:",
      error
    );

    alert(
      "Unable to connect to server."
    );

  }
};


// ------------------------------------
// Reject Ride
// ------------------------------------
const rejectRide = async (rideId) => {

  const confirmReject =
    window.confirm(
      "Are you sure you want to reject this ride?"
    );

  if (!confirmReject) {
    return;
  }

  try {

    // ------------------------------------
    // Reject the ride
    // ------------------------------------
    const response = await fetch(
      `http://localhost:5001/api/rides/${rideId}/reject`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          riderId: rider.id,
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {

      alert(
        data.message ||
        "Unable to reject ride."
      );

      return;
    }

    // ------------------------------------
    // Refresh assigned rides
    // ------------------------------------
    const ridesResponse =
      await fetch(
        `http://localhost:5001/api/riders/${rider.id}/rides`
      );

    const ridesData =
      await ridesResponse.json();

    if (ridesResponse.ok) {

      setRides(
        ridesData.rides
      );

    }

    // ------------------------------------
    // Rider becomes available
    // ------------------------------------
    setAvailable(true);

    alert(
      "Ride rejected. Looking for another rider."
    );

  } catch (error) {

    console.error(
      "Reject ride error:",
      error
    );

    alert(
      "Unable to connect to server."
    );

  }
};

  // ------------------------------------
  // Start Ride
  // ------------------------------------
  const startRide = async (rideId) => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/rides/${rideId}/start`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            riderId: rider.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.message ||
          "Unable to start ride."
        );
        return;
      }

      // Refresh assigned rides
      const ridesResponse = await fetch(
        `http://localhost:5001/api/riders/${rider.id}/rides`
      );

      const ridesData =
        await ridesResponse.json();

      if (ridesResponse.ok) {
        setRides(ridesData.rides);
      }

      alert("Ride started successfully!");

    } catch (error) {
      console.error(
        "Start ride error:",
        error
      );

      alert(
        "Unable to connect to server."
      );
    }
  };


  // ------------------------------------
  // Complete Ride
  // ------------------------------------
  const completeRide = async (rideId) => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/rides/${rideId}/complete`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            riderId: rider.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.message ||
          "Unable to complete ride."
        );
        return;
      }

      // Rider becomes available again
      const availabilityResponse =
        await fetch(
          `http://localhost:5001/api/riders/${rider.user_id}/availability`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              isAvailable: true,
            }),
          }
        );

      const availabilityData =
        await availabilityResponse.json();

      if (availabilityResponse.ok) {
        setAvailable(
          availabilityData.rider.is_available
        );
      }

      // Refresh assigned rides
      const ridesResponse = await fetch(
        `http://localhost:5001/api/riders/${rider.id}/rides`
      );

      const ridesData =
        await ridesResponse.json();

      if (ridesResponse.ok) {
        setRides(ridesData.rides);
      }

      alert(
        "Ride completed successfully!"
      );

    } catch (error) {
      console.error(
        "Complete ride error:",
        error
      );

      alert(
        "Unable to connect to server."
      );
    }
  };
   
   const activeRide = rides.find(
  (ride) =>
    ride.status === "DRIVER_ASSIGNED" ||
    ride.status === "RIDER_ACCEPTED" ||
    ride.status === "ONGOING"
   );


  // ------------------------------------
  // Dashboard
  // ------------------------------------
  return (

    <div className="rider-dashboard">


      {/* HEADER */}

      <div className="rider-header">

        <h1>
          🏍️ CampusRide Rider
        </h1>

        <p>
          Welcome, {rider.full_name}
        </p>

      <button
  onClick={async () => {

    if (!("Notification" in window)) {

      alert(
        "Browser notifications are not supported."
      );

      return;
    }

    const permission =
      await Notification.requestPermission();

    if (permission === "granted") {

      setNotificationEnabled(true);

      playRideNotificationSound();

      alert(
        "🔔 Rider notifications enabled!"
      );

    }

  }}
>
  {notificationEnabled
    ? "🔔 Notifications ON"
    : "🔕 Enable Notifications"}
</button>

      </div>



      {/* RIDER PROFILE */}

      <div className="rider-profile-card">

        <h2>
          👤 Rider Profile
        </h2>

        <p>
          <strong>Name:</strong>{" "}
          {rider.full_name}
        </p>

        <p>
          <strong>Email:</strong>{" "}
          {rider.email}
        </p>

        <p>
          <strong>Vehicle:</strong>{" "}
          {rider.vehicle_type}
        </p>

        <p>
          <strong>Vehicle Number:</strong>{" "}
          {rider.vehicle_number}
        </p>

      </div>



      {/* AVAILABILITY */}

      <div className="rider-availability-card">

        <h2>
          🟢 Rider Availability
        </h2>

        <div className="availability-status">

          {available ? (

            <span className="available">
              🟢 AVAILABLE
            </span>

          ) : (

            <span className="offline">
              🔴 OFFLINE
            </span>

          )}

        </div>


        <button
          className={
            available
              ? "offline-button"
              : "available-button"
          }

          onClick={toggleAvailability}
        >

          {available
            ? "Go Offline"
            : "Go Online"}

        </button>

            </div>


      {/* CURRENT LOCATION */}

      <div className="rider-location-card">

        <h2>
          📍 Current Location
        </h2>

        {location ? (

          <div className="location-details">

            <p>
              <strong>Latitude:</strong>{" "}
              {location.latitude.toFixed(6)}
            </p>

            <p>
              <strong>Longitude:</strong>{" "}
              {location.longitude.toFixed(6)}
            </p>

            <span className="location-live">
              🟢 LIVE LOCATION
            </span>

          </div>

        ) : (

          <p className="location-unavailable">
            📍 Location not available
          </p>

        )}

      </div>

      {activeRide && (
     <RiderRideMap
     ride={activeRide}
     riderLocation={location}
     />
     )}

      {/* ASSIGNED RIDES */}

      <div className="rider-rides-card">

        <h2>
          🚕 Assigned Rides
        </h2>


        {ridesLoading ? (

          <p>
            Loading assigned rides...
          </p>

        ) : rides.length === 0 ? (

          <p>
            No rides assigned yet.
          </p>

        ) : (

          <div className="assigned-rides-list">

            {rides.map((ride) => (

              <div
                className="assigned-ride"
                key={ride.id}
              >


                {/* Ride Header */}

                <div className="assigned-ride-header">

                  <h3>
                    Ride #{ride.id}
                  </h3>

                  <span className="ride-status">
                    {ride.status}
                  </span>

                </div>



                {/* Student Details */}

               {["DRIVER_ASSIGNED", "RIDER_ACCEPTED", "ONGOING"].includes(
                ride.status
                 ) && (
  <div className="ride-section">

    <h4>
      👤 Student Details
    </h4>

    <p>
      <strong>Name:</strong>{" "}
      {ride.full_name}
    </p>

    <p>
      <strong>Student ID:</strong>{" "}
      {ride.student_id}
    </p>

    <p>
      <strong>Mobile:</strong>{" "}
      {ride.mobile}
    </p>

  </div>
   )}


                {/* Ride Details */}

                <div className="ride-section">

                  <h4>
                    📍 Ride Details
                  </h4>

                  <p>
                    <strong>Pickup:</strong>{" "}
                    {Number(ride.pickup_lat).toFixed(5)},
                    {" "}
                    {Number(ride.pickup_lng).toFixed(5)}
                  </p>

                  <p>
                    <strong>Destination:</strong>{" "}
                    {Number(ride.destination_lat).toFixed(5)},
                    {" "}
                    {Number(ride.destination_lng).toFixed(5)}
                  </p>

                  <p>
                    <strong>Distance:</strong>{" "}
                    {Number(ride.distance_km).toFixed(2)}
                    {" "}km
                  </p>

                  <p>
                    <strong>Fare:</strong>{" "}
                    ₹{Number(ride.estimated_fare).toFixed(2)}
                  </p>

                </div>



                                {/* Action */}

                {ride.status === "DRIVER_ASSIGNED" && (

  <div
    style={{
      display: "flex",
      gap: "10px",
      marginTop: "12px",
    }}
  >

    <button
      className="accept-assigned-button"
      onClick={() =>
        acceptRide(ride.id)
      }
    >
      ✅ Accept Ride
    </button>

    <button
      className="reject-assigned-button"
      onClick={() =>
        rejectRide(ride.id)
      }
    >
      ❌ Reject Ride
    </button>

  </div>

)}


                {ride.status === "RIDER_ACCEPTED" && (

                  <button
                    className="start-ride-button"
                    onClick={() =>
                      startRide(ride.id)
                    }
                  >
                    🚀 Start Ride
                  </button>

                )}


                {ride.status === "ONGOING" && (

                  <button
                    className="complete-ride-button"
                    onClick={() =>
                      completeRide(ride.id)
                    }
                  >
                    ✅ Complete Ride
                  </button>

                )}

              </div>

            ))}

          </div>

        )}

      </div>

    </div>
  );
}

export default RiderDashboard;