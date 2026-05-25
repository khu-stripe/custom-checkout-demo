# Custom Checkout Demo

A subscription checkout page with two integration modes that users can toggle in Phase 1:

1. **Custom Checkout (Elements)** -- Compose individual Stripe Elements (Payment Element, Express Checkout, Currency Selector, Tax ID) for maximum control over layout
2. **Checkout Form** -- A single Stripe iframe that handles the entire checkout end-to-end (payments, billing, tax, express wallets)

Both modes use the same product (Luminary Membership, $299/mo subscription) with adaptive pricing, automatic tax, and tax ID collection.

**Live demo**: https://checkout-demo-silk.vercel.app

## Stripe APIs

| API | Method | Purpose |
|---|---|---|
| [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create) | `POST /v1/checkout/sessions` | Create a session with `ui_mode: "custom"` (Elements) or `ui_mode: "form"` (Checkout Form) |
| [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/retrieve) | `GET /v1/checkout/sessions/:id` | Retrieve session status after payment, with `expand: ["subscription"]` |

### Integration Mode: Custom Checkout (Elements)

Session created with `ui_mode: "custom"` (clover API version).

| Element | Method | Purpose |
|---|---|---|
| [Payment Element](https://docs.stripe.com/js/custom_checkout/payment_element) | `checkout.createPaymentElement()` | Card and alternative payment method inputs |
| [Express Checkout Element](https://docs.stripe.com/js/custom_checkout/express_checkout_element) | `checkout.createExpressCheckoutElement()` | Apple Pay and Google Pay buttons |
| [Currency Selector Element](https://docs.stripe.com/js/custom_checkout/currency_selector_element) | `checkout.createCurrencySelectorElement()` | Customer currency switching with adaptive pricing |
| [Tax ID Element](https://docs.stripe.com/js/custom_checkout/tax_id_element) | `checkout.createTaxIdElement()` | Business tax ID input |

### Integration Mode: Checkout Form

Session created with `ui_mode: "form"` and API version `2026-04-22.preview; custom_checkout_payment_form_preview=v1`.

The Checkout Form renders a complete checkout experience in a single iframe, handling payment details, billing address, tax ID, express wallets, and confirmation. See [Checkout Form docs](https://docs.stripe.com/payments/checkout/how-checkout-works?payment-ui=checkout-form).

## Project structure

```
.
├── api/
│   ├── config.js                       GET  /config
│   ├── create-checkout-session.js      POST /create-checkout-session (Elements)
│   ├── create-checkout-form-session.js POST /create-checkout-form-session (Form)
│   └── session-status.js               GET  /session-status
├── public/
│   ├── index.html                      Checkout page (source of truth)
│   └── return.html                     Post-payment confirmation page
├── index.html                          Copy of public/index.html (Vercel static root)
├── return.html                         Copy of public/return.html (Vercel static root)
├── server.js                           Express server for local development
├── vercel.json                         Vercel routing config
└── package.json
```

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your Stripe test keys
3. `npm install`
4. `node server.js`
5. Open http://localhost:4242

## Deployment

Deployed on Vercel as serverless functions. The `api/` directory contains the serverless endpoints and `vercel.json` rewrites the paths to their respective functions. Static files are served from the project root.

Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` as environment variables in the Vercel dashboard.
