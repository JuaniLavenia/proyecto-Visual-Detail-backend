const Producto = require("../models/Producto");

const getProducts = async (req, res) => {
  try {
    const productos = await Producto.find();

    res.json(productos);
  } catch (err) {
    console.log(err);
    return res.status(401).json({ error: err.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    console.log(producto);

    res.json(producto);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err.message });
  }
};

const postProduct = async (req, res) => {
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
    return res.status(400).json({ error: err.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const updatedFields = {};

    if (req.body.name) {
      updatedFields.name = req.body.name;
    }

    if (req.body.description) {
      updatedFields.description = req.body.description;
    }

    if (req.file && req.file.filename) {
      updatedFields.image = req.file.filename;
    }

    if (req.body.price) {
      updatedFields.price = req.body.price;
    }

    if (req.body.stock) {
      updatedFields.stock = req.body.stock;
    }

    if (req.body.capacity) {
      updatedFields.capacity = req.body.capacity;
    }

    if (req.body.category) {
      updatedFields.category = req.body.category;
    }

    const result = await Producto.findByIdAndUpdate(
      req.params.id,
      updatedFields,
      {
        new: true,
      }
    );

    res.json(result);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const result = await Producto.findByIdAndDelete(req.params.id);
    const msg = result ? "Registro borrado" : "No se encontro el registro";
    res.json({ msg });
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err.message });
  }
};

const searchFilter = async (req, res) => {
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
    return res.status(400).json({ error: err.message });
  }
};

const categoryFilter = async (req, res) => {
  const { filter } = req.params;

  try {
    const productos = await Producto.find({ category: { $regex: filter } });

    res.json(productos);
  } catch (error) {
    console.log(err);
    return res.status(400).json({ error: err.message });
  }
};

const brandFilter = async (req, res) => {
  const { filter } = req.params;

  try {
    const productos = await Producto.find({ brand: { $regex: filter } });

    res.json(productos);
  } catch (error) {
    console.log(err);
    return res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  postProduct,
  updateProduct,
  deleteProduct,
  searchFilter,
  categoryFilter,
  brandFilter,
};
