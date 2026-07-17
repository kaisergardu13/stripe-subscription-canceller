// Requiere: npm install
require('dotenv').config();

const express = require('express');
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

// Mapeo de cada precio (plan de cuotas) al número de ciclos de facturación
// que debe durar la suscripción antes de cancelarse sola.
const PLAN_CYCLES = {
  'price_1Tu8au2Y5OySBjTFGxJrGOwU': 12, // Plan 12 cuotas mensuales (283,33€/mes, total 3.400€)
  'price_1Tu8au2Y5OySBjTFP9EPrMzA': 24, // Plan 24 cuotas mensuales (156,25€/mes, total 3.750€)
  'price_1Tu8at2Y5OySBjTF60BfL0Dc': 36, // Plan 36 cuotas mensuales (118,06€/mes, total 4.250,16€)
  'price_1Tu8au2Y5OySBjTFJm7f18yZ': 45, // Plan 45 cuotas mensuales (111,11€/mes, total 4.999,95€)
  // price_1Tu8at2Y5OySBjTF5nUV9632 es el pago único de 2.700€, no aplica (no es suscripción)
};

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Firma de webhook inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Respondemos de inmediato para que Stripe no reintente por timeout;
  // el procesamiento posterior no debe romper el ack del webhook.
  res.json({ received: true });

  if (event.type !== 'customer.subscription.created') {
    return;
  }

  const subscription = event.data.object;
  const priceId = subscription.items.data[0]?.price?.id;
  const cycles = PLAN_CYCLES[priceId];

  if (!cycles) {
    return;
  }

  const startDate = new Date(subscription.billing_cycle_anchor * 1000);
  const cancelDate = new Date(startDate);
  cancelDate.setMonth(cancelDate.getMonth() + cycles);
  const cancelAtTimestamp = Math.floor(cancelDate.getTime() / 1000);

  try {
    await stripe.subscriptions.update(subscription.id, {
      cancel_at: cancelAtTimestamp,
    });
    console.log(
      `Suscripción ${subscription.id} configurada para cancelarse tras ${cycles} cuotas (${cancelDate.toISOString()})`
    );
  } catch (err) {
    console.error(`Error al configurar cancel_at para ${subscription.id}:`, err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook escuchando en el puerto ${PORT}`));
