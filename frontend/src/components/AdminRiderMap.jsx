import API_BASE_URL from "../api";
import { useEffect, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";


const campusCenter = [
  12.0198,
  79.8565
];

// ------------------------------------
// Professional Map Icons
// ------------------------------------

const riderIcon = L.divIcon({
  className: "4Mi Rides-rider-icon",
  html: `
    <div style="
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: white;
      border: 3px solid #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 23px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.25);
    ">
      🏍️
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -21],
});


const selectedRiderIcon = L.divIcon({
  className: "4Mi Rides-selected-rider-icon",
  html: `
    <div style="
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #eff6ff;
      border: 4px solid #1d4ed8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 27px;
      box-shadow: 0 0 0 5px rgba(37,99,235,0.18),
                  0 4px 14px rgba(0,0,0,0.3);
    ">
      🏍️
    </div>
  `,
  iconSize: [50, 50],
  iconAnchor: [25, 25],
  popupAnchor: [0, -25],
});


const pickupIcon = L.divIcon({
  className: "4Mi Rides-pickup-icon",
  html: `
    <div style="
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #dc2626;
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    ">
      📍
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -19],
});


const destinationIcon = L.divIcon({
  className: "4Mi Rides-destination-icon",
  html: `
    <div style="
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: white;
      border: 3px solid #dc2626;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    ">
      🏁
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -19],
});

// ------------------------------------
// Move map when a ride is selected
// ------------------------------------

function SelectedRideMapController({ selectedRide, assignedRider }) {

  const map = useMap();

  useEffect(() => {

    if (!selectedRide) {
      return;
    }

    const points = [
      [
        Number(selectedRide.pickup_lat),
        Number(selectedRide.pickup_lng)
      ],
      [
        Number(selectedRide.destination_lat),
        Number(selectedRide.destination_lng)
      ]
    ];


    // Include rider location if available
    if (
      assignedRider &&
      assignedRider.current_lat !== null &&
      assignedRider.current_lng !== null
    ) {

      points.push([
        Number(assignedRider.current_lat),
        Number(assignedRider.current_lng)
      ]);

    }


    map.fitBounds(points, {
      padding: [50, 50],
      maxZoom: 16,
    });

  }, [selectedRide, assignedRider, map]);


  return null;
}



// ------------------------------------
// Admin Rider Map
// ------------------------------------

function AdminRiderMap({ selectedRide }) {

  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);


  // ------------------------------------
  // Fetch riders
  // ------------------------------------

  const fetchRiders = async () => {

    try {

      const response = await fetch(
        `${API_BASE_URL}/api/admin/riders`
      );

      const data = await response.json();

      if (response.ok) {

        setRiders(data.riders);

      }

    } catch (error) {

      console.error(
        "Admin rider map error:",
        error
      );

    } finally {

      setLoading(false);

    }

  };


  // ------------------------------------
  // Refresh rider locations
  // ------------------------------------

  useEffect(() => {

    fetchRiders();

    const interval = setInterval(
      fetchRiders,
      5000
    );

    return () => {
      clearInterval(interval);
    };

  }, []);


  // ------------------------------------
  // Find assigned rider
  // ------------------------------------

  const assignedRider = selectedRide?.rider_id
    ? riders.find(
        (rider) =>
          Number(rider.id) ===
          Number(selectedRide.rider_id)
      )
    : null;


  // ------------------------------------
  // Selected ride coordinates
  // ------------------------------------

  const pickupPosition = selectedRide
    ? [
        Number(selectedRide.pickup_lat),
        Number(selectedRide.pickup_lng)
      ]
    : null;


  const destinationPosition = selectedRide
    ? [
        Number(selectedRide.destination_lat),
        Number(selectedRide.destination_lng)
      ]
    : null;


  return (

    <div className="admin-rider-map">

      <div className="admin-rider-map-header">

        <div>

          <h2>
            📍 Live Rider Locations
          </h2>

          <p>
            Monitor riders and selected ride locations
          </p>

        </div>

        <button
          onClick={fetchRiders}
        >
          🔄 Refresh
        </button>

      </div>


      {/* -------------------------------- */}
      {/* Selected Ride Information */}
      {/* -------------------------------- */}

      {selectedRide ? (

        <div
          style={{
            padding: "15px",
            marginBottom: "12px",
            borderRadius: "12px",
            background: "#f5f7fb",
            border: "1px solid #ddd",
          }}
        >

          <h3>
            🏍️ Ride #{selectedRide.id}
          </h3>

          <p>
            📍 <strong>Pickup:</strong>{" "}
            {selectedRide.pickup_name ||
              `${Number(selectedRide.pickup_lat).toFixed(5)}, ${Number(selectedRide.pickup_lng).toFixed(5)}`
            }
          </p>

          <p>
            🏁 <strong>Destination:</strong>{" "}
            {selectedRide.destination_name ||
              `${Number(selectedRide.destination_lat).toFixed(5)}, ${Number(selectedRide.destination_lng).toFixed(5)}`
            }
          </p>

          <p>
            📊 <strong>Status:</strong>{" "}
            {selectedRide.status}
          </p>

          {assignedRider && (

            <p>
              🏍️ <strong>Rider:</strong>{" "}
              {assignedRider.full_name}
            </p>

          )}

        </div>

      ) : (

        <div
          style={{
            padding: "15px",
            marginBottom: "12px",
            borderRadius: "12px",
            background: "#f5f7fb",
            border: "1px solid #ddd",
          }}
        >

          <strong>
            🗺️ Select a ride below to view its pickup and destination on the map.
          </strong>

        </div>

      )}


      {loading ? (

        <p>
          Loading rider locations...
        </p>

      ) : (

        <MapContainer
          center={campusCenter}
          zoom={15}
          style={{
            height: "500px",
            width: "100%",
            borderRadius: "15px",
          }}
        >

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />


          {/* -------------------------------- */}
          {/* Map Controller */}
          {/* -------------------------------- */}

          <SelectedRideMapController
            selectedRide={selectedRide}
            assignedRider={assignedRider}
          />


          {/* -------------------------------- */}
          {/* ALL RIDER MARKERS */}
          {/* -------------------------------- */}

          {riders.map((rider) => {

            if (
              rider.current_lat === null ||
              rider.current_lng === null
            ) {
              return null;
            }


            const position = [
              Number(rider.current_lat),
              Number(rider.current_lng)
            ];


            return (

             <Marker
              key={rider.id}
              position={position}
              icon={
              assignedRider &&
              Number(assignedRider.id) === Number(rider.id)
              ? selectedRiderIcon
              : riderIcon
              }
             >

                <Popup>

                  <div>

                    <h3>
                      🏍️ {rider.full_name}
                    </h3>

                    <p>
                      <strong>
                        Rider:
                      </strong>{" "}
                      #{rider.id}
                    </p>

                    <p>
                      <strong>
                        Vehicle:
                      </strong>{" "}
                      {rider.vehicle_type}
                    </p>

                    <p>
                      <strong>
                        Number:
                      </strong>{" "}
                      {rider.vehicle_number}
                    </p>

                    <p>

                      <strong>
                        Status:
                      </strong>{" "}

                      {rider.is_available ? (
                        <span>
                          🟢 AVAILABLE
                        </span>
                      ) : (
                        <span>
                          🔴 BUSY
                        </span>
                      )}

                    </p>

                    <p>
                      <strong>
                        Location:
                      </strong>
                      <br />

                      {Number(
                        rider.current_lat
                      ).toFixed(6)}
                      ,{" "}

                      {Number(
                        rider.current_lng
                      ).toFixed(6)}

                    </p>

                  </div>

                </Popup>

              </Marker>

            );

          })}


          {/* -------------------------------- */}
          {/* SELECTED RIDE PICKUP */}
          {/* -------------------------------- */}

          {pickupPosition && (

           <Marker
            position={pickupPosition}
            icon={pickupIcon}
           >

              <Popup>

                <div>

                  <h3>
                    📍 Pickup Location
                  </h3>

                  <p>
                    <strong>
                      {selectedRide.pickup_name ||
                        "Pickup location"
                      }
                    </strong>
                  </p>

                  <p>
                    Ride #{selectedRide.id}
                  </p>

                  <p>
                    {Number(
                      selectedRide.pickup_lat
                    ).toFixed(6)}
                    ,{" "}

                    {Number(
                      selectedRide.pickup_lng
                    ).toFixed(6)}
                  </p>

                </div>

              </Popup>

            </Marker>

          )}


          {/* -------------------------------- */}
          {/* SELECTED RIDE DESTINATION */}
          {/* -------------------------------- */}

          {destinationPosition && (

           <Marker
            position={destinationPosition}
            icon={destinationIcon}
           >

              <Popup>

                <div>

                  <h3>
                    🏁 Destination
                  </h3>

                  <p>
                    <strong>
                      {selectedRide.destination_name ||
                        "Destination"
                      }
                    </strong>
                  </p>

                  <p>
                    Ride #{selectedRide.id}
                  </p>

                  <p>
                    {Number(
                      selectedRide.destination_lat
                    ).toFixed(6)}
                    ,{" "}

                    {Number(
                      selectedRide.destination_lng
                    ).toFixed(6)}

                  </p>

                </div>

              </Popup>

            </Marker>

          )}


          {/* -------------------------------- */}
          {/* ROUTE LINE */}
          {/* -------------------------------- */}

          {pickupPosition &&
           destinationPosition && (

           <Polyline
             positions={[
             pickupPosition,
             destinationPosition
             ]}
             pathOptions={{
             color: "#2563eb",
             weight: 5,
             opacity: 0.75,
             dashArray: "10, 8",
             }}
           />

          )}

        </MapContainer>

      )}

 {/* -------------------------------- */}
{/* MAP LEGEND */}
{/* -------------------------------- */}

<div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: "18px",
    alignItems: "center",
    marginTop: "12px",
    padding: "12px 16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    fontSize: "14px",
  }}
>

  <div>
    🏍️ <strong>Rider</strong>
  </div>

  <div>
    📍 <strong>Pickup</strong>
  </div>

  <div>
    🏁 <strong>Destination</strong>
  </div>

  <div>
    🔵 <strong>Selected Ride</strong>
  </div>

  <div>
    🟢 <strong>Available</strong>
  </div>

  <div>
    🔴 <strong>Busy</strong>
  </div>

</div>

    </div>

  );

}

export default AdminRiderMap;