import { setCors } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  res.json({
    status:   "API شغال ✅",
    version:  "2.0.0",
    platform: "Vercel Serverless",
    endpoints: [
      "GET  /api",
      "GET  /api/services",
      "POST /api/order",
      "GET  /api/balance",
      "POST /api/auth/register",
    ],
  });
}
