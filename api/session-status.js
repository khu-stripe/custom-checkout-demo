const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-03-25.dahlia",
});

module.exports = async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ error: "Missing session_id" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription"],
    });
    res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      currency: session.currency,
      amountTotal: session.amount_total,
      customerEmail: session.customer_details?.email,
      presentmentDetails: session.presentment_details,
      subscriptionId: session.subscription?.id,
      subscriptionStatus: session.subscription?.status,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
