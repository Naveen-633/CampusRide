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
  if (!position || !markerRef.current) return;

  let animationFrame;
  let cancelled = false;

  const start = previousPosition.current || position;
  const end = position;
  const startTime = performance.now();
  const duration = 1200;

  const animate = (currentTime) => {
    if (cancelled || !markerRef.current) return;

    const progress = Math.min(
      (currentTime - startTime) / duration,
      1
    );

    const eased =
      progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const lat = start[0] + (end[0] - start[0]) * eased;
    const lng = start[1] + (end[1] - start[1]) * eased;

    markerRef.current.setLatLng([lat, lng]);

    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    }
  };

  animationFrame = requestAnimationFrame(animate);
  previousPosition.current = position;

  return () => {
    cancelled = true;
    cancelAnimationFrame(animationFrame);
  };
}, [position]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
    >
      <Popup>
        🏍️ <strong>Captain Live Location</strong>
      </Popup>
    </Marker>
  );
}

function getRideStatus(status) {
  switch (status) {
    case "REQUESTED":
      return {
        icon: "🔎",
        text: "Finding a Captain",
      };

    case "DRIVER_ASSIGNED":
      return {
        icon: "🏍️",
        text: "Captain assigned",
      };

    case "RIDER_ACCEPTED":
      return {
        icon: "✅",
        text: "Captain accepted your ride",
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

  const [fareQuote, setFareQuote] = useState(null);
const [fareQuoteLoading, setFareQuoteLoading] = useState(false);
const [fareQuoteError, setFareQuoteError] = useState("");

const [passengerCount, setPassengerCount] = useState(1);

const [manualPickup, setManualPickup] = useState(false);
const [manualDestination, setManualDestination] = useState(false);

  const [riderRouteCoordinates, setRiderRouteCoordinates] = useState([]);
  const [riderRouteDistance, setRiderRouteDistance] = useState(null);
  const [riderRouteDuration, setRiderRouteDuration] = useState(null);
  const [riderRouteLoading, setRiderRouteLoading] = useState(false);

  const [notificationEnabled, setNotificationEnabled] =
  useState(false);

  const previousRideStatus = useRef({
  rideId: null,
  status: null,
   });

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
  const [showBookingForm, setShowBookingForm] = useState(true);

  const previousActiveRideId = useRef(null);
  const lastCompletedRideId = useRef(null);
  const activeRideRequestId = useRef(0);

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


  // ------------------------------------
// STUDENT NOTIFICATION SOUND
// ------------------------------------

const playStudentNotificationSound = () => {
  try {

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext = new AudioContext();

    const now = audioContext.currentTime;

    // First tone
    const oscillator1 =
      audioContext.createOscillator();

    const gain1 =
      audioContext.createGain();

    oscillator1.connect(gain1);
    gain1.connect(audioContext.destination);

    oscillator1.type = "sine";

    oscillator1.frequency.setValueAtTime(
      660,
      now
    );

    gain1.gain.setValueAtTime(
      0.0001,
      now
    );

    gain1.gain.exponentialRampToValueAtTime(
      0.35,
      now + 0.02
    );

    gain1.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.22
    );

    oscillator1.start(now);
    oscillator1.stop(now + 0.23);


    // Second tone
    const oscillator2 =
      audioContext.createOscillator();

    const gain2 =
      audioContext.createGain();

    oscillator2.connect(gain2);
    gain2.connect(audioContext.destination);

    oscillator2.type = "sine";

    oscillator2.frequency.setValueAtTime(
      880,
      now + 0.12
    );

    gain2.gain.setValueAtTime(
      0.0001,
      now + 0.12
    );

    gain2.gain.exponentialRampToValueAtTime(
      0.35,
      now + 0.14
    );

    gain2.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.42
    );

    oscillator2.start(now + 0.12);
    oscillator2.stop(now + 0.43);


    setTimeout(() => {
      audioContext.close();
    }, 600);

  } catch (error) {

    console.error(
      "Passenger notification sound error:",
      error
    );

  }
};

const showStudentRideAcceptedNotification = (ride) => {

  playStudentNotificationSound();

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {

    new Notification(
      "🏍️ Ride Accepted",
      {
        body:
          `Your captain has accepted Ride #${ride.id}.`,
      }
    );

  }

};

  // Fetch student's latest rides
 const fetchActiveRide = async () => {
  if (!user?.id) {
    return;
  }

  const requestId = ++activeRideRequestId.current;

  try {
    const response = await fetch(
      `http://localhost:5001/api/rides/user/${user.id}`
    );

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    // Ignore an older response if a newer request
    // has already started.
   if (requestId !== activeRideRequestId.current) {
   return;
   }

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
}

// ------------------------------------
// ACTIVE RIDE EXISTS
// ------------------------------------

if (ride) {

  if (
  previousRideStatus.current.rideId === ride.id &&
  previousRideStatus.current.status === "DRIVER_ASSIGNED" &&
  ride.status === "RIDER_ACCEPTED"
) {
  showStudentRideAcceptedNotification(ride);
}

previousRideStatus.current = {
  rideId: ride.id,
  status: ride.status,
};
  setActiveRide(ride);

  previousActiveRideId.current = ride.id;

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

// Check whether the ride we were tracking was cancelled.
const previousRide = rides.find(
  (r) => r.id === previousActiveRideId.current
);

if (previousRide?.status === "CANCELLED") {
  // Remove the cancelled ride's booking details.
  setPickup(null);
setDestination(null);

setManualPickup(false);
setManualDestination(false);

setFareQuote(null);
setFareQuoteError("");
setRideMessage("");
  setRouteDistance(null);
  setRouteDuration(null);
  setCompletedRide(null);

  previousActiveRideId.current = null;
  return;
}

// ------------------------------------
// CHECK FOR NEWLY COMPLETED RIDE
// ------------------------------------

if (latestCompletedRide) {
  const latestCompletedId =
    latestCompletedRide.id;

  if (
  lastCompletedRideId.current !== latestCompletedId
) {
  setCompletedRide(latestCompletedRide);
  setShowBookingForm(false);

  lastCompletedRideId.current = latestCompletedId;
  setRideMessage("");
}
}



  } catch (error) {

    console.error(
      "Error fetching captain location:",
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
        throw new Error("captain route request failed.");
      }

      const data = await response.json();

      if (
        data.code !== "Ok" ||
        !data.routes ||
        data.routes.length === 0
      ) {
        throw new Error("No captain road route found.");
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
        "captain OSRM routing error:",
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
 // ------------------------------------
// SAFE ACTIVE RIDE POLLING
// ------------------------------------

useEffect(() => {
  if (!user?.id) {
    return;
  }

  let stopped = false;
  let timer = null;

  const pollActiveRide = async () => {
    if (stopped) {
      return;
    }

    await fetchActiveRide();

    if (stopped) {
      return;
    }

    // Start the next request only AFTER
    // the previous request has finished.
    timer = setTimeout(() => {
      pollActiveRide();
    }, 3000);
  };

  // Fetch immediately
  pollActiveRide();

  return () => {
    stopped = true;

    if (timer) {
      clearTimeout(timer);
    }
  };
}, []);

  // ------------------------------------
  // MAP LOCATION SELECTION
  // ------------------------------------

 const handleMapClick = (location) => {
  // First click: manually select pickup.
  if (!pickup || (pickup && destination)) {
    setManualPickup(true);
    setManualDestination(false);
    setPickup(location);
    setDestination(null);
    setFareQuote(null);
    setFareQuoteError("");
    return;
  }

  // Second click: manually select destination.
  setManualDestination(true);
  setDestination(location);
  setFareQuote(null);
  setFareQuoteError("");
};

 // ------------------------------------
// DISTANCE & FARE QUOTE
// ------------------------------------

const distance =
  pickup && destination
    ? routeDistance !== null
      ? routeDistance
      : calculateDistance(pickup, destination)
    : null;

const fare = fareQuote?.fare ?? null;

useEffect(() => {
  // The quote API requires saved location IDs.
 const pickupId = manualPickup ? null : selectedPickup?.id;
const destinationId = manualDestination
  ? null
  : selectedDestination?.id;

  if (
    !pickupId ||
    !destinationId ||
    String(pickupId) === String(destinationId) ||
    !pickup ||
    !destination
  ) {
    setFareQuote(null);
    setFareQuoteError("");
    setFareQuoteLoading(false);
    return;
  }

  let cancelled = false;

  const fetchFareQuote = async () => {
    setFareQuote(null);
    setFareQuoteError("");
    setFareQuoteLoading(true);

    try {
      const params = new URLSearchParams({
        pickup_location_id: String(pickupId),
        destination_location_id: String(destinationId),
        passenger_count: String(passengerCount),
      });

      const response = await fetch(
        `http://localhost:5001/api/fares/quote?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to get fare quote."
        );
      }

      // A missing configured fare is not a booking error.
// Keep the quote response so the UI can show "To be discussed".
if (!cancelled) {
  setFareQuote(data);
  setFareQuoteError("");
}
    } catch (error) {
      if (!cancelled) {
        console.error("Fare quote error:", error);
        setFareQuote(null);
        setFareQuoteError(error.message);
      }
    } finally {
      if (!cancelled) {
        setFareQuoteLoading(false);
      }
    }
  };

  fetchFareQuote();

  return () => {
    cancelled = true;
  };
}, [
  selectedPickup?.id,
  selectedDestination?.id,
  pickup,
  destination,
    manualPickup,
  manualDestination,
    passengerCount,
]);

  // ------------------------------------
  // REQUEST RIDE
  // ------------------------------------

  const handleRequestRide = async () => {

  // Prevent accidental booking after ride completion
  if (completedRide) {
    setRideMessage(
      "Your previous ride is completed. Click 'Book Another Ride' to start a new booking."
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

    if (!pickup || !destination) {
      setRideMessage(
        "Please select pickup and destination."
      );
      return;
    }

   if (
  !pickup ||
  !destination ||
  !Number.isFinite(Number(distance)) ||
  Number(distance) <= 0
) {
  setRideMessage(
    "Please select valid pickup and destination locations and wait for the route calculation."
  );
  return;
}

const hasConfiguredFare =
  fareQuote?.fare_available === true &&
  fareQuote?.fare != null &&
  Number.isFinite(Number(fareQuote.fare)) &&
  Number(fareQuote.fare) > 0;

const fareToSend = hasConfiguredFare
  ? Number(fareQuote.fare)
  : 0;

const fareStatusToSend = hasConfiguredFare
  ? "QUOTED"
  : "TO_BE_DISCUSSED";


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

          distance: Number(distance.toFixed(2)),
fare: fareToSend,
fareStatus: fareStatusToSend,

passengerCount: Number(passengerCount),

pickupLocationId: fareStatusToSend === "QUOTED"
  ? Number(selectedPickup.id)
  : null,

destinationLocationId: fareStatusToSend === "QUOTED"
  ? Number(selectedDestination.id)
  : null,
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

  const handleReset = () => {
  setPickup(null);
  setDestination(null);
  setManualPickup(false);
  setManualDestination(false);
  setFareQuote(null);
  setFareQuoteError("");
  setFareQuoteLoading(false);
  setRouteCoordinates([]);
  setRouteDistance(null);
  setRouteDuration(null);
  setRideMessage("");
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
{/* STUDENT NOTIFICATIONS */}
{/* -------------------------------- */}

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

      playStudentNotificationSound();

      alert(
        "🔔 notifications enabled!"
      );

    }

  }}
>
  {notificationEnabled
    ? "🔔 Notifications ON"
    : "🔕 Enable Notifications"}
</button>

      {/* -------------------------------- */}
      {/* LIVE RIDER STATUS */}
      {/* -------------------------------- */}

      {activeRide && (
  <div className="active-ride-status-card"
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


          {activeRide.status === "RIDER_ACCEPTED" &&
            activeRide.start_pin && (
              <div className="ride-pin-card">
                <strong>🔐 Your Ride Verification PIN</strong>
                <div className="ride-pin-number">
                  {activeRide.start_pin}
                </div>
                <p>
                  Share this code with your captain to start the ride.
                </p>
              </div>
            )}


          {activeRide.status === "REQUESTED" ? (
          <div style={{ marginTop: "5px" }}>
            🔎 Searching for an available captain...
          </div>
            ) : riderLocation ? (
          <div style={{ marginTop: "5px" }}>
            🟢 Captain location is updating live
          </div>
            ) : (
          <div style={{ marginTop: "5px" }}>
            🟡 Waiting for captain location...
          </div>
          )}

        </div>
      )}

      {/* Map */}
     <MapContainer
  center={campusCenter}
  zoom={15}
  className="campusride-map"
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
  <div className="live-rider-card"
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
    ? "🏍️ Your ride is in progress"
    : "🏍️ Your captain is on the way"}
        </h3>

        <p
          style={{
            margin: "6px 0 0",
            color: "#555",
          }}
        >
           {activeRide.status === "ONGOING"
    ? "🟢 Captain is taking you to your destination"
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
  👤 Captain:{" "}
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
      padding: "25px",
      borderRadius: "16px",
      background: "#ecfdf5",
      border: "1px solid #86efac",
      textAlign: "center",
      boxShadow: "0 5px 18px rgba(0,0,0,0.10)",
    }}
  >

    <div
      style={{
        fontSize: "42px",
        marginBottom: "8px",
      }}
    >
      🎉
    </div>

    <h2
      style={{
        margin: "0 0 10px 0",
        color: "#166534",
      }}
    >
      Ride Completed
    </h2>

    <p
      style={{
        fontSize: "17px",
        fontWeight: "600",
        marginBottom: "18px",
      }}
    >
      Thank you for riding with 4Mi Rides! 🏍️
    </p>

    <div
      style={{
        display: "grid",
        gap: "10px",
        fontSize: "16px",
        marginBottom: "18px",
      }}
    >

      <div>
        🏍️ Ride:{" "}
        <strong>
          #{completedRide.id}
        </strong>
      </div>

      <div>
        📍 Pickup:{" "}
        <strong>
          {completedRide.pickup_name ||
            "Pickup location"}
        </strong>
      </div>

      <div>
        🏁 Destination:{" "}
        <strong>
          {completedRide.destination_name ||
            "Destination"}
        </strong>
      </div>

      <div>
  📏 Distance:{" "}
  <strong>
    {Number(completedRide.distance_km).toFixed(2)} km
  </strong>
</div>

<div>
  💰 Fare:{" REFER FARE CHART "}
  <strong>
    ₹{Number(completedRide.estimated_fare).toFixed(2)}
  </strong>
</div>

    </div>

    <button
    onClick={() => {
  setCompletedRide(null);
  setShowBookingForm(false);
  setRideMessage("");
}}
      style={{
        padding: "11px 20px",
        border: "none",
        borderRadius: "9px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      📋 View My Rides
    </button>

    <button
  onClick={() => {
  setCompletedRide(null);
  setActiveRide(null);
  setRiderLocation(null);
  setRideMessage("");

  handleReset();

  setManualPickup(false);
setManualDestination(false);

  setShowBookingForm(true);
}}
  style={{
    marginTop: "12px",
    marginLeft: "10px",
    padding: "10px 18px",
    border: "none",
    borderRadius: "8px",
    background: "#ff6b35",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  }}
>
  🏍️ Book Another Ride
</button>

  </div>
)}

{!showBookingForm && !completedRide && !activeRide && (
  <button
    onClick={() => {
      handleReset();
      setRideMessage("");
      setShowBookingForm(true);
    }}
    style={{
      margin: "12px 0",
      padding: "12px 18px",
      border: "none",
      borderRadius: "8px",
      background: "#ff6b35",
      color: "white",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    🏍️ Book Another Ride
  </button>
)}

      {/* -------------------------------- */}
      {/* RIDE INFORMATION */}
      {/* -------------------------------- */}

     {showBookingForm &&
  pickup &&
  destination &&
  !activeRide &&
  !completedRide && (
    <div className="ride-summary">
          <h3>
           🏍️  Ride Details
          </h3>

  <div className="ride-detail">
  <label htmlFor="passenger-count">
    👥 Number of Persons
  </label>

  <select
    id="passenger-count"
    value={passengerCount}
    onChange={(event) => {
      setPassengerCount(Number(event.target.value));
      setFareQuote(null);
      setFareQuoteError("");
    }}
    style={{
  width: "150px",
  minWidth: "150px",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  backgroundColor: "#fff",
  color: "#1f2937",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer",
}}
  >
    <option value={1}>1 Person</option>
    <option value={2}>2 Persons</option>
  </select>
</div>

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
  <span>💰 Estimated Fare</span>

  <strong>
    {fareQuoteLoading
      ? "Calculating..."
      : fareQuote?.fare_available === true &&
        fareQuote?.fare != null &&
        Number(fareQuote.fare) > 0
      ? `₹${Number(fareQuote.fare).toFixed(2)}`
      : "Refer Fare Chart"}
  </strong>
</div>

{!fareQuoteLoading &&
  fareQuote?.fare_available !== true && (
    <p className="message">
      Fare based on the fare chart.
    </p>
  )}

{fareQuote?.fare_available === true && (
  <p>
    <small>Fare status: QUOTED</small>
  </p>
)}

{!manualPickup &&
  !manualDestination &&
  fareQuoteError && (
    <p className="message" role="alert">
      {fareQuoteError}
    </p>
  )}

{(manualPickup || manualDestination) && pickup && destination && (
  <p>
    <small>Fare status: To be discussed with captain</small>
  </p>
)}

{fareQuoteError && (
  <p className="message" role="alert">
    {fareQuoteError}
  </p>
)}

{fareQuote && (
  <p>
    <small>
      Fare status: {fareQuote.fare_status}
    </small>
  </p>
)}

          <button
            className="request-ride-button"
            onClick={handleRequestRide}
         disabled={
  loading ||
  routeLoading ||
  fareQuoteLoading ||
  !pickup ||
  !destination ||
  !Number.isFinite(Number(distance)) ||
  Number(distance) <= 0
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

          <div className="fake-booking-disclaimer">
             <div className="disclaimer-heading">
    <span className="disclaimer-icon">🧡</span>
    <h4>A Small Request from Our Team</h4>
  </div>
  <p>
    Every ride takes someone’s time, effort, and fuel.
    So, we kindly request you to book only genuine rides
    and avoid{" "}
    <span className="fake-booking-warning">
      fake bookings
    </span>.
  </p>
  </div>

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