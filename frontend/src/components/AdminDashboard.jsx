import { useEffect, useState, useRef } from "react";
import AdminRiderMap from "./AdminRiderMap";

function AdminDashboard() {

  // ------------------------------------
  // State
  // ------------------------------------

  const [rides, setRides] = useState([]);
  const [riders, setRiders] = useState([]);

  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const previousRideIds = useRef(new Set());
  const isFirstRideLoad = useRef(true);

  const [loading, setLoading] = useState(true);
  const [ridersLoading, setRidersLoading] = useState(true);

  const [error, setError] = useState("");
  const [ridersError, setRidersError] = useState("");

  const [availableRiders, setAvailableRiders] = useState({});
  const [selectedRiders, setSelectedRiders] = useState({});
  const [assigningRide, setAssigningRide] = useState(null);

  const [selectedMapRide, setSelectedMapRide] = useState(null);



  // ------------------------------------
// ADMIN NOTIFICATION + SOUND
// ------------------------------------

const playNotificationSound = () => {
  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext = new AudioContext();

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      880,
      audioContext.currentTime
    );

    gain.gain.setValueAtTime(
      0.8,
      audioContext.currentTime
    );

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + 0.35
    );

    setTimeout(() => {
      audioContext.close();
    }, 500);

  } catch (error) {
    console.error(
      "Notification sound error:",
      error
    );
  }
};


const showAdminNotification = (ride) => {

  playNotificationSound();

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {

    new Notification(
      "🚕 New CampusRide Request",
      {
        body:
          `Ride #${ride.id} requested by ${ride.full_name}`,
      }
    );

  }
};


  // ------------------------------------
  // Fetch rides
  // ------------------------------------

  const fetchRides = async () => {

    try {

      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:5001/api/admin/rides"
      );

      const data = await response.json();

      if (!response.ok) {

        setError(
          data.message ||
          "Unable to load rides."
        );

        return;
      }

      const newRides = data.rides || [];

      const currentRideIds = new Set(
      newRides.map((ride) => ride.id)
       );

// ------------------------------------
// Detect NEW ride requests
// ------------------------------------

if (!isFirstRideLoad.current) {

  newRides.forEach((ride) => {

    if (
      ride.status === "REQUESTED" &&
      !previousRideIds.current.has(ride.id)
    ) {

      showAdminNotification(ride);

    }

  });

}

previousRideIds.current = currentRideIds;

isFirstRideLoad.current = false;

setRides(newRides);

    } catch (error) {

      console.error(error);

      setError(
        "Unable to connect to server."
      );

    } finally {

      setLoading(false);

    }
  };


  // ------------------------------------
  // Fetch riders
  // ------------------------------------

  const fetchRiders = async () => {

    try {

      setRidersLoading(true);
      setRidersError("");

      const response = await fetch(
        "http://localhost:5001/api/admin/riders"
      );

      const data = await response.json();

      if (!response.ok) {

        setRidersError(
          data.message ||
          "Unable to load riders."
        );

        return;
      }

      setRiders(data.riders);

    } catch (error) {

      console.error(error);

      setRidersError(
        "Unable to connect to server."
      );

    } finally {

      setRidersLoading(false);

    }
  };


  // ------------------------------------
  // Initial loading
  // ------------------------------------

  useEffect(() => {

  fetchRides();
  fetchRiders();

  const interval = setInterval(() => {

    fetchRides();
    fetchRiders();

  }, 3000);

  return () => {
    clearInterval(interval);
  };

  }, []);


  // ------------------------------------
  // Statistics
  // ------------------------------------

  const totalRides = rides.length;

  const pendingRides = rides.filter(
    (ride) => ride.status === "REQUESTED"
  ).length;

  const completedRides = rides.filter(
    (ride) => ride.status === "COMPLETED"
  ).length;

  const availableRiderCount = riders.filter(
  (rider) => rider.is_available
  ).length;

  const busyRiders = riders.filter(
    (rider) => !rider.is_available
  ).length;

   // ------------------------------------
   // Fetch available riders for a ride
   // ------------------------------------

 const fetchAvailableRiders = async (rideId) => {
  try {
    const response = await fetch(
      `http://localhost:5001/api/admin/rides/${rideId}/available-riders`
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Unable to find available riders.");
      return;
    }

    setAvailableRiders((prev) => ({
      ...prev,
      [rideId]: data.riders,
    }));

  } catch (error) {
    console.error(error);
    alert("Unable to connect to server.");
  }
 };

  // ------------------------------------
  // Assign rider to ride
  // ------------------------------------

const assignRider = async (rideId) => {
  const riderId = selectedRiders[rideId];

  if (!riderId) {
    alert("Please select a rider first.");
    return;
  }

  try {
    setAssigningRide(rideId);

    const response = await fetch(
      `http://localhost:5001/api/rides/${rideId}/assign`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          riderId: Number(riderId),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Unable to assign rider.");
      return;
    }

    alert(
      `Rider ${data.rider.id} assigned successfully to Ride #${rideId}!`
    );

    // Clear selected rider
    setSelectedRiders((prev) => {
      const updated = { ...prev };
      delete updated[rideId];
      return updated;
    });

    // Clear available riders list for this ride
    setAvailableRiders((prev) => {
      const updated = { ...prev };
      delete updated[rideId];
      return updated;
    });

    // Refresh dashboard
    await fetchRides();
    await fetchRiders();

  } catch (error) {
    console.error(error);
    alert("Unable to connect to server.");

  } finally {
    setAssigningRide(null);
  }
 };

  // ------------------------------------
  // Update ride status
  // ------------------------------------

  const updateRideStatus = async (
    rideId,
    action
  ) => {

    try {

      const response = await fetch(
        `http://localhost:5001/api/admin/rides/${rideId}/${action}`,
        {
          method: "PATCH",
        }
      );

      const data = await response.json();

      if (!response.ok) {

        alert(
          data.message ||
          "Unable to update ride."
        );

        return;
      }

      await fetchRides();
      await fetchRiders();

    } catch (error) {

      console.error(error);

      alert(
        "Unable to connect to server."
      );

    }
  };


  // ------------------------------------
  // Refresh everything
  // ------------------------------------

  const refreshDashboard = async () => {

    await Promise.all([
      fetchRides(),
      fetchRiders()
    ]);

  };


  return (

    <div className="admin-dashboard">


      {/* ================================= */}
      {/* HEADER */}
      {/* ================================= */}

      <div className="admin-header">

        <h1>
          🚕 CampusRide Admin
        </h1>

        <p>
          Ride Management Dashboard
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

      playNotificationSound();

      alert(
        "🔔 Admin notifications enabled!"
      );
    }
  }}
  >
  {notificationEnabled
    ? "🔔 Notifications ON"
    : "🔕 Enable Notifications"}
 </button>

  </div>



      {/* ================================= */}
      {/* STATISTICS */}
      {/* ================================= */}

      <div className="admin-stats">


        <div className="admin-stat-card">

          <span>🚕</span>

          <h2>
            {totalRides}
          </h2>

          <p>
            Total Rides
          </p>

        </div>



        <div className="admin-stat-card">

          <span>⏳</span>

          <h2>
            {pendingRides}
          </h2>

          <p>
            Pending
          </p>

        </div>



        <div className="admin-stat-card">

          <span>✅</span>

          <h2>
            {completedRides}
          </h2>

          <p>
            Completed
          </p>

        </div>



        <div className="admin-stat-card">

          <span>🏍️</span>

          <h2>
         {availableRiderCount}
          </h2>

          <p>
          Riders Online
          </p>

        </div>

      </div>



      {/* ================================= */}
      {/* RIDER MANAGEMENT */}
      {/* ================================= */}

      <div className="admin-riders">


        <div className="admin-riders-header">

          <div>

            <h2>
              🏍️ Rider Management
            </h2>

            <p>
              Monitor rider availability and current rides
            </p>

          </div>


          <button
            onClick={refreshDashboard}
          >
            🔄 Refresh
          </button>

        </div>



        {/* Rider Statistics */}

        <div className="rider-summary">

          <div className="rider-summary-item">

            <span className="summary-number">
              {riders.length}
            </span>

            <span>
              Total Riders
            </span>

          </div>


          <div className="rider-summary-item online">

            <span className="summary-number">
               {availableRiderCount}
            </span>

            <span>
              🟢 Available
            </span>

          </div>


          <div className="rider-summary-item busy">

            <span className="summary-number">
              {busyRiders}
            </span>

            <span>
              🔴 Busy
            </span>

          </div>

        </div>



        {/* Rider Loading */}

        {ridersLoading && (

          <p className="admin-message">
            Loading riders...
          </p>

        )}



        {/* Rider Error */}

        {ridersError && (

          <p className="admin-error">
            {ridersError}
          </p>

        )}



        {/* No Riders */}

        {!ridersLoading &&
          !ridersError &&
          riders.length === 0 && (

            <p className="admin-message">
              No riders registered.
            </p>

          )}



        {/* Rider Cards */}

        {!ridersLoading &&
          riders.length > 0 && (

            <div className="admin-rider-list">

              {riders.map((rider) => (

                <div
                  className="admin-rider-card"
                  key={rider.id}
                >


                  {/* Rider Header */}

                  <div className="admin-rider-top">

                    <div>

                      <h3>
                        🏍️ {rider.full_name}
                      </h3>

                      <p>
                        Rider #{rider.id}
                      </p>

                    </div>


                    {rider.is_available ? (

                      <span className="rider-online">
                        🟢 AVAILABLE
                      </span>

                    ) : (

                      <span className="rider-busy">
                        🔴 BUSY
                      </span>

                    )}

                  </div>



                  {/* Rider Information */}

                  <div className="admin-rider-info">


                    <div>

                      <strong>
                        📧 Email
                      </strong>

                      <span>
                        {rider.email}
                      </span>

                    </div>


                    <div>

                      <strong>
                        📱 Mobile
                      </strong>

                      <span>
                        {rider.mobile}
                      </span>

                    </div>


                    <div>

                      <strong>
                        🛵 Vehicle
                      </strong>

                      <span>
                        {rider.vehicle_type}
                      </span>

                    </div>


                    <div>

                      <strong>
                        🔢 Vehicle Number
                      </strong>

                      <span>
                        {rider.vehicle_number}
                      </span>

                    </div>

                  </div>



                  {/* Current Ride */}

                  <div className="admin-current-ride">

                    <h4>
                      🚕 Current Ride
                    </h4>


                    {rider.current_ride_id ? (

                      <div>

                        <p>

                          <strong>
                            Ride:
                          </strong>{" "}

                          #{rider.current_ride_id}

                        </p>


                        <p>

                          <strong>
                            Status:
                          </strong>{" "}

                          {rider.current_ride_status}

                        </p>

                      </div>

                    ) : (

                      <p className="no-current-ride">
                        No active ride
                      </p>

                    )}

                  </div>



                  {/* Location */}

                  <div className="admin-rider-location">

                    <strong>
                      📍 Current Location
                    </strong>

                    {rider.current_lat &&
                    rider.current_lng ? (

                      <span>

                        {Number(
                          rider.current_lat
                        ).toFixed(5)}

                        ,{" "}

                        {Number(
                          rider.current_lng
                        ).toFixed(5)}

                      </span>

                    ) : (

                      <span>
                        Location not available
                      </span>

                    )}

                  </div>


                </div>

              ))}

            </div>

          )}

      </div>

     {/* Live Rider Map */}

      <AdminRiderMap
     selectedRide={selectedMapRide}
      />
      {/* ================================= */}
      {/* RIDE REQUESTS */}
      {/* ================================= */}

      <div className="admin-rides">


        <div className="admin-rides-header">

          <h2>
            🚕 Ride Requests
          </h2>

          <button
            onClick={refreshDashboard}
          >
            🔄 Refresh
          </button>

        </div>



        {loading && (

          <p className="admin-message">
            Loading ride requests...
          </p>

        )}



        {error && (

          <p className="admin-error">
            {error}
          </p>

        )}



        {!loading &&
          !error &&
          rides.length === 0 && (

            <p className="admin-message">
              No ride requests found.
            </p>

          )}



        <div className="admin-ride-list">

          {rides.map((ride) => (

            <div
              className="admin-ride-card"
              key={ride.id}
            >


              {/* Ride Header */}

              <div className="admin-ride-top">

                <h3>
                  Ride #{ride.id}
                </h3>

                <span className="admin-status">
                  {ride.status}
                </span>

              </div>



              {/* Student */}

              <div className="admin-student">

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



              {/* Ride Details */}

              <div className="admin-location">

                <h4>
                  📍 Ride Details
                </h4>

                <p>
  <strong>
    📍 Pickup:
  </strong>{" "}
  {ride.pickup_name || (
    <>
      {Number(ride.pickup_lat).toFixed(5)},{" "}
      {Number(ride.pickup_lng).toFixed(5)}
    </>
  )}
</p>


               <p>
  <strong>
    🏁 Destination:
  </strong>{" "}
  {ride.destination_name || (
    <>
      {Number(ride.destination_lat).toFixed(5)},{" "}
      {Number(ride.destination_lng).toFixed(5)}
    </>
  )}
</p>


                <p>

                  <strong>
                    Distance:
                  </strong>{" "}

                  {ride.distance_km} km

                </p>


                <p>

                  <strong>
                    Fare:
                  </strong>{" "}

                  ₹{ride.estimated_fare}

                </p>


                <p>

                  <strong>
                    Requested:
                  </strong>{" "}

                  {new Date(
                    ride.created_at
                  ).toLocaleString()}

                </p>

              </div>

        <button
          className="view-map-button"
          onClick={() => {
          setSelectedMapRide(ride);

          window.scrollTo({
          top: 0,
          behavior: "smooth",
          });
          }}
       >
        🗺️ View Ride on Map
        </button>


             {/* Assigned Rider */}

  {ride.rider_id && (

   <div className="assigned-rider-info">

    <h4>
      🏍️ Rider Details
    </h4>

    <p>
      <strong>Rider:</strong>{" "}
      {ride.rider_name || `Rider #${ride.rider_id}`}
    </p>

    <p>
      <strong>Vehicle:</strong>{" "}
      {ride.vehicle_type || "Not available"}
    </p>

    <p>
      <strong>Vehicle No:</strong>{" "}
      {ride.vehicle_number || "Not available"}
    </p>

    <p>
      <strong>Mobile:</strong>{" "}
      {ride.rider_mobile || "Not available"}
    </p>

  </div>

  )}



              {/* Admin Actions */}

              {ride.status === "REQUESTED" && (

  <div className="admin-actions">

    {/* Load riders button */}
    {!availableRiders[ride.id] && (

      <button
        className="accept-button"
        onClick={() =>
          fetchAvailableRiders(ride.id)
        }
      >
        🏍️ Find Available Riders
      </button>

    )}

    {/* Rider selection */}
    {availableRiders[ride.id] && (

      <div className="assign-rider-box">

        <label>
          <strong>Assign Rider</strong>
        </label>

        {availableRiders[ride.id].length === 0 ? (

          <p className="admin-message">
            No available riders found.
          </p>

        ) : (

          <>
            <select
              value={selectedRiders[ride.id] || ""}
              onChange={(event) =>
                setSelectedRiders((prev) => ({
                  ...prev,
                  [ride.id]: event.target.value,
                }))
              }
            >

              <option value="">
                Select a rider
              </option>

              {availableRiders[ride.id].map(
                (rider) => (

                  <option
                    key={rider.id}
                    value={rider.id}
                  >
                    {rider.full_name}
                    {" - "}
                    {rider.vehicle_number}
                    {" - "}
                    {rider.distance_to_pickup} km away
                  </option>

                )
              )}

            </select>

            <button
              className="accept-button"
              disabled={
                !selectedRiders[ride.id] ||
                assigningRide === ride.id
              }
              onClick={() =>
                assignRider(ride.id)
              }
            >
              {assigningRide === ride.id
                ? "Assigning..."
                : "✅ Assign Rider"}
            </button>

          </>

        )}

      </div>

    )}

    {/* Reject */}
    <button
      className="reject-button"
      onClick={() =>
        updateRideStatus(
          ride.id,
          "reject"
        )
      }
    >
      ❌ Reject Ride
    </button>

  </div>

)}


            </div>

          ))}

        </div>

      </div>

    </div>
  );
}

export default AdminDashboard;