const { validationResult } = require("express-validator");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res
        .status(403)
        .json({ error: "El correo y/o la contraseña son incorrectos" });
    }

    const passwordCorrecto = await user.comparePassword(password);
    if (!passwordCorrecto) {
      return res
        .status(403)
        .json({ error: "El correo y/o la contraseña son incorrectos" });
    }

    const token = jwt.sign({ uid: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ login: true, userId: user.id, token });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const register = async (req, res) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    return res.status(422).json({ errors: result.array() });
  }

  const { email, password } = req.body;

  try {
    const user = new User({
      email,
      password,
    });

    await user.save();

    res.json({ register: true, userId: user.id });
  } catch (error) {
    res.status(500).json({ error });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(422).json({ error: "No existe el usuario" });
    }

    const secret = process.env.JWT_SECRET + user.password;

    const token = jwt.sign({ uid: user.id }, secret, { expiresIn: "15m" });

    var transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const link = `https://visual-detailing.vercel.app/reset/${user.id}?token=${token}`;

    let emailOptions = {
      from: "forgot.password@visualdetailing.com",
      to: user.email,
      subject: "Restablecer Contraseña - Visual-Detailing",
      html: `
			<h1> ¿Olvidaste tu contraseña? </h1>
			<p> ¡No te preocupes! Te enviamos un link para que puedas acceder a tu cuenta; el mismo será válido por sólo 15 minutos. </br>
			<a  data-bs-toggle="modal"
			data-bs-target="#olvideContrasenaForm" href= "${link}"> Hacé click acá para restablecer tu contraseña. </a>
			</br>
			¡Gracias por utilizar nuestros servicios!
			</br>
			Saludos,
			</br>
			El equipo de Visual-Detailing.</br>
			
			`,
    };

    transporter.sendMail(emailOptions, function (err, data) {
      if (err) {
        return res.status(500).json({ err });
      }
      return res.json({
        userId: user.id,
        send: true,
      });
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  const { id, token } = req.params;
  const { password } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(422).json({ error: "El usuario no existe" });
    }
    const secret = process.env.JWT_SECRET + user.password;
    const verified = jwt.verify(token, secret);
    if (verified) {
      user.password = password;
      await user.save();
    }

    res.json({
      userId: user.id,
      verified,
    });
  } catch (error) {
    if (error.message == "jwt expired") {
      return res.status(500).json({ error: "Token expirado" });
    }
    if (error.message == "invalid token") {
      return res.status(500).json({ error: "Token inválido" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  login,
  register,
  forgotPassword,
  resetPassword,
};
