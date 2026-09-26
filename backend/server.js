const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
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
// Student Registration
// ------------------------------------
app.post("/api/auth/register", async (req, res) => {

    try {

        const {
            fullName,
            studentId,
            email,
            phone,
            password
        } = req.body;


        // Check required fields
        if (
            !fullName ||
            !studentId ||
            !email ||
            !phone ||
            !password
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


        // Check if student ID already exists
        const existingStudent = await pool.query(
            "SELECT id FROM users WHERE student_id = $1",
            [studentId]
        );

        if (existingStudent.rows.length > 0) {
            return res.status(409).json({
                message: "Student ID is already registered."
            });
        }


        // Check if email already exists
        const existingEmail = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingEmail.rows.length > 0) {
            return res.status(409).json({
                message: "Email is already registered."
            });
        }


        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);


        // Insert student into PostgreSQL
        const result = await pool.query(
            `INSERT INTO users
            (full_name, student_id, email, mobile, password_hash)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, full_name, student_id, email, mobile, role, created_at`,
            [
                fullName,
                studentId,
                email,
                phone,
                passwordHash
            ]
        );


        // Successful registration
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



app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    // Find user by email
    const result = await pool.query(
      "SELECT id, full_name, student_id, email, mobile, password_hash, role FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password.",
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
        message: "Invalid email or password.",
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
           fare
        } = req.body;


        // Check required fields
        if (
        !userId ||
        !pickupName ||
        pickupLat === undefined ||
        pickupLng === undefined ||
        !destinationName ||
        destinationLat === undefined ||
        destinationLng === undefined ||
        distance === undefined ||
        fare === undefined
        ) {
            return res.status(400).json({
                message: "All ride details are required."
            });
       }


        // Check whether user exists
        const userResult = await pool.query(
            "SELECT id, full_name, student_id FROM users WHERE id = $1",
            [userId]
        );


        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: "User not found."
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

        // Save ride in PostgreSQL
        const result = await pool.query(
            `INSERT INTO rides(
             user_id,
             pickup_name,
             pickup_lat,
             pickup_lng,
             destination_name,
             destination_lat,
             destination_lng,
             distance_km,
             estimated_fare
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
            userId,
            pickupName,
            pickupLat,
            pickupLng,
            destinationName,
            destinationLat,
            destinationLng,
            distance,
            fare
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
            `UPDATE riders
             SET is_available = $1
             WHERE user_id = $2
             RETURNING *`,
            [isAvailable, userId]
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

       // ------------------------------------
// Assign rider to ride
// ------------------------------------

const result = await pool.query(
    `UPDATE rides
     SET
        rider_id = $1,
        status = 'DRIVER_ASSIGNED'
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
                r.pickup_lat,
                r.pickup_lng,
                r.destination_lat,
                r.destination_lng,
                r.distance_km,
                r.estimated_fare,
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
             AND status = 'DRIVER_ASSIGNED'
             RETURNING *`,
            [rideId]
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

        if (result.rows[0].status !== "RIDER_ACCEPTED") {
            return res.status(400).json({
                message: "Ride cannot be started in its current status."
            });
        }

        const updateResult = await pool.query(
            `UPDATE rides
             SET status = 'ONGOING'
             WHERE id = $1
             RETURNING *`,
            [rideId]
        );

        res.json({
            message: "Ride started successfully!",
            ride: updateResult.rows[0]
        });

    } catch (error) {

        console.error(
            "Start ride error:",
            error
        );

        res.status(500).json({
            message: "Unable to start ride."
        });
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
              AND created_at <= NOW() - INTERVAL '60 seconds'
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
                    status = 'DRIVER_ASSIGNED'
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
// Run automatic assignment every 2 seconds
// ------------------------------------

setInterval(
    autoAssignPendingRides,
    2000
);


// ------------------------------------
// Start server
// ------------------------------------

app.listen(PORT, () => {

    console.log(
        `CampusRide backend running on http://localhost:${PORT}`
    );

});
