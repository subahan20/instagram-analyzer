export default async function handler(req, res) {

  try {

    const response = await fetch("https://instagram-analyzer-73my.onrender.com/webhook/init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "init trigger"
      })
    });

    const data = await response.text();

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: error.message
    });

  }

}