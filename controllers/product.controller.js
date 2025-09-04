const Producto = require("../models/Producto");
const XLSX = require("xlsx");

const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;
    const totalProductsCount = await Producto.countDocuments();
    const productos = await Producto.find().skip(skip).limit(limit);

    res.json({
      products: productos,
      currentPage: page,
      totalPages: Math.ceil(totalProductsCount / limit),
      totalProducts: totalProductsCount,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Error interno del servidor" });
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
    const productFields = {};

    if (req.body.name) {
      productFields.name = req.body.name;
    }

    if (req.body.description) {
      productFields.description = req.body.description;
    }

    if (req.file && req.file.filename) {
      productFields.image = req.file.filename;
    }

    if (req.body.imageUrl) {
      productFields.image = req.body.imageUrl;
    }

    if (req.body.category) {
      productFields.category = req.body.category;
    }

    if (req.body.price) {
      productFields.price = req.body.price;
    }

    if (req.body.stock) {
      productFields.stock = req.body.stock;
    }

    if (req.body.capacity) {
      productFields.capacity = req.body.capacity;
    }

    if (req.body.brand) {
      productFields.brand = req.body.brand;
    }

    if (req.file && req.file.filename && req.body.imageUrl) {
      return res.status(400).json({
        error:
          "Solo puedes proporcionar una imagen o un enlace a la imagen, no ambos.",
      });
    }

    const producto = new Producto(productFields);

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

    if (req.body.imageUrl) {
      updatedFields.image = req.body.imageUrl;
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

    if (req.body.brand) {
      updatedFields.brand = req.body.brand;
    }

    if (req.file && req.file.filename && req.body.imageUrl) {
      return res.status(400).json({
        error:
          "Solo puedes proporcionar una imagen o un enlace a la imagen, no ambos.",
      });
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

const bulkUploadProducts = async (req, res) => {
  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const resultados = [];
    for (const producto of data) {
      // Busca por name, category y capacity
      const filtro = {
        name: producto.name,
        category: producto.category,
        capacity: producto.capacity,
        brand: producto.brand,
      };
      const actualizado = await Producto.findOneAndUpdate(filtro, producto, {
        upsert: true,
        new: true,
      });
      resultados.push(actualizado);
    }

    res.json({
      message: "Productos cargados/reemplazados",
      productos: resultados,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: err.message });
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
  bulkUploadProducts,
};
