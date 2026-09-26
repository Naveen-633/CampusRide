import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
   useMap,
} from "react-leaflet";

import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const campusCenter = [12.0198, 79.8565];
const riderIcon = L.divIcon({
  className: "campusride-rider-icon",
  html: `
    <div style="
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.35);
      border: 3px solid #2196f3;
    ">
      🏍️
    </div>
  `,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
  popupAnchor: [0, -23],
});

const pickupIcon = L.divIcon({
  className: "campusride-pickup-icon",
  html: `
    <div style="
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #22c55e;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 23px;
      color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.30);
      border: 3px solid white;
    ">
      📍
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -21],
});

const destinationIcon = L.divIcon({
  className: "campusride-destination-icon",
  html: `
    <div style="
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 23px;
      color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.30);
      border: 3px solid white;
    ">
      🏁
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -21],
});

// Calculate distance between two coordinates
function calculateDistance(point1, point2) {
  const R = 6371; // Earth radius in KM

  const lat1 = (point1[0] * Math.PI) / 180;
  const lat2 = (point2[0] * Math.PI) / 180;

  const deltaLat =
    ((point2[0] - point1[0]) * Math.PI) / 180;

  const deltaLng =
    ((point2[1] - point1[1]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Map click handler
function LocationSelector({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect([
        event.latlng.lat,
        event.latlng.lng,
      ]);
    },
  });

  return null;
}
function SmoothRiderMarker({ position, icon }) {
  const markerRef = useRef(null);
  const previousPosition = useRef(position);

  useEffect(() => {
    if (!position || !markerRef.current) {
      return;
    }

    const start = previousPosition.current || position;
    const end = position;

    const startTime = performance.now();
    const duration = 1200;

    const animate = (currentTime) => {
      const progress = Math.min(
        (currentTime - startTime) / duration,
        1
      );

      // Smooth easing
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const lat =
        start[0] +
        (end[0] - start[0]) * eased;

      const lng =
        start[1] +
        (end[1] - start[1]) * eased;

      markerRef.current.setLatLng([
        lat,
        lng,
      ]);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);

    previousPosition.current = position;

  }, [position]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
    >
      <Popup>
        🏍️ <strong>Rider Live Location</strong>
      </Popup>
    </Marker>
  );
}

function getRideStatus(status) {
  switch (status) {
    case "REQUESTED":
      return {
        icon: "🔎",
        text: "Finding a rider",
      };

    case "DRIVER_ASSIGNED":
      return {
        icon: "🏍️",
        text: "Rider assigned",
      };

    case "RIDER_ACCEPTED":
      return {
        icon: "✅",
        text: "Rider accepted your ride",
      };

    case "ONGOING":
      return {
        icon: "🛣️",
        text: "Ride in progress",
      };

    case "COMPLETED":
      return {
        icon: "🎉",
        text: "Ride completed",
      };

    case "REJECTED":
      return {
        icon: "❌",
        text: "Ride rejected",
      };

    default:
      return {
        icon: "ℹ️",
        text: status || "Unknown status",
      };
  }
}

function MapAutoFit({ pickup, destination, riderLocation }) {
  const map = useMap();

  useEffect(() => {
    const points = [];

    if (pickup) {
      points.push(pickup);
    }

    if (destination) {
      points.push(destination);
    }

    if (riderLocation) {
      points.push(riderLocation);
    }

    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 16, {
        animate: true,
      });
      return;
    }

    const bounds = L.latLngBounds(points);

    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 16,
      animate: true,
    });
  }, [map, pickup, destination, riderLocation]);

  return null;
}
function CampusMap({
  selectedPickup,
  selectedDestination,
  }) { 
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [rideMessage, setRideMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [riderRouteCoordinates, setRiderRouteCoordinates] = useState([]);
  const [riderRouteDistance, setRiderRouteDistance] = useState(null);
  const [riderRouteDuration, setRiderRouteDuration] = useState(null);
  const [riderRouteLoading, setRiderRouteLoading] = useState(false);



    // ------------------------------------
  // SYNC LANDMARK SELECTION WITH MAP
  // ------------------------------------

  useEffect(() => {
    if (selectedPickup) {
      setPickup([
        Number(selectedPickup.lat),
        Number(selectedPickup.lng),
      ]);
    } else {
      setPickup(null);
    }
  }, [selectedPickup]);

  useEffect(() => {
    if (selectedDestination) {
      setDestination([
        Number(selectedDestination.lat),
        Number(selectedDestination.lng),
      ]);
    } else {
      setDestination(null);
    }
  }, [selectedDestination]);

  // ------------------------------------
// ROAD ROUTING USING OSRM
// ------------------------------------

useEffect(() => {
  if (!pickup || !destination) {
    setRouteCoordinates([]);
    setRouteDistance(null);
    setRouteDuration(null);
    return;
  }

  const fetchRoute = async () => {
    try {
      setRouteLoading(true);

      const pickupLng = pickup[1];
      const pickupLat = pickup[0];

      const destinationLng = destination[1];
      const destinationLat = destination[0];

      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${pickupLng},${pickupLat};` +
        `${destinationLng},${destinationLat}` +
        `?overview=full&geometries=geojson`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Routing request failed.");
      }

      const data = await response.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        throw new Error("No road route found.");
      }

      const route = data.routes[0];

      // OSRM returns [longitude, latitude]
      // Leaflet needs [latitude, longitude]
      const coordinates =
        route.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng]
        );

      setRouteCoordinates(coordinates);

      // meters → kilometers
      setRouteDistance(route.distance / 1000);

      // seconds → minutes
      setRouteDuration(route.duration / 60);

    } catch (error) {
      console.error(
        "OSRM routing error:",
        error
      );

      // Fallback to straight-line distance
      setRouteCoordinates([
        pickup,
        destination
      ]);

      const fallbackDistance =
        calculateDistance(
          pickup,
          destination
        );

      setRouteDistance(fallbackDistance);

      setRouteDuration(
        (fallbackDistance / 20) * 60
      );

    } finally {
      setRouteLoading(false);
    }
  };

  fetchRoute();

}, [pickup, destination]);

  // ------------------------------------
  // LIVE RIDER LOCATION
  // ------------------------------------

  const [activeRide, setActiveRide] = useState(null);
  const [riderLocation, setRiderLocation] = useState(null);
  const [completedRide, setCompletedRide] = useState(null);

  const previousActiveRideId = useRef(null);
  const lastCompletedRideId = useRef(null);

let riderDistance = null;
let riderEta = null;

if (
  riderLocation &&
  activeRide?.pickup_lat !== undefined &&
  activeRide?.pickup_lng !== undefined
) {
  riderDistance = calculateDistance(
    riderLocation,
    [
      Number(activeRide.pickup_lat),
      Number(activeRide.pickup_lng),
    ]
  );

  // Approximate campus riding speed
  const averageSpeed = 20;

  riderEta =
    (riderDistance / averageSpeed) * 60;
}
   
  const displayRiderDistance =
  riderRouteDistance !== null
    ? riderRouteDistance
    : riderDistance;

  const displayRiderEta =
  riderRouteDuration !== null
    ? riderRouteDuration
    : riderEta;

const mapPickup =
  activeRide?.pickup_lat !== undefined &&
  activeRide?.pickup_lng !== undefined
    ? [
        Number(activeRide.pickup_lat),
        Number(activeRide.pickup_lng),
      ]
    : pickup;

const mapDestination =
  activeRide?.destination_lat !== undefined &&
  activeRide?.destination_lng !== undefined
    ? [
        Number(activeRide.destination_lat),
        Number(activeRide.destination_lng),
      ]
    : destination;

  // Get logged-in student
  const user = JSON.parse(
    localStorage.getItem("campusrideUser")
  );

  // Fetch student's latest rides
 const fetchActiveRide = async () => {
  if (!user?.id) {
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:5001/api/rides/user/${user.id}`
    );

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    // Backend may return:
    // { rides: [...] }
    // or directly [...]
    const rides = data.rides || data;

    if (!Array.isArray(rides)) {
      return;
    }

    // ------------------------------------
    // FIND ACTIVE RIDE
    // ------------------------------------

    const ride = rides.find(
  (r) =>
    r.status === "REQUESTED" ||
    r.status === "DRIVER_ASSIGNED" ||
    r.status === "RIDER_ACCEPTED" ||
    r.status === "ONGOING"
   );

    // ------------------------------------
    // FIND LATEST COMPLETED RIDE
    // ------------------------------------

    const completedRides = rides
      .filter((r) => r.status === "COMPLETED")
      .sort(
        (a, b) =>
          new Date(b.created_at) -
          new Date(a.created_at)
      );

    const latestCompletedRide =
      completedRides.length > 0
        ? completedRides[0]
        : null;

    // ------------------------------------
    // FIRST TIME INITIALIZATION
    // ------------------------------------

    if (lastCompletedRideId.current === null) {

      if (latestCompletedRide) {
        lastCompletedRideId.current =
          latestCompletedRide.id;
      }

      if (ride) {
        previousActiveRideId.current =
          ride.id;
      }
    }

    // ------------------------------------
    // ACTIVE RIDE EXISTS
    // ------------------------------------

    if (ride) {

      setActiveRide(ride);

      // Remember current active ride
      previousActiveRideId.current =
        ride.id;

      // Update rider location
      if (
        ride.rider_lat !== null &&
        ride.rider_lat !== undefined &&
        ride.rider_lng !== null &&
        ride.rider_lng !== undefined
      ) {

        setRiderLocation([
          Number(ride.rider_lat),
          Number(ride.rider_lng),
        ]);

      } else {

        setRiderLocation(null);

      }

      return;
    }

    // ------------------------------------
    // NO ACTIVE RIDE
    // ------------------------------------

    setActiveRide(null);
    setRiderLocation(null);

    // ------------------------------------
    // CHECK FOR NEWLY COMPLETED RIDE
    // ------------------------------------

    if (latestCompletedRide) {

      const latestCompletedId =
        latestCompletedRide.id;

      // A new completed ride is detected
      if (
        lastCompletedRideId.current !==
        latestCompletedId
      ) {

        setCompletedRide(
          latestCompletedRide
        );

        lastCompletedRideId.current =
          latestCompletedId;
      }
    }

  } catch (error) {

    console.error(
      "Error fetching rider location:",
      error
    );

  }
};

  useEffect(() => {
  if (!riderLocation || !activeRide) {
    setRiderRouteCoordinates([]);
    setRiderRouteDistance(null);
    setRiderRouteDuration(null);
    return;
  }

  let target = null;

  // Rider → Pickup
  if (
    activeRide.status === "DRIVER_ASSIGNED" ||
    activeRide.status === "RIDER_ACCEPTED"
  ) {
    if (
      activeRide.pickup_lat !== undefined &&
      activeRide.pickup_lng !== undefined
    ) {
      target = [
        Number(activeRide.pickup_lat),
        Number(activeRide.pickup_lng),
      ];
    }
  }

  // Rider → Destination
  if (activeRide.status === "ONGOING") {
    if (
      activeRide.destination_lat !== undefined &&
      activeRide.destination_lng !== undefined
    ) {
      target = [
        Number(activeRide.destination_lat),
        Number(activeRide.destination_lng),
      ];
    }
  }

  if (!target) {
    setRiderRouteCoordinates([]);
    return;
  }

  const fetchRiderRoute = async () => {
    try {
      setRiderRouteLoading(true);

      const riderLat = riderLocation[0];
      const riderLng = riderLocation[1];

      const targetLat = target[0];
      const targetLng = target[1];

      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${riderLng},${riderLat};` +
        `${targetLng},${targetLat}` +
        `?overview=full&geometries=geojson`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Rider route request failed.");
      }

      const data = await response.json();

      if (
        data.code !== "Ok" ||
        !data.routes ||
        data.routes.length === 0
      ) {
        throw new Error("No rider road route found.");
      }

      const route = data.routes[0];

      const coordinates =
        route.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng]
        );

      setRiderRouteCoordinates(coordinates);

      setRiderRouteDistance(
        route.distance / 1000
      );

      setRiderRouteDuration(
        route.duration / 60
      );

    } catch (error) {
      console.error(
        "Rider OSRM routing error:",
        error
      );

      // Fallback to straight line
      setRiderRouteCoordinates([
        riderLocation,
        target,
      ]);

      const fallbackDistance =
        calculateDistance(
          riderLocation,
          target
        );

      setRiderRouteDistance(
        fallbackDistance
      );

      setRiderRouteDuration(
        (fallbackDistance / 20) * 60
      );

    } finally {
      setRiderRouteLoading(false);
    }
  };

  fetchRiderRoute();

}, [
  riderLocation,
  activeRide?.status,
  activeRide?.pickup_lat,
  activeRide?.pickup_lng,
  activeRide?.destination_lat,
  activeRide?.destination_lng,
]);

  // Poll rider location every 3 seconds
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Fetch immediately
    fetchActiveRide();

    // Then update every 3 seconds
    const interval = setInterval(() => {
      fetchActiveRide();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // ------------------------------------
  // MAP LOCATION SELECTION
  // ------------------------------------

  const handleMapClick = (location) => {
    // First click = pickup
    if (!pickup) {
      setPickup(location);
      setDestination(null);
      return;
    }

    // Second click = destination
    if (!destination) {
      setDestination(location);
      return;
    }

    // Third click starts a new selection
    setPickup(location);
    setDestination(null);
  };

  const handleReset = () => {
    setPickup(null);
    setDestination(null);
  };

  // ------------------------------------
  // DISTANCE & FARE
  // ------------------------------------

 let distance = null;
let fare = null;

if (pickup && destination) {

  distance =
    routeDistance !== null
      ? routeDistance
      : calculateDistance(
          pickup,
          destination
        );

  const baseFare = 10;
  const perKm = 5;

  fare = baseFare + distance * perKm;
}

  // ------------------------------------
  // REQUEST RIDE
  // ------------------------------------

  const handleRequestRide = async () => {
    const user = JSON.parse(
      localStorage.getItem("campusrideUser")
    );

    if (!user) {
      setRideMessage("Please login first.");
      return;
    }

    if (!pickup || !destination) {
      setRideMessage(
        "Please select pickup and destination."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:5001/api/rides",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            pickupName:
             selectedPickup?.name ||
            `Map Pickup (${pickup[0].toFixed(5)}, ${pickup[1].toFixed(5)})`,
            pickupLat: pickup[0],
            pickupLng: pickup[1],
            destinationName:
             selectedDestination?.name ||
            `Map Destination (${destination[0].toFixed(5)}, ${destination[1].toFixed(5)})`,
            destinationLat: destination[0],
            destinationLng: destination[1],

            distance: Number(
              distance.toFixed(2)
 ),
            fare: Math.ceil(fare),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setRideMessage(
          data.message || "Ride request failed."
        );
        return;
      }

     setRideMessage(
  `✅ Ride #${data.ride.id} requested successfully!`
    );

// Immediately show the newly created ride
     setActiveRide(data.ride);

// Refresh the latest ride information
     fetchActiveRide();

    } catch (error) {
      console.error(error);
      setRideMessage(
        "Server connection failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------
  // UI
  // ------------------------------------

  return (
    <div className="campus-map-container">

      {/* Instructions */}
      <div className="map-instructions">

        {!pickup && (
          <p>
            📍{" "}
            <strong>
              Select your pickup location
            </strong>
          </p>
        )}

        {pickup && !destination && (
          <p>
            🏁{" "}
            <strong>
              Now select your destination
            </strong>
          </p>
        )}

        {pickup && destination && (
          <p>
            ✅{" "}
            <strong>
              Pickup and destination selected
            </strong>
          </p>
        )}

      </div>

      {/* -------------------------------- */}
      {/* LIVE RIDER STATUS */}
      {/* -------------------------------- */}

      {activeRide && (
        <div
          style={{
            marginBottom: "12px",
            padding: "12px 15px",
            borderRadius: "10px",
            background: "#f5f7fa",
            border: "1px solid #ddd",
          }}
        >

          <strong>
            🏍️ Your Ride #{activeRide.id}
          </strong>

         <div style={{ marginTop: "8px" }}>
          {(() => {
          const statusInfo = getRideStatus(activeRide.status);

          return (
          <strong>
          {statusInfo.icon} {statusInfo.text}
          </strong>
           );
           })()}
         </div>

          {activeRide.status === "REQUESTED" ? (
          <div style={{ marginTop: "5px" }}>
            🔎 Searching for an available rider...
          </div>
            ) : riderLocation ? (
          <div style={{ marginTop: "5px" }}>
            🟢 Rider location is updating live
          </div>
            ) : (
          <div style={{ marginTop: "5px" }}>
            🟡 Waiting for rider location...
          </div>
          )}

        </div>
      )}

      {/* Map */}
      <MapContainer
        center={campusCenter}
        zoom={15}
        style={{
          height: "450px",
          width: "100%",
          borderRadius: "12px",
        }}
      >

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationSelector
          onSelect={handleMapClick}
        />

       <MapAutoFit
        pickup={mapPickup}
        destination={mapDestination}
        riderLocation={riderLocation}
       />
        {/* -------------------------------- */}
        {/* PICKUP MARKER */}
        {/* -------------------------------- */}

      {mapPickup && (
       <Marker
         position={mapPickup}
         icon={pickupIcon}
        >
    <Popup>
      <div>
        <strong>📍 Pickup Location</strong>
        <br />
        <span>
          {selectedPickup?.name || "Selected pickup point"}
        </span>
        <br />
        <small>
         {mapPickup[0].toFixed(5)}, {mapPickup[1].toFixed(5)}
        </small>
      </div>
    </Popup>
  </Marker>
)}

        {/* -------------------------------- */}
        {/* DESTINATION MARKER */}
        {/* -------------------------------- */}

      {mapDestination && (
    <Marker
      position={mapDestination}
      icon={destinationIcon}
    >
    <Popup>
      <div>
        <strong>🏁 Destination</strong>
        <br />
        <span>
          {selectedDestination?.name || "Selected destination"}
        </span>
        <br />
        <small>
          {mapDestination[0].toFixed(5)},{" "}
          {mapDestination[1].toFixed(5)}
        </small>
      </div>
    </Popup>
  </Marker>
)}

        {/* -------------------------------- */}
        {/* RIDER LIVE LOCATION */}
        {/* -------------------------------- */}

        {riderLocation && (
          <SmoothRiderMarker
           position={riderLocation}
           icon={riderIcon}
            />
           )}

        {/* -------------------------------- */}
        {/* ROUTE LINE */}
        {/* -------------------------------- */}

        {pickup &&
        destination &&
        routeCoordinates.length > 0 && (
    <Polyline
      positions={routeCoordinates}
      pathOptions={{
        color: "#2196f3",
        weight: 6,
        opacity: 0.85,
      }}
    />
    )}

       {/* Rider route */}

{riderLocation &&
  activeRide &&
  activeRide.status !== "ONGOING" &&
  riderRouteCoordinates.length > 0 && (
    <Polyline
      positions={riderRouteCoordinates}
      pathOptions={{
        color: "#2196f3",
        weight: 5,
        opacity: 0.85,
        dashArray: "8, 10",
      }}
    />
)}

{/* Ongoing ride route */}

{riderLocation &&
  activeRide?.status === "ONGOING" &&
  riderRouteCoordinates.length > 0 && (
    <Polyline
      positions={riderRouteCoordinates}
      pathOptions={{
        color: "#22c55e",
        weight: 6,
        opacity: 0.85,
      }}
    />
)}
     
     </MapContainer>
    
     {activeRide && riderLocation && (
  <div
    style={{
      marginBottom: "15px",
      padding: "18px",
      borderRadius: "14px",
      background: "white",
      boxShadow: "0 4px 15px rgba(0,0,0,0.12)",
      border: "1px solid #e5e7eb",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: "20px",
          }}
        >
         {activeRide.status === "ONGOING"
    ? "🚕 Your ride is in progress"
    : "🏍️ Your rider is on the way"}
        </h3>

        <p
          style={{
            margin: "6px 0 0",
            color: "#555",
          }}
        >
           {activeRide.status === "ONGOING"
    ? "🟢 Rider is taking you to your destination"
    : "🟢 Live location updating"}
        </p>
      </div>

      {activeRide.rider_mobile && (
        <a
          href={`tel:${activeRide.rider_mobile}`}
          style={{
            textDecoration: "none",
          }}
        >
          <button
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            📞 Call
          </button>
        </a>
      )}
    </div>

    <hr />

    <div
      style={{
        display: "grid",
        gap: "8px",
      }}
    >
     <div>
  👤 Rider:{" "}
  <strong>
    {activeRide.rider_name || "CampusRide Rider"}
  </strong>
</div>

<div>
  🛵 Vehicle Type:{" "}
  <strong>
    {activeRide.vehicle_type || "BIKE"}
  </strong>
</div>

<div>
  🔢 Vehicle No:{" "}
  <strong>
    {activeRide.vehicle_number || "Not available"}
  </strong>
</div>

<div>
  📱 Mobile:{" "}
  <strong>
    {activeRide.rider_mobile || "Not available"}
  </strong>
</div>

     {activeRide.status !== "ONGOING" &&
  displayRiderDistance !== null && (
    <div>
      📏 Distance to pickup:{" "}
      <strong>
        {displayRiderDistance.toFixed(2)} km
      </strong>
    </div>
)}

{activeRide.status !== "ONGOING" &&
  displayRiderEta !== null && (
    <div>
      ⏱️ Approx. ETA:{" "}
      <strong>
        {Math.max(1, Math.ceil(displayRiderEta))} min
      </strong>
    </div>
)}
    </div>
  </div>
  )}
      
      {/* -------------------------------- */}
{/* RIDE COMPLETED */}
{/* -------------------------------- */}

{completedRide && (
  <div
    style={{
      marginBottom: "15px",
      padding: "22px",
      borderRadius: "14px",
      background: "#ecfdf5",
      border: "1px solid #86efac",
      textAlign: "center",
      boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
    }}
  >

    <h2
      style={{
        marginTop: 0,
        marginBottom: "10px",
      }}
    >
      ✅ Ride Completed
    </h2>

    <p
      style={{
        fontSize: "17px",
        fontWeight: "600",
        marginBottom: "15px",
      }}
    >
      Thank you for riding with CampusRide! 🚕
    </p>

    <div
      style={{
        display: "grid",
        gap: "8px",
        fontSize: "15px",
      }}
    >

      <div>
        🚕 Ride:{" "}
        <strong>
          #{completedRide.id}
        </strong>
      </div>

      <div>
        💰 Fare:{" "}
        <strong>
          ₹{Number(completedRide.estimated_fare).toFixed(2)}
        </strong>
      </div>

    </div>

    <button
      onClick={() => setCompletedRide(null)}
      style={{
        marginTop: "15px",
        padding: "10px 18px",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      View My Rides
    </button>

  </div>
)}

      {/* -------------------------------- */}
      {/* RIDE INFORMATION */}
      {/* -------------------------------- */}

      {pickup && destination && !activeRide && (
       <div className="ride-summary">

          <h3>
            🚕 Ride Details
          </h3>

          <div className="ride-detail">
  <span>📍 Pickup</span>

  <strong>
    {selectedPickup?.name || (
      <>
        {pickup[0].toFixed(5)}, {pickup[1].toFixed(5)}
      </>
    )}
  </strong>
</div>

         <div className="ride-detail">
  <span>🏁 Destination</span>

  <strong>
    {selectedDestination?.name || (
      <>
        {destination[0].toFixed(5)}, {destination[1].toFixed(5)}
      </>
    )}
  </strong>
</div>

         <div className="ride-detail">
  <span>
    📏 Road Distance
  </span>

  <strong>
    {routeLoading
      ? "Calculating..."
      : `${distance.toFixed(2)} km`}
  </strong>
</div>

{routeDuration !== null && (
  <div className="ride-detail">
    <span>
      ⏱️ Estimated Time
    </span>

    <strong>
      {Math.max(
        1,
        Math.ceil(routeDuration)
      )} min
    </strong>
  </div>
)}

          <div className="ride-detail fare">
            <span>
              💰 Estimated Fare
            </span>

            <strong>
              ₹{Math.ceil(fare)}
            </strong>
          </div>

          <button
            className="request-ride-button"
            onClick={handleRequestRide}
            disabled={
                       loading ||
                  routeLoading ||
                !routeDistance
                  }
          >
            {loading
            ? "⏳ Requesting..."
            : routeLoading
            ? "🗺️ Calculating route..."
            : "Request Ride 🏍️"}
          </button>

          {rideMessage && (
            <p className="message">
              {rideMessage}
            </p>
          )}

          <button
            className="reset-button"
            onClick={handleReset}
          >
            Reset Locations
          </button>

        </div>
      )}

    </div>
  );
}

export default CampusMap;