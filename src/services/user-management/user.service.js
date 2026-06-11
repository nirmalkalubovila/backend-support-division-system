const httpStatus = require('http-status');
const { User } = require('../../models');
const ApiError = require('../../utils/ApiError');

/**
 * Create a user
 */
const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already taken');
  }
  return User.create(userBody);
};

/**
 * Query users with pagination
 */
const queryUsers = async (filter, options) => {
  const users = await User.paginate({ ...filter, deletedAt: null }, options);
  return users;
};

/**
 * Get all users (no pagination)
 */
const getAllUsers = async () => {
  return User.find({ deletedAt: null }).select('-password').sort({ createdAt: -1 });
};

/**
 * Get user by ID
 */
const getUserById = async (id) => {
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

/**
 * Get user by email
 */
const getUserByEmail = async (email) => {
  return User.findOne({ email, deletedAt: null });
};

/**
 * Update user by ID
 */
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Soft delete user by ID
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  user.deletedAt = new Date();
  user.isActive = false;
  await user.save();
  return user;
};

module.exports = {
  createUser,
  queryUsers,
  getAllUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
};
