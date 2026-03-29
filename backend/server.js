const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");

const app = express();

// ================= CONFIG =================
const username = process.env.DIGI_USERNAME;
const apiKey = process.env.DIGI_APIKEY;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.options("*", cors());

// ================= TEST =================
app.get("/", (req, res) => {
  res.send("API Topup Jalan");
});

app.get("/test", (req, res) => {
  res.json({
    status: "success",
    message: "API siap dipakai"
  });
});

// ================= ADMIN PANEL + ORDER =================
app.get("/admin", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Admin Panel Nasa Store</title>
      <style>
        body { font-family: Arial; background: #f5f5f5; padding: 20px; }
        h1 { color: #333; }
        .card { background: white; padding: 15px; margin: 10px 0; border-radius: 10px; }
        input, select, button {
          padding: 10px;
          margin: 5px 0;
          width: 100%;
        }
        button {
          background: #28a745;
          color: white;
          border: none;
          cursor: pointer;
        }
      </style>
    </head>
    <body>

      <h1>Dashboard Admin - Nasa Store</h1>

      <div class="card">
        <h3>Status Server</h3>
        <p>Aktif ✅</p>
      </div>

      <div class="card">
        <h3>Menu</h3>
        <ul>
          <li><a href="/cek-saldo">Cek Saldo API</a></li>
          <li><a href="/price-list">Lihat Produk</a></li>
          <li><a href="/log">Riwayat Transaksi</a></li>
        </ul>
      </div>

      <div class="card">
        <h3>⚡ Order Cepat</h3>

        <input type="text" id="userId" placeholder="User ID / No HP">

        <select id="produk">
          <optgroup label="Free Fire">
            <option value="ff12">12 Diamond</option>
            <option value="ff70">70 Diamond</option>
          </optgroup>

          <optgroup label="Mobile Legends">
            <option value="ml5">5 Diamond</option>
            <option value="ml12">12 Diamond</option>
          </optgroup>        
        </select>

        <button onclick="order()">Kirim Order</button>

        <p id="hasil"></p>
      </div>

      <script>
      function order() {
        const userId = document.getElementById("userId").value;
        const sku = document.getElementById("produk").value;

        if (!userId || !sku) {
          alert("Isi semua data!");
          return;
        }

        document.getElementById("hasil").innerText = "⏳ Memproses...";

        fetch("/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: userId,
            sku: sku
          })
        })
        .then(res => res.json())
        .then(data => {
          document.getElementById("hasil").innerText =
            JSON.stringify(data, null, 2);
        });
      }
      </script>

    </body>
    </html>
  `);
});

// ================= CEK SALDO =================
app.get("/cek-saldo", async (req, res) => {
  try {
    const signature = crypto
      .createHash("md5")
      .update(username + apiKey + "depo")
      .digest("hex");

    const response = await axios.post(
      "https://api.digiflazz.com/v1/cek-saldo",
      {
        cmd: "deposit",
        username: username,
        sign: signature
      }
    );

    res.json(response.data);

  } catch (error) {
    console.log("ERROR DETAIL:", error.response?.data);

    res.json({
      error: error.response?.data || error.message
    });
  }
});

// ================= PRICE LIST =================
app.get("/price-list", async (req, res) => {
  try {
    const signature = crypto
      .createHash("md5")
      .update(username + apiKey + "pricelist")
      .digest("hex");

    const response = await axios.post(
      "https://api.digiflazz.com/v1/price-list",
      {
        cmd: "prepaid",
        username: username,
        sign: signature
      }
    );

    res.json(response.data);

  } catch (error) {
    console.log("ERROR DETAIL:", error.response?.data);

    res.json({
      error: error.response?.data || error.message
    });
  }
});

// ================= ORDER REAL =================
app.post("/order", async (req, res) => {
  const { userId, sku } = req.body;

  if (!userId || !sku) {
    return res.json({
      status: "error",
      message: "User ID dan produk wajib diisi!"
    });
  }

  if (sku.length < 3) {
    return res.json({
      status: "error",
      message: "SKU tidak valid"
    });
  }

  try {
    const ref_id = "INV" + Date.now();

    const signature = crypto
      .createHash("md5")
      .update(username + apiKey + ref_id)
      .digest("hex");

    const response = await axios.post(
      "https://api.digiflazz.com/v1/transaction",
      {
        username: username,
        buyer_sku_code: sku,
        customer_no: userId,
        ref_id: ref_id,
        sign: signature
      }
    );

    // SIMPAN LOG
    const log = {
      waktu: new Date(),
      userId,
      sku,
      response: response.data
    };

    fs.appendFileSync("log.json", JSON.stringify(log) + "\\n");

    res.json(response.data);

  } catch (error) {
    console.log("ERROR DETAIL:", error.response?.data);

    res.json({
      error: error.response?.data || error.message
    });
  }
});

// ================= LIHAT LOG =================
app.get("/log", (req, res) => {
  try {
    const data = fs.readFileSync("log.json", "utf-8");
    res.send(`<pre>${data}</pre>`);
  } catch {
    res.send("Belum ada transaksi");
  }
});

app.get("/ip", async (req, res) => {
  const response = await axios.get("https://api.ipify.org?format=json");
  res.json(response.data);
});

// ================= RUN SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server jalan di port " + PORT);
});