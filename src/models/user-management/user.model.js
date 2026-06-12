const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const toJSON = require('../plugins/toJSON.plugin');
const paginate = require('../plugins/paginate.plugin');
const { roles } = require('../../config/roles');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      private: true, // plugin toJSON removes this
    },
    role: {
      type: String,
      enum: roles,
      default: 'engineer',
    },
    permissions: {
      type: [String],
      default: [],
    },
    avatar: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    designation: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Plugins
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

/**
 * Check if email is taken
 * @param {string} email
 * @param {ObjectId} [excludeUserId] - The user ID to exclude
 * @returns {Promise<boolean>}
 */
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId }, deletedAt: null });
  return !!user;
};

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (password) {
  const user = this;
  return bcrypt.compare(password, user.password);
};

// Hash password before save
userSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
  next();
});

// Chain custom toJSON transform to populate role rights in permissions array for frontend usage
userSchema.options.toJSON = {
  transform: (doc, ret) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    delete ret.__v;
    delete ret.password;
    
    // Dynamic import to avoid circular dependencies
    const { roleRights } = require('../../config/roles');
    const rights = roleRights.get(ret.role) || [];
    ret.permissions = Array.from(new Set([...(ret.permissions || []), ...rights]));
    
    return ret;
  }
};

const User = mongoose.model('User', userSchema);

module.exports = User;
