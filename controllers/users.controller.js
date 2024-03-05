const User = require("../models/User");

const getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.params.id, { email: 1, _id: 1 });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.status(200).json({ message: "Info del usuario", usuario: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el usuario" });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find({}, { email: 1, _id: 1 });
    res.status(200).json({ message: "Lista de usuarios", usuarios: users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los usuarios" });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).select({ email: 1, _id: 1 });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.status(200).json({ message: "Usuario modificado", usuario: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al modificar el usuario" });
  }
};

/*const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el usuario" });
  }
};*/

module.exports = {
  getUserInfo,
  getUsers,
  updateUser,
  //deleteUser,
};
