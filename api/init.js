// api/init.js

let isRunning = false;

export default async function handler(req, res) {
  try {

    // Allow only POST requests
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Only POST requests are allowed"
      });
    }

    // Prevent multiple executions
    if (isRunning) {
      return res.status(429).json({
        success: false,
        message: "Init function already running"
      });
    }

    // Lock execution
    isRunning = true;

    console.log("Init function started");

    // ---- Your main logic here ----
    // Example: fetch Instagram data or run automation
    const result = {
      message: "Init function executed successfully",
      time: new Date()
    };

    console.log("Init function finished");

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {

    console.error("Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });

  } finally {

    // Always release lock
    isRunning = false;

  }
}