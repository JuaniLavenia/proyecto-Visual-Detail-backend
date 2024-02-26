const bcrypt = require("bcryptjs");
const { Schema, model } = require("mongoose");

const userSchema = new Schema({
	email: {
		type: String,
		required: true,
		trim: true,
		unique: true,
		lowercase: true,
		index: { unique: true },
	},
	password: {
		type: String,
		required: true,
	},
});

userSchema.pre("save", async function () {
	try {
		this.password = await bcrypt.hash(this.password, 12);
	} catch (error) {
		console.log(error);
	}
});

userSchema.methods.comparePassword = async function (password) {
	return await bcrypt.compare(password, this.password);
};

userSchema.methods.comparePassword = async function (password) {
	return await bcrypt.compare(password, this.password);
};

const User = model("User", userSchema);

module.exports = User;
