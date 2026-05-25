const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId, customerId } = req.body;
  if (!sessionId || !customerId) {
    return res.status(400).json({ error: "Missing sessionId or customerId" });
  }

  try {
    const session = await stripe.checkout.sessions.update(sessionId, {
      customer: customerId,
    });
    res.json({ ok: true, sessionId: session.id });
  } catch (err) {
    console.error("Update checkout customer failed:", err.message);
    res.status(400).json({ error: err.message });
  }
};
