const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");

const app = express();

let cachedProducts = [];
let lastFetch = 0;

// ================= CONFIG =================
const username = process.env.DIGI_USERNAME;
const apiKey = process.env.DIGI_APIKEY;

// 🔥 FUNCTION AMBIL DATA SEKALI
async function loadPricelist() {
  try {
    console.log("Ambil data dari Digiflazz...");

    const signature = crypto
      .createHash("md5")
      .update(username + apiKey + "pricelist")
      .digest("hex");

    const response = await axios.post(
      "https://api.digiflazz.com/v1/price-list",
      {
        cmd: "prepaid",
        username,
        sign: signature
      }
    );

    if (Array.isArray(response.data.data)) {
      cachedProducts = response.data.data;
      console.log("✅ Pricelist berhasil disimpan:", cachedProducts.length);
    } else {
      console.log("❌ Gagal ambil pricelist:", response.data);
    }

  } catch (err) {
    console.log("ERROR INIT:", err.response?.data);
  }
}

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
        .card-produk {
          background: white;
          padding: 10px;
          border-radius: 10px;
          cursor: pointer;
          border: 2px solid transparent;
          transition: 0.2s;
        }
        .card-produk:hover {
          border: 2px solid #28a745;
        }
        .card-produk.active {
          border: 2px solid #28a745;
          background: #eaffea;
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
        <h3>⚡ Order Cepat</h3> <button onclick="reloadData()">🔄 Reload Produk</button>

        <input type="text" id="userId" placeholder="User ID / No HP">

        <select id="game" onchange="loadProduk()">
          <option value="">-- Pilih Game --</option>
          <option value="free fire">Free Fire</option>
          <option value="mobile legends">Mobile Legends</option>
        </select>

        <div id="produkList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;"></div>

        <button id="btnOrder" onclick="order()">Kirim Order</button>  

        <p id="hasil"></p>
      </div>

      <script>
        let selectedSku = "";

        async function loadProduk() {
          const game = document.getElementById("game").value;

          if (!game) return;

          selectedSku = "";

          const container = document.getElementById("produkList");
          container.innerHTML = "Loading...";

          try {
            const res = await fetch("/products/" + encodeURIComponent(game));                             
            const result = await res.json();
            console.log("FULL RESULT:", result);
            
            const data = result.data || result;

            if (!Array.isArray(data)) {
              console.log("DATA BUKAN ARRAY:", data);
              container.innerHTML = "Produk tidak tersedia";
              return;
            }

            container.innerHTML = "";

            data.forEach(p => {
              const card = document.createElement("div");
              card.className = "card-produk";

              card.innerHTML =
                "<b>" + p.product_name + "</b><br>" +
                "<small>Rp" + p.price + "</small>";

              card.onclick = () => {
                selectedSku = p.buyer_sku_code;

                document.querySelectorAll(".card-produk").forEach(c => {
                  c.classList.remove("active");
                });

                card.classList.add("active");
              };

              container.appendChild(card);
            });

          } catch (err) {
            container.innerHTML = "Gagal load produk";
            console.log("ERROR:", err);
          }
        }

        async function reloadData() {
          const hasil = document.getElementById("hasil");
          hasil.innerText = "⏳ Reload data...";

          const res = await fetch("/reload");
          const data = await res.json();

          hasil.innerText = data.message;
        }

        function order() {
          const userId = document.getElementById("userId").value;
          const sku = selectedSku;
          const btn = document.getElementById("btnOrder");

          if (!userId || !sku) {
            alert("Isi user ID dan pilih produk!");
            return;
          }

          btn.disabled = true;
          btn.innerText = "Memproses...";

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

            selectedSku = "";
            document.getElementById("produkList").innerHTML = "";
            document.getElementById("userId").value = "";

            btn.disabled = false;
            btn.innerText = "Kirim Order";
          })
          .catch(() => {
            btn.disabled = false;
            btn.innerText = "Kirim Order";
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

app.get("/products/:brand", (req, res) => {
  const brand = req.params.brand;

  // kalau cache kosong
  if (!Array.isArray(cachedProducts) || cachedProducts.length === 0) {
    return res.json([]);
  }

  const products = cachedProducts.filter(p =>
    p.brand &&
    p.brand.toLowerCase().includes(brand.toLowerCase()) &&
    p.category === "Games" &&
    p.buyer_product_status &&
    p.seller_product_status
  );

  res.json(products);
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

app.get("/reload", async (req, res) => {
  await loadPricelist();
  res.json({ status: "success", message: "Pricelist berhasil di-refresh" });
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

  // 🔥 WAJIB: load sekali saat start
  loadPricelist();
});