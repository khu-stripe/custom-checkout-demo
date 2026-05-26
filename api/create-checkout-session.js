const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { countryCode } = req.body;
  const origin =
    req.headers.origin ||
    `https://${req.headers.host}` ||
    "http://localhost:4242";

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: "elements",
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Luminary Membership",
              description:
                "Unlimited access to 100+ personal growth programs, daily meditations, and a global community.",
            },
            unit_amount: 29900,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      automatic_tax: { enabled: true },
      adaptive_pricing: { enabled: true },
      tax_id_collection: { enabled: true },
      saved_payment_method_options: { allow_redisplay_filters: [] },
      return_url: `${origin}/return.html?session_id={CHECKOUT_SESSION_ID}`,
    });

    res.json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (err) {
    console.error("Checkout Session creation failed:", err.message);
    res.status(400).json({ error: err.message });
  }
};
