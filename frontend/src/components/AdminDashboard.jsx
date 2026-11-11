import { useEffect, useState, useRef } from "react";
import AdminRiderMap from "./AdminRiderMap";

function AdminDashboard() {

  // ------------------------------------
  // State
  // ------------------------------------

  const [rides, setRides] = useState([]);
  const [riders, setRiders] = useState([]);
  const [totalStudents, setTotalStudents] = useState(null);

  // ------------------------------------
// 4Mi DYNAMIC FARE MANAGEMENT
// ------------------------------------

const [fareRoutes, setFareRoutes] = useState([]);
const [fareLocations, setFareLocations] = useState([]);

// 4Mi: Campus location and category management
const [locationCategories, setLocationCategories] = useState([]);

const [newCategoryName, setNewCategoryName] = useState("");


const [editingCategoryId, setEditingCategoryId] = useState(null);
const [editingCategoryName, setEditingCategoryName] = useState("");


const [locationForm, setLocationForm] = useState({
  category_id: "",
  name: "",
  latitude: "",
  longitude: "",
});

const [locationSaving, setLocationSaving] = useState(false);
const [categorySaving, setCategorySaving] = useState(false);
const [locationMessage, setLocationMessage] = useState("");

const [editingLocationId, setEditingLocationId] = useState(null);

const [fareForm, setFareForm] = useState({
  pickup_location_id: "",
  destination_location_id: "",
  fare_one_person: "",
  fare_two_persons: "",
});

const [fareLoading, setFareLoading] = useState(false);
const [fareSaving, setFareSaving] = useState(false);
const [fareMessage, setFareMessage] = useState("");


  const [showAddRider, setShowAddRider] = useState(false);

const [riderForm, setRiderForm] = useState({
  fullName: "",
  phone: "",
  email: "",
  password: "",
  vehicleType: "BIKE",
  vehicleNumber: "",
  licenseNumber: ""
});

const [addingRider, setAddingRider] = useState(false);
const [addRiderMessage, setAddRiderMessage] = useState("");

  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const previousRideIds = useRef(new Set());
  const isFirstRideLoad = useRef(true);

  const ridesRequestId = useRef(0);
  const ridersRequestId = useRef(0);

  const [loading, setLoading] = useState(true);
  const [ridersLoading, setRidersLoading] = useState(true);

  const [error, setError] = useState("");
  const [ridersError, setRidersError] = useState("");

  const [availableRiders, setAvailableRiders] = useState({});
  const [selectedRiders, setSelectedRiders] = useState({});
  const [assigningRide, setAssigningRide] = useState(null);

  const [selectedMapRide, setSelectedMapRide] = useState(null);
  const [selectedRider, setSelectedRider] = useState(null);

  const [expandedRideIds, setExpandedRideIds] = useState([]);

  const [rideDateFilter, setRideDateFilter] = useState("today");
const [rideStatusFilter, setRideStatusFilter] = useState("ALL");
const [showOlderRides, setShowOlderRides] = useState(false);



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
      audioContext.currentTime + 0.50
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
      " 🏍️ New 4Mi Rides Request",
      {
        body:
          `Ride #${ride.id} requested by ${ride.full_name}`,
      }
    );

  }
};



 // ------------------------------------
  // Fetch Rides
  // ------------------------------------


 const fetchRides = async () => {

    const requestId = ++ridesRequestId.current;

    try {

        setLoading(true);
        setError("");

        const response = await fetch(
            "http://localhost:5001/api/admin/rides"
        );

        const data = await response.json();

        // Ignore old response
        if (requestId !== ridesRequestId.current) {
            return;
        }

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


        // Detect NEW ride requests

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

        if (requestId === ridesRequestId.current) {

            setError(
                "Unable to connect to server."
            );

        }

    } finally {

        if (requestId === ridesRequestId.current) {
            setLoading(false);
        }

    }

};


const fetchStudentCount = async () => {
  try {
    const response = await fetch(
      "http://localhost:5001/api/admin/students/count"
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to fetch student count");
    }

    setTotalStudents(data.totalStudents);
  } catch (error) {
    console.error("Fetch student count error:", error);
  }
};


  // ------------------------------------
  // Fetch riders
  // ------------------------------------

  const fetchRiders = async () => {

    const requestId = ++ridersRequestId.current;

    try {

        setRidersLoading(true);
        setRidersError("");

        const response = await fetch(
            "http://localhost:5001/api/admin/riders"
        );

        const data = await response.json();

        // Ignore stale response
        if (requestId !== ridersRequestId.current) {
            return;
        }

        if (!response.ok) {

            setRidersError(
                data.message ||
                "Unable to load riders."
            );

            return;
        }

        setRiders(data.riders || []);

    } catch (error) {

        console.error(error);

        if (requestId === ridersRequestId.current) {

            setRidersError(
                "Unable to connect to server."
            );

        }

    } finally {

        if (requestId === ridersRequestId.current) {
            setRidersLoading(false);
        }

    }

};

// ------------------------------------
// 4Mi: LOAD FARES AND LOCATIONS
// ------------------------------------

const fetchFareManagementData = async () => {
  setFareLoading(true);
  setFareMessage("");

  try {
   const [fareResponse, locationResponse, categoryResponse] =
  await Promise.all([
    fetch("http://localhost:5001/api/admin/fare-routes"),
    fetch("http://localhost:5001/api/locations"),
    fetch("http://localhost:5001/api/admin/location-categories"),
  ]);

const fareData = await fareResponse.json();
const locationData = await locationResponse.json();
const categoryData = await categoryResponse.json();

if (!fareResponse.ok) {
  throw new Error(
    fareData.message || "Unable to load fare routes."
  );
}

if (!locationResponse.ok) {
  throw new Error(
    locationData.message || "Unable to load locations."
  );
}

if (!categoryResponse.ok) {
  throw new Error(
    categoryData.message || "Unable to load location categories."
  );
}

setFareRoutes(fareData.fare_routes || []);
setFareLocations(locationData.locations || []);
setLocationCategories(
  (categoryData.categories || []).filter(
    (category) =>
      category.is_active === true ||
      category.is_active === "true"
  )
);
  } catch (error) {
    console.error("Fare management error:", error);
    setFareMessage(error.message || "Unable to load fare data.");
  } finally {
    setFareLoading(false);
  }
};

// 4Mi: Create a new location category
const handleAddLocationCategory = async (event) => {
  event.preventDefault();
  setCategorySaving(true);
  setLocationMessage("");

  try {
    const response = await fetch(
      "http://localhost:5001/api/admin/location-categories",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to create category."
      );
    }

    setNewCategoryName("");
    setLocationMessage("✅ Category added successfully.");

    await fetchFareManagementData();
  } catch (error) {
    setLocationMessage(error.message);
  } finally {
    setCategorySaving(false);
  }
};


const handleStartEditCategory = (category) => {
  setEditingCategoryId(category.id);
  setEditingCategoryName(category.name);
  setLocationMessage("");
};

const handleSaveCategoryEdit = async (categoryId) => {
  const name = editingCategoryName.trim();

  if (!name) {
    setLocationMessage("Please enter a category name.");
    return;
  }

  setCategorySaving(true);
  setLocationMessage("");

  try {
    const response = await fetch(
      `http://localhost:5001/api/admin/location-categories/${categoryId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to rename category."
      );
    }

    setEditingCategoryId(null);
    setEditingCategoryName("");
    setLocationMessage("Category renamed successfully.");

    await fetchFareManagementData();
  } catch (error) {
    setLocationMessage(error.message);
  } finally {
    setCategorySaving(false);
  }
};

const handleCancelCategoryEdit = () => {
  setEditingCategoryId(null);
  setEditingCategoryName("");
  setLocationMessage("");
};


const handleRemoveLocationCategory = async (category) => {
    const confirmed = window.confirm(
        `Remove "${category.name}" and deactivate its campus locations and fare routes?`
    );

    if (!confirmed) return;

    setLocationMessage("");

    try {
        const response = await fetch(
            `http://localhost:5001/api/admin/location-categories/${category.id}`,
            {
                method: "DELETE",
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to remove category."
            );
        }

        // Clear the form if it uses a location from this category.
        setLocationForm((previous) => ({
            ...previous,
            category_id: "",
        }));

        setLocationMessage(`✅ ${data.message}`);

        // Refresh categories, locations and fare routes.
        await fetchFareManagementData();
    } catch (error) {
        console.error("Remove category error:", error);
        setLocationMessage(error.message);
    }
};


const handleEditCampusLocation = (location) => {
  const matchingCategory = locationCategories.find(
    (category) =>
      String(category.id) === String(location.category_id) ||
      category.name === location.category_name
  );

  setEditingLocationId(location.id);

  setLocationForm({
    category_id: String(
      location.category_id ?? matchingCategory?.id ?? ""
    ),
    name: location.name || "",
    latitude: String(location.latitude ?? ""),
    longitude: String(location.longitude ?? ""),
  });

  setLocationMessage(`Editing location: ${location.name}`);

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};


// 4Mi: Add a campus location with coordinates
const handleAddCampusLocation = async (event) => {
  event.preventDefault();
  setLocationSaving(true);
  setLocationMessage("");

  try {
    const isEditing = editingLocationId !== null;

const response = await fetch(
  isEditing
    ? `http://localhost:5001/api/admin/locations/${editingLocationId}`
    : "http://localhost:5001/api/admin/locations",
  {
    method: isEditing ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category_id: Number(locationForm.category_id),
      name: locationForm.name.trim(),
      latitude: Number(locationForm.latitude),
      longitude: Number(locationForm.longitude),
    }),
  }
);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to add campus location."
      );
    }

    setLocationForm({
      category_id: "",
      name: "",
      latitude: "",
      longitude: "",
    });
    setEditingLocationId(null);

   setLocationMessage(
  isEditing
    ? "✅ Location updated successfully."
    : "✅ Campus location added successfully."
);

    // Refresh locations so the fare form can use the new location.
    await fetchFareManagementData();
  } catch (error) {
    setLocationMessage(error.message);
  } finally {
    setLocationSaving(false);
  }
};


// Load fare-management data when the admin dashboard opens.
useEffect(() => {
  fetchFareManagementData();
}, []);


// ------------------------------------
// 4Mi: SAVE A FARE ROUTE
// ------------------------------------


const handleFareSubmit = async (event) => {
  event.preventDefault();
  setFareSaving(true);
  setFareMessage("");

  try {
    const pickupId = Number(fareForm.pickup_location_id);
    const destinationId = Number(fareForm.destination_location_id);
    const fareOne = Number(fareForm.fare_one_person);
    const fareTwo = Number(fareForm.fare_two_persons);

    if (!pickupId || !destinationId) {
      throw new Error("Select both pickup and destination.");
    }

    if (pickupId === destinationId) {
      throw new Error("Pickup and destination must be different.");
    }

    if (
      !Number.isFinite(fareOne) || fareOne <= 0 ||
      !Number.isFinite(fareTwo) || fareTwo <= 0
    ) {
      throw new Error("Enter valid fares for both 1 person and 2 persons.");
    }

    const saveFare = async (passengerCount, fare) => {
      const response = await fetch(
        "http://localhost:5001/api/admin/fare-routes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup_location_id: pickupId,
            destination_location_id: destinationId,
            passenger_count: passengerCount,
            fare,
            is_active: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          `Unable to save fare for ${passengerCount} person(s).`
        );
      }

      return data;
    };

    await saveFare(1, fareOne);
    await saveFare(2, fareTwo);

    setFareMessage("✅ Route saved with fares for 1 person and 2 persons.");

    setFareForm({
      pickup_location_id: "",
      destination_location_id: "",
      fare_one_person: "",
      fare_two_persons: "",
    });

    await fetchFareManagementData();
  } catch (error) {
    console.error("Save fare error:", error);
    setFareMessage(error.message || "Unable to save fares.");
    await fetchFareManagementData();
  } finally {
    setFareSaving(false);
  }
};



// ------------------------------------
// 4Mi: EDIT AN EXISTING FARE
// ------------------------------------

const handleEditFare = (route) => {
  setFareForm({
    id: route.id,
    pickup_location_id: String(route.pickup_location_id),
    destination_location_id: String(route.destination_location_id),
    passenger_count: String(route.passenger_count),
    fare: String(route.fare),
  });

  setFareMessage("Edit the fare and select Save Fare.");
};


// ------------------------------------
// 4Mi: DEACTIVATE A FARE ROUTE
// ------------------------------------

const handleDeactivateFare = async (routeId) => {
  const confirmed = window.confirm(
    "Deactivate this fare route? Existing ride history will be preserved."
  );

  if (!confirmed) return;

  setFareMessage("");

  try {
    const response = await fetch(
      `http://localhost:5001/api/admin/fare-routes/${routeId}/deactivate`,
      { method: "PATCH" }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to deactivate fare.");
    }

    setFareMessage(data.message || "Fare route deactivated.");
    await fetchFareManagementData();
  } catch (error) {
    console.error("Deactivate fare error:", error);
    setFareMessage(error.message || "Unable to deactivate fare.");
  }
};



const groupedFareRoutes = Object.values(
  fareRoutes.reduce((groups, route) => {
    const key =
      `${route.pickup_location_id}-${route.destination_location_id}`;

    if (!groups[key]) {
      groups[key] = {
        pickup_location_id: route.pickup_location_id,
        destination_location_id: route.destination_location_id,
        pickup_name: route.pickup_name,
        destination_name: route.destination_name,
        onePersonRoute: null,
        twoPersonsRoute: null,
      };
    }

    if (Number(route.passenger_count) === 1) {
      groups[key].onePersonRoute = route;
    } else if (Number(route.passenger_count) === 2) {
      groups[key].twoPersonsRoute = route;
    }

    return groups;
  }, {})
);

const handleEditFareGroup = (group) => {
  setFareForm({
    pickup_location_id: String(group.pickup_location_id),
    destination_location_id: String(group.destination_location_id),
    fare_one_person: group.onePersonRoute
      ? String(group.onePersonRoute.fare)
      : "",
    fare_two_persons: group.twoPersonsRoute
      ? String(group.twoPersonsRoute.fare)
      : "",
  });

  setFareMessage("Edit both fares, then select Save Fare.");
};

const handleDeactivateFareGroup = async (group) => {
  const routeIds = [
    group.onePersonRoute?.id,
    group.twoPersonsRoute?.id,
  ].filter(Boolean);

  if (!routeIds.length) return;

  if (!window.confirm("Deactivate this route and its configured fares?")) {
    return;
  }

  try {
    for (const routeId of routeIds) {
      const response = await fetch(
        `http://localhost:5001/api/admin/fare-routes/${routeId}/deactivate`,
        { method: "PATCH" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to deactivate route.");
      }
    }

    setFareMessage("Route deactivated.");
    await fetchFareManagementData();
  } catch (error) {
    setFareMessage(error.message || "Unable to deactivate route.");
    await fetchFareManagementData();
  }
};


const handleRemoveFareGroup = async (group) => {
  const routeIds = [
    group.onePersonRoute?.id,
    group.twoPersonsRoute?.id,
  ].filter(Boolean);

  if (routeIds.length === 0) {
    setFareMessage("No fare records found for this route.");
    return;
  }

  const confirmed = window.confirm(
    `Permanently remove the fare configuration for ` +
    `${group.pickup_name} → ${group.destination_name}?\n\n` +
    `Existing ride records will not be intentionally modified.`
  );

  if (!confirmed) return;

  setFareMessage("");

  try {
    for (const routeId of routeIds) {
      const response = await fetch(
        `http://localhost:5001/api/admin/fare-routes/${routeId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to remove fare route."
        );
      }
    }

    setFareMessage("🗑️ Fare configuration removed successfully.");
    await fetchFareManagementData();
  } catch (error) {
    console.error("Remove fare route error:", error);
    setFareMessage(
      error.message || "Unable to remove the fare configuration."
    );

    // Refresh in case one fare was removed before another failed.
    await fetchFareManagementData();
  }
};




  // ------------------------------------
  // Initial loading
  // ------------------------------------

  useEffect(() => {

    let stopped = false;
    let timer = null;

    const pollAdminDashboard = async () => {

        if (stopped) {
            return;
        }

        // Fetch one after another
        await fetchRides();

        if (stopped) {
            return;
        }

        await fetchRiders();
        await fetchStudentCount();

        if (stopped) {
            return;
        }

        timer = setTimeout(() => {
            pollAdminDashboard();
        }, 3000);

    };


    pollAdminDashboard();


    return () => {

        stopped = true;

        if (timer) {
            clearTimeout(timer);
        }

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

    await fetchRides();

    await fetchRiders();

};

  // ------------------------------------
// Add New Rider
// ------------------------------------

const handleRiderInputChange = (event) => {

  const { name, value } = event.target;

  setRiderForm((prev) => ({
    ...prev,
    [name]: value
  }));

};


const addNewRider = async (event) => {

  event.preventDefault();

  setAddRiderMessage("");

  const adminUser = JSON.parse(
    localStorage.getItem("campusrideUser")
  );

  if (!adminUser) {
    setAddRiderMessage(
      "Admin session not found."
    );
    return;
  }

  // Required fields
  if (
    !riderForm.fullName ||
    !riderForm.phone ||
    !riderForm.password ||
    !riderForm.vehicleType ||
    !riderForm.vehicleNumber ||
    !riderForm.licenseNumber
  ) {

    setAddRiderMessage(
      "Please fill in all required fields."
    );

    return;
  }

  // Phone validation
  const phoneRegex = /^[0-9]{10}$/;

  if (!phoneRegex.test(riderForm.phone)) {

    setAddRiderMessage(
      "Please enter a valid 10-digit mobile number."
    );

    return;
  }

  // Password validation
  if (riderForm.password.length < 8) {

    setAddRiderMessage(
      "Password must contain at least 8 characters."
    );

    return;
  }

  try {

    setAddingRider(true);

    const response = await fetch(
      "http://localhost:5001/api/admin/riders",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          adminUserId: adminUser.id,

          fullName: riderForm.fullName,
          phone: riderForm.phone,
          email: riderForm.email,

          password: riderForm.password,

          vehicleType: riderForm.vehicleType,
          vehicleNumber: riderForm.vehicleNumber,
          licenseNumber: riderForm.licenseNumber
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      setAddRiderMessage(
        data.message ||
        "Unable to create rider."
      );

      return;
    }

    setAddRiderMessage(
      "✅ Rider created successfully!"
    );

    // Reset form
    setRiderForm({
      fullName: "",
      phone: "",
      email: "",
      password: "",
      vehicleType: "BIKE",
      vehicleNumber: "",
      licenseNumber: ""
    });

    // Refresh rider list
    await fetchRiders();

    // Close form after short delay
    setTimeout(() => {

      setShowAddRider(false);
      setAddRiderMessage("");

    }, 1200);

  } catch (error) {

    console.error(
      "Add rider error:",
      error
    );

    setAddRiderMessage(
      "Unable to connect to 4Mi Rides server."
    );

  } finally {

    setAddingRider(false);

  }

};



const updateRiderStatus = async (
    riderId,
    status
) => {

    let reason = "";

    if (
        status === "SUSPENDED" ||
        status === "DETAINED" ||
        status === "REMOVED"
    ) {

        reason = window.prompt(
            `Enter reason for ${status.toLowerCase()} rider:`
        );

        if (!reason || !reason.trim()) {
            return;
        }

    }


    const actionText = {
        ACTIVE: "activate",
        SUSPENDED: "suspend",
        DETAINED: "detain",
        REMOVED: "remove"
    };


    const confirmed = window.confirm(
        `Are you sure you want to ${actionText[status]} this rider?`
    );


    if (!confirmed) {
        return;
    }


    try {

        const response = await fetch(
            `http://localhost:5001/api/admin/riders/${riderId}/status`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    status,
                    reason
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Unable to update rider status."
            );

            return;
        }


        alert(
            data.message ||
            "Rider status updated."
        );


        await fetchRiders();


    } catch (error) {

        console.error(
            "Rider status error:",
            error
        );

        alert(
            "Unable to connect to server."
        );

    }

};


const filteredRides = [...rides]
  .filter((ride) => {
    // Status filter
    if (
      rideStatusFilter !== "ALL" &&
      ride.status !== rideStatusFilter
    ) {
      return false;
    }

    // Date filter uses the browser's local date
    const rideDate = new Date(ride.created_at);

    if (rideDateFilter === "all") {return true;}

    if (Number.isNaN(rideDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfRideDate = new Date(rideDate);
    startOfRideDate.setHours(0, 0, 0, 0);

    if (
      rideDateFilter === "today" &&
      startOfRideDate.getTime() !== today.getTime()
    ) {
      return false;
    }

    if (
      rideDateFilter === "yesterday" &&
      startOfRideDate.getTime() !== yesterday.getTime()
    ) {
      return false;
    }

    if (rideDateFilter === "last7") {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      if (rideDate < sevenDaysAgo) return false;
    }

    return true;
  })
  // Newest rides first
  .sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

const activeRideStatuses = [
  "REQUESTED",
  "DRIVER_ASSIGNED",
  "RIDER_ACCEPTED",
  "RIDE_STARTED",
  "IN_PROGRESS",
];


  return (

    <div className="admin-dashboard">


      {/* ================================= */}
      {/* HEADER */}
      {/* ================================= */}

      <div className="admin-header">

        <h1>
          🏍️  4Mi Rides Admin
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

          <span>🏍️</span>

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


<div className="admin-stat-card">
  <span>🎓</span>

  <h2>
    {totalStudents === null ? "—" : totalStudents}
  </h2>

  <p>Total Registered Students</p>
</div>


      </div>

      


{/* ================================= */}
{/* 4Mi CAMPUS LOCATION MANAGEMENT */}
{/* ================================= */}

<div
  className="admin-riders"
  style={{ marginBottom: "24px" }}
>
  <div className="admin-riders-header">
    <div>
      <h2>📍 Campus Location Management</h2>
      <p>
        Create categories and add campus locations with GPS coordinates.
      </p>
    </div>

    <button
      type="button"
      onClick={fetchFareManagementData}
      disabled={fareLoading}
    >
      🔄 Refresh Locations
    </button>
  </div>

  {/* Create category */}
  <form
    onSubmit={handleAddLocationCategory}
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "12px",
      alignItems: "end",
      padding: "20px",
    }}
  >
    <div style={{ flex: "1 1 240px" }}>
      <label>New Location Category</label>

      <input
        type="text"
        required
        maxLength={100}
        value={newCategoryName}
        onChange={(event) =>
          setNewCategoryName(event.target.value)
        }
        placeholder="e.g. Boys Hostel, Girls Hostel, University"
        style={{
          width: "100%",
          padding: "10px",
          marginTop: "6px",
          boxSizing: "border-box",
        }}
      />
    </div>

    <button type="submit" disabled={categorySaving}>
      {categorySaving ? "Adding..." : "➕ Add Category"}
    </button>
  </form>


{/* Edit existing location categories */}
<div style={{ padding: "0 20px 20px" }}>
  <h3>Existing Categories</h3>

  {locationCategories.map((category) => (
    <div
      key={category.id}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {editingCategoryId === category.id ? (
        <>
          <input
            type="text"
            value={editingCategoryName}
            maxLength={100}
            onChange={(event) =>
              setEditingCategoryName(event.target.value)
            }
            aria-label="Edit category name"
            style={{
              flex: "1 1 220px",
              padding: "9px",
            }}
          />

          <button
            type="button"
            disabled={categorySaving}
            onClick={() =>
              handleSaveCategoryEdit(category.id)
            }
          >
            {categorySaving ? "Saving..." : "💾 Save"}
          </button>

          <button
            type="button"
            onClick={handleCancelCategoryEdit}
            disabled={categorySaving}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <span style={{ flex: "1 1 220px" }}>
            {category.name}
          </span>

          <button
            type="button"
            onClick={() => handleStartEditCategory(category)}
          >
            ✏️ Edit
          </button>


<button
    type="button"
    onClick={() => handleRemoveLocationCategory(category)}
    style={{
        marginLeft: "8px",
        backgroundColor: "#b91c1c",
        color: "white",
        border: "none",
        padding: "6px 10px",
        borderRadius: "4px",
        cursor: "pointer",
    }}
>
    🗑️ Remove
</button>

        </>
      )}
    </div>
  ))}
</div>


  <hr />

  {/* Add location */}
  <form
    onSubmit={handleAddCampusLocation}
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "14px",
      padding: "20px",
    }}
  >
    <div>
      <label>Category</label>

      <select
        required
        value={locationForm.category_id}
        onChange={(event) =>
          setLocationForm((previous) => ({
            ...previous,
            category_id: event.target.value,
          }))
        }
        style={{
          width: "100%",
          padding: "10px",
          marginTop: "6px",
          boxSizing: "border-box",
        }}
      >
        <option value="">Select category</option>

        {locationCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label>Location Name</label>

      <input
        required
        type="text"
        maxLength={150}
        value={locationForm.name}
        onChange={(event) =>
          setLocationForm((previous) => ({
            ...previous,
            name: event.target.value,
          }))
        }
        placeholder="e.g. Boys Hostel Block A"
        style={{
          width: "100%",
          padding: "10px",
          marginTop: "6px",
          boxSizing: "border-box",
        }}
      />
    </div>

    <div>
      <label>Latitude</label>

      <input
        required
        type="number"
        min="-90"
        max="90"
        step="any"
        value={locationForm.latitude}
        onChange={(event) =>
          setLocationForm((previous) => ({
            ...previous,
            latitude: event.target.value,
          }))
        }
        placeholder="e.g. 12.02172"
        style={{
          width: "100%",
          padding: "10px",
          marginTop: "6px",
          boxSizing: "border-box",
        }}
      />
    </div>

    <div>
      <label>Longitude</label>

      <input
        required
        type="number"
        min="-180"
        max="180"
        step="any"
        value={locationForm.longitude}
        onChange={(event) =>
          setLocationForm((previous) => ({
            ...previous,
            longitude: event.target.value,
          }))
        }
        placeholder="e.g. 79.85731"
        style={{
          width: "100%",
          padding: "10px",
          marginTop: "6px",
          boxSizing: "border-box",
        }}
      />
    </div>

    <div style={{ display: "flex", alignItems: "end" }}>
     <button type="submit" disabled={locationSaving}>
  {locationSaving
    ? "Saving..."
    : editingLocationId !== null
      ? "💾 Update Location"
      : "💾 Add Location"}
</button>

{editingLocationId !== null && (
  <button
    type="button"
    onClick={() => {
      setEditingLocationId(null);
      setLocationForm({
        category_id: "",
        name: "",
        latitude: "",
        longitude: "",
      });
      setLocationMessage("");
    }}
  >
    Cancel Edit
  </button>
)}
    </div>
  </form>

  {locationMessage && (
    <p role="status" style={{ padding: "0 20px 12px" }}>
      {locationMessage}
    </p>
  )}

  {/* Existing campus locations */}
  <div style={{ padding: "0 20px 20px", overflowX: "auto" }}>
    <h3>Campus Locations</h3>

    {fareLocations.length === 0 ? (
      <p>No active locations found.</p>
    ) : (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th style={{ padding: "10px", textAlign: "left" }}>
              Category
            </th>
            <th style={{ padding: "10px", textAlign: "left" }}>
              Location
            </th>
            <th style={{ padding: "10px", textAlign: "left" }}>
              Latitude
            </th>
            <th style={{ padding: "10px", textAlign: "left" }}>
              Longitude
            </th>
            <th style={{ padding: "10px", textAlign: "left" }}>
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {fareLocations.map((location) => (
            <tr key={location.id}>
              <td style={{ padding: "10px" }}>
                {location.category_name || "Uncategorized"}
              </td>
              <td style={{ padding: "10px" }}>
                {location.name}
              </td>
              <td style={{ padding: "10px" }}>
                {location.latitude}
              </td>
              <td style={{ padding: "10px" }}>
                {location.longitude}
              </td>
              <td style={{ padding: "10px" }}>
               <button
                 type="button"
                  onClick={() => handleEditCampusLocation(location)}
                >
                 ✏️ Edit
                </button>
                </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
</div>

{/* ================================= */}
{/* 4Mi DYNAMIC FARE MANAGEMENT */}
{/* ================================= */}

<div
  className="admin-riders"
  style={{ marginBottom: "24px" }}
>
  <div className="admin-riders-header">
    <div>
      <h2>💰 Fare Management</h2>
      <p>
        Configure campus route fares without redeploying 4Mi.
      </p>
    </div>

    <button
      type="button"
      onClick={fetchFareManagementData}
      disabled={fareLoading}
    >
      {fareLoading ? "Loading..." : "🔄 Refresh Fares"}
    </button>
  </div>

  <form
    onSubmit={handleFareSubmit}
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "14px",
      padding: "20px",
    }}
  >
    <div>
      <label>📍 Pickup Location</label>
      <select
        required
        value={fareForm.pickup_location_id}
        onChange={(event) =>
          setFareForm((previous) => ({
            ...previous,
            pickup_location_id: event.target.value,
          }))
        }
        style={{ width: "100%", padding: "10px", marginTop: "6px" }}
      >
        <option value="">Select pickup</option>
        {fareLocations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label>🏁 Destination</label>
      <select
        required
        value={fareForm.destination_location_id}
        onChange={(event) =>
          setFareForm((previous) => ({
            ...previous,
            destination_location_id: event.target.value,
          }))
        }
        style={{ width: "100%", padding: "10px", marginTop: "6px" }}
      >
        <option value="">Select destination</option>
        {fareLocations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </div>

   
<div>
  <label>₹ Fare for 1 Person</label>
  <input
    required
    type="number"
    min="0.01"
    max="100000"
    step="0.01"
    value={fareForm.fare_one_person}
    onChange={(event) =>
      setFareForm((previous) => ({
        ...previous,
        fare_one_person: event.target.value,
      }))
    }
    placeholder="Enter 1-person fare"
    style={{ width: "100%", padding: "10px", marginTop: "6px" }}
  />
</div>

<div>
  <label>₹ Fare for 2 Persons</label>
  <input
    required
    type="number"
    min="0.01"
    max="100000"
    step="0.01"
    value={fareForm.fare_two_persons}
    onChange={(event) =>
      setFareForm((previous) => ({
        ...previous,
        fare_two_persons: event.target.value,
      }))
    }
    placeholder="Enter 2-person fare"
    style={{ width: "100%", padding: "10px", marginTop: "6px" }}
  />
</div>


    <div style={{ display: "flex", alignItems: "end", gap: "8px" }}>
      <button type="submit" disabled={fareSaving}>
        {fareSaving ? "Saving..." : "💾 Save Fare"}
      </button>

      <button
        type="button"
        onClick={() => {
         setFareForm({
  pickup_location_id: "",
  destination_location_id: "",
  fare_one_person: "",
  fare_two_persons: "",
});
          setFareMessage("");
        }}
      >
        Clear
      </button>
    </div>
  </form>

  {fareMessage && (
    <p role="status" style={{ padding: "0 20px" }}>
      {fareMessage}
    </p>
  )}

  <div style={{ padding: "0 20px 20px", overflowX: "auto" }}>
    <h3>Configured Routes</h3>

    {fareLoading ? (
      <p>Loading fare routes...</p>
    ) : fareRoutes.length === 0 ? (
      <p>No fare routes found.</p>
    ) : (
      
<table style={{ width: "100%", borderCollapse: "collapse" }}>
  <thead>
    <tr>
      <th style={{ padding: "10px", textAlign: "left" }}>Pickup</th>
      <th style={{ padding: "10px", textAlign: "left" }}>Destination</th>
      <th style={{ padding: "10px", textAlign: "left" }}>1 Person</th>
      <th style={{ padding: "10px", textAlign: "left" }}>2 Persons</th>
      <th style={{ padding: "10px", textAlign: "left" }}>Status</th>
      <th style={{ padding: "10px", textAlign: "left" }}>Actions</th>
    </tr>
  </thead>

  <tbody>
    {groupedFareRoutes.map((group) => {
      const one = group.onePersonRoute;
      const two = group.twoPersonsRoute;
      const active = [one, two].some(
        (route) => route?.is_active
      );

      return (
        <tr
          key={`${group.pickup_location_id}-${group.destination_location_id}`}
        >
          <td style={{ padding: "10px" }}>{group.pickup_name}</td>
          <td style={{ padding: "10px" }}>{group.destination_name}</td>

          <td style={{ padding: "10px" }}>
            {one ? `₹${Number(one.fare).toFixed(2)}` : "Not set"}
          </td>

          <td style={{ padding: "10px" }}>
            {two ? `₹${Number(two.fare).toFixed(2)}` : "Not set"}
          </td>

          <td style={{ padding: "10px" }}>
            {active ? "🟢 Active" : "⚪ Inactive"}
          </td>

          
<td style={{ padding: "10px", whiteSpace: "nowrap" }}>
  <button
    type="button"
    onClick={() => handleEditFareGroup(group)}
  >
    ✏️ Edit
  </button>

  {active && (
    <button
      type="button"
      onClick={() => handleDeactivateFareGroup(group)}
      style={{ marginLeft: "6px" }}
    >
      Deactivate
    </button>
  )}

  <button
    type="button"
    onClick={() => handleRemoveFareGroup(group)}
    style={{
      marginLeft: "6px",
      backgroundColor: "#c62828",
      color: "#ffffff",
      border: "none",
      borderRadius: "4px",
      padding: "5px 9px",
      cursor: "pointer",
    }}
  >
    🗑️ Remove
  </button>
</td>

        </tr>
      );
    })}
  </tbody>
</table>

    )}
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

  <div className="rider-header-actions">

    <button
      className="add-rider-button"
      onClick={() => {
        setShowAddRider(!showAddRider);
        setAddRiderMessage("");
      }}
    >
      {showAddRider
        ? "✖ Close"
        : "➕ Add Rider"}
    </button>

    <button
      onClick={refreshDashboard}
    >
      🔄 Refresh
    </button>

  </div>

</div>


{showAddRider && (

  <div className="add-rider-panel">

    <div className="add-rider-panel-header">

      <div>
        <h3>
          ➕ Add New Rider
        </h3>

        <p>
          Create a rider account and vehicle profile
        </p>
      </div>

    </div>


    <form
      className="add-rider-form"
      onSubmit={addNewRider}
    >

      {/* Full Name */}

      <div className="rider-form-group">

        <label>
          👤 Full Name *
        </label>

        <input
          type="text"
          name="fullName"
          value={riderForm.fullName}
          onChange={handleRiderInputChange}
          placeholder="Enter rider name"
        />

      </div>


      {/* Mobile */}

      <div className="rider-form-group">

        <label>
          📱 Mobile Number *
        </label>

        <input
          type="tel"
          name="phone"
          value={riderForm.phone}
          onChange={handleRiderInputChange}
          placeholder="10-digit mobile number"
          maxLength="10"
        />

      </div>


      {/* Email */}

      <div className="rider-form-group">

        <label>
          📧 Email
        </label>

        <input
          type="email"
          name="email"
          value={riderForm.email}
          onChange={handleRiderInputChange}
          placeholder="rider@example.com"
        />

      </div>


      {/* Password */}

      <div className="rider-form-group">

        <label>
          🔐 Temporary Password *
        </label>

        <input
          type="password"
          name="password"
          value={riderForm.password}
          onChange={handleRiderInputChange}
          placeholder="Minimum 8 characters"
        />

      </div>


      {/* Vehicle Type */}

      <div className="rider-form-group">

        <label>
          🏍️ Vehicle Type *
        </label>

        <select
          name="vehicleType"
          value={riderForm.vehicleType}
          onChange={handleRiderInputChange}
        >

          <option value="BIKE">
            Bike
          </option>

          <option value="SCOOTER">
            Scooter
          </option>

        </select>

      </div>


      {/* Vehicle Number */}

      <div className="rider-form-group">

        <label>
          🔢 Vehicle Number *
        </label>

        <input
          type="text"
          name="vehicleNumber"
          value={riderForm.vehicleNumber}
          onChange={handleRiderInputChange}
          placeholder="PY01AB1234"
        />

      </div>


      {/* License Number */}

      <div className="rider-form-group">

        <label>
          🪪 Driving License Number *
        </label>

        <input
          type="text"
          name="licenseNumber"
          value={riderForm.licenseNumber}
          onChange={handleRiderInputChange}
          placeholder="Enter license number"
        />

      </div>


      {/* Message */}

      {addRiderMessage && (

        <div className="add-rider-message">
          {addRiderMessage}
        </div>

      )}


      {/* Submit */}

      <button
        type="submit"
        className="create-rider-button"
        disabled={addingRider}
      >

        {addingRider
          ? "Creating Rider..."
          : "🏍️ Create Rider"}

      </button>

    </form>

  </div>

)}




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



        {/* Compact Rider List */}

{!ridersLoading &&
  riders.length > 0 && (

    <div className="admin-rider-list">

      {riders.map((rider) => (

        <div
          className="admin-rider-compact"
          key={rider.id}
        >

          {/* Rider Main Row */}

          <div className="rider-compact-main">

            {/* Rider Name */}

            <div className="rider-compact-name">

              <span className="rider-icon">
                🏍️
              </span>

              <div>

                <h3>
                  {rider.full_name}
                </h3>

                <p>
                  Rider #{rider.id}
                </p>

              </div>

            </div>


            {/* Availability */}

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


          {/* Compact Rider Information */}

          <div className="rider-compact-info">

            <span>
              🛵 {rider.vehicle_type}
            </span>

            <span>
              🔢 {rider.vehicle_number}
            </span>

            {rider.current_ride_id ? (

              <span>
                🏍️ Ride #{rider.current_ride_id}
              </span>

            ) : (

              <span>
                🏍️ No active ride
              </span>

            )}

          </div>


          {/* Rider Status */}

          <div className="rider-compact-status">

            {rider.rider_status === "ACTIVE" && (
              <span className="status-active">
                🟢 ACTIVE
              </span>
            )}

            {rider.rider_status === "SUSPENDED" && (
              <span className="status-suspended">
                🟡 SUSPENDED
              </span>
            )}

            {rider.rider_status === "DETAINED" && (
              <span className="status-detained">
                🟠 DETAINED
              </span>
            )}

            {rider.rider_status === "REMOVED" && (
              <span className="status-removed">
                🔴 REMOVED
              </span>
            )}

          </div>


          {/* Rider Actions */}

          <div className="rider-compact-actions">

            <button
            className="view-rider-button"
            onClick={() => setSelectedRider(rider)}
            >
            👁️ View
            </button>

            {rider.rider_status === "ACTIVE" && (
              <>
                
                <button
                  className="suspend-rider-button"
                  onClick={() =>
                    updateRiderStatus(
                      rider.id,
                      "SUSPENDED"
                    )
                  }
                >
                  🟡 Suspend
                </button>


                <button
                  className="detain-rider-button"
                  onClick={() =>
                    updateRiderStatus(
                      rider.id,
                      "DETAINED"
                    )
                  }
                >
                  🟠 Detain
                </button>


                <button
                  className="remove-rider-button"
                  onClick={() =>
                    updateRiderStatus(
                      rider.id,
                      "REMOVED"
                    )
                  }
                >
                  🔴 Remove
                </button>

              </>
            )}


            {(rider.rider_status === "SUSPENDED" ||
              rider.rider_status === "DETAINED") && (

              <>

                <button
                  className="activate-rider-button"
                  onClick={() =>
                    updateRiderStatus(
                      rider.id,
                      "ACTIVE"
                    )
                  }
                >
                  🟢 Activate
                </button>


                <button
                  className="remove-rider-button"
                  onClick={() =>
                    updateRiderStatus(
                      rider.id,
                      "REMOVED"
                    )
                  }
                >
                  🔴 Remove
                </button>

              </>

            )}

          </div>

        </div>

      ))}

    </div>

)}
      </div>


{/* ================================= */}
{/* RIDER DETAILS MODAL */}
{/* ================================= */}

{selectedRider && (
  <div
    className="rider-modal-overlay"
    onClick={() => setSelectedRider(null)}
  >

    <div
      className="rider-modal"
      onClick={(event) => event.stopPropagation()}
    >

      {/* Modal Header */}

      <div className="rider-modal-header">

        <div>

          <h2>
            🏍️ {selectedRider.full_name}
          </h2>

          <p>
            Rider #{selectedRider.id}
          </p>

        </div>

        <button
          className="rider-modal-close"
          onClick={() => setSelectedRider(null)}
        >
          ✕
        </button>

      </div>


      {/* Availability */}

      <div className="rider-modal-availability">

        {selectedRider.is_available ? (
          <span className="rider-online">
            🟢 AVAILABLE
          </span>
        ) : (
          <span className="rider-busy">
            🔴 BUSY
          </span>
        )}

      </div>


      {/* Rider Details */}

      <div className="rider-modal-details">

        <div className="rider-detail-item">

          <strong>
            📧 Email
          </strong>

          <span>
            {selectedRider.email || "Not available"}
          </span>

        </div>


        <div className="rider-detail-item">

          <strong>
            📱 Mobile
          </strong>

          <span>
            {selectedRider.mobile || "Not available"}
          </span>

        </div>


        <div className="rider-detail-item">

          <strong>
            🛵 Vehicle
          </strong>

          <span>
            {selectedRider.vehicle_type || "Not available"}
          </span>

        </div>


        <div className="rider-detail-item">

          <strong>
            🔢 Vehicle Number
          </strong>

          <span>
            {selectedRider.vehicle_number || "Not available"}
          </span>

        </div>


        <div className="rider-detail-item">

          <strong>
            🪪 License Number
          </strong>

          <span>
            {selectedRider.license_number || "Not available"}
          </span>

        </div>


        <div className="rider-detail-item">

          <strong>
            🏍️ Current Ride
          </strong>

          <span>
            {selectedRider.current_ride_id
              ? `Ride #${selectedRider.current_ride_id}`
              : "No active ride"}
          </span>

        </div>


        <div className="rider-detail-item">

          <strong>
            🚦 Ride Status
          </strong>

          <span>
            {selectedRider.current_ride_status ||
              "No active ride"}
          </span>

        </div>


        <div className="rider-detail-item">

          <strong>
            🛡️ Rider Status
          </strong>

          <span>
            {selectedRider.rider_status || "ACTIVE"}
          </span>

        </div>

      </div>


      {/* Location */}

      <div className="rider-modal-location">

        <strong>
          📍 Current Location
        </strong>

        {selectedRider.current_lat &&
        selectedRider.current_lng ? (

          <span>
            {Number(
              selectedRider.current_lat
            ).toFixed(5)}
            ,{" "}
            {Number(
              selectedRider.current_lng
            ).toFixed(5)}
          </span>

        ) : (

          <span>
            Location not available
          </span>

        )}

      </div>


      {/* Status Reason */}

      {selectedRider.status_reason && (

        <div className="rider-modal-reason">

          <strong>
            ⚠️ Status Reason
          </strong>

          <p>
            {selectedRider.status_reason}
          </p>

        </div>

      )}


      {/* Close */}

      <div className="rider-modal-footer">

        <button
          className="rider-modal-close-button"
          onClick={() => setSelectedRider(null)}
        >
          Close
        </button>

      </div>

    </div>

  </div>
)}


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
             🏍️ Ride Requests
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

          

<div className="ride-history-toolbar">
  <div>
    <label htmlFor="ride-date-filter">Date</label>
    <select
      id="ride-date-filter"
      value={rideDateFilter}
      onChange={(e) => setRideDateFilter(e.target.value)}
    >
      <option value="today">Today</option>
      <option value="yesterday">Yesterday</option>
      <option value="last7">Last 7 days</option>
      <option value="all">All dates</option>
    </select>
  </div>

  <div>
    <label htmlFor="ride-status-filter">Status</label>
    <select
      id="ride-status-filter"
      value={rideStatusFilter}
      onChange={(e) => setRideStatusFilter(e.target.value)}
    >
      <option value="ALL">All statuses</option>
      <option value="REQUESTED">Requested</option>
      <option value="DRIVER_ASSIGNED">Driver assigned</option>
      <option value="RIDER_ACCEPTED">Rider accepted</option>
      <option value="RIDE_STARTED">Ride started</option>
      <option value="IN_PROGRESS">In progress</option>
      <option value="COMPLETED">Completed</option>
      <option value="REJECTED">Rejected</option>
      <option value="CANCELLED">Cancelled</option>
    </select>
  </div>
</div>

<p className="ride-results-count">
  Showing {filteredRides.length} rides
</p>



       <div className="admin-ride-list">
  {filteredRides.map((ride) => (

            <div
              className="admin-ride-card"
              key={ride.id}
            >


              {/* Ride Header */}

             
{/* Compact Ride Summary */}
<div className="compact-ride-header">
  <div className="compact-ride-title">
    <h3>🏍️ Ride #{ride.id}</h3>
    <span className={`admin-status status-${ride.status.toLowerCase()}`}>
      {ride.status.replaceAll("_", " ")}
    </span>
  </div>

  <div className="compact-ride-route">
    <div>
      <span>📍 Pickup</span>
      <strong>
        {ride.pickup_name ||
          `${Number(ride.pickup_lat).toFixed(5)}, ${Number(ride.pickup_lng).toFixed(5)}`}
      </strong>
    </div>

    <div>
      <span>🏁 Destination</span>
      <strong>
        {ride.destination_name ||
          `${Number(ride.destination_lat).toFixed(5)}, ${Number(ride.destination_lng).toFixed(5)}`}
      </strong>
    </div>
  </div>

  <div className="compact-ride-meta">
    <span>👤 {ride.full_name}</span>
    <span>📏 {ride.distance_km} km</span>
    <span>💰 ₹{ride.estimated_fare}</span>
    <span>
      🕒 {new Date(ride.created_at).toLocaleString()}
    </span>
  </div>

  <div className="compact-ride-toolbar">
    <button
      type="button"
      className="compact-details-button"
      onClick={() => {
        setExpandedRideIds((previous) =>
          previous.includes(ride.id)
            ? previous.filter((id) => id !== ride.id)
            : [...previous, ride.id]
        );
      }}
    >
      {expandedRideIds.includes(ride.id)
        ? "▲ Hide Details"
        : "▼ View Details"}
    </button>
  </div>
</div>

 {expandedRideIds.includes(ride.id) && (
  <div className="expanded-ride-details">



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

                  <div className="ride-detail">
  <span>👥 Number of Persons</span>
  <strong>{ride.passenger_count ?? 1}</strong>
</div>
</p>

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
)}


            </div>

          ))}

        </div>

      </div>

    </div>
  );
}

export default AdminDashboard;