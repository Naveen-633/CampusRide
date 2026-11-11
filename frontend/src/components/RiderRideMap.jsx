import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


// ------------------------------------
// Custom Icons
// ------------------------------------

const pickupIcon = L.divIcon({
  className: "campusride-pickup-icon",
  html: `
    <div style="
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 25px;
      border: 3px solid #22c55e;
      box-shadow: 0 3px 12px rgba(0,0,0,0.35);
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
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 25px;
      border: 3px solid #ef4444;
      box-shadow: 0 3px 12px rgba(0,0,0,0.35);
    ">
      🏁
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -21],
});


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
      border: 3px solid #2196f3;
      box-shadow: 0 3px 12px rgba(0,0,0,0.35);
    ">
      🏍️
    </div>
  `,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
  popupAnchor: [0, -23],
});


// ------------------------------------
// Map Controller
// ------------------------------------

function MapController({
  pickup,
  destination,
  rider,
  rideId,
}) {

  const map = useMap();

  // Prevent map from continuously re-fitting
  // every time rider GPS changes.
  const hasFitted = useRef(false);

  useEffect(() => {

    if (!pickup || !destination) {
      return;
    }

    // Reset when a new ride starts
    hasFitted.current = false;

  }, [rideId]);


  useEffect(() => {

    if (hasFitted.current) {
      return;
    }

    if (!pickup || !destination) {
      return;
    }

    const points = [
      pickup,
      destination,
    ];

    // Include rider location only for
    // the initial map fitting.
    if (rider) {
      points.push(rider);
    }

    map.fitBounds(points, {
      padding: [60, 60],
      maxZoom: 16,
    });

    hasFitted.current = true;

  }, [
    pickup,
    destination,
    rider,
    map,
    rideId,
  ]);

  return null;
}


// ------------------------------------
// Rider Ride Map
// ------------------------------------

function RiderRideMap({
  ride,
  riderLocation,
}) {

  if (!ride) {
    return null;
  }


  // ------------------------------------
  // Pickup
  // ------------------------------------

  const pickup = [
    Number(ride.pickup_lat),
    Number(ride.pickup_lng),
  ];


  // ------------------------------------
  // Destination
  // ------------------------------------

  const destination = [
    Number(ride.destination_lat),
    Number(ride.destination_lng),
  ];


  // ------------------------------------
  // Rider Current Location
  // ------------------------------------

  const rider = riderLocation
    ? [
        Number(riderLocation.latitude),
        Number(riderLocation.longitude),
      ]
    : null;

  // ------------------------------------
  // OSRM ROAD ROUTING
  // ------------------------------------

  const [riderRouteCoordinates, setRiderRouteCoordinates] =
    useState([]);

  const [riderRouteLoading, setRiderRouteLoading] =
    useState(false);

  useEffect(() => {
    if (!rider || !ride) {
      setRiderRouteCoordinates([]);
      return;
    }

    // Before ride starts:
    // Rider → Pickup
    //
    // During ride:
    // Rider → Destination
    const target =
      ride.status === "ONGOING"
        ? destination
        : pickup;

    if (!target) {
      setRiderRouteCoordinates([]);
      return;
    }

    const controller = new AbortController();

    const fetchRiderRoadRoute = async () => {
      try {
        setRiderRouteLoading(true);

        const riderLat = rider[0];
        const riderLng = rider[1];

        const targetLat = target[0];
        const targetLng = target[1];

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${riderLng},${riderLat};` +
          `${targetLng},${targetLat}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("OSRM routing request failed.");
        }

        const data = await response.json();

        if (
          data.code !== "Ok" ||
          !data.routes ||
          data.routes.length === 0
        ) {
          throw new Error("No road route found.");
        }

        const route = data.routes[0];

        const coordinates =
          route.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng]
          );

        setRiderRouteCoordinates(coordinates);

      } catch (error) {

        if (error.name === "AbortError") {
          return;
        }

        console.error(
          "Rider OSRM routing error:",
          error
        );

        // Fallback to straight line
        setRiderRouteCoordinates([
          rider,
          target,
        ]);

      } finally {
        if (!controller.signal.aborted) {
          setRiderRouteLoading(false);
        }
      }
    };

    fetchRiderRoadRoute();

    return () => {
      controller.abort();
    };

  }, [
    ride.id,
    ride.status,
    riderLocation?.latitude,
    riderLocation?.longitude,
  ]);


  return (

    <div
      className="rider-ride-map-card"
      style={{
        marginTop: "20px",
        marginBottom: "20px",
        padding: "15px",
        borderRadius: "14px",
        background: "white",
        boxShadow: "0 4px 15px rgba(0,0,0,0.10)",
      }}
    >

      {/* -------------------------------- */}
      {/* MAP HEADER */}
      {/* -------------------------------- */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >

        <h2
          style={{
            margin: 0,
            fontSize: "20px",
          }}
        >
          🗺️ Ride Map
        </h2>


        <span
          style={{
            padding: "6px 10px",
            borderRadius: "20px",
            background:
              ride.status === "ONGOING"
                ? "#dcfce7"
                : "#fef3c7",
            fontSize: "13px",
            fontWeight: "bold",
          }}
        >
         {riderRouteLoading
         ? "🗺️ CALCULATING ROUTE..."
         : ride.status === "ONGOING"
         ? "🏍️ RIDE IN PROGRESS"
         : "📍 GO TO PICKUP"}
        </span>

      </div>


      {/* -------------------------------- */}
      {/* MAP */}
      {/* -------------------------------- */}

      <MapContainer
        center={pickup}
        zoom={15}
        scrollWheelZoom={true}
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


        <MapController
          pickup={pickup}
          destination={destination}
          rider={rider}
          rideId={ride.id}
        />


        {/* -------------------------------- */}
        {/* PICKUP MARKER */}
        {/* -------------------------------- */}

        <Marker
          position={pickup}
          icon={pickupIcon}
        >

          <Popup>

            <strong>
              📍  Pickup Location
            </strong>

            <br />

            This is where the passenger is waiting.

            <br />

            <small>
              {pickup[0].toFixed(5)},{" "}
              {pickup[1].toFixed(5)}
            </small>

          </Popup>

        </Marker>


        {/* -------------------------------- */}
        {/* DESTINATION MARKER */}
        {/* -------------------------------- */}

        <Marker
          position={destination}
          icon={destinationIcon}
        >

          <Popup>

            <strong>
              🏁  Destination
            </strong>

            <br />

            Final destination.

            <br />

            <small>
              {destination[0].toFixed(5)},{" "}
              {destination[1].toFixed(5)}
            </small>

          </Popup>

        </Marker>


        {/* -------------------------------- */}
        {/* RIDER CURRENT LOCATION */}
        {/* -------------------------------- */}

        {rider && (

          <Marker
            position={rider}
            icon={riderIcon}
          >

            <Popup>

              <strong>
                🏍️ Your Current Location
              </strong>

              <br />

              Your live GPS position.

              <br />

              <small>
                {rider[0].toFixed(5)},{" "}
                {rider[1].toFixed(5)}
              </small>

            </Popup>

          </Marker>

        )}


        {/* -------------------------------- */}
        {/* ROUTE TO PICKUP */}
        {/* -------------------------------- */}

       {ride.status !== "ONGOING" &&
       rider &&
       riderRouteCoordinates.length > 0 && (

    <Polyline
      positions={riderRouteCoordinates}
      pathOptions={{
        color: "#2196f3",
        weight: 5,
        dashArray: "10, 10",
        opacity: 0.9,
      }}
    />
   )}


        {/* -------------------------------- */}
        {/* ROUTE TO DESTINATION */}
        {/* -------------------------------- */}

       {ride.status === "ONGOING" &&
       rider &&
       riderRouteCoordinates.length > 0 && (

    <Polyline
      positions={riderRouteCoordinates}
      pathOptions={{
        color: "#22c55e",
        weight: 6,
        opacity: 0.9,
      }}
    />

)}


        {/* -------------------------------- */}
        {/* PICKUP → DESTINATION REFERENCE */}
        {/* -------------------------------- */}

        {ride.status !== "ONGOING" && (

          <Polyline
            positions={[
              pickup,
              destination,
            ]}
            pathOptions={{
              color: "#999",
              weight: 3,
              dashArray: "5, 10",
              opacity: 0.5,
            }}
          />

        )}

      </MapContainer>


      {/* -------------------------------- */}
      {/* MAP LEGEND */}
      {/* -------------------------------- */}

      <div
        style={{
          display: "flex",
          gap: "15px",
          flexWrap: "wrap",
          marginTop: "12px",
          fontSize: "14px",
        }}
      >

        <span>
          📍 <strong>Pickup</strong>
        </span>

        <span>
          🏁 <strong>Destination</strong>
        </span>

        {rider && (
          <span>
            🏍️ <strong>Your Location</strong>
          </span>
        )}

      </div>


      {/* -------------------------------- */}
      {/* RIDER INSTRUCTION */}
      {/* -------------------------------- */}

      <div
        style={{
          marginTop: "12px",
          padding: "12px",
          borderRadius: "10px",
          background:
            ride.status === "ONGOING"
              ? "#ecfdf5"
              : "#eff6ff",
          fontSize: "14px",
        }}
      >

        {ride.status === "ONGOING" ? (

          <>
            🏍️ <strong>Ride in progress.</strong>
            <br />
            Follow the route toward the passenger's
            destination.
          </>

        ) : (

          <>
            📍 <strong>Go to the pickup location.</strong>
            <br />
            The green 📍 marker shows where the
            passenger is waiting.
          </>

        )}

      </div>

    </div>
  );
}

export default RiderRideMap;