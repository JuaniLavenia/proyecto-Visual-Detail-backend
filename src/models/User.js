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
	refreshToken: {
		type: String,
		default: null,
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

userSchema.methods.toJSON = function () {
	const obj = this.toObject();
	delete obj.password;
	delete obj.refreshToken;
	return obj;
};

const User = model("User", userSchema);

module.exports = User;