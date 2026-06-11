/**
 * Mongoose toJSON plugin — transforms _id and removes __v + sensitive fields
 */
const toJSON = (schema) => {
  schema.set('toJSON', {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret.__v;
      if (ret.password) delete ret.password;
      return ret;
    },
  });
};

module.exports = toJSON;
