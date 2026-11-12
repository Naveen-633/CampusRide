const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { randomInt } = require("crypto");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());


// ------------------------------------
// Test backend
// ------------------------------------
app.get("/", (req, res) => {
    res.json({
        message: "CampusRide backend is running!"
    });
});


// ------------------------------------
// Test PostgreSQL connection
// ------------------------------------
app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            message: "PostgreSQL connection successful!",
            databaseTime: result.rows[0].now
        });

    } catch (error) {
        console.error("Database error:", error);

        res.status(500).json({
            message: "PostgreSQL connection failed",
            error: error.message
        });
    }
});


 // ------------------------------------
 // Dynamic Locations - Student & Rider
 // ------------------------------------
app.get("/api/locations", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                l.id,
                l.category_id,
                l.name,
                l.latitude,
                l.longitude,
                lc.name AS category_name
            FROM locations l
            INNER JOIN location_categories lc
                ON lc.id = l.category_id
            WHERE l.is_active = TRUE
              AND lc.is_active = TRUE
            ORDER BY lc.name ASC, l.name ASC
        `);

        res.json({
            locations: result.rows
        });

    } catch (error) {
        console.error("Get locations error:", error);

        res.status(500).json({
            message: "Unable to load campus locations."
        });
    }
});


/* 4Mi: Get a fare quote for a configured campus route */
app.get("/api/fares/quote", async (req, res) => {
  try {
    const pickupId = Number(req.query.pickup_location_id);
    const destinationId = Number(req.query.destination_location_id);
    const passengerCount = Number(req.query.passenger_count ?? 1);

    if (
      !Number.isInteger(pickupId) ||
      !Number.isInteger(destinationId) ||
      pickupId <= 0 ||
      destinationId <= 0 ||
      pickupId === destinationId ||
      ![1, 2].includes(passengerCount)
    ) {
      return res.status(400).json({
        message: "Provide valid pickup, destination and passenger count."
      });
    }

    const result = await pool.query(
      `SELECT
         fr.id,
         fr.fare,
         fr.passenger_count,
         pickup.name AS pickup_name,
         destination.name AS destination_name
       FROM fare_routes fr
       JOIN locations pickup
         ON pickup.id = fr.pickup_location_id
       JOIN locations destination
         ON destination.id = fr.destination_location_id
       WHERE fr.pickup_location_id = $1
         AND fr.destination_location_id = $2
         AND fr.passenger_count = $3
         AND fr.is_active = TRUE
         AND pickup.is_active = TRUE
         AND destination.is_active = TRUE
       LIMIT 1`,
      [pickupId, destinationId, passengerCount]
    );

    if (result.rows.length === 0) {
      return res.json({
        fare_available: false,
        fare: null,
        fare_status: "TO_BE_DISCussed".toUpperCase(),
        message: "Fare needs to be discussed for this route."
      });
    }

    const route = result.rows[0];

    return res.json({
      fare_available: true,
      fare: Number(route.fare),
      fare_status: "QUOTED",
      pickup: {
        id: pickupId,
        name: route.pickup_name
      },
      destination: {
        id: destinationId,
        name: route.destination_name
      },
      passenger_count: route.passenger_count
    });
  } catch (error) {
    console.error("Fare quote error:", error);
    return res.status(500).json({
      message: "Unable to retrieve fare quote."
    });
  }
});


// ------------------------------------
// 4Mi: Admin - Manage Dynamic Fare Routes
// ------------------------------------

app.get("/api/admin/fare-routes", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        fr.id,
        fr.pickup_location_id,
        fr.destination_location_id,
        fr.passenger_count,
        fr.fare,
        fr.is_active,
        pickup.name AS pickup_name,
        destination.name AS destination_name
      FROM fare_routes fr
      JOIN locations pickup
        ON pickup.id = fr.pickup_location_id
      JOIN locations destination
        ON destination.id = fr.destination_location_id
      ORDER BY pickup.name, destination.name, fr.passenger_count
    `);

    res.json({ fare_routes: result.rows });
  } catch (error) {
    console.error("Get admin fare routes error:", error);
    res.status(500).json({
      message: "Unable to load fare routes."
    });
  }
});


// Create a fare route or update its existing fare
app.post("/api/admin/fare-routes", async (req, res) => {
  try {
    const pickupId = Number(req.body.pickup_location_id);
    const destinationId = Number(req.body.destination_location_id);
    const passengerCount = Number(req.body.passenger_count ?? 1);
    const fare = Number(req.body.fare);
    const isActive = req.body.is_active !== false;

    if (
      !Number.isSafeInteger(pickupId) ||
      !Number.isSafeInteger(destinationId) ||
      pickupId <= 0 ||
      destinationId <= 0 ||
      pickupId === destinationId
    ) {
      return res.status(400).json({
        message: "Choose different, valid pickup and destination locations."
      });
    }

    if (![1, 2].includes(passengerCount)) {
      return res.status(400).json({
        message: "Passenger count must be 1 or 2."
      });
    }

    if (!Number.isFinite(fare) || fare <= 0 || fare > 100000) {
      return res.status(400).json({
        message: "Enter a valid fare greater than ₹0."
      });
    }

    const locations = await pool.query(
      `SELECT id
       FROM locations
       WHERE id = ANY($1::int[])
         AND is_active = TRUE`,
      [[pickupId, destinationId]]
    );

    if (locations.rows.length !== 2) {
      return res.status(400).json({
        message: "Both locations must exist and be active."
      });
    }

    // Find an existing route for this direction and passenger count.
    const existing = await pool.query(
      `SELECT id
       FROM fare_routes
       WHERE pickup_location_id = $1
         AND destination_location_id = $2
         AND passenger_count = $3
       LIMIT 1`,
      [pickupId, destinationId, passengerCount]
    );

    let result;

    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE fare_routes
         SET fare = $1, is_active = $2
         WHERE id = $3
         RETURNING *`,
        [fare, isActive, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO fare_routes
           (pickup_location_id, destination_location_id,
            passenger_count, fare, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [pickupId, destinationId, passengerCount, fare, isActive]
      );
    }

    res.status(existing.rows.length > 0 ? 200 : 201).json({
      message: existing.rows.length > 0
        ? "Fare route updated successfully."
        : "Fare route created successfully.",
      fare_route: result.rows[0]
    });
  } catch (error) {
    console.error("Save fare route error:", error);
    res.status(500).json({
      message: "Unable to save the fare route."
    });
  }
});


// Deactivate a route without deleting its history
app.patch("/api/admin/fare-routes/:id/deactivate", async (req, res) => {
  try {
    const routeId = Number(req.params.id);

    if (!Number.isSafeInteger(routeId) || routeId <= 0) {
      return res.status(400).json({
        message: "Invalid fare route ID."
      });
    }

    const result = await pool.query(
      `UPDATE fare_routes
       SET is_active = FALSE
       WHERE id = $1
       RETURNING id`,
      [routeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Fare route not found."
      });
    }

    res.json({ message: "Fare route deactivated successfully." });
  } catch (error) {
    console.error("Deactivate fare route error:", error);
    res.status(500).json({
      message: "Unable to deactivate the fare route."
    });
  }
});


 // Permanently remove a configured fare route
 // Existing ride records are not modified.
app.delete("/api/admin/fare-routes/:id", async (req, res) => {
  try {
    const routeId = Number(req.params.id);

    if (!Number.isSafeInteger(routeId) || routeId <= 0) {
      return res.status(400).json({
        message: "Invalid fare route ID."
      });
    }

    const result = await pool.query(
      `DELETE FROM fare_routes
       WHERE id = $1
       RETURNING id`,
      [routeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Fare route not found."
      });
    }

    return res.json({
      message: "Fare route removed successfully."
    });
  } catch (error) {
    console.error("Remove fare route error:", error);

    return res.status(500).json({
      message: "Unable to remove the fare route."
    });
  }
});



 // ------------------------------------
 // Admin - Get Location Categories
 // ------------------------------------
app.get("/api/admin/location-categories", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, is_active, created_at
            FROM location_categories
            ORDER BY name ASC
        `);

        res.json({
            categories: result.rows
        });
    } catch (error) {
        console.error("Get location categories error:", error);

        res.status(500).json({
            message: "Unable to load location categories."
        });
    }
});


// ------------------------------------
// Admin - Create Location Category
// ------------------------------------

/* Admin - Rename an existing location category */
app.put("/api/admin/location-categories/:id", async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    const { name } = req.body;

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        message: "Invalid category ID.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Category name is required.",
      });
    }

    const categoryName = name.trim();

    if (categoryName.length > 100) {
      return res.status(400).json({
        message: "Category name cannot exceed 100 characters.",
      });
    }

    const result = await pool.query(
      `UPDATE location_categories
       SET name = $1
       WHERE id = $2
       RETURNING id, name, is_active, created_at`,
      [categoryName, categoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Category not found.",
      });
    }

    res.json({
      message: "Category renamed successfully.",
      category: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "A category with this name already exists.",
      });
    }

    console.error("Rename location category error:", error);

    res.status(500).json({
      message: "Unable to rename category.",
    });
  }
});



 // ------------------------------------
 // Admin - Update Location Category
 // ------------------------------------
app.put("/api/admin/location-categories/:id", async (req, res) => {
    try {
        const categoryId = Number(req.params.id);
        const { name } = req.body;

        if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({
                message: "Invalid category ID."
            });
        }

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                message: "Category name is required."
            });
        }

        const categoryName = name.trim();

        if (categoryName.length > 100) {
            return res.status(400).json({
                message: "Category name cannot exceed 100 characters."
            });
        }

        const result = await pool.query(
            `UPDATE location_categories
             SET name = $1
             WHERE id = $2
             RETURNING id, name, is_active, created_at`,
            [categoryName, categoryId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Category not found."
            });
        }

        return res.json({
            message: "Category updated successfully.",
            category: result.rows[0]
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "A category with this name already exists."
            });
        }

        console.error("Update location category error:", error);

        return res.status(500).json({
            message: "Unable to update location category."
        });
    }
});


 // ------------------------------------
 // Admin - Remove (deactivate) Location Category
 // ------------------------------------
app.delete("/api/admin/location-categories/:id", async (req, res) => {
    const categoryId = Number(req.params.id);

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({
            message: "Invalid category ID."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const categoryResult = await client.query(
            `SELECT id, name
             FROM location_categories
             WHERE id = $1 AND is_active = TRUE
             FOR UPDATE`,
            [categoryId]
        );

        if (categoryResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                message: "Category not found or already removed."
            });
        }

        // Deactivate the category without deleting its record.
        await client.query(
            `UPDATE location_categories
             SET is_active = FALSE
             WHERE id = $1`,
            [categoryId]
        );

        // Deactivate locations belonging to this category.
        await client.query(
            `UPDATE locations
             SET is_active = FALSE
             WHERE category_id = $1`,
            [categoryId]
        );

        // Disable fare routes that use those locations.
        await client.query(
            `UPDATE fare_routes
             SET is_active = FALSE
             WHERE pickup_location_id IN (
                 SELECT id FROM locations WHERE category_id = $1
             )
             OR destination_location_id IN (
                 SELECT id FROM locations WHERE category_id = $1
             )`,
            [categoryId]
        );

        await client.query("COMMIT");

        res.json({
            message: `Category "${categoryResult.rows[0].name}" removed successfully.`
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Remove location category error:", error);

        res.status(500).json({
            message: "Unable to remove the category."
        });
    } finally {
        client.release();
    }
});


 // ------------------------------------
 // Admin - Create Campus Location
 // ------------------------------------
app.post("/api/admin/locations", async (req, res) => {
    try {
        const { category_id, name, latitude, longitude } = req.body;

        const categoryId = Number(category_id);
        const lat = Number(latitude);
        const lng = Number(longitude);

        if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({
                message: "A valid category_id is required."
            });
        }

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                message: "Location name is required."
            });
        }

        if (name.trim().length > 150) {
            return res.status(400).json({
                message: "Location name cannot exceed 150 characters."
            });
        }

        if (
            latitude === undefined || latitude === null || latitude === "" ||
            longitude === undefined || longitude === null || longitude === ""
        ) {
            return res.status(400).json({
                message: "Latitude and longitude are required."
            });
        }

        if (
            !Number.isFinite(lat) ||
            lat < -90 || lat > 90 ||
            !Number.isFinite(lng) ||
            lng < -180 || lng > 180
        ) {
            return res.status(400).json({
                message: "Invalid latitude or longitude."
            });
        }

        const category = await pool.query(
            `SELECT id
             FROM location_categories
             WHERE id = $1 AND is_active = TRUE`,
            [categoryId]
        );

        if (category.rows.length === 0) {
            return res.status(400).json({
                message: "Category does not exist or is inactive."
            });
        }

        const result = await pool.query(
            `INSERT INTO locations
                (category_id, name, latitude, longitude)
             VALUES ($1, $2, $3, $4)
             RETURNING id, category_id, name, latitude,
                       longitude, is_active, created_at`,
            [categoryId, name.trim(), lat, lng]
        );

        res.status(201).json({
            message: "Campus location created successfully.",
            location: result.rows[0]
        });

    } catch (error) {
        console.error("Create campus location error:", error);

        res.status(500).json({
            message: "Unable to create campus location."
        });
    }
});


 // ------------------------------------
// Admin - Update Campus Location
// ------------------------------------
app.put("/api/admin/locations/:id", async (req, res) => {
    try {
        const locationId = Number(req.params.id);
        const { category_id, name, latitude, longitude } = req.body;

        const categoryId = Number(category_id);
        const lat = Number(latitude);
        const lng = Number(longitude);

        if (!Number.isSafeInteger(locationId) || locationId <= 0) {
            return res.status(400).json({
                message: "Invalid location ID."
            });
        }

        if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({
                message: "A valid category is required."
            });
        }

        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 150
        ) {
            return res.status(400).json({
                message: "Enter a location name (maximum 150 characters)."
            });
        }

        if (
            latitude === undefined || latitude === null || latitude === "" ||
            longitude === undefined || longitude === null || longitude === ""
        ) {
            return res.status(400).json({
                message: "Latitude and longitude are required."
            });
        }

        if (
            !Number.isFinite(lat) || lat < -90 || lat > 90 ||
            !Number.isFinite(lng) || lng < -180 || lng > 180
        ) {
            return res.status(400).json({
                message: "Enter valid latitude and longitude coordinates."
            });
        }

        const category = await pool.query(
            `SELECT id
             FROM location_categories
             WHERE id = $1 AND is_active = TRUE`,
            [categoryId]
        );

        if (category.rows.length === 0) {
            return res.status(400).json({
                message: "The selected category does not exist or is inactive."
            });
        }

        const result = await pool.query(
            `UPDATE locations
             SET category_id = $1,
                 name = $2,
                 latitude = $3,
                 longitude = $4
             WHERE id = $5
             RETURNING id, category_id, name, latitude,
                       longitude, is_active, created_at`,
            [categoryId, name.trim(), lat, lng, locationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Location not found."
            });
        }

        return res.json({
            message: "Location updated successfully.",
            location: result.rows[0]
        });

    } catch (error) {
        console.error("Update campus location error:", error);

        return res.status(500).json({
            message: "Unable to update campus location."
        });
    }
});



// ------------------------------------
// Student Registration
// ------------------------------------
app.post("/api/auth/register", async (req, res) => {

    try {

       const {
    fullName,
    phone,
    password,
    securityQuestion,
    securityAnswer
} = req.body;


        // Check required fields
       if (
    !fullName ||
    !phone ||
    !password ||
    !securityQuestion ||
    !securityAnswer
) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }


        // Validate phone
        const phoneRegex = /^[0-9]{10}$/;

        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                message: "Please enter a valid 10-digit mobile number."
            });
        }


        // Validate password
        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters."
            });
        }

        // Validate security question and answer
if (!securityQuestion.trim() || !securityAnswer.trim()) {
    return res.status(400).json({
        message: "Security question and answer are required."
    });
}


        // Check if mobile number already exists
        const existingMobile = await pool.query(
            "SELECT id FROM users WHERE mobile = $1",
            [phone]
        );

        if (existingMobile.rows.length > 0) {
            return res.status(409).json({
                message: "Mobile number is already registered."
            });
        }


        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Normalize and securely hash the security answer
const normalizedAnswer = securityAnswer.trim().toLowerCase();

const securityAnswerHash = await bcrypt.hash(normalizedAnswer, 12);


       // Insert student
const result = await pool.query(
    `INSERT INTO users
    (
        full_name,
        mobile,
        password_hash,
        security_question,
        security_answer_hash,
        role
    )
    VALUES ($1, $2, $3, $4, $5, 'STUDENT')
    RETURNING
        id,
        full_name,
        mobile,
        role,
        created_at`,
    [
        fullName,
        phone,
        passwordHash,
        securityQuestion.trim(),
        securityAnswerHash
    ]
);


        res.status(201).json({
            message: "Registration successful!",
            user: result.rows[0]
        });

    } catch (error) {

        console.error("Registration error:", error);

        res.status(500).json({
            message: "Server error during registration."
        });
    }

});

// ------------------------------------
// Forgot Password - Get Security Question
// ------------------------------------

app.post("/api/auth/forgot-password", async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                message: "Mobile number is required."
            });
        }

        const phoneRegex = /^[0-9]{10}$/;

        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                message: "Please enter a valid 10-digit mobile number."
            });
        }

        const result = await pool.query(
            `SELECT id, security_question
             FROM users
             WHERE mobile = $1
             LIMIT 1`,
            [phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "No account found with this mobile number."
            });
        }

        const user = result.rows[0];

        if (!user.security_question) {
            return res.status(400).json({
                message: "Password recovery is not available for this account."
            });
        }

        res.json({
            message: "Security question found.",
            securityQuestion: user.security_question
        });

    } catch (error) {
        console.error("Forgot password error:", error);

        res.status(500).json({
            message: "Server error while starting password recovery."
        });
    }
});

// ------------------------------------
// Reset Password
// ------------------------------------

app.post("/api/auth/reset-password", async (req, res) => {
    try {
        const {
            phone,
            securityAnswer,
            newPassword
        } = req.body;

        // Check required fields
        if (!phone || !securityAnswer || !newPassword) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        // Validate phone
        const phoneRegex = /^[0-9]{10}$/;

        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                message: "Please enter a valid 10-digit mobile number."
            });
        }

        // Validate new password
        if (newPassword.length < 8) {
            return res.status(400).json({
                message: "New password must contain at least 8 characters."
            });
        }

        // Find user
        const result = await pool.query(
            `SELECT
                id,
                security_answer_hash
             FROM users
             WHERE mobile = $1
             LIMIT 1`,
            [phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "No account found with this mobile number."
            });
        }

        const user = result.rows[0];

        // Check whether security answer exists
        if (!user.security_answer_hash) {
            return res.status(400).json({
                message: "Password recovery is not available for this account."
            });
        }

        // Normalize answer
        const normalizedAnswer = securityAnswer
            .trim()
            .toLowerCase();

        // Verify security answer
        const answerMatch = await bcrypt.compare(
            normalizedAnswer,
            user.security_answer_hash
        );

        if (!answerMatch) {
            return res.status(401).json({
                message: "Incorrect security answer."
            });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(
            newPassword,
            12
        );

        // Update password
        await pool.query(
            `UPDATE users
             SET password_hash = $1
             WHERE id = $2`,
            [
                newPasswordHash,
                user.id
            ]
        );

        res.json({
            message: "Password reset successfully!"
        });

    } catch (error) {
        console.error("Reset password error:", error);

        res.status(500).json({
            message: "Server error while resetting password."
        });
    }
});


app.post("/api/auth/login", async (req, res) => {
  try {
   const { identifier, password } = req.body;

    // Check required fields
   if (!identifier || !password) {
    return res.status(400).json({
        message: "Mobile number and password are required."
    });
}

    // Find user by email
   const result = await pool.query(
    `SELECT
        id,
        full_name,
        student_id,
        email,
        mobile,
        password_hash,
        role
     FROM users
     WHERE mobile = $1
        OR email = $1
     LIMIT 1`,
    [identifier]
);

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid Mobile number or password.",
      });
    }

    const user = result.rows[0];

    // Compare password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid Mobile number or password.",
      });
    }

    // Don't send password hash to frontend
    delete user.password_hash;

    res.json({
      message: "Login successful!",
      user: user,
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Server error during login.",
    });
  }
});

// ------------------------------------
// Request a Ride
// ------------------------------------
app.post("/api/rides", async (req, res) => {
    try {

      const {
  userId,
  pickupName,
  pickupLat,
  pickupLng,
  destinationName,
  destinationLat,
  destinationLng,
  distance,
  fareStatus = "QUOTED",
  passengerCount = 1,
  pickupLocationId,
  destinationLocationId
} = req.body;

if (
  !userId ||
  !pickupName ||
  pickupLat === undefined ||
  pickupLng === undefined ||
  !destinationName ||
  destinationLat === undefined ||
  destinationLng === undefined ||
  distance === undefined
) {
  return res.status(400).json({
    message: "All ride details are required."
  });
}

if (!["QUOTED", "TO_BE_DISCUSSED"].includes(fareStatus)) {
  return res.status(400).json({
    message: "Invalid fare status."
  });
}

const passengerCountValue = Number(passengerCount);

if (![1, 2].includes(passengerCountValue)) {
  return res.status(400).json({
    message: "Passenger count must be 1 or 2."
  });
}

let finalFare = 0;

// A configured fare must be looked up again in the database.
// Do not rely on the price sent by the browser.
if (fareStatus === "QUOTED") {
  const pickupId = Number(pickupLocationId);
  const destinationId = Number(destinationLocationId);

  if (
    !Number.isSafeInteger(pickupId) ||
    !Number.isSafeInteger(destinationId) ||
    pickupId <= 0 ||
    destinationId <= 0 ||
    pickupId === destinationId
  ) {
    return res.status(400).json({
      message: "Select valid predefined locations for a quoted fare."
    });
  }

  const fareResult = await pool.query(
    `SELECT fare
     FROM fare_routes
     WHERE pickup_location_id = $1
       AND destination_location_id = $2
       AND passenger_count = $3
       AND is_active = TRUE
     LIMIT 1`,
    [pickupId, destinationId, passengerCountValue]
  );

  if (fareResult.rows.length === 0) {
    return res.status(400).json({
      message: "This route has no configured fare. Refresh the fare quote."
    });
  }

  finalFare = Number(fareResult.rows[0].fare);
}


        // Check whether user exists
      const userResult = await pool.query(
    `SELECT
        id,
        full_name,
        student_id,
        mobile,
        role
     FROM users
     WHERE id = $1
       AND role = 'STUDENT'
     LIMIT 1`,
    [userId]
);


        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (userResult.rows.length === 0) {
    return res.status(403).json({
        message: "Only student accounts can request rides."
    });
}

// Check whether the student already has an active ride
const activeRideResult = await pool.query(
    `
    SELECT id, status
    FROM rides
    WHERE user_id = $1
      AND status IN (
        'REQUESTED',
        'DRIVER_ASSIGNED',
        'RIDER_ACCEPTED',
        'ONGOING'
      )
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId]
);

if (activeRideResult.rows.length > 0) {
    return res.status(409).json({
        message: `You already have an active ride (#${activeRideResult.rows[0].id}). Please complete or cancel it before booking another ride.`
    });
}


        // Check whether any eligible rider is available
        const availableRiderResult = await pool.query(
            `SELECT id
             FROM riders
             WHERE is_available = TRUE
               AND rider_status = 'ACTIVE'
               AND current_lat IS NOT NULL
               AND current_lng IS NOT NULL
             LIMIT 1`
        );

        if (availableRiderResult.rows.length === 0) {
            return res.status(503).json({
                message:
                    "⚠️ No riders are currently available. Please try again shortly."
            });
        }


const startPin = String(randomInt(0, 10000))
  .padStart(4, "0");

        // Save ride in PostgreSQL
const normalizedFareStatus =
  fareStatus === "TO_BE_DISCUSSED"
    ? "TO_BE_DISCUSSED"
    : "QUOTED";

const normalizedFare =
  normalizedFareStatus === "TO_BE_DISCUSSED"
    ? 0
    : finalFare;

if (
  !Number.isFinite(normalizedFare) ||
  normalizedFare < 0 ||
  (
    normalizedFareStatus === "QUOTED" &&
    normalizedFare <= 0
  )
) {
  return res.status(400).json({
    message: "Invalid fare details."
  });
}

const result = await pool.query(
  `
  INSERT INTO rides (
    user_id,
    pickup_name,
    pickup_lat,
    pickup_lng,
    destination_name,
    destination_lat,
    destination_lng,
    distance_km,
    estimated_fare,
    fare_status,
    passenger_count,
    start_pin,
    start_pin_attempts
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)
  RETURNING *
  `,
  [
    userId,
    pickupName,
    pickupLat,
    pickupLng,
    destinationName,
    destinationLat,
    destinationLng,
    distance,
    normalizedFare,
    normalizedFareStatus,
    passengerCountValue,
    startPin
  ]
);

        // Successful ride request
        res.status(201).json({
            message: "Ride requested successfully!",
            ride: result.rows[0]
        });


    } catch (error) {

        console.error("Ride request error:", error);

        res.status(500).json({
            message: "Server error while requesting ride."
        });
    }
});


// ------------------------------------
// Get Rides for a Student
// ------------------------------------

app.get("/api/rides/user/:userId", async (req, res) => {
  // Prevent cached ride-history responses
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });

  try {


        const { userId } = req.params;

        const result = await pool.query(
    `
    SELECT
        r.id,
        r.pickup_name,
        r.pickup_lat,
        r.pickup_lng,
        r.destination_name,
        r.destination_lat,
        r.destination_lng,
        r.distance_km,
        r.estimated_fare,
        r.status,
        CASE
    WHEN r.status = 'RIDER_ACCEPTED'
    THEN r.start_pin
    ELSE NULL
    END AS start_pin,
        r.created_at,

        r.rider_id,

        rider.current_lat AS rider_lat,
        rider.current_lng AS rider_lng,

        rider.vehicle_type,
        rider.vehicle_number,

        rider_user.full_name AS rider_name,
        rider_user.mobile AS rider_mobile

    FROM rides r

    LEFT JOIN riders rider
        ON r.rider_id = rider.id

    LEFT JOIN users rider_user
        ON rider.user_id = rider_user.id

    WHERE r.user_id = $1

    ORDER BY r.created_at DESC
    `,
    [userId]
     );
      
     res.json({
            rides: result.rows
        });

    } catch (error) {

        console.error("Get rides error:", error);

        res.status(500).json({
            message: "Unable to fetch ride history."
        });
    }
});

// ------------------------------------
// Admin - Get All Ride Requests
// ------------------------------------
app.get("/api/admin/rides", async (req, res) => {
    try {

        const result = await pool.query(
            `
            SELECT
                -- Ride details
                r.id,
                r.user_id,
                r.rider_id,

                r.pickup_name,
                r.pickup_lat,
                r.pickup_lng,

                r.destination_name,
                r.destination_lat,
                r.destination_lng,

                r.distance_km,
r.estimated_fare,
r.passenger_count,
r.fare_status,
r.status,
r.created_at,
                -- Student details
                student.full_name AS full_name,
                student.student_id,
                student.mobile,

                -- Rider details
                rider_user.full_name AS rider_name,
                rider_user.mobile AS rider_mobile,
                rider.vehicle_type,
                rider.vehicle_number

            FROM rides r

            -- Student
            JOIN users student
                ON r.user_id = student.id

            -- Rider
            LEFT JOIN riders rider
                ON r.rider_id = rider.id

            LEFT JOIN users rider_user
                ON rider.user_id = rider_user.id

            ORDER BY r.created_at DESC
            `
        );

        res.json({
            rides: result.rows
        });

    } catch (error) {

        console.error("Admin rides error:", error);

        res.status(500).json({
            message: "Unable to fetch ride requests."
        });
    }
});


// ===============================
// STUDENT CANCEL RIDE
// ===============================

app.patch("/api/rides/:rideId/cancel", async (req, res) => {
    const client = await pool.connect();

    try {
        const { rideId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                message: "User ID is required."
            });
        }

        await client.query("BEGIN");

        // Lock the ride row so cancellation is handled safely
        const rideResult = await client.query(
            `
            SELECT id, user_id, rider_id, status
            FROM rides
            WHERE id = $1 AND user_id = $2
            FOR UPDATE
            `,
            [rideId, userId]
        );

        if (rideResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Ride not found or you are not allowed to cancel this ride."
            });
        }

        const ride = rideResult.rows[0];

        // Student can cancel only before rider accepts
        if (
            ride.status !== "REQUESTED" &&
            ride.status !== "DRIVER_ASSIGNED"
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "This ride cannot be cancelled now."
            });
        }

        // Change ride status to CANCELLED
        const updateResult = await client.query(
            `
            UPDATE rides
            SET status = 'CANCELLED'
            WHERE id = $1
              AND user_id = $2
              AND status IN ('REQUESTED', 'DRIVER_ASSIGNED')
            RETURNING *
            `,
            [rideId, userId]
        );

        if (updateResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Ride could not be cancelled."
            });
        }

        // If a rider was already assigned,
        // make that rider available again.
        if (ride.rider_id) {
            await client.query(
                `
                UPDATE riders
                SET is_available = TRUE
                WHERE id = $1
                `,
                [ride.rider_id]
            );
        }

        await client.query("COMMIT");

        return res.json({
            message: "Ride cancelled successfully.",
            ride: updateResult.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Cancel ride error:", error);

        return res.status(500).json({
            message: "Unable to cancel ride."
        });
    } finally {
        client.release();
    }
});

// ------------------------------------
// Admin - Accept Ride
// ------------------------------------
app.patch("/api/admin/rides/:id/accept", async (req, res) => {
    try {

        const { id } = req.params;

        const result = await pool.query(
            `UPDATE rides
             SET status = 'ACCEPTED'
             WHERE id = $1
             AND status = 'REQUESTED'
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Ride not found or already processed."
            });
        }

        res.json({
            message: "Ride accepted successfully!",
            ride: result.rows[0]
        });

    } catch (error) {

        console.error("Accept ride error:", error);

        res.status(500).json({
            message: "Unable to accept ride."
        });
    }
});

// ------------------------------------
// Admin - Reject Ride
// ------------------------------------
app.patch("/api/admin/rides/:id/reject", async (req, res) => {
    try {

        const { id } = req.params;

        const result = await pool.query(
            `UPDATE rides
             SET status = 'REJECTED'
             WHERE id = $1
             AND status = 'REQUESTED'
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Ride not found or already processed."
            });
        }

        res.json({
            message: "Ride rejected successfully!",
            ride: result.rows[0]
        });

    } catch (error) {

        console.error("Reject ride error:", error);

        res.status(500).json({
            message: "Unable to reject ride."
        });
    }
});


/* ------------------------------------
   4Mi Admin - Cancel / Terminate Ride
------------------------------------ */

app.patch("/api/admin/rides/:id/cancel", async (req, res) => {
    const client = await pool.connect();

    try {
        const rideId = Number(req.params.id);

        if (!Number.isSafeInteger(rideId) || rideId <= 0) {
            return res.status(400).json({
                message: "Invalid ride ID."
            });
        }

        await client.query("BEGIN");

        // Lock the ride so concurrent updates cannot conflict.
        const rideResult = await client.query(
            `SELECT id, rider_id, status
             FROM rides
             WHERE id = $1
             FOR UPDATE`,
            [rideId]
        );

        if (rideResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Ride not found."
            });
        }

        const ride = rideResult.rows[0];

        const activeStatuses = [
            "REQUESTED",
            "DRIVER_ASSIGNED",
            "ACCEPTED",
            "RIDER_ACCEPTED",
            "ONGOING"
        ];

        if (!activeStatuses.includes(ride.status)) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message:
                    `This ride cannot be terminated because its status is ${ride.status}.`
            });
        }

        // Cancel the ride, including an ongoing ride.
        const updateResult = await client.query(
            `UPDATE rides
             SET status = 'CANCELLED'
             WHERE id = $1
             RETURNING id, status`,
            [rideId]
        );

        // Release the assigned Captain for future rides.
        if (ride.rider_id) {
            await client.query(
                `UPDATE riders
                 SET is_available = TRUE
                 WHERE id = $1`,
                [ride.rider_id]
            );
        }

        await client.query("COMMIT");

        return res.json({
            message: "Ride cancelled by admin successfully.",
            ride: updateResult.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Admin cancel ride error:", error);

        return res.status(500).json({
            message: "Unable to cancel the ride."
        });
    } finally {
        client.release();
    }
});


// ------------------------------------
// Get Online / Available Riders Count
// ------------------------------------
app.get("/api/riders/available-count", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT COUNT(*)::int AS available_count
            FROM riders
            WHERE is_available = TRUE
        `);

        res.json({
            availableCount: result.rows[0].available_count
        });
    } catch (error) {
        console.error("Get available riders count error:", error);

        res.status(500).json({
            message: "Unable to fetch online riders count."
        });
    }
});

// ------------------------------------
// Get Rider Profile
// ------------------------------------
app.get("/api/riders/:userId", async (req, res) => {
    try {

        const { userId } = req.params;

        const result = await pool.query(
            `SELECT
                r.id,
                r.user_id,
                u.full_name,
                u.email,
                u.mobile,
                u.role,
                r.vehicle_type,
                r.vehicle_number,
                r.license_number,
                r.is_available,
                r.current_lat,
                r.current_lng
             FROM riders r
             JOIN users u ON r.user_id = u.id
             WHERE r.user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Rider not found."
            });
        }

        res.json({
            rider: result.rows[0]
        });

    } catch (error) {

        console.error("Get rider error:", error);

        res.status(500).json({
            message: "Unable to fetch rider profile."
        });
    }
});



// ------------------------------------
// Rider - Update Availability
// ------------------------------------
app.patch("/api/riders/:userId/availability", async (req, res) => {
    try {

        const { userId } = req.params;
        const { isAvailable } = req.body;

        if (typeof isAvailable !== "boolean") {
            return res.status(400).json({
                message: "isAvailable must be true or false."
            });
        }

       const result = await pool.query(
    `
    UPDATE riders

    SET is_available = $1

    WHERE user_id = $2
    AND rider_status = 'ACTIVE'

    RETURNING *
    `,
    [
        isAvailable,
        userId
    ]
);

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Rider not found."
            });
        }

        res.json({
            message: "Availability updated successfully!",
            rider: result.rows[0]
        });

    } catch (error) {

        console.error("Availability error:", error);

        res.status(500).json({
            message: "Unable to update availability."
        });
    }
});

// ------------------------------------
// Update Rider Location
// ------------------------------------
app.patch("/api/riders/:userId/location", async (req, res) => {
    try {

        const { userId } = req.params;
        const { latitude, longitude } = req.body;

        // Validate location
        if (
            latitude === undefined ||
            longitude === undefined ||
            latitude === null ||
            longitude === null
        ) {
            return res.status(400).json({
                message: "Latitude and longitude are required."
            });
        }

        // Check rider exists
        const riderResult = await pool.query(
            `SELECT id, user_id, is_available
             FROM riders
             WHERE user_id = $1`,
            [userId]
        );

        if (riderResult.rows.length === 0) {
            return res.status(404).json({
                message: "Rider not found."
            });
        }

        // Update location
        const result = await pool.query(
            `UPDATE riders
             SET current_lat = $1,
                 current_lng = $2
             WHERE user_id = $3
             RETURNING id, user_id, is_available,
                       current_lat, current_lng`,
            [
                latitude,
                longitude,
                userId
            ]
        );

        res.json({
            message: "Rider location updated successfully!",
            rider: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Rider location update error:",
            error
        );

        res.status(500).json({
            message: "Unable to update rider location."
        });
    }
});

// ------------------------------------
// Assign Rider to Ride
// ------------------------------------
app.patch("/api/rides/:rideId/assign", async (req, res) => {
    try {

        const { rideId } = req.params;
        const { riderId } = req.body;

        // Check rider ID
        if (!riderId) {
            return res.status(400).json({
                message: "Rider ID is required."
            });
        }

        // Check ride
        const rideResult = await pool.query(
            `SELECT id, status, rider_id
             FROM rides
             WHERE id = $1`,
            [rideId]
        );

        if (rideResult.rows.length === 0) {
            return res.status(404).json({
                message: "Ride not found."
            });
        }

        const ride = rideResult.rows[0];

       // Ride must be assignable
        if (
             ride.status !== "REQUESTED" &&
             ride.status !== "ACCEPTED"
            ) {
           return res.status(400).json({
            message: "This ride cannot be assigned in its current status."
             });
            }

        // Check rider
       const riderResult = await pool.query(
       `SELECT
        r.id,
        r.user_id,
        r.is_available,
        r.rider_status,
        u.full_name,
        u.email,
        r.vehicle_type,
        r.vehicle_number
     FROM riders r
     JOIN users u ON r.user_id = u.id
     WHERE r.id = $1`,
    [riderId]
   );

        if (riderResult.rows.length === 0) {
            return res.status(404).json({
                message: "Rider not found."
            });
        }

        const rider = riderResult.rows[0];

        // Rider must be available
        if (!rider.is_available) {
            return res.status(400).json({
                message: "Rider is currently unavailable."
            });
        }

        if (rider.rider_status !== "ACTIVE") {

        return res.status(403).json({
        message:
            `Your rider account is currently ${rider.rider_status.toLowerCase()}. Please contact 4Mi administration.`
          });

         }

       // ------------------------------------
// Assign rider to ride
// ------------------------------------

const result = await pool.query(
    `UPDATE rides
     SET
        rider_id = $1,
        status = 'DRIVER_ASSIGNED',
        assigned_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [riderId, rideId]
);


// ------------------------------------
// Mark rider as BUSY
// ------------------------------------

await pool.query(
    `UPDATE riders
     SET is_available = false
     WHERE id = $1`,
    [riderId]
  );

        res.json({
            message: "Rider assigned successfully!",
            ride: result.rows[0],
            rider: rider
        });

    } catch (error) {

        console.error("Assign rider error:", error);

        res.status(500).json({
            message: "Unable to assign rider."
        });
    }
});

// ------------------------------------
// Get Available Riders Near Pickup
// ------------------------------------

app.get("/api/admin/rides/:rideId/available-riders", async (req, res) => {

  try {

    const { rideId } = req.params;


    // ------------------------------------
    // Get ride pickup location
    // ------------------------------------

    const rideResult = await pool.query(
      `
      SELECT
        id,
        pickup_lat,
        pickup_lng,
        status
      FROM rides
      WHERE id = $1
      `,
      [rideId]
    );


    if (rideResult.rows.length === 0) {

      return res.status(404).json({
        message: "Ride not found."
      });

    }


    const ride = rideResult.rows[0];


    // ------------------------------------
    // Find available riders
    // ------------------------------------

    const riderResult = await pool.query(
      `
      SELECT
        r.id,
        r.user_id,
        r.is_available,
        r.current_lat,
        r.current_lng,
        r.vehicle_type,
        r.vehicle_number,
        u.full_name,
        u.email,
        u.mobile
      FROM riders r
      JOIN users u
        ON r.user_id = u.id
      WHERE r.is_available = true
        AND r.current_lat IS NOT NULL
        AND r.current_lng IS NOT NULL
      `
    );


    // ------------------------------------
    // Calculate distance
    // ------------------------------------

    const riders = riderResult.rows.map((rider) => {

      const lat1 = Number(ride.pickup_lat);
      const lon1 = Number(ride.pickup_lng);

      const lat2 = Number(rider.current_lat);
      const lon2 = Number(rider.current_lng);


      const R = 6371;

      const dLat =
        (lat2 - lat1) * Math.PI / 180;

      const dLon =
        (lon2 - lon1) * Math.PI / 180;


      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;


      const c =
        2 * Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        );


      const distance =
        R * c;


      return {
        ...rider,
        distance_to_pickup: Number(
          distance.toFixed(2)
        )
      };

    });


    // ------------------------------------
    // Nearest rider first
    // ------------------------------------

    riders.sort(
      (a, b) =>
        a.distance_to_pickup -
        b.distance_to_pickup
    );


    res.json({

      ride: {
        id: ride.id,
        pickup_lat: ride.pickup_lat,
        pickup_lng: ride.pickup_lng,
        status: ride.status
      },

      riders: riders

    });


  } catch (error) {

    console.error(
      "Available riders error:",
      error
    );


    res.status(500).json({

      message:
        "Unable to find available riders."

    });

  }

});

// ------------------------------------
// Get rides assigned to a rider
// ------------------------------------
app.get("/api/riders/:riderId/rides", async (req, res) => {
    try {
        const { riderId } = req.params;

        const result = await pool.query(
            `SELECT
                r.id,
                r.user_id,
                r.rider_id,
               r.pickup_name,
r.pickup_lat,
r.pickup_lng,

r.destination_name,
r.destination_lat,
r.destination_lng,

r.distance_km,
r.estimated_fare,
r.passenger_count,
r.fare_status,
r.status,
r.created_at,

                u.full_name,
                u.student_id,
                u.mobile

            FROM rides r

            JOIN users u
                ON r.user_id = u.id

            WHERE r.rider_id = $1

            ORDER BY r.created_at DESC`,
            [riderId]
        );

        res.json({
            rides: result.rows
        });

    } catch (error) {

        console.error("Assigned rides error:", error);

        res.status(500).json({
            message: "Unable to fetch assigned rides."
        });
    }
});

// ------------------------------------
// Rider accepts assigned ride
// ------------------------------------
app.patch("/api/rides/:rideId/accept", async (req, res) => {
    try {

        const { rideId } = req.params;
        const { riderId } = req.body;

        if (!riderId) {
            return res.status(400).json({
                message: "Rider ID is required."
            });
        }

        // Check ride and assigned rider
        const rideResult = await pool.query(
            `SELECT
                id,
                rider_id,
                status
             FROM rides
             WHERE id = $1`,
            [rideId]
        );

        if (rideResult.rows.length === 0) {
            return res.status(404).json({
                message: "Ride not found."
            });
        }

        const ride = rideResult.rows[0];

        // Make sure this rider is assigned to this ride
        if (Number(ride.rider_id) !== Number(riderId)) {
            return res.status(403).json({
                message: "This ride is not assigned to you."
            });
        }

        // Ride must still be waiting for rider
        if (ride.status !== "DRIVER_ASSIGNED") {
            return res.status(400).json({
                message: "This ride cannot be accepted now."
            });
        }

        // Update ride status
       const result = await pool.query(
    `UPDATE rides
     SET status = 'RIDER_ACCEPTED'
     WHERE id = $1
       AND rider_id = $2
       AND status = 'DRIVER_ASSIGNED'
       AND assigned_at > NOW() - INTERVAL '60 seconds'
     RETURNING *`,
    [rideId, riderId]
);

        if (result.rows.length === 0) {
        return res.status(400).json({
        message: "This ride is no longer available."
         });
        }

        // Make rider unavailable
        await pool.query(
            `UPDATE riders
             SET is_available = FALSE
             WHERE id = $1`,
            [riderId]
        );

        res.json({
            message: "Ride accepted successfully!",
            ride: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Accept ride error:",
            error
        );

        res.status(500).json({
            message: "Unable to accept ride."
        });
    }
});


// ------------------------------------
// Rider rejects assigned ride
// ------------------------------------

app.patch(
  "/api/rides/:rideId/reject",
  async (req, res) => {

    try {

      const { rideId } = req.params;
      const { riderId } = req.body;

      if (!riderId) {

        return res.status(400).json({
          message:
            "Rider ID is required."
        });

      }

      // ------------------------------------
      // Check assigned ride
      // ------------------------------------

      const rideResult =
        await pool.query(
          `
          SELECT
              id,
              rider_id,
              status
          FROM rides
          WHERE id = $1
          `,
          [rideId]
        );

      if (
        rideResult.rows.length === 0
      ) {

        return res.status(404).json({
          message:
            "Ride not found."
        });

      }

      const ride =
        rideResult.rows[0];

      // Make sure this rider owns assignment
      if (
        Number(ride.rider_id) !==
        Number(riderId)
      ) {

        return res.status(403).json({
          message:
            "This ride is not assigned to you."
        });

      }

      if (
        ride.status !==
        "DRIVER_ASSIGNED"
      ) {

        return res.status(400).json({
          message:
            "Only assigned rides can be rejected."
        });

      }

      // ------------------------------------
      // Remember rejection
      // ------------------------------------

      await pool.query(
        `
        INSERT INTO ride_rider_rejections
        (
          ride_id,
          rider_id
        )
        VALUES ($1, $2)
        ON CONFLICT
        (ride_id, rider_id)
        DO NOTHING
        `,
        [rideId, riderId]
      );

      // ------------------------------------
      // Release ride
      // ------------------------------------

      const updateResult =
        await pool.query(
          `
          UPDATE rides
          SET
              rider_id = NULL,
              status = 'REQUESTED'
          WHERE id = $1
          AND rider_id = $2
          AND status = 'DRIVER_ASSIGNED'
          RETURNING *
          `,
          [rideId, riderId]
        );

      if (
        updateResult.rows.length === 0
      ) {

        return res.status(400).json({
          message:
            "Ride could not be released."
        });

      }

      // ------------------------------------
      // Make rider available
      // ------------------------------------

      await pool.query(
        `
        UPDATE riders
        SET is_available = TRUE
        WHERE id = $1
        `,
        [riderId]
      );

      res.json({
        message:
          "Ride rejected. Finding another rider.",
        ride:
          updateResult.rows[0]
      });

    } catch (error) {

      console.error(
        "Reject ride error:",
        error
      );

      res.status(500).json({
        message:
          "Unable to reject ride."
      });

    }

  }
);


// ------------------------------------
// Rider starts ride
// ------------------------------------

app.patch("/api/rides/:id/start", async (req, res) => {
  const client = await pool.connect();

  try {
    const rideId = req.params.id;
    const { riderId, pin } = req.body;

    if (!riderId || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        message: "Rider ID and a valid 4-digit PIN are required."
      });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, rider_id, status, start_pin, start_pin_attempts
       FROM rides
       WHERE id = $1 AND rider_id = $2
       FOR UPDATE`,
      [rideId, riderId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Ride not found or rider is not assigned."
      });
    }

    const ride = result.rows[0];

    if (ride.status !== "RIDER_ACCEPTED") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Only an accepted ride can be started."
      });
    }

    if (Number(ride.start_pin_attempts) >= 5) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        message: "Too many incorrect PIN attempts. Please contact the administrator."
      });
    }

    if (!ride.start_pin || pin !== ride.start_pin.trim()) {
      await client.query(
        `UPDATE rides
         SET start_pin_attempts = start_pin_attempts + 1
         WHERE id = $1`,
        [rideId]
      );

      await client.query("COMMIT");

      return res.status(401).json({
        message: "Incorrect PIN. Please ask the student to confirm the code."
      });
    }

    const updateResult = await client.query(
      `UPDATE rides
       SET status = 'ONGOING',
           start_pin = NULL,
           start_pin_verified_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND rider_id = $2
         AND status = 'RIDER_ACCEPTED'
       RETURNING id, status`,
      [rideId, riderId]
    );

    if (updateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Ride status changed. Refresh and try again."
      });
    }

    await client.query("COMMIT");

    return res.json({
      message: "PIN verified. Ride started successfully!",
      ride: updateResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Start ride error:", error);

    return res.status(500).json({
      message: "Unable to start ride."
    });
  } finally {
    client.release();
  }
});



// ------------------------------------
// Rider completes ride
// ------------------------------------
app.patch("/api/rides/:id/complete", async (req, res) => {
    try {

        const rideId = req.params.id;
        const { riderId } = req.body;

        if (!riderId) {
            return res.status(400).json({
                message: "Rider ID is required."
            });
        }

        const result = await pool.query(
            `SELECT *
             FROM rides
             WHERE id = $1
             AND rider_id = $2`,
            [rideId, riderId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Ride not found or rider is not assigned."
            });
        }

        if (result.rows[0].status !== "ONGOING") {
            return res.status(400).json({
                message: "Ride must be ongoing before it can be completed."
            });
        }

        // Complete ride
        const updateResult = await pool.query(
            `UPDATE rides
             SET status = 'COMPLETED'
             WHERE id = $1
             RETURNING *`,
            [rideId]
        );

        // Make rider available again
        await pool.query(
            `UPDATE riders
             SET is_available = TRUE
             WHERE id = $1`,
            [riderId]
        );

        res.json({
            message: "Ride completed successfully!",
            ride: updateResult.rows[0]
        });

    } catch (error) {

        console.error(
            "Complete ride error:",
            error
        );

        res.status(500).json({
            message: "Unable to complete ride."
        });
    }
});


app.get("/api/admin/students/count", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*)::int AS total_students
      FROM users
      WHERE role = 'STUDENT'
    `);

    res.json({
      totalStudents: result.rows[0].total_students
    });
  } catch (error) {
    console.error("Get student count error:", error);

    res.status(500).json({
      message: "Unable to fetch registered student count."
    });
  }
});


// ------------------------------------
// Admin - Get All Riders
// ------------------------------------
app.get("/api/admin/riders", async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT
                r.id,
                r.user_id,
                r.vehicle_type,
                r.vehicle_number,
                r.license_number,
                r.is_available,
                r.rider_status,
                r.status_reason,
                r.status_updated_at,
                r.current_lat,
                r.current_lng,
                u.full_name,
                u.email,
                u.mobile,

                current_ride.id AS current_ride_id,
                current_ride.status AS current_ride_status

            FROM riders r

            JOIN users u
                ON r.user_id = u.id

            LEFT JOIN rides current_ride
                ON current_ride.rider_id = r.id
                AND current_ride.status IN (
                    'DRIVER_ASSIGNED',
                    'RIDER_ACCEPTED',
                    'ONGOING'
                )

            ORDER BY r.id;
        `);

        res.json({
            riders: result.rows
        });

    } catch (error) {

        console.error(
            "Admin riders error:",
            error
        );

        res.status(500).json({
            message: "Unable to load riders."
        });
    }
});

// ------------------------------------
// Admin - Update Rider Status
// ------------------------------------

app.patch("/api/admin/riders/:riderId/status", async (req, res) => {

    try {

        const { riderId } = req.params;

        const {
            status,
            reason
        } = req.body;


        const allowedStatuses = [
            "ACTIVE",
            "SUSPENDED",
            "DETAINED",
            "REMOVED"
        ];


        if (!allowedStatuses.includes(status)) {

            return res.status(400).json({
                message: "Invalid rider status."
            });

        }


        if (
            ["SUSPENDED", "DETAINED", "REMOVED"].includes(status) &&
            (!reason || !reason.trim())
        ) {

            return res.status(400).json({
                message: "Reason is required for this action."
            });

        }


        // ------------------------------------
        // Check rider
        // ------------------------------------

        const riderResult = await pool.query(
            `
            SELECT
                r.id,
                r.user_id,
                r.rider_status,
                r.is_available,
                current_ride.id AS current_ride_id,
                current_ride.status AS current_ride_status
            FROM riders r

            LEFT JOIN rides current_ride
                ON current_ride.rider_id = r.id
                AND current_ride.status IN (
                    'DRIVER_ASSIGNED',
                    'RIDER_ACCEPTED',
                    'ONGOING'
                )

            WHERE r.id = $1
            `,
            [riderId]
        );


        if (riderResult.rows.length === 0) {

            return res.status(404).json({
                message: "Rider not found."
            });

        }


        const rider = riderResult.rows[0];


        // ------------------------------------
        // Don't remove/suspend rider
        // while an active ride is running
        // ------------------------------------

        if (
            ["SUSPENDED", "DETAINED", "REMOVED"].includes(status) &&
            rider.current_ride_id
        ) {

            return res.status(400).json({
                message:
                    `Rider cannot be ${status.toLowerCase()} while Ride #${rider.current_ride_id} is active.`
            });

        }


        // ------------------------------------
        // Update rider status
        // ------------------------------------

        const updateResult = await pool.query(
            `
            UPDATE riders

            SET
                rider_status = $1,
                status_reason = $2,
                status_updated_at = CURRENT_TIMESTAMP,

                is_available =
                    CASE
                        WHEN $1 = 'ACTIVE'
                        THEN FALSE
                        ELSE FALSE
                    END

            WHERE id = $3

            RETURNING
                id,
                user_id,
                rider_status,
                status_reason,
                status_updated_at,
                is_available
            `,
            [
                status,
                reason ? reason.trim() : null,
                riderId
            ]
        );


        res.json({
            message:
                `Rider status updated to ${status}.`,

            rider: updateResult.rows[0]
        });


    } catch (error) {

        console.error(
            "Update rider status error:",
            error
        );

        res.status(500).json({
            message:
                "Unable to update rider status."
        });

    }

});


// ------------------------------------
// Automatic Rider Assignment
// ------------------------------------

const autoAssignPendingRides = async () => {

    try {

        // Find rides that have been REQUESTED
        // for at least 20 seconds
        const rideResult = await pool.query(
            `
            SELECT
                id,
                pickup_lat,
                pickup_lng,
                status
            FROM rides
            WHERE status = 'REQUESTED'
              AND created_at <= NOW() - INTERVAL '40 seconds'
            ORDER BY created_at ASC
            `
        );

        for (const ride of rideResult.rows) {

            // ------------------------------------
            // Find available riders
            // ------------------------------------

            const riderResult = await pool.query(
                `
                SELECT
                    r.id,
                    r.user_id,
                    r.is_available,
                    r.current_lat,
                    r.current_lng,
                    r.vehicle_type,
                    r.vehicle_number,
                    u.full_name,
                    u.email,
                    u.mobile
                FROM riders r
                JOIN users u
                    ON r.user_id = u.id
              WHERE r.is_available = TRUE
              AND r.rider_status = 'ACTIVE'
               AND r.current_lat IS NOT NULL
               AND r.current_lng IS NOT NULL

               AND NOT EXISTS (
               SELECT 1
               FROM ride_rider_rejections rr
               WHERE rr.ride_id = $1
               AND rr.rider_id = r.id
             )
               `,
               [ride.id]
            );

            // No available riders
            if (riderResult.rows.length === 0) {
                console.log(
                    `⏳ Ride #${ride.id}: No available riders.`
                );

                continue;
            }

            // ------------------------------------
            // Calculate distance to pickup
            // ------------------------------------

            const lat1 = Number(ride.pickup_lat);
            const lon1 = Number(ride.pickup_lng);

            const ridersWithDistance =
                riderResult.rows.map((rider) => {

                    const lat2 = Number(rider.current_lat);
                    const lon2 = Number(rider.current_lng);

                    const R = 6371;

                    const dLat =
                        (lat2 - lat1) * Math.PI / 180;

                    const dLon =
                        (lon2 - lon1) * Math.PI / 180;

                    const a =
                        Math.sin(dLat / 2) ** 2 +
                        Math.cos(lat1 * Math.PI / 180) *
                        Math.cos(lat2 * Math.PI / 180) *
                        Math.sin(dLon / 2) ** 2;

                    const c =
                        2 * Math.atan2(
                            Math.sqrt(a),
                            Math.sqrt(1 - a)
                        );

                    const distance = R * c;

                    return {
                        ...rider,
                        distance_to_pickup: distance
                    };
                });

            // ------------------------------------
            // Nearest rider
            // ------------------------------------

            ridersWithDistance.sort(
                (a, b) =>
                    a.distance_to_pickup -
                    b.distance_to_pickup
            );

            const nearestRider =
                ridersWithDistance[0];

            // ------------------------------------
            // Assign rider
            // ------------------------------------

            const assignResult = await pool.query(
                `
               UPDATE rides
SET
    rider_id = $1,
    status = 'DRIVER_ASSIGNED',
    assigned_at = NOW()
WHERE id = $2
  AND status = 'REQUESTED'
  AND rider_id IS NULL
RETURNING *
                `,
                [
                    nearestRider.id,
                    ride.id
                ]
            );

            // Ride may have been manually assigned
            // by Admin during the same period
            if (assignResult.rows.length === 0) {

                console.log(
                    `ℹ️ Ride #${ride.id} was already processed.`
                );

                continue;
            }

            // ------------------------------------
            // Make rider busy
            // ------------------------------------

            await pool.query(
                `
                UPDATE riders
                SET is_available = FALSE
                WHERE id = $1
                `,
                [nearestRider.id]
            );

            console.log(
                `🤖 AUTO ASSIGNED Ride #${ride.id} → ` +
                `Rider #${nearestRider.id} ` +
                `(${nearestRider.distance_to_pickup.toFixed(2)} km away)`
            );
        }

    } catch (error) {

        console.error(
            "Automatic rider assignment error:",
            error
        );
    }
};

// ------------------------------------
// Reassign rides not accepted within 60 seconds
// ------------------------------------

const reassignExpiredRides = async () => {
    const expiredResult = await pool.query(`
        SELECT id
        FROM rides
        WHERE status = 'DRIVER_ASSIGNED'
          AND rider_id IS NOT NULL
          AND assigned_at <= NOW() - INTERVAL '60 seconds'
        ORDER BY assigned_at ASC
    `);

    for (const expired of expiredResult.rows) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Lock and recheck this ride to prevent stale reassignment
            const rideResult = await client.query(`
                SELECT
                    id,
                    rider_id,
                    pickup_lat,
                    pickup_lng,
                    status,
                    assigned_at
                FROM rides
                WHERE id = $1
                  AND status = 'DRIVER_ASSIGNED'
                  AND rider_id IS NOT NULL
                  AND assigned_at <= NOW() - INTERVAL '60 seconds'
                FOR UPDATE SKIP LOCKED
            `, [expired.id]);

            if (rideResult.rows.length === 0) {
                await client.query('COMMIT');
                continue;
            }

            const ride = rideResult.rows[0];
            const previousRiderId = ride.rider_id;

            // Remember the rider who did not accept
            await client.query(`
                INSERT INTO ride_rider_rejections (ride_id, rider_id)
                VALUES ($1, $2)
                ON CONFLICT (ride_id, rider_id) DO NOTHING
            `, [ride.id, previousRiderId]);

            // Release the previous rider
            await client.query(`
                UPDATE riders
                SET is_available = TRUE
                WHERE id = $1
                  AND rider_status = 'ACTIVE'
            `, [previousRiderId]);

            // Find eligible available riders, excluding previous rejections.
            // Lock candidates so another transaction cannot lock them simultaneously.
            const riderResult = await client.query(`
                SELECT
                    r.id,
                    r.current_lat,
                    r.current_lng
                FROM riders r
                WHERE r.is_available = TRUE
                  AND r.rider_status = 'ACTIVE'
                  AND r.current_lat IS NOT NULL
                  AND r.current_lng IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM ride_rider_rejections rr
                      WHERE rr.ride_id = $1
                        AND rr.rider_id = r.id
                  )
                FOR UPDATE OF r SKIP LOCKED
            `, [ride.id]);

            // Choose the nearest eligible rider
            const lat1 = Number(ride.pickup_lat);
            const lon1 = Number(ride.pickup_lng);

            const candidates = riderResult.rows.map((rider) => {
                const lat2 = Number(rider.current_lat);
                const lon2 = Number(rider.current_lng);

                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;

                const a =
                    Math.sin(dLat / 2) ** 2 +
                    Math.cos(lat1 * Math.PI / 180) *
                    Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) ** 2;

                const distance =
                    6371 * 2 * Math.atan2(
                        Math.sqrt(a),
                        Math.sqrt(1 - a)
                    );

                return { ...rider, distance };
            });

            candidates.sort((a, b) => a.distance - b.distance);

            const nextRider = candidates[0];

            if (nextRider) {
                // Mark the selected rider busy
                const busyResult = await client.query(`
                    UPDATE riders
                    SET is_available = FALSE
                    WHERE id = $1
                      AND is_available = TRUE
                      AND rider_status = 'ACTIVE'
                    RETURNING id
                `, [nextRider.id]);

                if (busyResult.rows.length > 0) {
                    // Assign the ride and restart the 60-second timer
                    await client.query(`
                        UPDATE rides
                        SET
                            rider_id = $1,
                            status = 'DRIVER_ASSIGNED',
                            assigned_at = NOW()
                        WHERE id = $2
                    `, [nextRider.id, ride.id]);

                    console.log(
                        `🔄 Ride #${ride.id} reassigned from rider #${previousRiderId} to rider #${nextRider.id}`
                    );
                } else {
                    // Rider was no longer available; retry later
                    await client.query(`
                        UPDATE rides
                        SET
                            rider_id = NULL,
                            status = 'REQUESTED',
                            assigned_at = NULL
                        WHERE id = $1
                    `, [ride.id]);

                    console.log(
                        `⏳ Ride #${ride.id}: selected rider became unavailable; retrying`
                    );
                }
            } else {
                // No eligible rider: return ride to the existing auto-assignment queue
                await client.query(`
                    UPDATE rides
                    SET
                        rider_id = NULL,
                        status = 'REQUESTED',
                        assigned_at = NULL
                    WHERE id = $1
                `, [ride.id]);

                console.log(
                    `⏳ Ride #${ride.id}: no alternative rider; will retry`
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(
                `Reassignment failed for ride #${expired.id}:`,
                error
            );
        } finally {
            client.release();
        }
    }
};


// ------------------------------------
// Run automatic assignment every 2 seconds
// ------------------------------------

setInterval(async () => {
    try {
        await reassignExpiredRides();
        await autoAssignPendingRides();
    } catch (error) {
        console.error("Ride assignment cycle failed:", error);
    }
}, 2000);


// ------------------------------------
// Admin - Add New Rider
// ------------------------------------
app.post("/api/admin/riders", async (req, res) => {
    const client = await pool.connect();

    try {

        const {
            adminUserId,
            fullName,
            phone,
            email,
            password,
            vehicleType,
            vehicleNumber,
            licenseNumber
        } = req.body;

        // ------------------------------------
        // Validate required fields
        // ------------------------------------

        if (
            !adminUserId ||
            !fullName ||
            !phone ||
            !password ||
            !vehicleType ||
            !vehicleNumber ||
            !licenseNumber
        ) {
            return res.status(400).json({
                message: "Please fill in all required fields."
            });
        }

        // ------------------------------------
        // Validate phone
        // ------------------------------------

        const phoneRegex = /^[0-9]{10}$/;

        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                message: "Please enter a valid 10-digit mobile number."
            });
        }

        // ------------------------------------
        // Validate password
        // ------------------------------------

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters."
            });
        }

        // ------------------------------------
        // Check admin
        // ------------------------------------

        const adminResult = await pool.query(
            `SELECT id, role
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [adminUserId]
        );

        if (adminResult.rows.length === 0) {
            return res.status(403).json({
                message: "Admin account not found."
            });
        }

        if (adminResult.rows[0].role !== "ADMIN") {
            return res.status(403).json({
                message: "Only administrators can add riders."
            });
        }

        // ------------------------------------
        // Check duplicate mobile
        // ------------------------------------

        const existingPhone = await pool.query(
            `SELECT id
             FROM users
             WHERE mobile = $1
             LIMIT 1`,
            [phone]
        );

        if (existingPhone.rows.length > 0) {
            return res.status(409).json({
                message: "A user with this mobile number already exists."
            });
        }

        // ------------------------------------
        // Check duplicate email
        // ------------------------------------

        if (email && email.trim()) {

            const existingEmail = await pool.query(
                `SELECT id
                 FROM users
                 WHERE email = $1
                 LIMIT 1`,
                [email.trim()]
            );

            if (existingEmail.rows.length > 0) {
                return res.status(409).json({
                    message: "A user with this email already exists."
                });
            }
        }

        // ------------------------------------
        // Hash password
        // ------------------------------------

        const passwordHash = await bcrypt.hash(
            password,
            12
        );

        // ------------------------------------
        // Start transaction
        // ------------------------------------

        await client.query("BEGIN");

        // ------------------------------------
        // Create user
        // ------------------------------------

        const userResult = await client.query(
            `INSERT INTO users
            (
                full_name,
                student_id,
                email,
                mobile,
                password_hash,
                role
            )
            VALUES
            (
                $1,
                NULL,
                $2,
                $3,
                $4,
                'RIDER'
            )
            RETURNING
                id,
                full_name,
                email,
                mobile,
                role`,
            [
                fullName.trim(),
                email && email.trim()
                    ? email.trim()
                    : null,
                phone,
                passwordHash
            ]
        );

        const user = userResult.rows[0];

        // ------------------------------------
        // Create rider profile
        // ------------------------------------

        const riderResult = await client.query(
            `INSERT INTO riders
            (
                user_id,
                vehicle_type,
                vehicle_number,
                license_number,
                is_available,
                current_lat,
                current_lng
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                FALSE,
                NULL,
                NULL
            )
            RETURNING
                id,
                user_id,
                vehicle_type,
                vehicle_number,
                license_number,
                is_available`,
            [
                user.id,
                vehicleType,
                vehicleNumber.trim().toUpperCase(),
                licenseNumber.trim().toUpperCase()
            ]
        );

        const rider = riderResult.rows[0];

        // ------------------------------------
        // Commit transaction
        // ------------------------------------

        await client.query("COMMIT");

        res.status(201).json({
            message: "Rider created successfully!",
            user,
            rider
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Add rider error:",
            error
        );

        // PostgreSQL duplicate constraint
        if (error.code === "23505") {
            return res.status(409).json({
                message: "A user with these details already exists."
            });
        }

        res.status(500).json({
            message: "Unable to create rider."
        });

    } finally {

        client.release();

    }
});


/* =========================================
   4Mi FEEDBACK, SUGGESTIONS & COMPLAINTS
========================================= */

// Student submits feedback
app.post("/api/feedback", async (req, res) => {
    try {
        const userId = Number(req.body.userId);
        const feedbackType = req.body.feedbackType;
        const message =
            typeof req.body.message === "string"
                ? req.body.message.trim()
                : "";

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                message: "Please log in before submitting feedback."
            });
        }

        if (!["Feedback", "Suggestion", "Complaint"].includes(feedbackType)) {
            return res.status(400).json({
                message: "Please select a valid feedback type."
            });
        }

        if (message.length < 5 || message.length > 2000) {
            return res.status(400).json({
                message: "Your message must be between 5 and 2000 characters."
            });
        }

        // Confirm the user exists before saving the submission.
        const userResult = await pool.query(
            "SELECT id FROM users WHERE id = $1",
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: "User account not found. Please log in again."
            });
        }

        const result = await pool.query(
            `INSERT INTO feedback (user_id, feedback_type, message)
             VALUES ($1, $2, $3)
             RETURNING id, feedback_type, message, status, created_at`,
            [userId, feedbackType, message]
        );

        return res.status(201).json({
            message: "Thank you! Your feedback has been submitted.",
            feedback: result.rows[0]
        });

    } catch (error) {
        console.error("Submit feedback error:", error);

        return res.status(500).json({
            message: "Unable to submit feedback right now."
        });
    }
});


// Admin views all feedback submissions
app.get("/api/admin/feedback", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                f.id,
                f.user_id,
                f.feedback_type,
                f.message,
                f.status,
                f.created_at,
                u.full_name,
                u.student_id,
                u.mobile
             FROM feedback f
             LEFT JOIN users u ON u.id = f.user_id
             ORDER BY
                CASE f.status
                    WHEN 'NEW' THEN 0
                    WHEN 'REVIEWED' THEN 1
                    ELSE 2
                END,
                f.created_at DESC`
        );

        return res.json({ feedback: result.rows });

    } catch (error) {
        console.error("Get admin feedback error:", error);

        return res.status(500).json({
            message: "Unable to load feedback submissions."
        });
    }
});


// Admin marks feedback as reviewed or resolved
app.patch("/api/admin/feedback/:id/status", async (req, res) => {
    try {
        const feedbackId = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
            return res.status(400).json({
                message: "Invalid feedback ID."
            });
        }

        if (!["REVIEWED", "RESOLVED"].includes(status)) {
            return res.status(400).json({
                message: "Choose REVIEWED or RESOLVED."
            });
        }

        const result = await pool.query(
            `UPDATE feedback
             SET status = $1
             WHERE id = $2
             RETURNING id, status`,
            [status, feedbackId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Feedback submission not found."
            });
        }

        return res.json({
            message: "Feedback status updated.",
            feedback: result.rows[0]
        });

    } catch (error) {
        console.error("Update feedback status error:", error);

        return res.status(500).json({
            message: "Unable to update feedback status."
        });
    }
});


// ------------------------------------
// Start server
// ------------------------------------

app.listen(PORT, () => {

    console.log(
        `CampusRide backend running on http://localhost:${PORT}`
    );

});
