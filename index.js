require("dotenv").config();

const express = require("express");
const app = express();

const mongoose = require("mongoose");
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("mongoose conectado"))
  .catch((err) => console.log(err));

app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(express.json());

const cors = require("cors");

app.get("/", (req, res) => {
  res.send("Hola");
});

app.use(cors());
app.use("/api", require("./routes/users"));
app.use("/api", require("./routes/productos"));
app.use("/api", require("./routes/pedidos"));
app.use("/api", require("./routes/auth.router"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
