const express = require("express");
const Producto = require("../models/Producto");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/img/productos");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

router.get("/productos", async (req, res) => {
  try {
    const productos = await Producto.find();

    res.json(productos);
  } catch (err) {
    console.log(err);
    return res.status(401).json({ error: err.message });
  }
});

router.get("/productos/:id", async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    console.log(producto);

    res.json(producto);
  } catch (err) {
    console.log(err);
  }
});

router.post("/productos", upload.single("image"), async (req, res) => {
  console.log(req.body, req.file);

  try {
    const producto = new Producto({
      name: req.body.name,
      description: req.body.description,
      image: req.file.filename,
      category: req.body.category,
      price: req.body.price,
      stock: req.body.stock,
      capacity: req.body.capacity,
    });

    const result = await producto.save();

    res.json(result);
  } catch (err) {
    console.log(err);
  }
});

router.put("/productos/:id", upload.single("image"), async (req, res) => {
  try {
    const result = await Producto.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        description: req.body.description,
        image: req.file.filename,
        price: req.body.price,
        stock: req.body.stock,
        capacity: req.body.capacity,
        category: req.body.category,
      },
      {
        new: true,
      }
    );
    res.json(result);
  } catch (err) {
    console.log(err);
  }
});

router.delete("/productos/:id", async (req, res) => {
  try {
    const result = await Producto.findByIdAndDelete(req.params.id);
    const msg = result ? "Registro borrado" : "No se encontro el registro";
    res.json({ msg });
  } catch (err) {
    console.log(err);
  }
});

router.get("/productos/search/:filter", async (req, res) => {
  const { filter } = req.params;

  try {
    let productos;
    if (!filter) {
      productos = await Producto.find();
    } else {
      productos = await Producto.find({
        name: { $regex: filter, $options: "i" },
      });
    }

    res.json(productos);
  } catch (error) {
    console.log(err);
  }
});

router.get("/productos/category/:filter", async (req, res) => {
  const { filter } = req.params;

  try {
    const productos = await Producto.find({ category: { $regex: filter } });

    res.json(productos);
  } catch (error) {
    console.log(err);
  }
});

router.get("/productos/brand/:filter", async (req, res) => {
  const { filter } = req.params;

  try {
    const productos = await Producto.find({ brand: { $regex: filter } });

    res.json(productos);
  } catch (error) {
    console.log(err);
  }
});

module.exports = router;
