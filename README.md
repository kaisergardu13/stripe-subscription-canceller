# Stripe Subscription Canceller

Servidor Express que recibe el webhook `customer.subscription.created` de Stripe
y programa la cancelación automática de la suscripción (`cancel_at`) según el
número de cuotas del plan contratado.

## Planes configurados

| Price ID | Cuotas | Total |
|---|---|---|
| `price_1Tu8au2Y5OySBjTFGxJrGOwU` | 12 | 3.400€ |
| `price_1Tu8au2Y5OySBjTFP9EPrMzA` | 24 | 3.750€ |
| `price_1Tu8at2Y5OySBjTF60BfL0Dc` | 36 | 4.250€ |
| `price_1Tu8au2Y5OySBjTFJm7f18yZ` | 45 | 5.000€ |

`price_1Tu8at2Y5OySBjTF5nUV9632` (pago único, 2.700€) no es una suscripción y se ignora.

Si cambias los planes o los precios en Stripe, actualiza el objeto `PLAN_CYCLES`
en [`webhook-server.js`](webhook-server.js).

## 1. Instalación local

```bash
npm install
cp .env.example .env
# Edita .env con tus claves reales de Stripe
npm start
```

El servidor arranca en `http://localhost:3000` (o el puerto que definas en `PORT`).

## 2. Despliegue

Puedes desplegarlo en cualquier proveedor que ejecute Node.js (Railway, Render,
Fly.io, un VPS con PM2, etc.). Pasos generales:

1. Sube el código (sin el archivo `.env`, que está en `.gitignore`).
2. Configura las variables de entorno en el proveedor:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `PORT` (opcional, algunos proveedores lo asignan automáticamente)
3. Comando de arranque: `npm start`.
4. Asegúrate de que el endpoint `/webhook` sea accesible públicamente por HTTPS
   (Stripe exige HTTPS en producción).

## 3. Registrar el webhook en Stripe

1. Ve al [Dashboard de Stripe](https://dashboard.stripe.com/) → **Desarrolladores** → **Webhooks**.
2. Haz clic en **Añadir endpoint**.
3. En **URL del endpoint**, introduce `https://tu-dominio.com/webhook`.
4. En **Seleccionar eventos**, elige `customer.subscription.created`.
5. Guarda el endpoint y copia el **Signing secret** (`whsec_...`) que te muestra Stripe.
6. Coloca ese valor en la variable de entorno `STRIPE_WEBHOOK_SECRET` de tu despliegue.

### Probar en local con Stripe CLI

```bash
stripe listen --forward-to localhost:3000/webhook
```

Esto te da un `whsec_...` temporal para pruebas locales y puedes disparar el
evento manualmente con:

```bash
stripe trigger customer.subscription.created
```

## 4. Comportamiento

- El endpoint verifica la firma del webhook con `stripe.webhooks.constructEvent`;
  si la firma no es válida, responde `400`.
- Responde `{ received: true }` a Stripe inmediatamente (para evitar timeouts
  y reintentos innecesarios) y procesa la lógica de cancelación después.
- Si el `price_id` de la suscripción no está en `PLAN_CYCLES`, no hace nada.
- Si `stripe.subscriptions.update` falla, el error se registra en consola sin
  afectar la respuesta ya enviada al webhook.
- Cada cancelación programada se registra en consola con el ID de la
  suscripción y la fecha calculada.

## 5. Notas de seguridad

- Nunca hardcodees `STRIPE_SECRET_KEY` ni `STRIPE_WEBHOOK_SECRET` en el código;
  usa siempre variables de entorno.
- El endpoint `/webhook` usa `express.raw()` en vez de `express.json()` porque
  Stripe necesita el cuerpo de la petición sin procesar para verificar la firma.
