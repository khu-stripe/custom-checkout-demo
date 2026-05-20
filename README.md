# Custom Checkout Demo

A subscription checkout page built with Stripe Custom Checkout (dahlia API version `2026-03-25.dahlia`). Demonstrates adaptive pricing, express checkout, tax ID collection, and custom email capture using composable Stripe Elements.

**Live demo**: https://checkout-demo-silk.vercel.app

## Stripe APIs

| API | Method | Purpose |
|---|---|---|
| [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create) | `POST /v1/checkout/sessions` | Create a session with `ui_mode: "elements"` for embedded checkout |
| [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/retrieve) | `GET /v1/checkout/sessions/:id` | Retrieve session status after payment, with `expand: ["subscription"]` |

### Checkout Session parameters used

- `ui_mode: "elements"` to enable composable Elements integration
- `mode: "subscription"` for recurring billing
- `adaptive_pricing: { enabled: true }` to show prices in the customer's local currency
- `automatic_tax: { enabled: true }` for Stripe Tax calculation
- `tax_id_collection: { enabled: true }` to allow business tax ID capture
- `line_items` with inline `price_data` (no pre-created Price object needed)

## Stripe.js Elements

Initialized via `stripe.initCheckoutElementsSdk()` with the `custom_checkout_tax_id_1` beta.

| Element | Method | Purpose |
|---|---|---|
| [Payment Element](https://docs.stripe.com/js/custom_checkout/payment_element) | `checkout.createPaymentElement()` | Card and alternative payment method inputs |
| [Express Checkout Element](https://docs.stripe.com/js/custom_checkout/express_checkout_element) | `checkout.createExpressCheckoutElement()` | Apple Pay and Google Pay buttons (set to `always` display) |
| [Currency Selector Element](https://docs.stripe.com/js/custom_checkout/currency_selector_element) | `checkout.createCurrencySelectorElement()` | Lets customers switch currency when adaptive pricing is active |
| [Tax ID Element](https://docs.stripe.com/js/custom_checkout/tax_id_element) | `checkout.createTaxIdElement()` | Business name and tax ID input (requires `custom_checkout_tax_id_1` beta) |

### Checkout SDK methods used

- `checkout.loadActions()` to get the `actions` object
- `actions.getSession()` to read current session state (totals, currency, recurring)
- `actions.updateEmail(email)` to set the customer email from a custom text field
- `actions.confirm()` to finalize the payment
- `checkout.on("change", callback)` to react to session updates (tax, currency changes)

## Project structure

```
.
├── api/
│   ├── config.js                  GET  /config (returns publishable key)
│   ├── create-checkout-session.js POST /create-checkout-session
│   └── session-status.js          GET  /session-status
├── public/
│   ├── index.html                 Checkout page (source of truth)
│   └── return.html                Post-payment confirmation page
├── index.html                     Copy of public/index.html (Vercel static root)
├── return.html                    Copy of public/return.html (Vercel static root)
├── server.js                      Express server for local development
├── vercel.json                    Vercel routing config
└── package.json
```

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your Stripe test keys
3. `npm install`
4. `node server.js`
5. Open http://localhost:4242

## Deployment

Deployed on Vercel as serverless functions. The `api/` directory contains the serverless endpoints and `vercel.json` rewrites `/config`, `/create-checkout-session`, and `/session-status` to their respective functions. Static files are served from the project root.

Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` as environment variables in the Vercel dashboard.
