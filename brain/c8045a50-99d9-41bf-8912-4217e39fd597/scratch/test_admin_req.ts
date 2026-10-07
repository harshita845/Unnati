import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import http from "http";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

// Create an admin token
const token = jwt.sign(
  {
    userId: "650000000000000000000001",
    userType: "Admin",
    role: "super_admin",
    email: "admin@test.com"
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

console.log("Generated Admin Token:", token.substring(0, 20) + "...");

function fetchUrl(path: string) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:5001${path}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  console.log("Testing /api/v1/admin/orders/pos-report...");
  const res1: any = await fetchUrl("/api/v1/admin/orders/pos-report?page=1&limit=20");
  console.log("pos-report STATUS:", res1.status);
  console.log("pos-report BODY:", res1.body.substring(0, 300));

  console.log("\nTesting /api/v1/admin/orders/online...");
  const res2: any = await fetchUrl("/api/v1/admin/orders/online?page=1&limit=20");
  console.log("online STATUS:", res2.status);
  console.log("online BODY:", res2.body.substring(0, 300));
}

run().catch(console.error);
