import API_BASE_URL from "../api";
import { useEffect, useRef, useState } from "react";

function getRideStatus(status) {
  switch (status) {
    case "REQUESTED":
      return {
        icon: "🔎",
        text: "Finding a captain",
      };

    case "DRIVER_ASSIGNED":
      return {
        icon: "🏍️",
        text: "Rider assigned",
      };

    case "RIDER_ACCEPTED":
      return {
        icon: "✅",
        text: "Rider accepted",
      };

    case "ONGOING":
      return {
        icon: "🛣️",
        text: "Ride in progress",
      };

    case "COMPLETED":
      return {
        icon: "🎉",
        text: "Completed",
      };

    case "REJECTED":
      return {
        icon: "❌",
        text: "Rejected",
      };

    case "CANCELLED":
      return { 
        icon: "🚫", 
        text: "Cancelled"
     };

    default:
      return {
        icon: "ℹ️",
        text: status,
      };
  }
}

function RideHistory() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ridesRequestId = useRef(0);


  const cancelRide = async (rideId) => {
  const confirmed = window.confirm(
    "Are you sure you want to cancel this ride?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem("campusrideUser"));

    if (!user) {
      alert("Please login first.");
      return;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/rides/${rideId}/cancel`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Unable to cancel ride.");
      return;
    }

    alert("Ride cancelled successfully.");

    // Immediately update the ride in the UI
    setRides((prevRides) =>
      prevRides.map((ride) =>
        ride.id === rideId
          ? { ...ride, status: "CANCELLED" }
          : ride
      )
    );

  } catch (error) {
    console.error("Cancel ride error:", error);
    alert("Unable to connect to server.");
  }
};


 
useEffect(() => {
  let stopped = false;
  let timer = null;

  const fetchRides = async () => {
    const requestId = ++ridesRequestId.current;

    try {
      const user = JSON.parse(
        localStorage.getItem("campusrideUser")
      );

      if (!user) {
        if (requestId === ridesRequestId.current) {
          setError("Please login first.");
          setLoading(false);
        }
        return;
      }

      const response = await fetch(
  `${API_BASE_URL}/api/rides/user/${user.id}`,
  {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    }
  }
);

      const data = await response.json();

      // Ignore older responses that could overwrite newer ride statuses.
      if (requestId !== ridesRequestId.current) {
        return;
      }

      if (!response.ok) {
        setError(data.message || "Unable to load rides.");
        return;
      }

      setRides(data.rides || []);
      setError("");
    } catch (err) {
      if (requestId !== ridesRequestId.current) {
        return;
      }

      console.error("Fetch rides error:", err);
      setError("Unable to connect to server.");
    } finally {
      if (requestId === ridesRequestId.current) {
        setLoading(false);
      }
    }
  };

  const pollRides = async () => {
    if (stopped) return;

    await fetchRides();

    if (stopped) return;

    // Wait for the current request before starting the next poll.
    timer = setTimeout(pollRides, 3000);
  };

  pollRides();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    ridesRequestId.current++;
  };
}, []);

  if (loading) {
    return (
      <div className="ride-history">
        <h2> My Rides</h2>
        <p>Loading your rides...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ride-history">
        <h2> My Rides</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="ride-history">

      <h2> My Rides</h2>

      {rides.length === 0 ? (
        <p>No rides found.</p>
      ) : (
        <div className="ride-history-list">

          {rides.map((ride) => (
            <div
              className="ride-history-card"
              key={ride.id}
            >

              {/* ---------------- HEADER ---------------- */}

              <div className="ride-history-header">
                <strong>
                 🏍️ Ride #{ride.id}
                </strong>

                <span className="ride-status">
                {getRideStatus(ride.status).icon}{" "}
                {getRideStatus(ride.status).text}
                </span>
              </div>


              {/* ---------------- RIDE DETAILS ---------------- */}

              <div className="ride-history-details">

                <p>
                  📍 <strong>Pickup:</strong>{" "}
                  {ride.pickup_name || (
                    <>
                      {Number(ride.pickup_lat).toFixed(5)},{" "}
                      {Number(ride.pickup_lng).toFixed(5)}
                    </>
                  )}
                </p>


                <p>
                  🏁 <strong>Destination:</strong>{" "}
                  {ride.destination_name || (
                    <>
                      {Number(ride.destination_lat).toFixed(5)},{" "}
                      {Number(ride.destination_lng).toFixed(5)}
                    </>
                  )}
                </p>


                <p>
                  📏 <strong>Distance:</strong>{" "}
                  {ride.distance_km} km
                </p>


                <p>
                  💰 <strong>Fare:</strong>{" "}
                  ₹{ride.estimated_fare}
                </p>


                <p>
                  🕒 <strong>Requested:</strong>{" "}
                  {new Date(
                    ride.created_at
                  ).toLocaleString()}
                </p>

              </div>


{(ride.status === "REQUESTED" ||
  ride.status === "DRIVER_ASSIGNED") && (
  <button
    className="cancel-ride-button"
    onClick={() => cancelRide(ride.id)}
  >
    🚫 Cancel Ride
  </button>
)}

              {/* ---------------- RIDER DETAILS ---------------- */}

             {ride.rider_id &&
              ["DRIVER_ASSIGNED", "RIDER_ACCEPTED", "ONGOING"].includes(
               ride.status
               ) && (
                <div className="ride-rider-details">

                  <hr />

                  <h3>🏍️ Rider Details</h3>

                  {ride.rider_name && (
                    <p>
                      👤 <strong>Rider:</strong>{" "}
                      {ride.rider_name}
                    </p>
                  )}

                  {ride.vehicle_type && (
                    <p>
                      🛵 <strong>Vehicle:</strong>{" "}
                      {ride.vehicle_type}
                    </p>
                  )}

                  {ride.vehicle_number && (
                    <p>
                      🔢 <strong>Vehicle No:</strong>{" "}
                      {ride.vehicle_number}
                    </p>
                  )}

                  {ride.rider_mobile && (
                    <p>
                      📞 <strong>Mobile:</strong>{" "}
                      {ride.rider_mobile}
                    </p>
                  )}

                </div>
              )}

            </div>
          ))}

        </div>
      )}

    </div>
  );
}

export default RideHistory;